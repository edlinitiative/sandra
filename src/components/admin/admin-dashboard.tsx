'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';

const ADMIN_KEY_STORAGE = 'sandra_admin_api_key';

type AdminTab = 'system' | 'analytics' | 'actions';

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

interface AnalyticsSummary {
  totalEvents: number;
  byEventType: Record<string, number>;
  byChannel: Record<string, number>;
  byLanguage: Record<string, number>;
  topTools: Array<{ tool: string; count: number }>;
  averageResponseMs: number | null;
  cacheHitRate: number | null;
  period: { from: string; to: string };
}

interface ActionEntry {
  id: string;
  userId: string | null;
  sessionId: string | null;
  channel: string;
  tool: string;
  input: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
  requiresApproval: boolean;
  requestedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
}

interface TestResult {
  response: string;
  language: string;
  toolsUsed: string[];
  demoMode?: boolean;
  usage?: { totalTokens: number };
}

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTab>('system');
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

  // Analytics state
  const [analyticsData, setAnalyticsData] = useState<AnalyticsSummary | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [analyticsFrom, setAnalyticsFrom] = useState(() => {
    const d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  });
  const [analyticsTo, setAnalyticsTo] = useState(() => new Date().toISOString().slice(0, 10));

  // Actions state
  const [actions, setActions] = useState<ActionEntry[]>([]);
  const [actionsTotal, setActionsTotal] = useState(0);
  const [actionsLoading, setActionsLoading] = useState(false);
  const [actionsError, setActionsError] = useState<string | null>(null);
  const [actionsFilter, setActionsFilter] = useState<'pending' | 'all'>('pending');
  const [actionProcessing, setActionProcessing] = useState<string | null>(null);

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

  // Load tab-specific data when switching tabs
  useEffect(() => {
    if (!adminKey) return;
    if (activeTab === 'analytics') {
      void loadAnalytics(analyticsFrom, analyticsTo, adminKey);
    } else if (activeTab === 'actions') {
      void loadActions(actionsFilter, adminKey);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, adminKey]);

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

  const loadAnalytics = useCallback(async (from: string, to: string, key: string) => {
    if (!key) return;
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const res = await fetch(`/api/analytics?from=${from}&to=${to}T23:59:59`, {
        headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
      });
      const json = await res.json() as { data?: AnalyticsSummary; error?: { message?: string } };
      if (!res.ok) {
        setAnalyticsError(json.error?.message ?? 'Failed to load analytics');
      } else {
        setAnalyticsData(json.data ?? null);
      }
    } catch (err) {
      setAnalyticsError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  const loadActions = useCallback(async (filter: 'pending' | 'all', key: string) => {
    if (!key) return;
    setActionsLoading(true);
    setActionsError(null);
    try {
      const status = filter === 'pending' ? '?status=pending' : '';
      const res = await fetch(`/api/actions${status}`, {
        headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
      });
      const json = await res.json() as { data?: { actions: ActionEntry[]; total: number }; error?: { message?: string } };
      if (!res.ok) {
        setActionsError(json.error?.message ?? 'Failed to load actions');
      } else {
        setActions(json.data?.actions ?? []);
        setActionsTotal(json.data?.total ?? 0);
      }
    } catch (err) {
      setActionsError(err instanceof Error ? err.message : 'Failed to load actions');
    } finally {
      setActionsLoading(false);
    }
  }, []);

  const handleApproveAction = async (id: string) => {
    setActionProcessing(id);
    try {
      const res = await fetch(`/api/actions/${id}/approve`, {
        method: 'POST',
        headers: { 'x-api-key': adminKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewedBy: 'admin' }),
      });
      if (res.ok) {
        await loadActions(actionsFilter, adminKey);
      }
    } finally {
      setActionProcessing(null);
    }
  };

  const handleRejectAction = async (id: string) => {
    setActionProcessing(id);
    try {
      const res = await fetch(`/api/actions/${id}/reject`, {
        method: 'POST',
        headers: { 'x-api-key': adminKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewedBy: 'admin', reason: 'Rejected via admin UI' }),
      });
      if (res.ok) {
        await loadActions(actionsFilter, adminKey);
      }
    } finally {
      setActionProcessing(null);
    }
  };

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
      if (response.status === 503 || code === 'DATABASE_UNAVAILABLE' ||
          /Can't reach database server|Connection refused|ECONNREFUSED|database.*unavailable/i.test(message)) {
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
    setDbUnavailable(false);

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

      {/* Tab navigation */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
        {(['system', 'analytics', 'actions'] as AdminTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium capitalize transition-all ${
              activeTab === tab
                ? 'bg-white text-gray-900 shadow'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'system' ? '⚙️ System' : tab === 'analytics' ? '📊 Analytics' : '🔐 Actions'}
          </button>
        ))}
      </div>

      {/* ── SYSTEM TAB ────────────────────────────────────── */}
      {activeTab === 'system' && (
        <div className="space-y-8">
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
      )}

      {/* ── ANALYTICS TAB ─────────────────────────────────── */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {!adminKey ? (
            <Card><p className="text-sm text-gray-600">Enter an admin key to view analytics.</p></Card>
          ) : (
            <>
              {/* Date range controls */}
              <Card>
                <CardHeader>
                  <CardTitle>Date Range</CardTitle>
                  <CardDescription>Filter analytics events by time window.</CardDescription>
                </CardHeader>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-gray-500">From</span>
                    <input
                      type="date"
                      value={analyticsFrom}
                      onChange={(e) => setAnalyticsFrom(e.target.value)}
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-sandra-400 focus:outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-gray-500">To</span>
                    <input
                      type="date"
                      value={analyticsTo}
                      onChange={(e) => setAnalyticsTo(e.target.value)}
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-sandra-400 focus:outline-none"
                    />
                  </label>
                  <Button
                    onClick={() => void loadAnalytics(analyticsFrom, analyticsTo, adminKey)}
                    isLoading={analyticsLoading}
                    size="sm"
                  >
                    Refresh
                  </Button>
                </div>
              </Card>

              {analyticsError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{analyticsError}</div>
              )}

              {analyticsLoading && !analyticsData && (
                <div className="flex justify-center py-12"><Spinner size="lg" /></div>
              )}

              {analyticsData && (
                <>
                  {/* Summary metrics */}
                  <div className="grid gap-4 sm:grid-cols-4">
                    <Card>
                      <p className="text-xs font-medium text-gray-500">Total Events</p>
                      <p className="mt-1 text-3xl font-bold text-gray-900">{analyticsData.totalEvents.toLocaleString()}</p>
                    </Card>
                    <Card>
                      <p className="text-xs font-medium text-gray-500">Avg Response</p>
                      <p className="mt-1 text-3xl font-bold text-gray-900">
                        {analyticsData.averageResponseMs !== null ? `${Math.round(analyticsData.averageResponseMs)}ms` : '—'}
                      </p>
                    </Card>
                    <Card>
                      <p className="text-xs font-medium text-gray-500">Cache Hit Rate</p>
                      <p className="mt-1 text-3xl font-bold text-gray-900">
                        {analyticsData.cacheHitRate !== null ? `${(analyticsData.cacheHitRate * 100).toFixed(1)}%` : '—'}
                      </p>
                    </Card>
                    <Card>
                      <p className="text-xs font-medium text-gray-500">Top Tool</p>
                      <p className="mt-1 text-lg font-bold text-gray-900 truncate">
                        {analyticsData.topTools[0]?.tool ?? '—'}
                      </p>
                      {analyticsData.topTools[0] && (
                        <p className="text-xs text-gray-400">{analyticsData.topTools[0].count} calls</p>
                      )}
                    </Card>
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    {/* By Event Type */}
                    <Card>
                      <CardHeader><CardTitle>Events by Type</CardTitle></CardHeader>
                      <div className="space-y-2">
                        {Object.entries(analyticsData.byEventType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                          <div key={type} className="flex items-center gap-3">
                            <span className="w-40 truncate text-sm text-gray-600">{type}</span>
                            <div className="flex-1 rounded-full bg-gray-100">
                              <div
                                className="h-2 rounded-full bg-sandra-500"
                                style={{ width: `${Math.round((count / analyticsData.totalEvents) * 100)}%` }}
                              />
                            </div>
                            <span className="w-12 text-right text-sm font-medium text-gray-900">{count}</span>
                          </div>
                        ))}
                        {Object.keys(analyticsData.byEventType).length === 0 && (
                          <p className="text-sm text-gray-400">No events recorded.</p>
                        )}
                      </div>
                    </Card>

                    {/* By Channel */}
                    <Card>
                      <CardHeader><CardTitle>Events by Channel</CardTitle></CardHeader>
                      <div className="space-y-2">
                        {Object.entries(analyticsData.byChannel).sort((a, b) => b[1] - a[1]).map(([channel, count]) => (
                          <div key={channel} className="flex items-center gap-3">
                            <span className="w-24 truncate text-sm text-gray-600 capitalize">{channel}</span>
                            <div className="flex-1 rounded-full bg-gray-100">
                              <div
                                className="h-2 rounded-full bg-indigo-400"
                                style={{ width: `${Math.round((count / analyticsData.totalEvents) * 100)}%` }}
                              />
                            </div>
                            <span className="w-12 text-right text-sm font-medium text-gray-900">{count}</span>
                          </div>
                        ))}
                        {Object.keys(analyticsData.byChannel).length === 0 && (
                          <p className="text-sm text-gray-400">No channel data.</p>
                        )}
                      </div>
                    </Card>

                    {/* By Language */}
                    <Card>
                      <CardHeader><CardTitle>Events by Language</CardTitle></CardHeader>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(analyticsData.byLanguage).sort((a, b) => b[1] - a[1]).map(([lang, count]) => (
                          <div key={lang} className="flex items-center gap-1.5 rounded-lg bg-gray-50 px-3 py-2">
                            <span className="text-sm font-medium uppercase text-gray-700">{lang}</span>
                            <Badge variant="default">{count}</Badge>
                          </div>
                        ))}
                        {Object.keys(analyticsData.byLanguage).length === 0 && (
                          <p className="text-sm text-gray-400">No language data.</p>
                        )}
                      </div>
                    </Card>

                    {/* Top Tools */}
                    <Card>
                      <CardHeader><CardTitle>Top Tools Used</CardTitle></CardHeader>
                      <div className="space-y-2">
                        {analyticsData.topTools.slice(0, 8).map(({ tool, count }) => (
                          <div key={tool} className="flex items-center justify-between">
                            <span className="truncate text-sm text-gray-600">{tool}</span>
                            <Badge variant="info">{count}</Badge>
                          </div>
                        ))}
                        {analyticsData.topTools.length === 0 && (
                          <p className="text-sm text-gray-400">No tool usage recorded.</p>
                        )}
                      </div>
                    </Card>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ── ACTIONS TAB ───────────────────────────────────── */}
      {activeTab === 'actions' && (
        <div className="space-y-6">
          {!adminKey ? (
            <Card><p className="text-sm text-gray-600">Enter an admin key to manage action requests.</p></Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Action Requests</CardTitle>
                  <CardDescription>
                    Review and approve or reject pending agentic actions that require human-in-the-loop approval.
                  </CardDescription>
                </CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
                    {(['pending', 'all'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => {
                          setActionsFilter(f);
                          void loadActions(f, adminKey);
                        }}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-all ${
                          actionsFilter === f ? 'bg-white text-gray-900 shadow' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {f === 'pending' ? '⏳ Pending' : '📋 All'}
                      </button>
                    ))}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void loadActions(actionsFilter, adminKey)}
                    isLoading={actionsLoading}
                  >
                    Refresh
                  </Button>
                  <span className="ml-auto text-sm text-gray-400">{actionsTotal} total</span>
                </div>
              </Card>

              {actionsError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{actionsError}</div>
              )}

              {actionsLoading && actions.length === 0 && (
                <div className="flex justify-center py-12"><Spinner size="lg" /></div>
              )}

              {!actionsLoading && actions.length === 0 && !actionsError && (
                <Card>
                  <p className="text-center text-sm text-gray-500 py-6">
                    {actionsFilter === 'pending' ? '✅ No pending actions — queue is clear.' : 'No action requests found.'}
                  </p>
                </Card>
              )}

              <div className="grid gap-4">
                {actions.map((action) => (
                  <Card key={action.id} className="space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-gray-900">{action.tool}</span>
                          <Badge variant={
                            action.status === 'pending' ? 'warning'
                            : action.status === 'approved' || action.status === 'executed' ? 'success'
                            : action.status === 'rejected' || action.status === 'failed' ? 'error'
                            : 'default'
                          }>
                            {action.status}
                          </Badge>
                          <Badge variant="info" >{action.channel}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-gray-400">
                          ID: {action.id.slice(0, 8)}…
                          {action.userId ? ` · user: ${action.userId.slice(0, 8)}…` : ''}
                          {' · '}
                          {new Date(action.requestedAt).toLocaleString()}
                        </p>
                        <pre className="mt-2 rounded bg-gray-50 p-2 text-xs text-gray-700 overflow-auto max-h-32">
                          {JSON.stringify(action.input, null, 2)}
                        </pre>
                        {action.reviewedBy && (
                          <p className="mt-1 text-xs text-gray-500">
                            Reviewed by {action.reviewedBy}
                            {action.reviewNote ? `: ${action.reviewNote}` : ''}
                          </p>
                        )}
                      </div>
                      {action.status === 'pending' && (
                        <div className="flex shrink-0 gap-2">
                          <Button
                            size="sm"
                            onClick={() => void handleApproveAction(action.id)}
                            isLoading={actionProcessing === action.id}
                            disabled={!!actionProcessing}
                          >
                            ✓ Approve
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => void handleRejectAction(action.id)}
                            isLoading={actionProcessing === action.id}
                            disabled={!!actionProcessing}
                          >
                            ✕ Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
