/**
 * createGithubIssue — open a new GitHub issue via the GitHub API.
 *
 * Uses the app-level GitHubClient (GITHUB_TOKEN env var). Can assign labels,
 * set an assignee, and optionally set a milestone.
 *
 * Required scopes: admin:tools
 */

import { z } from 'zod';
import type { SandraTool, ToolResult, ToolContext } from './types';
import { toolRegistry } from './registry';
import { getGitHubClient } from '@/lib/github/client';
import { logAuditEvent } from '@/lib/audit';

const GITHUB_API = 'https://api.github.com';

const inputSchema = z.object({
  owner: z.string().min(1).describe("GitHub repository owner (user or org)"),
  repo: z.string().min(1).describe("Repository name"),
  title: z.string().min(1).max(256).describe("Issue title"),
  body: z.string().optional().describe("Issue description (Markdown supported)"),
  labels: z
    .array(z.string())
    .optional()
    .describe("Labels to attach, e.g. ['bug', 'high-priority']"),
  assignee: z
    .string()
    .optional()
    .describe("GitHub username to assign the issue to"),
  milestone: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Milestone number to associate with the issue"),
});

const createGithubIssueTool: SandraTool = {
  name: 'createGithubIssue',
  description:
    "Create a new GitHub issue in a repository. Use when the user asks to file a bug, create a task, or open an issue on GitHub. Supports labels, assignees, and milestones.",
  parameters: {
    type: 'object',
    properties: {
      owner: { type: 'string', description: 'Repository owner (GitHub user or org)' },
      repo: { type: 'string', description: 'Repository name' },
      title: { type: 'string', description: 'Issue title' },
      body: { type: 'string', description: 'Issue description (Markdown)' },
      labels: { type: 'array', items: { type: 'string' }, description: 'Labels to attach' },
      assignee: { type: 'string', description: 'GitHub username to assign' },
      milestone: { type: 'number', description: 'Milestone number' },
    },
    required: ['owner', 'repo', 'title'],
  },
  inputSchema,
  requiredScopes: ['admin:tools'],

  async handler(input: unknown, context: ToolContext): Promise<ToolResult> {
    const params = inputSchema.parse(input);
    const userId = context.userId;

    if (!userId) {
      return { success: false, data: null, error: 'Authentication required.' };
    }

    try {
      const client = getGitHubClient();
      // Access private headers via bracket notation (they are set in constructor)
      const headers = (client as unknown as { headers: Record<string, string> }).headers;

      const body: Record<string, unknown> = { title: params.title };
      if (params.body) body.body = params.body;
      if (params.labels?.length) body.labels = params.labels;
      if (params.assignee) body.assignees = [params.assignee];
      if (params.milestone) body.milestone = params.milestone;

      const url = `${GITHUB_API}/repos/${params.owner}/${params.repo}/issues`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.status === 401) {
        return { success: false, data: null, error: 'GitHub token is invalid or missing.' };
      }
      if (response.status === 403) {
        return { success: false, data: null, error: 'GitHub token lacks permission to create issues.' };
      }
      if (response.status === 404) {
        return { success: false, data: null, error: `Repository ${params.owner}/${params.repo} not found or no access.` };
      }
      if (response.status === 410) {
        return { success: false, data: null, error: 'Issues are disabled for this repository.' };
      }
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return {
          success: false,
          data: null,
          error: `GitHub API error ${response.status}: ${(err as { message?: string }).message ?? 'unknown'}`,
        };
      }

      const issue = await response.json() as {
        number: number; title: string; html_url: string; state: string; created_at: string;
      };

      await logAuditEvent({
        userId, sessionId: context.sessionId, action: 'github_action',
        resource: 'createGithubIssue',
        details: { owner: params.owner, repo: params.repo, issueNumber: issue.number, title: issue.title },
        success: true,
      }).catch(() => {});

      return {
        success: true,
        data: {
          issueNumber: issue.number,
          title: issue.title,
          url: issue.html_url,
          state: issue.state,
          createdAt: issue.created_at,
          confirmation: `Issue #${issue.number} created: ${issue.html_url}`,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Failed to create GitHub issue: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  },
};

toolRegistry.register(createGithubIssueTool);
export { createGithubIssueTool };
