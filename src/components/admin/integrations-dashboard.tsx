'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiConnection {
  id: string;
  name: string;
  baseUrl: string;
  authType: string;
  isActive: boolean;
  toolCount: number;
  lastHealthCheck: string | null;
  lastHealthStatus: string | null;
  createdAt: string;
}

interface ApiTool {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  createdAt: string;
}

interface ConnectionDetail extends ApiConnection {
  tools: ApiTool[];
  rateLimitRpm: number;
}

type AuthType = 'api_key' | 'bearer' | 'basic' | 'oauth2' | 'none';

const AUTH_LABELS: Record<AuthType, string> = {
  api_key: 'API Key',
  bearer: 'Bearer Token',
  basic: 'Username & Password',
  oauth2: 'OAuth 2.0 (Client Credentials)',
  none: 'No Authentication',
};

// ─── Component ────────────────────────────────────────────────────────────────

interface IntegrationsDashboardProps {
  tenantId?: string;
}

export function IntegrationsDashboard({ tenantId: tenantIdProp }: IntegrationsDashboardProps) {
  // Connection list state
  const [connections, setConnections] = useState<ApiConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail panel state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConnectionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Add form state
  const [showForm, setShowForm] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Form fields
  const [formName, setFormName] = useState('');
  const [formBaseUrl, setFormBaseUrl] = useState('');
  const [formAuthType, setFormAuthType] = useState<AuthType>('api_key');
  const [formApiKey, setFormApiKey] = useState('');
  const [formBearerToken, setFormBearerToken] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formClientId, setFormClientId] = useState('');
  const [formClientSecret, setFormClientSecret] = useState('');
  const [formTokenUrl, setFormTokenUrl] = useState('');
  const [formHeaderName, setFormHeaderName] = useState('X-API-Key');
  const [formSpec, setFormSpec] = useState('');
  const [formSpecFile, setFormSpecFile] = useState<File | null>(null);

  // Tool toggle state
  const [togglingTool, setTogglingTool] = useState<string | null>(null);

  // Delete state
  const [deleting, setDeleting] = useState<string | null>(null);

  // Tenant ID — passed from server component, falls back to EdLight
  const TENANT_ID = tenantIdProp ?? 'cmnhsjh850000a1y1b69ji257';

  // ─── Data loading ─────────────────────────────────────────────────────────

  const loadConnections = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tools/connections?tenantId=${TENANT_ID}`);
      const json = await res.json() as { connections?: ApiConnection[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to load');
      setConnections(json.connections ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load integrations');
    } finally {
      setLoading(false);
    }
  }, [TENANT_ID]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/tools/connections/${id}`);
      const json = await res.json() as ConnectionDetail & { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to load');
      setDetail(json);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  // ─── Form handlers ───────────────────────────────────────────────────────

  function resetForm() {
    setFormName('');
    setFormBaseUrl('');
    setFormAuthType('api_key');
    setFormApiKey('');
    setFormBearerToken('');
    setFormUsername('');
    setFormPassword('');
    setFormClientId('');
    setFormClientSecret('');
    setFormTokenUrl('');
    setFormHeaderName('X-API-Key');
    setFormSpec('');
    setFormSpecFile(null);
    setFormError(null);
    setFormSuccess(null);
  }

  async function handleFileUpload(file: File) {
    setFormSpecFile(file);
    try {
      const text = await file.text();
      setFormSpec(text);
    } catch {
      setFormError('Could not read file');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setFormSubmitting(true);

    try {
      // Parse the spec
      let specJson: Record<string, unknown>;
      try {
        specJson = JSON.parse(formSpec) as Record<string, unknown>;
      } catch {
        setFormError('Invalid JSON in OpenAPI spec. Please paste valid JSON.');
        setFormSubmitting(false);
        return;
      }

      // Build credentials based on auth type
      const credentials: Record<string, string> = {};
      const authConfig: Record<string, string> = {};

      switch (formAuthType) {
        case 'api_key':
          credentials.apiKey = formApiKey;
          authConfig.headerName = formHeaderName || 'X-API-Key';
          break;
        case 'bearer':
          credentials.bearerToken = formBearerToken;
          break;
        case 'basic':
          credentials.username = formUsername;
          credentials.password = formPassword;
          break;
        case 'oauth2':
          credentials.clientId = formClientId;
          credentials.clientSecret = formClientSecret;
          credentials.tokenUrl = formTokenUrl;
          break;
      }

      const res = await fetch('/api/tools/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: TENANT_ID,
          connectionName: formName,
          baseUrl: formBaseUrl,
          openApiSpec: specJson,
          authType: formAuthType,
          credentials,
          authConfig: formAuthType === 'api_key' ? authConfig : undefined,
        }),
      });

      const json = await res.json() as {
        toolsCreated?: number;
        toolNames?: string[];
        connectionId?: string;
        error?: string;
        details?: string[];
        warnings?: string[];
      };

      if (!res.ok) {
        const msg = json.details?.length
          ? `${json.error}: ${json.details.join(', ')}`
          : json.error ?? 'Registration failed';
        setFormError(msg);
        return;
      }

      setFormSuccess(
        `✅ Created ${json.toolsCreated} tool${json.toolsCreated !== 1 ? 's' : ''}: ${json.toolNames?.join(', ')}`,
      );

      // Refresh list and reset after a delay
      await loadConnections();
      setTimeout(() => {
        setShowForm(false);
        resetForm();
      }, 2000);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setFormSubmitting(false);
    }
  }

  // ─── Tool toggle ──────────────────────────────────────────────────────────

  async function handleToggleTool(tool: ApiTool) {
    if (!selectedId) return;
    setTogglingTool(tool.id);
    try {
      const res = await fetch(`/api/tools/tenant/${TENANT_ID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId: tool.id, enabled: !tool.enabled }),
      });
      if (res.ok) {
        await loadDetail(selectedId);
        await loadConnections();
      }
    } finally {
      setTogglingTool(null);
    }
  }

  // ─── Connection toggle & delete ───────────────────────────────────────────

  async function handleToggleConnection(conn: ApiConnection) {
    setDeleting(conn.id);
    try {
      await fetch(`/api/tools/connections/${conn.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !conn.isActive }),
      });
      await loadConnections();
      if (selectedId === conn.id) await loadDetail(conn.id);
    } finally {
      setDeleting(null);
    }
  }

  async function handleDeleteConnection(id: string) {
    if (!confirm('This will permanently delete this API connection and ALL its tools. Continue?')) return;
    setDeleting(id);
    try {
      await fetch(`/api/tools/connections/${id}`, { method: 'DELETE' });
      if (selectedId === id) {
        setSelectedId(null);
        setDetail(null);
      }
      await loadConnections();
    } finally {
      setDeleting(null);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">API Integrations</h1>
          <p className="mt-1 text-sm text-slate-400">
            Connect external APIs so Sandra can call them on behalf of your team.
            Just paste an OpenAPI spec and Sandra auto-generates the tools.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => window.location.href = '/admin'}>
            ← Admin
          </Button>
          <Button
            size="sm"
            onClick={() => { resetForm(); setShowForm(true); }}
          >
            + Connect API
          </Button>
        </div>
      </div>

      {/* ── Add Integration Form ─────────────────────────────────── */}
      {showForm && (
        <Card className="border-sandra-500/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Connect a New API</CardTitle>
                <CardDescription>
                  Provide your API details and OpenAPI spec. Sandra will automatically create tools for each endpoint.
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); resetForm(); }}>✕</Button>
            </div>
          </CardHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Step 1: Basic info */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">① API Details</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-slate-400">Connection Name</label>
                  <Input
                    placeholder="e.g. Acme CRM"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-400">Base URL</label>
                  <Input
                    placeholder="https://api.acme.com/v1"
                    value={formBaseUrl}
                    onChange={(e) => setFormBaseUrl(e.target.value)}
                    required
                    type="url"
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Authentication */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">② Authentication</h4>

              {/* Auth type selector */}
              <div className="flex flex-wrap gap-2">
                {(Object.entries(AUTH_LABELS) as [AuthType, string][]).map(([type, label]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormAuthType(type)}
                    className={`rounded-lg px-3 py-1.5 text-sm transition-all ${
                      formAuthType === type
                        ? 'bg-sandra-600 text-white'
                        : 'bg-white/[0.06] text-slate-400 hover:bg-white/[0.1] hover:text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Auth fields */}
              <div className="rounded-lg bg-white/[0.03] p-4 space-y-3">
                {formAuthType === 'api_key' && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm text-slate-400">API Key</label>
                      <Input
                        type="password"
                        placeholder="sk-..."
                        value={formApiKey}
                        onChange={(e) => setFormApiKey(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-slate-400">Header Name</label>
                      <Input
                        placeholder="X-API-Key"
                        value={formHeaderName}
                        onChange={(e) => setFormHeaderName(e.target.value)}
                      />
                      <p className="mt-1 text-xs text-slate-600">Where to send the key (default: X-API-Key)</p>
                    </div>
                  </div>
                )}
                {formAuthType === 'bearer' && (
                  <div>
                    <label className="mb-1 block text-sm text-slate-400">Bearer Token</label>
                    <Input
                      type="password"
                      placeholder="eyJhbGci..."
                      value={formBearerToken}
                      onChange={(e) => setFormBearerToken(e.target.value)}
                    />
                  </div>
                )}
                {formAuthType === 'basic' && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm text-slate-400">Username</label>
                      <Input
                        placeholder="admin"
                        value={formUsername}
                        onChange={(e) => setFormUsername(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-slate-400">Password</label>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                      />
                    </div>
                  </div>
                )}
                {formAuthType === 'oauth2' && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm text-slate-400">Client ID</label>
                      <Input
                        placeholder="client_abc..."
                        value={formClientId}
                        onChange={(e) => setFormClientId(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-slate-400">Client Secret</label>
                      <Input
                        type="password"
                        placeholder="secret_xyz..."
                        value={formClientSecret}
                        onChange={(e) => setFormClientSecret(e.target.value)}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-sm text-slate-400">Token URL</label>
                      <Input
                        placeholder="https://auth.acme.com/oauth/token"
                        value={formTokenUrl}
                        onChange={(e) => setFormTokenUrl(e.target.value)}
                        type="url"
                      />
                    </div>
                  </div>
                )}
                {formAuthType === 'none' && (
                  <p className="text-sm text-slate-500">No authentication required — the API is public.</p>
                )}
              </div>
            </div>

            {/* Step 3: OpenAPI Spec */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">③ OpenAPI Specification</h4>
              <p className="text-sm text-slate-400">
                Paste your OpenAPI 3.x spec as JSON, or upload a <code className="text-sandra-400">.json</code> file.
                Sandra will parse every endpoint and auto-create a tool for each one.
              </p>

              {/* File upload */}
              <div className="flex items-center gap-3">
                <label className="cursor-pointer rounded-lg bg-white/[0.06] px-4 py-2 text-sm text-slate-300 transition hover:bg-white/[0.1]">
                  📁 Upload spec file
                  <input
                    type="file"
                    accept=".json,.yaml,.yml"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleFileUpload(file);
                    }}
                  />
                </label>
                {formSpecFile && (
                  <span className="text-sm text-slate-500">
                    {formSpecFile.name} ({(formSpecFile.size / 1024).toFixed(1)} KB)
                  </span>
                )}
              </div>

              {/* Spec textarea */}
              <textarea
                className="h-64 w-full rounded-lg border border-white/[0.1] bg-white/[0.04] p-3 font-mono text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-sandra-500 focus:ring-offset-1 focus:ring-offset-[#0d0d0d]"
                placeholder={`{
  "openapi": "3.0.0",
  "info": { "title": "Your API", "version": "1.0" },
  "paths": {
    "/endpoint": {
      "get": {
        "operationId": "getEndpoint",
        "summary": "Description here",
        "responses": { "200": { "description": "OK" } }
      }
    }
  }
}`}
                value={formSpec}
                onChange={(e) => setFormSpec(e.target.value)}
              />
            </div>

            {/* Error / Success */}
            {formError && (
              <div className="rounded-lg border border-red-500/20 bg-red-950/30 p-3 text-sm text-red-400">
                {formError}
              </div>
            )}
            {formSuccess && (
              <div className="rounded-lg border border-green-500/20 bg-green-950/30 p-3 text-sm text-green-400">
                {formSuccess}
              </div>
            )}

            {/* Submit */}
            <div className="flex items-center justify-end gap-3 border-t border-white/[0.06] pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => { setShowForm(false); resetForm(); }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                isLoading={formSubmitting}
                disabled={!formName || !formBaseUrl || !formSpec}
              >
                Register API →
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* ── Connections List ──────────────────────────────────── */}
      {loading && connections.length === 0 && (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      )}

      {!loading && connections.length === 0 && !error && !showForm && (
        <Card className="text-center py-16">
          <div className="text-4xl mb-4">🔌</div>
          <p className="text-lg font-medium text-white">No integrations yet</p>
          <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto">
            Connect your first API to give Sandra the ability to call external services,
            query databases, or interact with any system that has an OpenAPI spec.
          </p>
          <Button className="mt-6" onClick={() => { resetForm(); setShowForm(true); }}>
            + Connect Your First API
          </Button>
        </Card>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-950/30 p-3 text-sm text-red-400">{error}</div>
      )}

      {connections.length > 0 && (
        <div className="grid gap-4">
          {connections.map((conn) => (
            <Card
              key={conn.id}
              className={`cursor-pointer transition-all hover:border-white/[0.15] ${
                selectedId === conn.id ? 'border-sandra-500/30 ring-1 ring-sandra-500/20' : ''
              }`}
              onClick={() => setSelectedId(selectedId === conn.id ? null : conn.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sandra-600/20 text-sandra-400 text-lg">
                    🔗
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white truncate">{conn.name}</span>
                      <Badge variant={conn.isActive ? 'success' : 'default'}>
                        {conn.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      {conn.lastHealthStatus === 'error' && (
                        <Badge variant="error">Error</Badge>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-sm text-slate-500">
                      <span className="truncate">{conn.baseUrl}</span>
                      <span>·</span>
                      <span>{conn.toolCount} tool{conn.toolCount !== 1 ? 's' : ''}</span>
                      <span>·</span>
                      <span>{conn.authType === 'api_key' ? '🔑 API Key' : conn.authType === 'bearer' ? '🎫 Bearer' : conn.authType === 'basic' ? '👤 Basic' : conn.authType === 'oauth2' ? '🔐 OAuth' : '🌐 Public'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleToggleConnection(conn)}
                    isLoading={deleting === conn.id}
                    disabled={!!deleting}
                  >
                    {conn.isActive ? '⏸ Pause' : '▶ Resume'}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDeleteConnection(conn.id)}
                    isLoading={deleting === conn.id}
                    disabled={!!deleting}
                  >
                    🗑
                  </Button>
                </div>
              </div>

              {/* Expanded detail panel */}
              {selectedId === conn.id && (
                <div className="mt-4 border-t border-white/[0.06] pt-4" onClick={(e) => e.stopPropagation()}>
                  {detailLoading ? (
                    <div className="flex justify-center py-8"><Spinner /></div>
                  ) : detail ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-slate-300">
                          Tools ({detail.tools.length})
                        </h4>
                        <span className="text-xs text-slate-600">
                          Rate limit: {detail.rateLimitRpm} req/min · Created {new Date(detail.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {detail.tools.length === 0 ? (
                        <p className="text-sm text-slate-500 py-4">
                          No tools were generated. The OpenAPI spec may have been empty or invalid.
                        </p>
                      ) : (
                        <div className="grid gap-2">
                          {detail.tools.map((tool) => (
                            <div
                              key={tool.id}
                              className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <code className="text-sm font-medium text-sandra-400">{tool.name}</code>
                                  <Badge variant={tool.enabled ? 'success' : 'default'} className="text-[10px]">
                                    {tool.enabled ? 'on' : 'off'}
                                  </Badge>
                                </div>
                                <p className="mt-0.5 text-xs text-slate-500 truncate">{tool.description}</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleTool(tool)}
                                isLoading={togglingTool === tool.id}
                                disabled={!!togglingTool}
                              >
                                {tool.enabled ? 'Disable' : 'Enable'}
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Could not load details.</p>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
