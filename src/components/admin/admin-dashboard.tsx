'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';

const ADMIN_KEY_STORAGE = 'sandra_admin_api_key';

type AdminTab = 'system' | 'analytics' | 'actions' | 'gaps' | 'tools';

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

interface CapabilityGapEntry {
  id: string;
  sessionId: string;
  userId: string | null;
  channel: string | null;
  language: string | null;
  userMessage: string;
  patterns: string[];
  reviewed: boolean;
  createdAt: string;
}

interface DynamicToolEntry {
  id: string;
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handlerCode: string;
  requiredScopes: string[];
  enabled: boolean;
  tested: boolean;
  createdBy: string | null;
  sourceGapIds: string[];
  createdAt: string;
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

  // Capability gaps state
  const [gaps, setGaps] = useState<CapabilityGapEntry[]>([]);
  const [gapsTotal, setGapsTotal] = useState(0);
  const [gapsLoading, setGapsLoading] = useState(false);
  const [gapsError, setGapsError] = useState<string | null>(null);
  const [gapsFilter, setGapsFilter] = useState<'unreviewed' | 'all'>('unreviewed');
  const [gapGenerating, setGapGenerating] = useState<string | null>(null);

  // Dynamic tools state
  const [dynamicTools, setDynamicTools] = useState<DynamicToolEntry[]>([]);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [toolsError, setToolsError] = useState<string | null>(null);
  const [toolProcessing, setToolProcessing] = useState<string | null>(null);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);

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
    } else if (activeTab === 'gaps') {
      void loadGaps(gapsFilter, adminKey);
    } else if (activeTab === 'tools') {
      void loadDynamicTools(adminKey);
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

  const loadGaps = useCallback(async (filter: 'unreviewed' | 'all', key: string) => {
    if (!key) return;
    setGapsLoading(true);
    setGapsError(null);
    try {
      const reviewed = filter === 'all' ? 'all' : 'false';
      const res = await fetch(`/api/capability-gaps?reviewed=${reviewed}&limit=100`, {
        headers: { 'x-api-key': key },
      });
      const json = await res.json() as { data?: { gaps: CapabilityGapEntry[]; total: number }; error?: { message?: string } };
      if (!res.ok) {
        setGapsError(json.error?.message ?? 'Failed to load capability gaps');
      } else {
        setGaps(json.data?.gaps ?? []);
        setGapsTotal(json.data?.total ?? 0);
      }
    } catch (err) {
      setGapsError(err instanceof Error ? err.message : 'Failed to load capability gaps');
    } finally {
      setGapsLoading(false);
    }
  }, []);

  const loadDynamicTools = useCallback(async (key: string) => {
    if (!key) return;
    setToolsLoading(true);
    setToolsError(null);
    try {
      const res = await fetch('/api/dynamic-tools', {
        headers: { 'x-api-key': key },
      });
      const json = await res.json() as { data?: { tools: DynamicToolEntry[] }; error?: { message?: string } };
      if (!res.ok) {
        setToolsError(json.error?.message ?? 'Failed to load dynamic tools');
      } else {
        setDynamicTools(json.data?.tools ?? []);
      }
    } catch (err) {
      setToolsError(err instanceof Error ? err.message : 'Failed to load dynamic tools');
    } finally {
      setToolsLoading(false);
    }
  }, []);

  const handleGenerateFromGap = async (gapId: string) => {
    setGapGenerating(gapId);
    try {
      const res = await fetch(`/api/capability-gaps/${gapId}/generate`, {
        method: 'POST',
        headers: { 'x-api-key': adminKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json() as { data?: { result?: { success?: boolean; data?: { toolName?: string; message?: string } } } };
      if (res.ok && json.data?.result?.success) {
        const toolName = json.data.result.data?.toolName;
        alert(`✅ Tool '${toolName}' generated and registered!`);
        await loadGaps(gapsFilter, adminKey);
        await loadDynamicTools(adminKey);
      } else {
        const msg = json.data?.result?.data?.message ?? 'Generation failed';
        alert(`❌ ${msg}`);
      }
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'unknown'}`);
    } finally {
      setGapGenerating(null);
    }
  };

  const handleToggleTool = async (tool: DynamicToolEntry) => {
    setToolProcessing(tool.id);
    try {
      const res = await fetch(`/api/dynamic-tools/${tool.id}`, {
        method: 'PATCH',
        headers: { 'x-api-key': adminKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !tool.enabled }),
      });
      if (res.ok) {
        await loadDynamicTools(adminKey);
      }
    } finally {
      setToolProcessing(null);
    }
  };

  const handleDeleteTool = async (tool: DynamicToolEntry) => {
    if (!confirm(`Delete dynamic tool '${tool.name}'? This cannot be undone.`)) return;
    setToolProcessing(tool.id);
    try {
      const res = await fetch(`/api/dynamic-tools/${tool.id}`, {
        method: 'DELETE',
        headers: { 'x-api-key': adminKey },
      });
      if (res.ok) {
        await loadDynamicTools(adminKey);
      }
    } finally {
      setToolProcessing(null);
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
        <h1 className="text-2xl font-bold text-white">Sandra Admin</h1>
        <p className="mt-1 text-slate-500">Manage repositories, indexing, and system status.</p>
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
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <Badge variant={adminKey ? 'success' : 'warning'}>
            {adminKey ? 'Authenticated' : 'Read-only'}
          </Badge>
          {authError && <span>{authError}</span>}
        </div>
      </Card>

      {/* Database unavailable banner */}
      {dbUnavailable && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-950/30 p-4">
          <div className="flex items-start gap-3">
            <span className="text-lg">⚠️</span>
            <div>
              <p className="font-medium text-amber-400">Database unavailable</p>
              <p className="mt-1 text-sm text-amber-300/70">
                Sandra is running without a database connection. Chat and tools work normally using
                built-in knowledge, but repository management and indexing require a running PostgreSQL
                database.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1 overflow-x-auto rounded-xl bg-white/[0.04] p-1">
          {(['system', 'analytics', 'actions', 'gaps', 'tools'] as AdminTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium capitalize transition-all ${
                activeTab === tab
                  ? 'bg-white/[0.1] text-white shadow'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab === 'system'    ? '⚙️ System'
             : tab === 'analytics' ? '📊 Analytics'
             : tab === 'actions'   ? '🔐 Actions'
             : tab === 'gaps'      ? '🧠 Gaps'
             :                       '🔧 Tools'}
            </button>
          ))}
        </div>
        <a
          href="/admin/integrations"
          className="shrink-0 rounded-lg bg-sandra-600/20 px-3 py-2 text-sm font-medium text-sandra-400 transition-all hover:bg-sandra-600/30 hover:text-sandra-300"
        >
          🔌 Integrations
        </a>
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
                <div className="rounded-lg bg-white/[0.04] p-4">
                  <p className="text-sm font-medium text-slate-500">Knowledge</p>
                  <p className="mt-1 text-2xl font-bold text-white">
                    {formatMetric(health.summary.knowledge.indexedDocuments)}
                  </p>
                  <p className="text-xs text-slate-500">
                    documents · {formatMetric(health.summary.knowledge.vectorStoreChunks)} vector chunks
                  </p>
                </div>
                <div className="rounded-lg bg-white/[0.04] p-4">
                  <p className="text-sm font-medium text-slate-500">Repositories</p>
                  <p className="mt-1 text-2xl font-bold text-white">
                    {formatMetric(health.summary.repos.active)}/{formatMetric(health.summary.repos.total)}
                  </p>
                  <p className="text-xs text-slate-500">
                    indexed {formatMetric(health.summary.repos.indexed)} · errors {formatMetric(health.summary.repos.error)}
                  </p>
                </div>
                <div className="rounded-lg bg-white/[0.04] p-4">
                  <p className="text-sm font-medium text-slate-500">Tools</p>
                  <p className="mt-1 text-2xl font-bold text-white">{health.summary.tools.count}</p>
                  <p className="text-xs text-slate-500">registered</p>
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
              <p className="text-sm text-slate-400">{indexResult}</p>
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
                  className="flex-1 rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-base text-white placeholder:text-slate-500 focus:border-sandra-400 focus:outline-none focus:ring-2 focus:ring-sandra-500/30"
                />
                <select
                  value={testLanguage}
                  onChange={(e) => setTestLanguage(e.target.value)}
                  className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white focus:border-sandra-400 focus:outline-none [&>option]:bg-[#1a1a1a] [&>option]:text-white"
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
                <div className="rounded-lg border border-red-500/20 bg-red-950/30 p-3 text-sm text-red-400">
                  {testError}
                </div>
              )}

              {testResult && (
                <div className="space-y-3 rounded-lg border border-white/[0.08] bg-white/[0.03] p-4">
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
                  <div className="whitespace-pre-wrap text-sm text-slate-300">
                    {testResult.response}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Repository List */}
          <div>
            <h2 className="mb-4 text-lg font-semibold text-white">Registered Repositories</h2>
            {!adminKey ? (
              <Card>
                <p className="text-sm text-slate-400">
                  Repository status and indexing controls unlock after you enter a valid admin key.
                </p>
              </Card>
            ) : (
              <div className="grid gap-4">
                {repos.map((repo) => (
                  <Card key={`${repo.owner}/${repo.name}`} className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white">{repo.displayName}</h3>
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
                      <p className="mt-1 text-sm text-slate-400">{repo.description ?? 'No description available.'}</p>
                      <p className="mt-1 text-xs text-slate-600">
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
            <Card><p className="text-sm text-slate-400">Enter an admin key to view analytics.</p></Card>
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
                    <span className="text-xs font-medium text-slate-500">From</span>
                    <input
                      type="date"
                      value={analyticsFrom}
                      onChange={(e) => setAnalyticsFrom(e.target.value)}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white focus:border-sandra-400 focus:outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-500">To</span>
                    <input
                      type="date"
                      value={analyticsTo}
                      onChange={(e) => setAnalyticsTo(e.target.value)}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white focus:border-sandra-400 focus:outline-none"
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
                <div className="rounded-lg border border-red-500/20 bg-red-950/30 p-3 text-sm text-red-400">{analyticsError}</div>
              )}

              {analyticsLoading && !analyticsData && (
                <div className="flex justify-center py-12"><Spinner size="lg" /></div>
              )}

              {analyticsData && (
                <>
                  {/* Summary metrics */}
                  <div className="grid gap-4 sm:grid-cols-4">
                    <Card>
                      <p className="text-xs font-medium text-slate-500">Total Events</p>
                      <p className="mt-1 text-3xl font-bold text-white">{analyticsData.totalEvents.toLocaleString()}</p>
                    </Card>
                    <Card>
                      <p className="text-xs font-medium text-slate-500">Avg Response</p>
                      <p className="mt-1 text-3xl font-bold text-white">
                        {analyticsData.averageResponseMs !== null ? `${Math.round(analyticsData.averageResponseMs)}ms` : '—'}
                      </p>
                    </Card>
                    <Card>
                      <p className="text-xs font-medium text-slate-500">Cache Hit Rate</p>
                      <p className="mt-1 text-3xl font-bold text-white">
                        {analyticsData.cacheHitRate !== null ? `${(analyticsData.cacheHitRate * 100).toFixed(1)}%` : '—'}
                      </p>
                    </Card>
                    <Card>
                      <p className="text-xs font-medium text-slate-500">Top Tool</p>
                      <p className="mt-1 text-lg font-bold text-white truncate">
                        {analyticsData.topTools[0]?.tool ?? '—'}
                      </p>
                      {analyticsData.topTools[0] && (
                        <p className="text-xs text-slate-600">{analyticsData.topTools[0].count} calls</p>
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
                            <span className="w-40 truncate text-sm text-slate-400">{type}</span>
                            <div className="flex-1 rounded-full bg-white/[0.06]">
                              <div
                                className="h-2 rounded-full bg-sandra-500"
                                style={{ width: `${Math.round((count / analyticsData.totalEvents) * 100)}%` }}
                              />
                            </div>
                            <span className="w-12 text-right text-sm font-medium text-white">{count}</span>
                          </div>
                        ))}
                        {Object.keys(analyticsData.byEventType).length === 0 && (
                          <p className="text-sm text-slate-600">No events recorded.</p>
                        )}
                      </div>
                    </Card>

                    {/* By Channel */}
                    <Card>
                      <CardHeader><CardTitle>Events by Channel</CardTitle></CardHeader>
                      <div className="space-y-2">
                        {Object.entries(analyticsData.byChannel).sort((a, b) => b[1] - a[1]).map(([channel, count]) => (
                          <div key={channel} className="flex items-center gap-3">
                            <span className="w-24 truncate text-sm text-slate-400 capitalize">{channel}</span>
                            <div className="flex-1 rounded-full bg-white/[0.06]">
                              <div
                                className="h-2 rounded-full bg-indigo-400"
                                style={{ width: `${Math.round((count / analyticsData.totalEvents) * 100)}%` }}
                              />
                            </div>
                            <span className="w-12 text-right text-sm font-medium text-white">{count}</span>
                          </div>
                        ))}
                        {Object.keys(analyticsData.byChannel).length === 0 && (
                          <p className="text-sm text-slate-600">No channel data.</p>
                        )}
                      </div>
                    </Card>

                    {/* By Language */}
                    <Card>
                      <CardHeader><CardTitle>Events by Language</CardTitle></CardHeader>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(analyticsData.byLanguage).sort((a, b) => b[1] - a[1]).map(([lang, count]) => (
                          <div key={lang} className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-3 py-2">
                            <span className="text-sm font-medium uppercase text-slate-300">{lang}</span>
                            <Badge variant="default">{count}</Badge>
                          </div>
                        ))}
                        {Object.keys(analyticsData.byLanguage).length === 0 && (
                          <p className="text-sm text-slate-600">No language data.</p>
                        )}
                      </div>
                    </Card>

                    {/* Top Tools */}
                    <Card>
                      <CardHeader><CardTitle>Top Tools Used</CardTitle></CardHeader>
                      <div className="space-y-2">
                        {analyticsData.topTools.slice(0, 8).map(({ tool, count }) => (
                          <div key={tool} className="flex items-center justify-between">
                            <span className="truncate text-sm text-slate-400">{tool}</span>
                            <Badge variant="info">{count}</Badge>
                          </div>
                        ))}
                        {analyticsData.topTools.length === 0 && (
                          <p className="text-sm text-slate-600">No tool usage recorded.</p>
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
            <Card><p className="text-sm text-slate-400">Enter an admin key to manage action requests.</p></Card>
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
                  <div className="flex gap-1 rounded-lg bg-white/[0.06] p-1">
                    {(['pending', 'all'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => {
                          setActionsFilter(f);
                          void loadActions(f, adminKey);
                        }}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-all ${
                          actionsFilter === f ? 'bg-white/[0.1] text-white' : 'text-slate-500 hover:text-slate-300'
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
                  <span className="ml-auto text-sm text-slate-600">{actionsTotal} total</span>
                </div>
              </Card>

              {actionsError && (
                <div className="rounded-lg border border-red-500/20 bg-red-950/30 p-3 text-sm text-red-400">{actionsError}</div>
              )}

              {actionsLoading && actions.length === 0 && (
                <div className="flex justify-center py-12"><Spinner size="lg" /></div>
              )}

              {!actionsLoading && actions.length === 0 && !actionsError && (
                <Card>
                  <p className="text-center text-sm text-slate-500 py-6">
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
                          <span className="font-semibold text-white">{action.tool}</span>
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
                        <p className="mt-1 text-xs text-slate-600">
                          ID: {action.id.slice(0, 8)}…
                          {action.userId ? ` · user: ${action.userId.slice(0, 8)}…` : ''}
                          {' · '}
                          {new Date(action.requestedAt).toLocaleString()}
                        </p>
                        <pre className="mt-2 rounded bg-black/30 p-2 text-xs text-slate-300 overflow-auto max-h-32">
                          {JSON.stringify(action.input, null, 2)}
                        </pre>
                        {action.reviewedBy && (
                          <p className="mt-1 text-xs text-slate-500">
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
      {/* ── GAPS TAB ──────────────────────────────────────── */}
      {activeTab === 'gaps' && (
        <div className="space-y-6">
          {!adminKey ? (
            <Card><p className="text-sm text-slate-400">Enter an admin key to view capability gaps.</p></Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Capability Gaps</CardTitle>
                  <CardDescription>
                    Requests Sandra couldn&apos;t fulfil. Use &ldquo;Generate Tool&rdquo; to scaffold a new tool from any gap.
                  </CardDescription>
                </CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1 rounded-lg bg-white/[0.06] p-1">
                    {(['unreviewed', 'all'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => {
                          setGapsFilter(f);
                          void loadGaps(f, adminKey);
                        }}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-all ${
                          gapsFilter === f ? 'bg-white/[0.1] text-white' : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {f === 'unreviewed' ? '🔴 Unreviewed' : '📋 All'}
                      </button>
                    ))}
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => void loadGaps(gapsFilter, adminKey)} isLoading={gapsLoading}>Refresh</Button>
                  <span className="ml-auto text-sm text-slate-600">{gapsTotal} total</span>
                </div>
              </Card>

              {gapsError && <div className="rounded-lg border border-red-500/20 bg-red-950/30 p-3 text-sm text-red-400">{gapsError}</div>}
              {gapsLoading && gaps.length === 0 && <div className="flex justify-center py-12"><Spinner size="lg" /></div>}
              {!gapsLoading && gaps.length === 0 && !gapsError && (
                <Card>
                  <p className="text-center text-sm text-slate-500 py-6">
                    {gapsFilter === 'unreviewed' ? '✅ No unreviewed gaps — all caught up.' : 'No capability gaps recorded yet.'}
                  </p>
                </Card>
              )}

              <div className="grid gap-4">
                {gaps.map((gap) => (
                  <Card key={gap.id} className="space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white text-sm leading-relaxed">&ldquo;{gap.userMessage}&rdquo;</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {gap.patterns.map((p) => (
                            <Badge key={p} variant="warning">{p}</Badge>
                          ))}
                          {gap.channel && <Badge variant="info">{gap.channel}</Badge>}
                          {gap.language && <Badge variant="default">{gap.language}</Badge>}
                          <Badge variant={gap.reviewed ? 'success' : 'error'}>
                            {gap.reviewed ? 'reviewed' : 'unreviewed'}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">
                          {new Date(gap.createdAt).toLocaleString()}
                          {gap.userId ? ` · user: ${gap.userId.slice(0, 8)}…` : ''}
                        </p>
                      </div>
                      {!gap.reviewed && (
                        <Button
                          size="sm"
                          onClick={() => void handleGenerateFromGap(gap.id)}
                          isLoading={gapGenerating === gap.id}
                          disabled={!!gapGenerating}
                        >
                          ✨ Generate Tool
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TOOLS TAB ─────────────────────────────────────── */}
      {activeTab === 'tools' && (
        <div className="space-y-6">
          {!adminKey ? (
            <Card><p className="text-sm text-slate-400">Enter an admin key to manage dynamic tools.</p></Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Dynamic Tools</CardTitle>
                  <CardDescription>
                    Runtime-generated tools created by scaffoldTool. Toggle, inspect, or delete them here.
                  </CardDescription>
                </CardHeader>
                <div className="flex items-center gap-3">
                  <Button variant="secondary" size="sm" onClick={() => void loadDynamicTools(adminKey)} isLoading={toolsLoading}>Refresh</Button>
                  <span className="ml-auto text-sm text-slate-600">{dynamicTools.length} tool{dynamicTools.length !== 1 ? 's' : ''}</span>
                </div>
              </Card>

              {toolsError && <div className="rounded-lg border border-red-500/20 bg-red-950/30 p-3 text-sm text-red-400">{toolsError}</div>}
              {toolsLoading && dynamicTools.length === 0 && <div className="flex justify-center py-12"><Spinner size="lg" /></div>}
              {!toolsLoading && dynamicTools.length === 0 && !toolsError && (
                <Card>
                  <p className="text-center text-sm text-slate-500 py-6">No dynamic tools yet. Ask Sandra to scaffold one, or use the Gaps tab.</p>
                </Card>
              )}

              <div className="grid gap-4">
                {dynamicTools.map((tool) => (
                  <Card key={tool.id} className="space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-white">{tool.name}</span>
                          <Badge variant={tool.enabled ? 'success' : 'default'}>{tool.enabled ? 'enabled' : 'disabled'}</Badge>
                          <Badge variant={tool.tested ? 'success' : 'warning'}>{tool.tested ? 'tested' : 'untested'}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-slate-400">{tool.description}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {tool.requiredScopes.map((s) => (
                            <Badge key={s} variant="info">{s}</Badge>
                          ))}
                        </div>
                        <p className="mt-1 text-xs text-slate-600">
                          Created {new Date(tool.createdAt).toLocaleString()}
                          {tool.createdBy ? ` · by ${tool.createdBy.slice(0, 8)}…` : ''}
                          {tool.sourceGapIds.length > 0 ? ` · from ${tool.sourceGapIds.length} gap(s)` : ''}
                        </p>
                        {/* Collapsible handler code */}
                        <button
                          className="mt-2 text-xs text-sandra-500 hover:underline"
                          onClick={() => setExpandedCode(expandedCode === tool.id ? null : tool.id)}
                        >
                          {expandedCode === tool.id ? '▲ Hide code' : '▼ View code'}
                        </button>
                        {expandedCode === tool.id && (
                          <pre className="mt-2 overflow-auto rounded bg-black/40 p-3 text-xs text-slate-300 max-h-48">
                            {tool.handlerCode}
                          </pre>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => void handleToggleTool(tool)}
                          isLoading={toolProcessing === tool.id}
                          disabled={!!toolProcessing}
                        >
                          {tool.enabled ? '⏸ Disable' : '▶ Enable'}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => void handleDeleteTool(tool)}
                          isLoading={toolProcessing === tool.id}
                          disabled={!!toolProcessing}
                        >
                          🗑 Delete
                        </Button>
                      </div>
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
