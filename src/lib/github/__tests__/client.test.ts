import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock env config
vi.mock('@/lib/config', () => ({
  env: { GITHUB_TOKEN: 'test-token' },
}));

import { GitHubClient } from '../client';

describe('GitHubClient', () => {
  let client: GitHubClient;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GitHubClient('test-token');
    // Replace global fetch
    vi.stubGlobal('fetch', mockFetch);
  });

  function makeResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: vi.fn().mockResolvedValue(body),
      headers: {
        get: (key: string) => headers[key] ?? null,
      },
    };
  }

  describe('listDirectory', () => {
    it('returns file listing on success', async () => {
      const items = [
        { name: 'README.md', path: 'README.md', sha: 'abc', size: 1000, type: 'file', html_url: 'https://github.com/org/repo/blob/main/README.md', download_url: null },
        { name: 'docs', path: 'docs', sha: 'def', size: 0, type: 'dir', html_url: 'https://github.com/org/repo/tree/main/docs', download_url: null },
      ];
      mockFetch.mockResolvedValue(makeResponse(items));

      const result = await client.listDirectory('org', 'repo', '', 'main');
      expect(result).toHaveLength(2);
      expect(result![0]?.name).toBe('README.md');
    });

    it('returns null on 404', async () => {
      mockFetch.mockResolvedValue(makeResponse({}, 404));

      const result = await client.listDirectory('org', 'repo', 'nonexistent', 'main');
      expect(result).toBeNull();
    });

    it('throws ProviderError on 403 rate limit', async () => {
      mockFetch.mockResolvedValue(makeResponse({}, 403, { 'X-RateLimit-Reset': '1700000000' }));

      await expect(client.listDirectory('org', 'repo', '', 'main')).rejects.toThrow('rate limit');
    });

    it('throws ProviderError on other errors', async () => {
      mockFetch.mockResolvedValue(makeResponse({}, 500));

      await expect(client.listDirectory('org', 'repo', '', 'main')).rejects.toThrow();
    });
  });

  describe('getFileContent', () => {
    it('returns decoded file content on success', async () => {
      const content = Buffer.from('# Hello World\nThis is a doc.', 'utf-8').toString('base64');
      mockFetch.mockResolvedValue(makeResponse({
        path: 'README.md',
        name: 'README.md',
        content: content + '\n', // GitHub adds newline
        sha: 'abc123',
        size: 100,
        html_url: 'https://github.com/org/repo/blob/main/README.md',
      }));

      const file = await client.getFileContent('org', 'repo', 'README.md');
      expect(file).not.toBeNull();
      expect(file!.content).toContain('Hello World');
      expect(file!.path).toBe('README.md');
    });

    it('returns null on 404', async () => {
      mockFetch.mockResolvedValue(makeResponse({}, 404));

      const result = await client.getFileContent('org', 'repo', 'missing.md');
      expect(result).toBeNull();
    });

    it('throws ProviderError on 403', async () => {
      mockFetch.mockResolvedValue(makeResponse({}, 403));

      await expect(client.getFileContent('org', 'repo', 'README.md')).rejects.toThrow('rate limit');
    });
  });

  describe('getReadme', () => {
    it('returns README content on success', async () => {
      const content = Buffer.from('# My Project', 'utf-8').toString('base64');
      mockFetch.mockResolvedValue(makeResponse({
        path: 'README.md',
        name: 'README.md',
        content,
        sha: 'abc',
        size: 50,
        html_url: 'https://github.com/org/repo/blob/main/README.md',
      }));

      const readme = await client.getReadme('org', 'repo');
      expect(readme).not.toBeNull();
      expect(readme!.content).toContain('My Project');
    });

    it('returns null on 404', async () => {
      mockFetch.mockResolvedValue(makeResponse({}, 404));

      const readme = await client.getReadme('org', 'repo');
      expect(readme).toBeNull();
    });

    it('returns null on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const readme = await client.getReadme('org', 'repo');
      expect(readme).toBeNull();
    });
  });

  describe('healthCheck', () => {
    it('returns true when API is reachable', async () => {
      mockFetch.mockResolvedValue(makeResponse({ rate: { limit: 5000, remaining: 4999 } }));

      const healthy = await client.healthCheck();
      expect(healthy).toBe(true);
    });

    it('returns false when API is unreachable', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const healthy = await client.healthCheck();
      expect(healthy).toBe(false);
    });
  });
});
