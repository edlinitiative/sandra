/**
 * Personalized recommendation engine.
 *
 * Combines user memory (stated interests, language, program engagement) with
 * knowledge-base retrieval to produce ranked course and program recommendations.
 *
 * Surfaced as the `getPersonalizedRecommendations` tool in the agent registry.
 */

import { getUserMemoryStore } from '@/lib/memory/user-memory';
import { retrieveContext } from './retrieval';
import type { SearchResult } from './types';
import { createLogger } from '@/lib/utils';
import type { SupportedLanguage } from '@/lib/i18n/types';

const log = createLogger('knowledge:recommendations');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RecommendationItem {
  title: string;
  platform: string;
  description: string;
  relevanceScore: number;
  reason: string;
}

export interface PersonalizedRecommendations {
  courses: RecommendationItem[];
  programs: RecommendationItem[];
  totalFound: number;
  basedOn: string[]; // Which memory keys influenced the recommendations
}

// ─── Interest extraction from user memory ─────────────────────────────────────

const INTEREST_MEMORY_KEYS = [
  'interests',
  'learning_interests',
  'program_interests',
  'preferred_platform',
  'goal',
  'occupation',
  'education_level',
];

async function getUserInterests(userId: string): Promise<{
  interests: string[];
  memoryKeysUsed: string[];
}> {
  const store = getUserMemoryStore();
  const memories = await store.getMemories(userId);

  const interests: string[] = [];
  const memoryKeysUsed: string[] = [];

  for (const mem of memories) {
    if (INTEREST_MEMORY_KEYS.includes(mem.key)) {
      interests.push(mem.value);
      memoryKeysUsed.push(mem.key);
    }
  }

  return { interests, memoryKeysUsed };
}

// ─── Platform + content type mapping ─────────────────────────────────────────

function classifyResult(result: SearchResult): { platform: string; type: 'course' | 'program' | 'other' } {
  const meta = result.chunk.metadata ?? {};
  const platform = (typeof meta.platform === 'string' ? meta.platform : '').toLowerCase();
  const contentType = typeof meta.contentType === 'string' ? meta.contentType : '';

  const isProgram = ['eslp', 'nexus', 'initiative', 'labs'].some((p) => platform.includes(p)) ||
    ['program', 'application', 'leadership', 'exchange'].some((kw) => contentType.includes(kw));

  const isCourse = ['academy', 'code'].some((p) => platform.includes(p)) ||
    ['course', 'lesson', 'module', 'track'].some((kw) => contentType.includes(kw));

  return {
    platform: platform || 'edlight',
    type: isProgram ? 'program' : isCourse ? 'course' : 'other',
  };
}

function buildRecommendationItem(
  result: SearchResult,
  interests: string[],
): RecommendationItem {
  const { platform, type } = classifyResult(result);
  const title = result.chunk.title ?? result.chunk.path ?? 'EdLight Content';
  const description = result.chunk.content.slice(0, 200).replace(/\n+/g, ' ').trim();

  // Build reason from user interests
  const matchedInterest = interests.find((interest) =>
    result.chunk.content.toLowerCase().includes((interest.toLowerCase().split(' ')[0]) ?? ''),
  );
  const reason = matchedInterest
    ? `Matches your interest in "${matchedInterest}"`
    : `Relevant to your learning profile on ${platform}`;

  return {
    title,
    platform,
    description: description + (description.length >= 200 ? '…' : ''),
    relevanceScore: Math.round(result.score * 100) / 100,
    reason,
  };

  void type; // used for classification routing above
}

// ─── Main recommendation function ────────────────────────────────────────────

/**
 * Generate personalized content recommendations for a user.
 *
 * @param userId   Sandra user ID (from Prisma User table)
 * @param query    Optional explicit query to guide retrieval (e.g. "learn Python")
 * @param language User's language preference
 */
export async function getPersonalizedRecommendations(
  userId: string,
  query?: string,
  language?: SupportedLanguage,
): Promise<PersonalizedRecommendations> {
  log.info('Generating recommendations', { userId, query });

  // 1. Load user interests from memory
  const { interests, memoryKeysUsed } = await getUserInterests(userId);

  // 2. Build retrieval query — combine explicit query with user interests
  const retrievalQuery = [
    query,
    interests.slice(0, 3).join(' '),
    'EdLight courses programs learn',
  ]
    .filter(Boolean)
    .join(' ');

  // 3. Retrieve relevant knowledge
  let results: SearchResult[] = [];
  try {
    results = await retrieveContext(retrievalQuery, {
      topK: 12,
      minScore: 0.15,
    });
  } catch (error) {
    log.warn('Retrieval failed for recommendations', {
      error: error instanceof Error ? error.message : 'unknown',
    });
  }

  // 4. Classify and build recommendation items
  const courses: RecommendationItem[] = [];
  const programs: RecommendationItem[] = [];
  const seen = new Set<string>();

  for (const result of results) {
    const { type } = classifyResult(result);
    const key = result.chunk.title ?? result.chunk.path ?? result.chunk.content.slice(0, 50);

    if (seen.has(key)) continue;
    seen.add(key);

    const item = buildRecommendationItem(result, interests);
    if (type === 'course') {
      courses.push(item);
    } else if (type === 'program') {
      programs.push(item);
    }

    if (courses.length >= 5 && programs.length >= 3) break;
  }

  // 5. Sort by relevance score
  courses.sort((a, b) => b.relevanceScore - a.relevanceScore);
  programs.sort((a, b) => b.relevanceScore - a.relevanceScore);

  log.info('Recommendations generated', {
    userId,
    courses: courses.length,
    programs: programs.length,
    basedOnInterests: interests.length,
  });

  void language; // used for future i18n scoring

  return {
    courses: courses.slice(0, 5),
    programs: programs.slice(0, 3),
    totalFound: results.length,
    basedOn: memoryKeysUsed,
  };
}
