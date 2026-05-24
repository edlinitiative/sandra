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

const defaultHealth = {
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
};

const defaultRepos = {
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
};

describe('AdminDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockImplementation(async (input, init) => {
      const url = getUrl(input);

      if (url === '/api/health') {
        return jsonResponse(defaultHealth);
      }

      if (url === '/api/repos') {
        return jsonResponse(defaultRepos);
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

  it('renders admin dashboard title', async () => {
    const { AdminDashboard } = await import('../admin-dashboard');
    render(<AdminDashboard />);

    expect(await screen.findByText('Sandra Admin')).toBeInTheDocument();
  });

  it('loads and displays health data on mount', async () => {
    const { AdminDashboard } = await import('../admin-dashboard');
    render(<AdminDashboard />);

    expect(await screen.findByText('Sandra v1.0.0')).toBeInTheDocument();
    expect(screen.getByText('24')).toBeInTheDocument();
    expect(screen.getByText('database: ok')).toBeInTheDocument();
    expect(screen.getByText('vectorStore: ok')).toBeInTheDocument();
  });

  it('loads and displays repository data', async () => {
    const { AdminDashboard } = await import('../admin-dashboard');
    render(<AdminDashboard />);

    expect(await screen.findByText('EdLight Code')).toBeInTheDocument();
    expect(screen.getByText('Registered Repositories')).toBeInTheDocument();
  });

  it('does not show repo data when repos endpoint returns 401', async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = getUrl(input);

      if (url === '/api/health') {
        return jsonResponse(defaultHealth);
      }

      if (url === '/api/repos') {
        return jsonResponse({ error: { message: 'Unauthorized' } }, 401);
      }

      return jsonResponse({ error: { message: `Unhandled fetch for ${url}` } }, 500);
    });

    const { AdminDashboard } = await import('../admin-dashboard');
    render(<AdminDashboard />);

    expect(await screen.findByText('Sandra v1.0.0')).toBeInTheDocument();
    expect(screen.queryByText('EdLight Code')).not.toBeInTheDocument();
  });

  it('indexes all repositories and shows result', async () => {
    const { AdminDashboard } = await import('../admin-dashboard');
    render(<AdminDashboard />);

    expect(await screen.findByText('EdLight Code')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Index All Repositories'));

    expect(
      await screen.findByText('Indexed 1/1 repo(s), 8 chunks created.'),
    ).toBeInTheDocument();

    const indexCall = fetchMock.mock.calls.find(([request]) => getUrl(request) === '/api/index');
    expect(indexCall).toBeDefined();
  });
});
