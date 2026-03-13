import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the client
const mockListDirectory = vi.fn();
const mockGetFileContent = vi.fn();
const mockGetReadme = vi.fn();

vi.mock('../client', () => ({
  getGitHubClient: () => ({
    listDirectory: mockListDirectory,
    getFileContent: mockGetFileContent,
    getReadme: mockGetReadme,
  }),
}));

import { fetchRepoDocuments, fetchRepoContent } from '../fetcher';
import type { RepoConfig } from '../types';

const testRepo: RepoConfig = {
  owner: 'edlight',
  name: 'academy',
  displayName: 'EdLight Academy',
  description: 'Educational platform',
  url: 'https://github.com/edlight/academy',
  branch: 'main',
  isActive: true,
};

describe('fetchRepoDocuments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetReadme.mockResolvedValue(null);
    mockListDirectory.mockResolvedValue([]);
    mockGetFileContent.mockResolvedValue(null);
  });

  it('returns empty array when no README and no docs', async () => {
    mockGetReadme.mockResolvedValue(null);
    mockListDirectory.mockResolvedValue([]);

    const docs = await fetchRepoDocuments(testRepo);
    expect(docs).toHaveLength(0);
  });

  it('includes README when available', async () => {
    mockGetReadme.mockResolvedValue({
      path: 'README.md',
      name: 'README.md',
      content: '# EdLight Academy\nWelcome!',
      sha: 'abc',
      size: 100,
      url: 'https://github.com/edlight/academy/blob/main/README.md',
    });
    mockListDirectory.mockResolvedValue([]);

    const docs = await fetchRepoDocuments(testRepo);
    expect(docs).toHaveLength(1);
    expect(docs[0]?.path).toBe('README.md');
    expect(docs[0]?.content).toContain('EdLight Academy');
  });

  it('fetches .md files from directory', async () => {
    mockGetReadme.mockResolvedValue(null);
    mockListDirectory.mockResolvedValue([
      { name: 'guide.md', path: 'guide.md', sha: 'def', size: 500, type: 'file', html_url: 'https://...', download_url: null },
      { name: 'index.ts', path: 'index.ts', sha: 'ghi', size: 200, type: 'file', html_url: 'https://...', download_url: null },
    ]);
    mockGetFileContent.mockResolvedValue({
      path: 'guide.md',
      name: 'guide.md',
      content: '# Guide',
      sha: 'def',
      size: 500,
      url: 'https://github.com/edlight/academy/blob/main/guide.md',
    });

    const docs = await fetchRepoDocuments(testRepo);
    expect(docs).toHaveLength(1);
    expect(docs[0]?.path).toBe('guide.md');
  });

  it('skips non-markdown files', async () => {
    mockGetReadme.mockResolvedValue(null);
    mockListDirectory.mockResolvedValue([
      { name: 'config.json', path: 'config.json', sha: 'x', size: 100, type: 'file', html_url: '', download_url: null },
      { name: 'styles.css', path: 'styles.css', sha: 'y', size: 200, type: 'file', html_url: '', download_url: null },
    ]);

    const docs = await fetchRepoDocuments(testRepo);
    expect(docs).toHaveLength(0);
    expect(mockGetFileContent).not.toHaveBeenCalled();
  });

  it('handles missing docsPath gracefully', async () => {
    mockGetReadme.mockResolvedValue(null);
    mockListDirectory.mockResolvedValue(null); // 404

    const docs = await fetchRepoDocuments({ ...testRepo, docsPath: 'nonexistent/' });
    expect(docs).toHaveLength(0);
  });

  it('deduplicates files (README not fetched twice)', async () => {
    mockGetReadme.mockResolvedValue({
      path: 'README.md',
      name: 'README.md',
      content: '# Readme',
      sha: 'abc',
      size: 100,
      url: 'https://github.com/edlight/academy/blob/main/README.md',
    });
    // Directory listing also returns README.md
    mockListDirectory.mockResolvedValue([
      { name: 'README.md', path: 'README.md', sha: 'abc', size: 100, type: 'file', html_url: 'https://...', download_url: null },
    ]);

    const docs = await fetchRepoDocuments(testRepo);
    // README should appear only once
    const readmeDocs = docs.filter((d) => d.path === 'README.md');
    expect(readmeDocs).toHaveLength(1);
  });
});

describe('fetchRepoContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetReadme.mockResolvedValue(null);
    mockListDirectory.mockResolvedValue([]);
    mockGetFileContent.mockResolvedValue(null);
  });

  it('returns empty array when no files found', async () => {
    const files = await fetchRepoContent(testRepo);
    expect(files).toHaveLength(0);
  });

  it('includes README when available', async () => {
    mockGetReadme.mockResolvedValue({
      path: 'README.md',
      name: 'README.md',
      content: '# Readme',
      sha: 'abc',
      size: 100,
      url: 'https://github.com/edlight/academy/blob/main/README.md',
    });

    const files = await fetchRepoContent(testRepo);
    expect(files.some((f) => f.path === 'README.md')).toBe(true);
  });

  it('handles null directory listing gracefully', async () => {
    mockListDirectory.mockResolvedValue(null);
    const files = await fetchRepoContent(testRepo);
    expect(Array.isArray(files)).toBe(true);
  });
});
