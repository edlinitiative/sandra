'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';

// ── Types ────────────────────────────────────────────────────────────────────

interface AgentConfig {
  agentName?: string;
  orgName?: string;
  orgDescription?: string | null;
  websiteUrl?: string | null;
  contactEmail?: string | null;
  systemPromptOverride?: string | null;
  additionalContext?: string | null;
  supportedLanguages?: string[] | null;
  enabledTools?: string[] | null;
  allowedTopics?: string[] | null;
  offTopicResponse?: string | null;
}

interface ConfigResponse {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  tenantDomain: string | null;
  agentConfig: AgentConfig;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function TagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');

  function add() {
    const trimmed = draft.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setDraft('');
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((item, i) => (
          <Badge key={i} className="group flex items-center gap-1 bg-surface-container-high text-sm text-on-surface">
            {item}
            <button
              type="button"
              onClick={() => onChange(value.filter((_, idx) => idx !== i))}
              className="ml-0.5 text-on-surface-variant hover:text-red-400"
            >
              ×
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="flex-1 text-sm"
        />
        <Button variant="secondary" size="sm" onClick={add} disabled={!draft.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
}

function Textarea({
  value,
  onChange,
  placeholder,
  rows = 4,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={`w-full rounded-lg border border-outline-variant/20 bg-surface-container-low px-3 py-2 text-sm text-white transition-colors placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 focus:ring-offset-surface ${className}`}
    />
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function AgentConfigSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tenant, setTenant] = useState<{ id: string; name: string; slug: string; domain: string | null } | null>(null);

  // ── Form state ──
  const [agentName, setAgentName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgDescription, setOrgDescription] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [systemPromptOverride, setSystemPromptOverride] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [supportedLanguages, setSupportedLanguages] = useState<string[]>([]);
  const [allowedTopics, setAllowedTopics] = useState<string[]>([]);
  const [offTopicResponse, setOffTopicResponse] = useState('');

  // ── Load ──
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/agent-config');
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as Record<string, string>;
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as ConfigResponse;
      setTenant({ id: data.tenantId, name: data.tenantName, slug: data.tenantSlug, domain: data.tenantDomain });
      const c = data.agentConfig;
      setAgentName(c.agentName ?? '');
      setOrgName(c.orgName ?? '');
      setOrgDescription(c.orgDescription ?? '');
      setWebsiteUrl(c.websiteUrl ?? '');
      setContactEmail(c.contactEmail ?? '');
      setSystemPromptOverride(c.systemPromptOverride ?? '');
      setAdditionalContext(c.additionalContext ?? '');
      setSupportedLanguages(c.supportedLanguages ?? []);
      setAllowedTopics(c.allowedTopics ?? []);
      setOffTopicResponse(c.offTopicResponse ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // ── Save ──
  async function save() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const body: Record<string, unknown> = {};

      // Only send fields that have a value — send null to clear
      body.agentName = agentName || undefined;
      body.orgName = orgName || undefined;
      body.orgDescription = orgDescription || null;
      body.websiteUrl = websiteUrl || null;
      body.contactEmail = contactEmail || null;
      body.systemPromptOverride = systemPromptOverride || null;
      body.additionalContext = additionalContext || null;
      body.supportedLanguages = supportedLanguages.length > 0 ? supportedLanguages : null;
      body.allowedTopics = allowedTopics.length > 0 ? allowedTopics : null;
      body.offTopicResponse = offTopicResponse || null;

      const res = await fetch('/api/admin/agent-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as Record<string, string>;
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      setSuccess('Configuration saved successfully. Changes take effect on the next conversation.');
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  // ── Render ──

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 py-2">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Agent Settings</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Configure how Sandra behaves for{' '}
          <span className="font-medium text-white">{tenant?.name ?? 'your organization'}</span>.
          Changes apply to all new conversations.
        </p>
      </div>

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

      {/* ── Identity ── */}
      <Card>
        <CardHeader>
          <CardTitle>🤖 Identity</CardTitle>
          <CardDescription>
            Control the assistant&apos;s name, organization branding, and contact info.
          </CardDescription>
        </CardHeader>
        <div className="space-y-5">
          <Field label="Assistant Name" hint='The name users see — e.g. "Sandra", "Aria", "Max"'>
            <Input value={agentName} onChange={(e) => setAgentName(e.target.value)} placeholder="Sandra" />
          </Field>
          <Field label="Organization Name" hint='Your company or org name — e.g. "EdLight", "Acme Corp"'>
            <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="EdLight" />
          </Field>
          <Field label="Organization Description" hint="A short paragraph describing what your organization does. Used when no full system prompt override is set.">
            <Textarea value={orgDescription} onChange={setOrgDescription} placeholder="We are an organization dedicated to..." rows={3} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Website URL" hint="Shown in responses when directing users for more info.">
              <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://example.com" />
            </Field>
            <Field label="Contact Email" hint="The primary contact email for your organization.">
              <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="info@example.com" />
            </Field>
          </div>
        </div>
      </Card>

      {/* ── Languages ── */}
      <Card>
        <CardHeader>
          <CardTitle>🌍 Languages</CardTitle>
          <CardDescription>
            Which languages should the assistant support? Leave empty for all platform-supported languages (en, fr, ht).
          </CardDescription>
        </CardHeader>
        <TagInput
          value={supportedLanguages}
          onChange={setSupportedLanguages}
          placeholder="Add a language code (e.g. en, fr, ht, es)"
        />
      </Card>

      {/* ── Scope / Abuse Prevention ── */}
      <Card>
        <CardHeader>
          <CardTitle>🛡️ Topic Scope &amp; Abuse Prevention</CardTitle>
          <CardDescription>
            Restrict what the assistant can discuss. When topics are defined, any off-topic
            request will be politely refused. Leave empty to allow all topics.
          </CardDescription>
        </CardHeader>
        <div className="space-y-5">
          <Field label="Allowed Topics" hint="Add each topic the assistant is allowed to help with. Be descriptive — these are injected directly into the AI's instructions.">
            <TagInput
              value={allowedTopics}
              onChange={setAllowedTopics}
              placeholder="e.g. EdLight programs and applications"
            />
          </Field>
          <Field label="Off-Topic Response" hint="The exact message returned when a user asks about something outside the allowed topics. If blank, a sensible default is generated from the org name.">
            <Textarea
              value={offTopicResponse}
              onChange={setOffTopicResponse}
              placeholder="I'm Sandra, EdLight's assistant. I can only help with EdLight-related topics..."
              rows={3}
            />
          </Field>
        </div>
      </Card>

      {/* ── Advanced: System Prompt ── */}
      <Card>
        <CardHeader>
          <CardTitle>🧠 System Prompt</CardTitle>
          <CardDescription>
            Advanced — full control over what Sandra knows and how she behaves. The{' '}
            <strong>System Prompt Override</strong> replaces the auto-generated identity block
            entirely. <strong>Additional Context</strong> is appended to the guidelines section
            (tool routing rules, domain hints, etc.).
          </CardDescription>
        </CardHeader>
        <div className="space-y-5">
          <Field label="System Prompt Override" hint="When set, replaces the default identity block. Do NOT include the date — it's always added automatically.">
            <Textarea
              value={systemPromptOverride}
              onChange={setSystemPromptOverride}
              placeholder="You are Sandra, the AI assistant for..."
              rows={10}
            />
          </Field>
          <Field label="Additional Context / Tool Routing Rules" hint="Appended to the guidelines section. Use for org-specific tool routing rules, domain hints, or behavioral notes.">
            <Textarea
              value={additionalContext}
              onChange={setAdditionalContext}
              placeholder="- Use 'getCourseInventory' when users ask about courses..."
              rows={8}
            />
          </Field>
        </div>
      </Card>

      {/* ── Save ── */}
      <div className="flex items-center justify-end gap-4 pb-12">
        <Button variant="ghost" onClick={load} disabled={saving}>
          Reset
        </Button>
        <Button onClick={save} isLoading={saving}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}

// ── Reusable form field wrapper ──────────────────────────────────────────────

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-on-surface">{label}</label>
      {hint && <p className="text-xs text-on-surface-variant">{hint}</p>}
      {children}
    </div>
  );
}
