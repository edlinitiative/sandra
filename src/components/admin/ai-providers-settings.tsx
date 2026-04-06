'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';

// ── Types ────────────────────────────────────────────────────────────────────

interface ProviderInfo {
  name: 'openai' | 'gemini' | 'anthropic';
  configured: boolean;
  source: 'database' | 'environment' | 'none';
  maskedKey: string | null;
  model?: string | null;
  isActive: boolean;
  lastHealthCheck: string | null;
  lastHealthStatus: string | null;
}

interface AIProvidersResponse {
  providers: ProviderInfo[];
  priority: string;
}

// ── Metadata for each provider ───────────────────────────────────────────────

const PROVIDER_META: Record<
  string,
  { label: string; icon: string; defaultModel: string; keyPrefix: string; keyPlaceholder: string }
> = {
  openai: {
    label: 'OpenAI',
    icon: '🤖',
    defaultModel: 'gpt-4o',
    keyPrefix: 'sk-',
    keyPlaceholder: 'sk-proj-...',
  },
  gemini: {
    label: 'Google Gemini',
    icon: '✨',
    defaultModel: 'gemini-2.0-flash',
    keyPrefix: 'AI',
    keyPlaceholder: 'AIzaSy...',
  },
  anthropic: {
    label: 'Anthropic',
    icon: '🧠',
    defaultModel: 'claude-3-5-sonnet-20241022',
    keyPrefix: 'sk-ant-',
    keyPlaceholder: 'sk-ant-api03-...',
  },
};

// ── Main component ───────────────────────────────────────────────────────────

export function AiProvidersSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [priority, setPriority] = useState('openai,gemini,anthropic');

  // Draft keys — only sent when non-empty (empty string = "remove key")
  const [draftKeys, setDraftKeys] = useState<Record<string, string>>({});
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});

  // ── Load ──
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/ai-providers');
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as Record<string, string>;
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as AIProvidersResponse;
      setProviders(data.providers);
      setPriority(data.priority);
      setDraftKeys({});
      setShowKey({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Save ──
  async function save() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const providerUpdates: Record<string, { apiKey?: string; model?: string }> = {};

      // Only send providers that have been edited
      for (const [name, key] of Object.entries(draftKeys)) {
        if (key !== undefined) {
          providerUpdates[name] = { apiKey: key };
        }
      }

      const body: Record<string, unknown> = {};
      if (Object.keys(providerUpdates).length > 0) {
        body.providers = providerUpdates;
      }
      body.priority = priority;

      const res = await fetch('/api/admin/ai-providers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as Record<string, string>;
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      setSuccess('AI provider configuration saved. Changes take effect on the next conversation.');
      setTimeout(() => setSuccess(null), 5000);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  // ── Render ──

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  const configuredCount = providers.filter((p) => p.configured).length;

  return (
    <div className="space-y-6">
      {/* Status messages */}
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-950/30 p-4 text-sm text-red-300">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-500/20 bg-green-950/30 p-4 text-sm text-green-300">
          {success}
        </div>
      )}

      {/* Provider cards */}
      <Card>
        <CardHeader>
          <CardTitle>🔑 AI Provider API Keys</CardTitle>
          <CardDescription>
            Configure API keys for the AI providers Sandra uses for chat, tool calling, and voice.
            Keys stored here override environment variables. Sandra automatically falls back to the
            next provider if the primary one is unavailable.
          </CardDescription>
          <div className="mt-2">
            <Badge className={configuredCount > 0 ? 'bg-green-900/40 text-green-300' : 'bg-yellow-900/40 text-yellow-300'}>
              {configuredCount}/3 providers configured
            </Badge>
          </div>
        </CardHeader>

        <div className="space-y-4">
          {providers.map((provider) => {
            const meta = PROVIDER_META[provider.name]!;
            const draft = draftKeys[provider.name];
            const hasDraft = draft !== undefined;

            return (
              <div
                key={provider.name}
                className="rounded-xl border border-outline-variant/15 bg-surface-container-low p-4"
              >
                {/* Provider header */}
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{meta.icon}</span>
                    <span className="text-sm font-bold text-on-surface">{meta.label}</span>
                    {provider.configured && (
                      <Badge className="bg-green-900/40 text-green-300 text-[0.6rem]">
                        {provider.source === 'database' ? 'DB' : 'ENV'}
                      </Badge>
                    )}
                    {!provider.configured && (
                      <Badge className="bg-surface-container-high text-on-surface-variant text-[0.6rem]">
                        Not configured
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-on-surface-variant">
                    Model: <code className="text-primary">{provider.model ?? meta.defaultModel}</code>
                  </span>
                </div>

                {/* Current key (masked) */}
                {provider.maskedKey && !hasDraft && (
                  <div className="mb-3 flex items-center gap-2">
                    <code className="flex-1 rounded-lg bg-black/30 px-3 py-2 text-xs tracking-wider text-on-surface-variant">
                      {provider.maskedKey}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setDraftKeys((prev) => ({ ...prev, [provider.name]: '' }))
                      }
                    >
                      Change
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300"
                      onClick={() =>
                        setDraftKeys((prev) => ({ ...prev, [provider.name]: '' }))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                )}

                {/* Key input (shown when editing or when no key exists) */}
                {(hasDraft || !provider.maskedKey) && (
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showKey[provider.name] ? 'text' : 'password'}
                        value={draft ?? ''}
                        onChange={(e) =>
                          setDraftKeys((prev) => ({ ...prev, [provider.name]: e.target.value }))
                        }
                        placeholder={meta.keyPlaceholder}
                        className="pr-10 font-mono text-xs"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowKey((prev) => ({
                            ...prev,
                            [provider.name]: !prev[provider.name],
                          }))
                        }
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                      >
                        <span className="material-symbols-outlined text-base">
                          {showKey[provider.name] ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                    {hasDraft && provider.maskedKey && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDraftKeys((prev) => {
                            const next = { ...prev };
                            delete next[provider.name];
                            return next;
                          });
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                )}

                {/* Source hint */}
                {provider.source === 'environment' && !hasDraft && (
                  <p className="mt-2 text-[0.6875rem] text-on-surface-variant">
                    ℹ️ This key is set via environment variable. Saving a new key here will
                    override it. To revert to the env var, remove the key.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Priority */}
      <Card>
        <CardHeader>
          <CardTitle>⚡ Fallback Priority</CardTitle>
          <CardDescription>
            Comma-separated list of provider names. Sandra tries them in order. If the first
            provider fails (quota, rate limit, server error), it automatically retries with
            the next one.
          </CardDescription>
        </CardHeader>
        <Input
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          placeholder="openai,gemini,anthropic"
          className="font-mono text-sm"
        />
        <p className="mt-2 text-xs text-on-surface-variant">
          Valid names: <code className="text-primary">openai</code>,{' '}
          <code className="text-primary">gemini</code>,{' '}
          <code className="text-primary">anthropic</code>
        </p>
      </Card>

      {/* Info callout */}
      <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4">
        <p className="text-sm text-on-surface-variant">
          <span className="material-symbols-outlined mr-1 align-middle text-base text-primary">
            info
          </span>
          <strong className="text-on-surface">How fallback works:</strong> If OpenAI hits a quota
          limit, Sandra automatically retries the same request with Gemini. If Gemini also fails,
          it tries Anthropic. Only providers with a valid API key are included in the chain.
        </p>
      </div>

      {/* Save */}
      <div className="flex items-center justify-end gap-4">
        <Button variant="ghost" onClick={load} disabled={saving}>
          Reset
        </Button>
        <Button onClick={save} isLoading={saving}>
          Save AI Providers
        </Button>
      </div>
    </div>
  );
}
