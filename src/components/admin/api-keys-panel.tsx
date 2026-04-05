'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  isActive: boolean;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ApiKeysPanel() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null); // plaintext shown once

  // Revoke state
  const [revoking, setRevoking] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/tenant/keys');
      const json = await res.json() as { keys?: ApiKey[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to load');
      setKeys(json.keys ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/tenant/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const json = await res.json() as ApiKey & { key?: string; error?: string };
      if (!res.ok) { setCreateError(json.error ?? 'Failed to create'); return; }
      setNewKey(json.key ?? null);
      setNewName('');
      await load();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm('Revoke this API key? Any services using it will stop working.')) return;
    setRevoking(id);
    try {
      await fetch(`/api/tenant/keys/${id}`, { method: 'DELETE' });
      await load();
    } finally {
      setRevoking(null);
    }
  }

  async function handleCopy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function formatDate(iso: string | null) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">API Keys</h2>
          <p className="text-sm text-slate-400">
            Use these keys to call Sandra from your own apps.{' '}
            <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-xs text-slate-300">
              Authorization: Bearer sk_live_…
            </code>
          </p>
        </div>
        {!showForm && (
          <Button size="sm" onClick={() => { setShowForm(true); setNewKey(null); }}>
            + New Key
          </Button>
        )}
      </div>

      {/* One-time key reveal */}
      {newKey && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-950/30 p-4 space-y-2">
          <p className="text-sm font-semibold text-amber-300">
            🔐 Copy this key now — it won&apos;t be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded bg-black/40 px-3 py-2 font-mono text-sm text-amber-200">
              {newKey}
            </code>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void handleCopy(newKey)}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </Button>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setNewKey(null)}>
            I&apos;ve saved it ✓
          </Button>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <Card>
          <form onSubmit={handleCreate} className="flex items-end gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-sm text-slate-400">Key label</label>
              <Input
                placeholder='e.g. "Production website", "Staging"'
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <Button type="submit" isLoading={creating} disabled={!newName.trim()}>
              Generate
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => { setShowForm(false); setCreateError(null); }}
            >
              Cancel
            </Button>
          </form>
          {createError && <p className="mt-2 text-sm text-red-400">{createError}</p>}
        </Card>
      )}

      {/* Keys list */}
      {loading && <div className="flex justify-center py-8"><Spinner /></div>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && keys.length === 0 && !showForm && (
        <Card className="py-8 text-center">
          <p className="text-slate-400">No API keys yet. Generate one to start using Sandra as an API.</p>
        </Card>
      )}

      {keys.length > 0 && (
        <div className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-white/[0.02]">
          {keys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white">{key.name}</span>
                  <Badge variant={key.isActive ? 'success' : 'default'}>
                    {key.isActive ? 'Active' : 'Revoked'}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <code className="font-mono text-slate-400">{key.keyPrefix}…</code>
                  <span>Created {formatDate(key.createdAt)}</span>
                  <span>Last used {formatDate(key.lastUsedAt)}</span>
                  {key.expiresAt && <span>Expires {formatDate(key.expiresAt)}</span>}
                </div>
              </div>
              {key.isActive && (
                <Button
                  variant="danger"
                  size="sm"
                  isLoading={revoking === key.id}
                  disabled={!!revoking}
                  onClick={() => void handleRevoke(key.id)}
                >
                  Revoke
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Usage snippet */}
      {keys.some((k) => k.isActive) && (
        <details className="group">
          <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-300 select-none">
            📋 How to use
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-black/40 p-4 text-xs text-slate-300">{`# Send a message to Sandra
curl -X POST https://your-app.vercel.app/api/chat/stream \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "What can you help me with?",
    "sessionId": "session-abc-123"
  }'

# Response is Server-Sent Events (SSE)
# data: {"type":"start","sessionId":"...","language":"en"}
# data: {"type":"token","data":"Hello!"}
# data: {"type":"done","toolsUsed":[],"retrievalUsed":false}`}</pre>
        </details>
      )}
    </div>
  );
}
