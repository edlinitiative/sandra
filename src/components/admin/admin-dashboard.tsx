'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';

const ADMIN_KEY_STORAGE = 'sandra_admin_api_key';

interface Repo {
  owner: string;
  name: string;
  displayName: string;
  description: string | null;
  url: string;
  branch: string;
  docsPath: string | null;
  isActive: boolean;
  syncStatus: 'not_indexed' | 'indexing' | 'indexed' | 'error';
  lastIndexedAt: string | null;
  indexedDocumentCount: number;
}

interface HealthData {
  name: string;
  version: string;
  status: string;
  checks: Record<string, string>;
  summary: {
    repos: {
      total: number | null;
      active: number | null;
      indexed: number | null;
      indexing: number | null;
      error: number | null;
    };
    tools: {
      registered: string[];
      count: number;
    };
    knowledge: {
      indexedSources: number | null;
      indexedDocuments: number | null;
      vectorStoreChunks: number | null;
    };
  };
}

interface TestResult {
  response: string;
  language: string;
  toolsUsed: string[];
  demoMode?: boolean;
  usage?: { totalTokens: number };
}

export function AdminDashboard() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [indexing, setIndexing] = useState<string | null>(null);
  const [indexResult, setIndexResult] = useState<string | null>(null);
  const [adminKey, setAdminKey] = useState('');
  const [adminKeyDraft, setAdminKeyDraft] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [dbUnavailable, setDbUnavailable] = useState(false);

  // Test chat state
  const [testMessage, setTestMessage] = useState('');
  const [testLanguage, setTestLanguage] = useState('en');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // Initial admin bootstrap should run once on mount; follow-up refreshes are explicit.
  useEffect(() => {
    let storedKey = '';

    try {
      storedKey = sessionStorage.getItem(ADMIN_KEY_STORAGE) ?? '';
    } catch {
      storedKey = '';
    }

    if (storedKey) {
      setAdminKey(storedKey);
      setAdminKeyDraft(storedKey);
      void loadData(storedKey);
      return;
    }

    void loadHealth();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadHealth() {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealth(data as HealthData);
    } catch {
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAdminJson(path: string, init: RequestInit = {}, key = adminKey) {
    const headers = new Headers(init.headers);
    headers.set('Content-Type', 'application/json');
    if (key) {
      headers.set('x-api-key', key);
    }

    const response = await fetch(path, {
      ...init,
      headers,
    });

    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorBody = json as { error?: { code?: string; message?: string } };
      const code = errorBody?.error?.code ?? '';
      const message = errorBody?.error?.message ?? 'Admin request failed';

      // Distinguish database connectivity errors from auth/other errors
      if (response.status === 503 || code === 'DATABASE_UNAVAILABLE') {
        const err = new Error(message);
        (err as Error & { isDbError: boolean }).isDbError = true;
        throw err;
      }

      throw new Error(message);
    }

    return json as { data?: unknown };
  }

  async function loadRepos(key = adminKey) {
    if (!key) {
      setRepos([]);
      return;
    }

    const reposRes = await fetchAdminJson('/api/repos', undefined, key);
    const data = reposRes.data as { repos?: Repo[] } | undefined;
    setRepos(data?.repos ?? []);
  }

  async function loadData(key = adminKey) {
    setLoading(true);
    setAuthError(null);
    setDbUnavailable(false);
    try {
      await Promise.all([loadHealth(), loadRepos(key)]);
    } catch (err) {
      setRepos([]);
      if (err instanceof Error && (err as Error & { isDbError?: boolean }).isDbError) {
        // DB is down — key is still valid, just show a banner
        setAdminKey(key);
        try { sessionStorage.setItem(ADMIN_KEY_STORAGE, key); } catch { /* ignore */ }
        setDbUnavailable(true);
      } else {
        setAuthError(err instanceof Error ? err.message : 'Failed to load admin data');
      }
      setLoading(false);
    }
  }

  async function saveAdminKey() {
    if (!adminKeyDraft.trim()) {
      setAuthError('Enter an admin API key to access repository controls.');
      return;
    }

    setLoading(true);
    setAuthError(null);

    try {
      const normalizedKey = adminKeyDraft.trim();
      await loadRepos(normalizedKey);
      setAdminKey(normalizedKey);
      try {
        sessionStorage.setItem(ADMIN_KEY_STORAGE, normalizedKey);
      } catch {
        // Ignore storage errors
      }
      await loadHealth();
    } catch (err) {
      if (err instanceof Error && (err as Error & { isDbError?: boolean }).isDbError) {
        // DB is down but key may be valid — store it and show a banner
        setAdminKey(adminKeyDraft.trim());
        try { sessionStorage.setItem(ADMIN_KEY_STORAGE, adminKeyDraft.trim()); } catch { /* ignore */ }
        setDbUnavailable(true);
        await loadHealth();
      } else {
        setAdminKey('');
        setRepos([]);
        setAuthError(err instanceof Error ? err.message : 'Invalid admin API key');
        try {
          sessionStorage.removeItem(ADMIN_KEY_STORAGE);
        } catch {
          // Ignore storage errors
        }
      }
      setLoading(false);
    }
  }

  function clearAdminKey() {
    setAdminKey('');
    setAdminKeyDraft('');
    setRepos([]);
    setAuthError(null);
    setDbUnavailable(false);
    try {
      sessionStorage.removeItem(ADMIN_KEY_STORAGE);
    } catch {
      // Ignore storage errors
    }
  }

  async function sendTestMessage() {
    if (!testMessage.trim()) return;
    setTestLoading(true);
    setTestResult(null);
    setTestError(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: testMessage,
          language: testLanguage,
          channel: 'web',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTestError(data.error?.message ?? 'Request failed');
      } else {
        setTestResult(data.data);
      }
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setTestLoading(false);
    }
  }

  async function triggerIndex(owner?: string, name?: string) {
    if (!adminKey) {
      setAuthError('Enter an admin API key before indexing repositories.');
      return;
    }

    const key = owner && name ? `${owner}/${name}` : 'all';
    setIndexing(key);
    setIndexResult(null);

    try {
      const body = owner && name ? { repoId: `${owner}/${name}` } : {};
      const data = await fetchAdminJson(
        '/api/index',
        {
        method: 'POST',
        body: JSON.stringify(body),
        },
        adminKey,
      );

      const payload = data.data as {
        results?: Array<{ chunksCreated: number }>;
        summary?: { total: number; completed: number; failed: number; status: string };
      } | undefined;
      const results = payload?.results ?? [];
      const summary = payload?.summary;
      const totalChunks = results.reduce((sum, result) => sum + result.chunksCreated, 0);
      const failureSuffix = summary && summary.failed > 0
        ? `, ${summary.failed} failed`
        : '';

      setIndexResult(
        `Indexed ${summary?.completed ?? results.length}/${summary?.total ?? results.length} repo(s), ${totalChunks} chunks created${failureSuffix}.`,
      );
      await loadData(adminKey);
    } catch (err) {
      setIndexResult(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIndexing(null);
    }
  }

  function formatMetric(value: number | null): string {
    return value === null ? '—' : String(value);
  }

  function syncStatusVariant(syncStatus: Repo['syncStatus']): 'default' | 'success' | 'warning' | 'error' | 'info' {
    switch (syncStatus) {
      case 'indexed':
        return 'success';
      case 'indexing':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sandra Admin</h1>
        <p className="mt-1 text-gray-500">Manage repositories, indexing, and system status.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Admin Access</CardTitle>
          <CardDescription>
            Enter the admin API key to unlock repository status and indexing controls.
          </CardDescription>
        </CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            type="password"
            value={adminKeyDraft}
            onChange={(e) => setAdminKeyDraft(e.target.value)}
            placeholder="Enter ADMIN_API_KEY"
            error={authError ?? undefined}
          />
          <Button onClick={saveAdminKey} className="sm:w-auto">
            Save Key
          </Button>
          {adminKey && (
            <Button variant="secondary" onClick={clearAdminKey} className="sm:w-auto">
              Clear Key
            </Button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-gray-500">
          <Badge variant={adminKey ? 'success' : 'warning'}>
            {adminKey ? 'Authenticated' : 'Read-only'}
          </Badge>
          {authError && <span>{authError}</span>}
        </div>
      </Card>

      {/* Database unavailable banner */}
      {dbUnavailable && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <span className="text-lg">⚠️</span>
            <div>
              <p className="font-medium text-amber-800">Database unavailable</p>
              <p className="mt-1 text-sm text-amber-700">
                Sandra is running without a database connection. Chat and tools work normally using
                built-in knowledge, but repository management and indexing require a running PostgreSQL
                database.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Health Status */}
      {health && (
        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>Sandra v{health.version}</CardDescription>
          </CardHeader>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-500">Knowledge</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {formatMetric(health.summary.knowledge.indexedDocuments)}
              </p>
              <p className="text-xs text-gray-500">
                documents · {formatMetric(health.summary.knowledge.vectorStoreChunks)} vector chunks
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-500">Repositories</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {formatMetric(health.summary.repos.active)}/{formatMetric(health.summary.repos.total)}
              </p>
              <p className="text-xs text-gray-500">
                indexed {formatMetric(health.summary.repos.indexed)} · errors {formatMetric(health.summary.repos.error)}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-500">Tools</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{health.summary.tools.count}</p>
              <p className="text-xs text-gray-500">registered</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(health.checks).map(([name, value]) => (
              <Badge key={name} variant={value === 'ok' ? 'success' : 'warning'}>
                {name}: {value}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Index All Button */}
      <div className="flex items-center gap-4">
        <Button onClick={() => triggerIndex()} isLoading={indexing === 'all'} disabled={!adminKey}>
          Index All Repositories
        </Button>
        {indexResult && (
          <p className="text-sm text-gray-600">{indexResult}</p>
        )}
      </div>

      {/* Test Chat Panel */}
      <Card>
        <CardHeader>
          <CardTitle>Test Chat</CardTitle>
          <CardDescription>Send a test message to Sandra and inspect the response.</CardDescription>
        </CardHeader>
        <div className="space-y-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !testLoading && sendTestMessage()}
              placeholder="Type a test message..."
              className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-sandra-400 focus:outline-none focus:ring-2 focus:ring-sandra-100"
            />
            <select
              value={testLanguage}
              onChange={(e) => setTestLanguage(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-sandra-400 focus:outline-none"
            >
              <option value="en">🇺🇸 EN</option>
              <option value="fr">🇫🇷 FR</option>
              <option value="ht">🇭🇹 HT</option>
            </select>
            <Button onClick={sendTestMessage} isLoading={testLoading} size="sm">
              Send
            </Button>
          </div>

          {testError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {testError}
            </div>
          )}

          {testResult && (
            <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant={testResult.demoMode ? 'warning' : 'success'}>
                  {testResult.demoMode ? 'Demo Mode' : 'Live'}
                </Badge>
                <Badge variant="info">Lang: {testResult.language}</Badge>
                {testResult.usage && (
                  <Badge variant="default">{testResult.usage.totalTokens} tokens</Badge>
                )}
                {testResult.toolsUsed.length > 0 && (
                  <Badge variant="info">Tools: {testResult.toolsUsed.join(', ')}</Badge>
                )}
              </div>
              <div className="whitespace-pre-wrap text-sm text-gray-800">
                {testResult.response}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Repository List */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Registered Repositories</h2>
        {!adminKey ? (
          <Card>
            <p className="text-sm text-gray-600">
              Repository status and indexing controls unlock after you enter a valid admin key.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4">
          {repos.map((repo) => (
            <Card key={`${repo.owner}/${repo.name}`} className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">{repo.displayName}</h3>
                  <Badge variant={repo.isActive ? 'success' : 'default'}>
                    {repo.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  <Badge variant={syncStatusVariant(repo.syncStatus)}>
                    {repo.syncStatus}
                  </Badge>
                  <Badge variant={repo.indexedDocumentCount > 0 ? 'info' : 'default'}>
                    {repo.indexedDocumentCount} docs
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-gray-500">{repo.description ?? 'No description available.'}</p>
                <p className="mt-1 text-xs text-gray-400">
                  {repo.owner}/{repo.name} · {repo.branch}
                  {repo.docsPath ? ` · docs: ${repo.docsPath}` : ' · no docs path'}
                  {repo.lastIndexedAt ? ` · indexed ${new Date(repo.lastIndexedAt).toLocaleString()}` : ' · never indexed'}
                </p>
              </div>
              <div className="ml-4 shrink-0">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => triggerIndex(repo.owner, repo.name)}
                  isLoading={indexing === `${repo.owner}/${repo.name}`}
                  disabled={!adminKey}
                >
                  Index
                </Button>
              </div>
            </Card>
          ))}
          </div>
        )}
      </div>
    </div>
  );
}
