import type { KnowledgeContentType, KnowledgePlatform } from './types';

const PLATFORM_ALIASES: Record<KnowledgePlatform, string[]> = {
  academy: ['academy', 'edlight academy'],
  code: ['code', 'edlight code'],
  news: ['news', 'edlight news'],
  initiative: ['initiative', 'edlight initiative'],
};

export function normalizePlatform(value?: string | null): KnowledgePlatform | undefined {
  if (!value) return undefined;

  const normalized = value.trim().toLowerCase();

  for (const [platform, aliases] of Object.entries(PLATFORM_ALIASES) as Array<[KnowledgePlatform, string[]]>) {
    if (aliases.includes(normalized)) {
      return platform;
    }
  }

  if (normalized.includes('academy')) return 'academy';
  if (normalized.includes('news')) return 'news';
  if (normalized.includes('initiative')) return 'initiative';
  if (normalized.includes('code')) return 'code';

  return undefined;
}

export function platformFromRepo(repoName: string, displayName?: string): KnowledgePlatform | undefined {
  return normalizePlatform(displayName) ?? normalizePlatform(repoName);
}

export function repoIdForPlatform(platform: KnowledgePlatform): string {
  switch (platform) {
    case 'academy':
      return 'edlinitiative/EdLight-Academy';
    case 'code':
      return 'edlinitiative/code';
    case 'news':
      return 'edlinitiative/EdLight-News';
    case 'initiative':
      return 'edlinitiative/EdLight-Initiative';
  }
}

export function displayNameForPlatform(platform: KnowledgePlatform): string {
  switch (platform) {
    case 'academy':
      return 'EdLight Academy';
    case 'code':
      return 'EdLight Code';
    case 'news':
      return 'EdLight News';
    case 'initiative':
      return 'EdLight Initiative';
  }
}

export function deriveContentType(
  path?: string | null,
  content = '',
  platform?: KnowledgePlatform,
): KnowledgeContentType {
  const normalizedPath = (path ?? '').toLowerCase();
  const normalizedContent = content.toLowerCase();

  if (normalizedPath.endsWith('readme.md') || normalizedPath === 'readme.md') {
    return 'repo_readme';
  }

  if (
    normalizedPath.includes('/courses/') ||
    normalizedPath.startsWith('courses/') ||
    normalizedContent.includes('course') ||
    normalizedContent.includes('curriculum') ||
    normalizedContent.includes('lesson') ||
    normalizedContent.includes('module')
  ) {
    return 'course';
  }

  if (
    normalizedPath.includes('program') ||
    normalizedPath.includes('scholar') ||
    normalizedPath.includes('intern') ||
    normalizedPath.includes('leadership') ||
    normalizedContent.includes('scholarship') ||
    normalizedContent.includes('internship') ||
    normalizedContent.includes('leadership program')
  ) {
    return 'program';
  }

  if (
    normalizedPath.includes('news') ||
    normalizedPath.includes('blog') ||
    normalizedPath.includes('announc') ||
    normalizedContent.includes('announcement') ||
    normalizedContent.includes('community update')
  ) {
    return 'news';
  }

  if (normalizedPath.includes('docs/') || normalizedPath.endsWith('.md') || normalizedPath.endsWith('.mdx')) {
    return 'documentation';
  }

  if (normalizedPath.match(/\.(ts|tsx|js|jsx|py|rb|go|rs|css|scss|html)$/)) {
    return 'code';
  }

  if (platform === 'news') return 'news';
  if (platform === 'initiative') return 'program';

  return 'general';
}

export function computePathPriority(path?: string | null, contentType?: KnowledgeContentType): number {
  const normalizedPath = (path ?? '').toLowerCase();

  if (normalizedPath.endsWith('readme.md') || normalizedPath === 'readme.md') {
    return 6;
  }

  if (normalizedPath.includes('/courses/') || normalizedPath.startsWith('courses/')) {
    return 6;
  }

  if (normalizedPath.includes('program') || normalizedPath.includes('scholar') || normalizedPath.includes('leadership')) {
    return 5;
  }

  if (normalizedPath.includes('docs/')) {
    return 4;
  }

  switch (contentType) {
    case 'course':
      return 5;
    case 'program':
      return 4;
    case 'repo_readme':
      return 6;
    case 'documentation':
      return 4;
    case 'news':
      return 4;
    default:
      return 2;
  }
}

export function metadataString(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = metadata?.[key];
  return typeof value === 'string' ? value : undefined;
}

export function metadataNumber(metadata: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = metadata?.[key];
  return typeof value === 'number' ? value : undefined;
}

export function inferPlatformFromChunk(args: {
  sourceId?: string;
  title?: string;
  path?: string;
  metadata?: Record<string, unknown>;
}): KnowledgePlatform | undefined {
  return (
    normalizePlatform(metadataString(args.metadata, 'platform')) ??
    normalizePlatform(metadataString(args.metadata, 'platformDisplayName')) ??
    normalizePlatform(metadataString(args.metadata, 'repo')) ??
    normalizePlatform(args.sourceId) ??
    normalizePlatform(args.title) ??
    normalizePlatform(args.path)
  );
}

export function inferContentTypeFromChunk(args: {
  path?: string;
  content?: string;
  metadata?: Record<string, unknown>;
  platform?: KnowledgePlatform;
}): KnowledgeContentType {
  const fromMetadata = metadataString(args.metadata, 'contentType');
  if (fromMetadata) {
    return fromMetadata as KnowledgeContentType;
  }

  return deriveContentType(args.path, args.content, args.platform);
}
