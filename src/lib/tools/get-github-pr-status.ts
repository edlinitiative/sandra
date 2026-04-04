/**
 * getGithubPrStatus — fetch the status of a GitHub pull request.
 *
 * Returns PR metadata, review state (approved/changes-requested/pending),
 * CI check runs, and a merge-readiness summary.
 *
 * Required scopes: repos:read
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { getGitHubClient } from '@/lib/github/client';

const GITHUB_API = 'https://api.github.com';

const inputSchema = z.object({
  owner: z.string().min(1).describe("GitHub repository owner (user or org)"),
  repo: z.string().min(1).describe("Repository name"),
  pullNumber: z.number().int().positive().describe("Pull request number"),
});

const getGithubPrStatusTool: SandraTool = {
  name: 'getGithubPrStatus',
  description:
    "Check the status of a GitHub pull request: review approvals, requested changes, CI checks, and whether it is ready to merge. Use when the user asks about a PR's state, reviews, or CI results.",
  parameters: {
    type: 'object',
    properties: {
      owner: { type: 'string', description: 'Repository owner (GitHub user or org)' },
      repo: { type: 'string', description: 'Repository name' },
      pullNumber: { type: 'number', description: 'Pull request number' },
    },
    required: ['owner', 'repo', 'pullNumber'],
  },
  inputSchema,
  requiredScopes: ['repos:read'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);

    try {
      const client = getGitHubClient();
      const headers = (client as unknown as { headers: Record<string, string> }).headers;

      // Fetch PR details in parallel with reviews and check runs
      const [prRes, reviewsRes, checksRes] = await Promise.all([
        fetch(`${GITHUB_API}/repos/${params.owner}/${params.repo}/pulls/${params.pullNumber}`, { headers }),
        fetch(`${GITHUB_API}/repos/${params.owner}/${params.repo}/pulls/${params.pullNumber}/reviews`, { headers }),
        fetch(`${GITHUB_API}/repos/${params.owner}/${params.repo}/commits/`, { headers }).then(() => null).catch(() => null),
      ]);

      if (!prRes.ok) {
        if (prRes.status === 404) {
          return { success: false, data: null, error: `PR #${params.pullNumber} not found in ${params.owner}/${params.repo}.` };
        }
        return { success: false, data: null, error: `GitHub API error ${prRes.status} fetching PR.` };
      }

      const pr = await prRes.json() as {
        number: number;
        title: string;
        state: string;
        draft: boolean;
        merged: boolean;
        mergeable: boolean | null;
        mergeable_state: string;
        html_url: string;
        head: { ref: string; sha: string };
        base: { ref: string };
        user: { login: string };
        created_at: string;
        updated_at: string;
        body: string | null;
        additions: number;
        deletions: number;
        changed_files: number;
      };

      // Reviews
      let reviews: Array<{ user: { login: string }; state: string; submitted_at: string }> = [];
      if (reviewsRes.ok) {
        reviews = await reviewsRes.json() as typeof reviews;
      }

      // Deduplicate: keep latest review per reviewer
      const latestReviews = new Map<string, { state: string; submittedAt: string }>();
      for (const review of reviews) {
        if (['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(review.state)) {
          latestReviews.set(review.user.login, {
            state: review.state,
            submittedAt: review.submitted_at,
          });
        }
      }

      const approvals = [...latestReviews.values()].filter((r) => r.state === 'APPROVED').length;
      const changesRequested = [...latestReviews.values()].filter((r) => r.state === 'CHANGES_REQUESTED').length;

      // Fetch check runs for the head commit
      let checkRuns: Array<{ name: string; status: string; conclusion: string | null }> = [];
      const checksUrl = `${GITHUB_API}/repos/${params.owner}/${params.repo}/commits/${pr.head.sha}/check-runs`;
      const checkRunsRes = await fetch(checksUrl, { headers }).catch(() => null);
      if (checkRunsRes?.ok) {
        const data = await checkRunsRes.json() as { check_runs: typeof checkRuns };
        checkRuns = data.check_runs ?? [];
      }

      const failedChecks = checkRuns.filter((c) => c.conclusion === 'failure' || c.conclusion === 'timed_out');
      const pendingChecks = checkRuns.filter((c) => c.status === 'in_progress' || c.status === 'queued');
      const passedChecks = checkRuns.filter((c) => c.conclusion === 'success');

      // Merge readiness
      const isReadyToMerge =
        pr.state === 'open' &&
        !pr.draft &&
        approvals >= 1 &&
        changesRequested === 0 &&
        failedChecks.length === 0 &&
        pendingChecks.length === 0 &&
        pr.mergeable !== false;

      return {
        success: true,
        data: {
          pr: {
            number: pr.number,
            title: pr.title,
            state: pr.state,
            draft: pr.draft,
            merged: pr.merged,
            author: pr.user.login,
            sourceBranch: pr.head.ref,
            targetBranch: pr.base.ref,
            url: pr.html_url,
            createdAt: pr.created_at,
            updatedAt: pr.updated_at,
            changes: {
              additions: pr.additions,
              deletions: pr.deletions,
              files: pr.changed_files,
            },
          },
          reviews: {
            approvals,
            changesRequested,
            reviewers: Object.fromEntries(latestReviews),
          },
          checks: {
            total: checkRuns.length,
            passed: passedChecks.length,
            failed: failedChecks.length,
            pending: pendingChecks.length,
            failedNames: failedChecks.map((c) => c.name),
          },
          mergeability: {
            mergeable: pr.mergeable,
            mergeableState: pr.mergeable_state,
            readyToMerge: isReadyToMerge,
            blockers: [
              pr.draft ? 'PR is in draft mode' : null,
              changesRequested > 0 ? `${changesRequested} review(s) requesting changes` : null,
              approvals === 0 ? 'No approvals yet' : null,
              failedChecks.length > 0 ? `${failedChecks.length} CI check(s) failing` : null,
              pendingChecks.length > 0 ? `${pendingChecks.length} CI check(s) pending` : null,
              pr.mergeable === false ? 'Merge conflicts detected' : null,
            ].filter(Boolean),
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to fetch PR status: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  },
};

toolRegistry.register(getGithubPrStatusTool);
export { getGithubPrStatusTool };
