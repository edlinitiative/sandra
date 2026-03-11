'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

interface Repo {
  owner: string;
  name: string;
  displayName: string;
  description: string;
  url: string;
  branch: string;
  docsPath?: string;
  isActive: boolean;
  indexed: boolean;
  chunkCount: number;
}

interface HealthData {
  name: string;
  version: string;
  status: string;
  components: {
    vectorStore: { ready: boolean; totalChunks: number };
    repos: { total: number; active: number };
    tools: { registered: string[]; count: number };
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

  // Test chat state
  const [testMessage, setTestMessage] = useState('');
  const [testLanguage, setTestLanguage] = useState('en');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [reposRes, healthRes] = await Promise.all([
        fetch('/api/repos').then((r) => r.json()),
        fetch('/api/health').then((r) => r.json()),
      ]);
      setRepos(reposRes.data?.repos ?? []);
      setHealth(healthRes.data ?? null);
    } catch {
      // Silently handle — data will just be empty
    } finally {
      setLoading(false);
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
    const key = owner && name ? `${owner}/${name}` : 'all';
    setIndexing(key);
    setIndexResult(null);

    try {
      const body = owner && name ? { owner, repo: name } : {};
      const res = await fetch('/api/index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (res.ok) {
        const results = data.data?.results ?? [];
        const totalChunks = results.reduce((s: number, r: { chunksCreated: number }) => s + r.chunksCreated, 0);
        setIndexResult(`✅ Indexed ${results.length} repo(s), ${totalChunks} chunks created`);
        loadData();
      } else {
        setIndexResult(`❌ Error: ${data.error?.message ?? 'Unknown error'}`);
      }
    } catch (err) {
      setIndexResult(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIndexing(null);
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

      {/* Health Status */}
      {health && (
        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>Sandra v{health.version}</CardDescription>
          </CardHeader>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-500">Vector Store</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{health.components.vectorStore.totalChunks}</p>
              <p className="text-xs text-gray-500">chunks indexed</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-500">Repositories</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{health.components.repos.active}/{health.components.repos.total}</p>
              <p className="text-xs text-gray-500">active</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-500">Tools</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{health.components.tools.count}</p>
              <p className="text-xs text-gray-500">registered</p>
            </div>
          </div>
        </Card>
      )}

      {/* Index All Button */}
      <div className="flex items-center gap-4">
        <Button onClick={() => triggerIndex()} isLoading={indexing === 'all'}>
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
        <div className="grid gap-4">
          {repos.map((repo) => (
            <Card key={`${repo.owner}/${repo.name}`} className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">{repo.displayName}</h3>
                  <Badge variant={repo.isActive ? 'success' : 'default'}>
                    {repo.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  <Badge variant={repo.indexed ? 'info' : 'warning'}>
                    {repo.indexed ? `${repo.chunkCount} chunks` : 'Not indexed'}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-gray-500">{repo.description}</p>
                <p className="mt-1 text-xs text-gray-400">
                  {repo.owner}/{repo.name} · {repo.branch}
                  {repo.docsPath ? ` · docs: ${repo.docsPath}` : ''}
                </p>
              </div>
              <div className="ml-4 shrink-0">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => triggerIndex(repo.owner, repo.name)}
                  isLoading={indexing === `${repo.owner}/${repo.name}`}
                >
                  Index
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
