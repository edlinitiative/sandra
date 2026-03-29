// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function getUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

describe('AdminDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    fetchMock.mockImplementation(async (input, init) => {
      const url = getUrl(input);

      if (url === '/api/health') {
        return jsonResponse({
          name: 'Sandra',
          version: '1.0.0',
          status: 'ok',
          timestamp: '2026-03-17T00:00:00.000Z',
          checks: { database: 'ok', vectorStore: 'ok' },
          summary: {
            repos: { total: 4, active: 4, indexed: 2, indexing: 1, error: 0 },
            tools: { count: 5, registered: ['searchKnowledgeBase'] },
            knowledge: { indexedSources: 4, indexedDocuments: 24, vectorStoreChunks: 120 },
          },
        });
      }

      if (url === '/api/repos') {
        return jsonResponse({
          data: {
            repos: [
              {
                owner: 'edlinitiative',
                name: 'code',
                displayName: 'EdLight Code',
                description: 'Coding courses',
                url: 'https://github.com/edlinitiative/code',
                branch: 'main',
                docsPath: 'docs',
                isActive: true,
                syncStatus: 'indexed',
                lastIndexedAt: '2026-03-17T00:00:00.000Z',
                indexedDocumentCount: 12,
              },
            ],
          },
        });
      }

      if (url === '/api/index') {
        return jsonResponse({
          data: {
            results: [{ chunksCreated: 8 }],
            summary: { total: 1, completed: 1, failed: 0, status: 'completed' },
          },
        });
      }

      return jsonResponse({ error: { message: `Unhandled fetch for ${url}` } }, 500);
    });

    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows read-only state before an admin key is provided', async () => {
    const { AdminDashboard } = await import('../admin-dashboard');
    render(<AdminDashboard />);

    expect(await screen.findByText('Read-only')).toBeInTheDocument();
    expect(
      screen.getByText('Repository status and indexing controls unlock after you enter a valid admin key.'),
    ).toBeInTheDocument();
  });

  it('saves an admin key and loads repository data with x-api-key', async () => {
    const { AdminDashboard } = await import('../admin-dashboard');
    render(<AdminDashboard />);

    const input = await screen.findByPlaceholderText('Enter ADMIN_API_KEY');
    fireEvent.change(input, { target: { value: 'super-secret-key' } });
    fireEvent.click(screen.getByText('Save Key'));

    expect(await screen.findByText('Authenticated')).toBeInTheDocument();
    expect(await screen.findByText('EdLight Code')).toBeInTheDocument();

    const repoCall = fetchMock.mock.calls.find(([request]) => getUrl(request) === '/api/repos');
    expect(repoCall).toBeDefined();
    expect(new Headers(repoCall?.[1]?.headers).get('x-api-key')).toBe('super-secret-key');
  });

  it('renders an explicit auth error when the admin key is invalid', async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = getUrl(input);

      if (url === '/api/health') {
        return jsonResponse({
          name: 'Sandra',
          version: '1.0.0',
          status: 'ok',
          timestamp: '2026-03-17T00:00:00.000Z',
          checks: { database: 'ok' },
          summary: {
            repos: { total: 4, active: 4, indexed: 2, indexing: 1, error: 0 },
            tools: { count: 5, registered: [] },
            knowledge: { indexedSources: 4, indexedDocuments: 24, vectorStoreChunks: 120 },
          },
        });
      }

      if (url === '/api/repos') {
        return jsonResponse({ error: { message: 'Invalid admin API key' } }, 401);
      }

      return jsonResponse({ error: { message: `Unhandled fetch for ${url}` } }, 500);
    });

    const { AdminDashboard } = await import('../admin-dashboard');
    render(<AdminDashboard />);

    const input = await screen.findByPlaceholderText('Enter ADMIN_API_KEY');
    fireEvent.change(input, { target: { value: 'wrong-key' } });
    fireEvent.click(screen.getByText('Save Key'));

    const errors = await screen.findAllByText('Invalid admin API key');
    expect(errors.length).toBeGreaterThan(0);
    expect(screen.getByText('Read-only')).toBeInTheDocument();
  });

  it('indexes all repositories with the saved admin key and an empty body', async () => {
    sessionStorage.setItem('sandra_admin_api_key', 'stored-admin-key');

    const { AdminDashboard } = await import('../admin-dashboard');
    render(<AdminDashboard />);

    expect(await screen.findByText('EdLight Code')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Index All Repositories'));

    expect(
      await screen.findByText('Indexed 1/1 repo(s), 8 chunks created.'),
    ).toBeInTheDocument();

    const indexCall = fetchMock.mock.calls.find(([request]) => getUrl(request) === '/api/index');
    expect(indexCall).toBeDefined();
    expect(new Headers(indexCall?.[1]?.headers).get('x-api-key')).toBe('stored-admin-key');
    expect(indexCall?.[1]?.body).toBe('{}');
  });
});
