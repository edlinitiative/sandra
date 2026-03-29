import { retrieveContext } from './retrieval';
import type {
  KnowledgeContentType,
  KnowledgePlatform,
  RetrieveContextOptions,
  SearchResult,
} from './types';
import {
  computePathPriority,
  displayNameForPlatform,
  inferContentTypeFromChunk,
  inferPlatformFromChunk,
  metadataString,
  normalizePlatform,
  repoIdForPlatform,
} from './platform-metadata';

export interface InferredKnowledgeQueryContext {
  platform?: KnowledgePlatform;
  contentType?: KnowledgeContentType | KnowledgeContentType[];
  preferPaths: string[];
  minScore?: number;
}

export function inferKnowledgeQueryContext(query: string): InferredKnowledgeQueryContext {
  const normalized = query.toLowerCase();
  const preferPaths = new Set<string>(['README.md', 'docs/']);
  let platform: KnowledgePlatform | undefined;
  let contentType: KnowledgeContentType | KnowledgeContentType[] | undefined;

  if (normalized.includes('academy') || /(math|physics|economics|exam)/.test(normalized)) {
    platform = 'academy';
  } else if (
    normalized.includes('edlight code') ||
    /\b(code|coding|python|sql|javascript|web development)\b/.test(normalized)
  ) {
    platform = 'code';
  } else if (normalized.includes('news') || /(announcement|update|story)/.test(normalized)) {
    platform = 'news';
  } else if (
    normalized.includes('initiative') ||
    /(leadership|scholarship|program|internship|eslp)/.test(normalized)
  ) {
    platform = 'initiative';
  }

  if (/(course|courses|curriculum|lesson|module|learn)/.test(normalized)) {
    contentType = 'course';
    preferPaths.add('courses/');
    preferPaths.add('curriculum');
  } else if (/(program|scholarship|internship|leadership|eslp)/.test(normalized)) {
    contentType = 'program';
    preferPaths.add('program');
    preferPaths.add('leadership');
    preferPaths.add('scholar');
  } else if (/(news|announcement|update|story)/.test(normalized)) {
    contentType = 'news';
    preferPaths.add('news');
    preferPaths.add('announcement');
  }

  if (platform === 'academy' || platform === 'code') {
    preferPaths.add('docs/');
    preferPaths.add('courses/');
  }

  if (platform === 'initiative') {
    preferPaths.add('program');
    preferPaths.add('leadership');
  }

  if (platform === 'news') {
    preferPaths.add('news');
    preferPaths.add('blog');
  }

  return {
    platform,
    contentType,
    preferPaths: Array.from(preferPaths),
    minScore: contentType ? 0.18 : 0.22,
  };
}

export async function searchPlatformKnowledge(
  query: string,
  options: {
    platform?: KnowledgePlatform | string;
    repo?: string;
    contentType?: KnowledgeContentType | KnowledgeContentType[];
    preferPaths?: string[];
    topK?: number;
    minScore?: number;
  } = {},
): Promise<SearchResult[]> {
  const normalizedPlatform = normalizePlatform(options.platform);
  const inferred = inferKnowledgeQueryContext(query);
  const repo = options.repo ?? (normalizedPlatform ? repoIdForPlatform(normalizedPlatform) : undefined);
  const contentType = options.contentType ?? inferred.contentType;
  const preferPaths = options.preferPaths ?? inferred.preferPaths;

  const retrieveOptions: RetrieveContextOptions = {
    topK: options.topK ?? 6,
    minScore: options.minScore ?? inferred.minScore,
    filter: {
      repo,
      platform: normalizedPlatform ?? inferred.platform,
      contentType,
      preferPaths,
    },
  };

  return retrieveContext(query, retrieveOptions);
}

export function extractCourseMatches(
  results: SearchResult[],
  platform?: KnowledgePlatform,
): Array<{
  title: string;
  platform: KnowledgePlatform;
  level: 'beginner' | 'intermediate' | 'advanced' | 'general';
  beginner: boolean;
  description: string;
  path?: string;
}> {
  const matches = new Map<string, {
    title: string;
    platform: KnowledgePlatform;
    level: 'beginner' | 'intermediate' | 'advanced' | 'general';
    beginner: boolean;
    description: string;
    path?: string;
  }>();

  for (const result of results) {
    const chunkPlatform =
      platform ??
      inferPlatformFromChunk({
        sourceId: result.chunk.sourceId,
        title: result.chunk.title,
        path: result.chunk.path,
        metadata: result.chunk.metadata,
      });

    if (!chunkPlatform) continue;

    const candidates = [
      ...extractTitlesFromPath(result.chunk.path),
      ...extractHeadingCandidates(result.chunk.content),
    ];

    for (const candidate of candidates) {
      if (!looksLikeCourseTitle(candidate)) continue;

      const title = normalizeCandidateTitle(candidate);
      const key = `${chunkPlatform}:${title.toLowerCase()}`;

      if (matches.has(key)) continue;

      const description = summarizeChunk(result.chunk.content);
      const beginner = /(beginner|intro|introduction|fundamentals|basics|absolute beginner)/i.test(
        `${title} ${description}`,
      );
      const level =
        /(advanced|expert|deep dive)/i.test(`${title} ${description}`)
          ? 'advanced'
          : /(intermediate)/i.test(`${title} ${description}`)
            ? 'intermediate'
            : beginner
              ? 'beginner'
              : 'general';

      matches.set(key, {
        title,
        platform: chunkPlatform,
        level,
        beginner,
        description,
        path: result.chunk.path,
      });
    }
  }

  return Array.from(matches.values()).sort((left, right) => left.title.localeCompare(right.title));
}

export function extractProgramMatches(
  results: SearchResult[],
): Array<{
  name: string;
  type: 'leadership' | 'scholarship' | 'internship';
  description: string;
  path?: string;
}> {
  const matches = new Map<string, {
    name: string;
    type: 'leadership' | 'scholarship' | 'internship';
    description: string;
    path?: string;
  }>();

  for (const result of results) {
    const candidates = [
      ...extractTitlesFromPath(result.chunk.path),
      ...extractHeadingCandidates(result.chunk.content),
    ];

    for (const candidate of candidates) {
      if (!looksLikeProgramTitle(candidate)) continue;

      const name = normalizeCandidateTitle(candidate);
      const key = name.toLowerCase();

      if (matches.has(key)) continue;

      const description = summarizeChunk(result.chunk.content);
      const type =
        /scholar/i.test(`${name} ${description}`)
          ? 'scholarship'
          : /intern/i.test(`${name} ${description}`)
            ? 'internship'
            : 'leadership';

      matches.set(key, {
        name,
        type,
        description,
        path: result.chunk.path,
      });
    }
  }

  return Array.from(matches.values()).sort((left, right) => left.name.localeCompare(right.name));
}

export function buildGroundedDescription(
  results: SearchResult[],
  fallbackDescription: string,
): string {
  const topResult = results[0];
  if (!topResult) return fallbackDescription;

  const summary = summarizeChunk(topResult.chunk.content);
  return summary || fallbackDescription;
}

export function extractHighlights(results: SearchResult[], limit = 4): string[] {
  const highlights = new Set<string>();

  for (const result of results) {
    const candidates = extractHeadingCandidates(result.chunk.content);
    for (const candidate of candidates) {
      const normalized = normalizeCandidateTitle(candidate);
      if (!normalized || normalized.length > 90) continue;
      highlights.add(normalized);
      if (highlights.size >= limit) {
        return Array.from(highlights);
      }
    }
  }

  return Array.from(highlights);
}

export function listGroundingSources(results: SearchResult[]): string[] {
  return Array.from(
    new Set(
      results
        .map((result) => result.chunk.path ?? metadataString(result.chunk.metadata, 'repo') ?? result.chunk.sourceId)
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

export function fallbackPlatformDescription(platform: KnowledgePlatform): string {
  switch (platform) {
    case 'academy':
      return `${displayNameForPlatform(platform)} provides academic learning support for students, with courses and structured study resources.`;
    case 'code':
      return `${displayNameForPlatform(platform)} focuses on practical programming and coding skills.`;
    case 'news':
      return `${displayNameForPlatform(platform)} shares announcements, stories, and updates across the EdLight ecosystem.`;
    case 'initiative':
      return `${displayNameForPlatform(platform)} is the organizational hub for leadership programs, scholarships, and community work.`;
  }
}

function extractTitlesFromPath(path?: string): string[] {
  if (!path) return [];

  const normalized = path.replace(/\\/g, '/');
  const segments = normalized.split('/').filter(Boolean);
  const titles: string[] = [];

  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index]!;
    const previous = segments[index - 1];
    if (previous === 'courses' || previous === 'programs' || previous === 'scholarships') {
      titles.push(segment.replace(/\.[^.]+$/, ''));
    }
  }

  if (normalized.toLowerCase() === 'readme.md') {
    titles.push('README');
  }

  return titles;
}

function extractHeadingCandidates(content: string): string[] {
  const lines = content.split('\n');
  const candidates: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const headingMatch = trimmed.match(/^#{1,6}\s+(.+)/);
    if (headingMatch) {
      candidates.push(headingMatch[1]!);
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.+)/);
    if (bulletMatch) {
      candidates.push(bulletMatch[1]!);
      continue;
    }

    const numberedMatch = trimmed.match(/^\d+\.\s+(.+)/);
    if (numberedMatch) {
      candidates.push(numberedMatch[1]!);
    }
  }

  return candidates;
}

function looksLikeCourseTitle(candidate: string): boolean {
  return /(course|python|sql|web|math|physics|economics|leadership|exam|office|excel|powerpoint|design|fundamentals|basics)/i.test(
    candidate,
  );
}

function looksLikeProgramTitle(candidate: string): boolean {
  return /(program|scholarship|internship|leadership|fellowship|eslp)/i.test(candidate);
}

function normalizeCandidateTitle(candidate: string): string {
  return candidate
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function summarizeChunk(content: string): string {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#') && !line.startsWith('-') && !line.startsWith('*'));

  const summary = lines[0] ?? '';
  return summary.length > 260 ? `${summary.slice(0, 257)}...` : summary;
}
