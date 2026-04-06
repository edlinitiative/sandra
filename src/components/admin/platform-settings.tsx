'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

// ── Types ────────────────────────────────────────────────────────────────────

interface AgentConfig {
  platformName?: string | null;
  allowedOrigins?: string | null;
  allowedOriginSuffix?: string | null;
  emailSenderAddress?: string | null;
  whatsappPhoneNumberId?: string | null;
  whatsappAccessToken?: string | null;
  whatsappWebhookSecret?: string | null;
  instagramPageAccessToken?: string | null;
  instagramAppSecret?: string | null;
  instagramVerifyToken?: string | null;
}

interface ConfigResponse {
  tenantId: string;
  tenantName: string;
  agentConfig: AgentConfig;
}

// ── Textarea helper ──────────────────────────────────────────────────────────

function Textarea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-lg border border-outline-variant/20 bg-surface-container-low px-3 py-2 text-sm text-white transition-colors placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 focus:ring-offset-surface"
    />
  );
}

// ── Field wrapper ────────────────────────────────────────────────────────────

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

// ── Main component ───────────────────────────────────────────────────────────

export function PlatformSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ── Form state ──
  const [platformName, setPlatformName] = useState('');
  const [emailSenderAddress, setEmailSenderAddress] = useState('');
  const [allowedOrigins, setAllowedOrigins] = useState('');
  const [allowedOriginSuffix, setAllowedOriginSuffix] = useState('');
  const [whatsappPhoneNumberId, setWhatsappPhoneNumberId] = useState('');
  const [whatsappAccessToken, setWhatsappAccessToken] = useState('');
  const [whatsappWebhookSecret, setWhatsappWebhookSecret] = useState('');
  const [instagramPageAccessToken, setInstagramPageAccessToken] = useState('');
  const [instagramAppSecret, setInstagramAppSecret] = useState('');
  const [instagramVerifyToken, setInstagramVerifyToken] = useState('');

  // Password visibility toggles
  const [showWhatsappToken, setShowWhatsappToken] = useState(false);
  const [showWhatsappSecret, setShowWhatsappSecret] = useState(false);
  const [showInstaToken, setShowInstaToken] = useState(false);
  const [showInstaSecret, setShowInstaSecret] = useState(false);

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
      const c = data.agentConfig;
      setPlatformName(c.platformName ?? '');
      setEmailSenderAddress(c.emailSenderAddress ?? '');
      setAllowedOrigins(c.allowedOrigins ?? '');
      setAllowedOriginSuffix(c.allowedOriginSuffix ?? '');
      setWhatsappPhoneNumberId(c.whatsappPhoneNumberId ?? '');
      setWhatsappAccessToken(c.whatsappAccessToken ?? '');
      setWhatsappWebhookSecret(c.whatsappWebhookSecret ?? '');
      setInstagramPageAccessToken(c.instagramPageAccessToken ?? '');
      setInstagramAppSecret(c.instagramAppSecret ?? '');
      setInstagramVerifyToken(c.instagramVerifyToken ?? '');
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
      const body: Record<string, unknown> = {
        platformName: platformName || null,
        allowedOrigins: allowedOrigins || null,
        allowedOriginSuffix: allowedOriginSuffix || null,
        emailSenderAddress: emailSenderAddress || null,
        whatsappPhoneNumberId: whatsappPhoneNumberId || null,
        whatsappAccessToken: whatsappAccessToken || null,
        whatsappWebhookSecret: whatsappWebhookSecret || null,
        instagramPageAccessToken: instagramPageAccessToken || null,
        instagramAppSecret: instagramAppSecret || null,
        instagramVerifyToken: instagramVerifyToken || null,
      };

      const res = await fetch('/api/admin/agent-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as Record<string, string>;
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      setSuccess('Platform settings saved. CORS and channel changes take effect on the next request.');
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
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
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

      {/* ── Platform Branding ── */}
      <Card>
        <CardHeader>
          <CardTitle>🏷️ Platform Branding</CardTitle>
          <CardDescription>
            The platform brand identity — shown in emails, page titles, WhatsApp mentions, and
            other system-level surfaces. This is separate from the AI assistant&apos;s persona name
            (configured in Agent Settings).
          </CardDescription>
        </CardHeader>
        <div className="space-y-5">
          <Field
            label="Platform Name"
            hint='The brand name shown in emails, page titles, and WhatsApp mentions. Defaults to "Sandra".'
          >
            <Input
              value={platformName}
              onChange={(e) => setPlatformName(e.target.value)}
              placeholder="Sandra"
            />
          </Field>
          <Field
            label="Email Sender Address"
            hint="The 'from' address for outbound emails (verification codes, notifications). Falls back to SANDRA_EMAIL_ADDRESS env var."
          >
            <Input
              type="email"
              value={emailSenderAddress}
              onChange={(e) => setEmailSenderAddress(e.target.value)}
              placeholder="noreply@example.com"
            />
          </Field>
        </div>
      </Card>

      {/* ── CORS ── */}
      <Card>
        <CardHeader>
          <CardTitle>🌐 CORS &amp; Allowed Origins</CardTitle>
          <CardDescription>
            Control which domains can call the API. Values here are merged with the
            ALLOWED_ORIGINS env var — no redeploy needed for new origins.
          </CardDescription>
        </CardHeader>
        <div className="space-y-5">
          <Field
            label="Allowed Origins"
            hint="Comma-separated list of allowed origins. Example: https://app.acme.com,https://staging.acme.com"
          >
            <Textarea
              value={allowedOrigins}
              onChange={setAllowedOrigins}
              placeholder="https://app.example.com,https://staging.example.com"
              rows={3}
            />
          </Field>
          <Field
            label="Origin Suffix"
            hint='Wildcard suffix for origin matching. Example: ".acme.com" allows all *.acme.com subdomains.'
          >
            <Input
              value={allowedOriginSuffix}
              onChange={(e) => setAllowedOriginSuffix(e.target.value)}
              placeholder=".example.com"
            />
          </Field>
        </div>
      </Card>

      {/* ── WhatsApp ── */}
      <Card>
        <CardHeader>
          <CardTitle>📱 WhatsApp Credentials</CardTitle>
          <CardDescription>
            Meta Cloud API credentials for WhatsApp Business. When set here, they override the
            WHATSAPP_* environment variables — no redeploy required.
          </CardDescription>
        </CardHeader>
        <div className="space-y-5">
          <Field label="Phone Number ID" hint="Meta Cloud API phone number ID.">
            <Input
              value={whatsappPhoneNumberId}
              onChange={(e) => setWhatsappPhoneNumberId(e.target.value)}
              placeholder="1234567890"
            />
          </Field>
          <Field label="Access Token" hint="Meta Cloud API permanent access token.">
            <div className="flex gap-2">
              <Input
                type={showWhatsappToken ? 'text' : 'password'}
                value={whatsappAccessToken}
                onChange={(e) => setWhatsappAccessToken(e.target.value)}
                placeholder="EAAx..."
                className="flex-1"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowWhatsappToken(!showWhatsappToken)}
              >
                {showWhatsappToken ? 'Hide' : 'Show'}
              </Button>
            </div>
          </Field>
          <Field label="Webhook Secret" hint="Webhook verification token for incoming messages.">
            <div className="flex gap-2">
              <Input
                type={showWhatsappSecret ? 'text' : 'password'}
                value={whatsappWebhookSecret}
                onChange={(e) => setWhatsappWebhookSecret(e.target.value)}
                placeholder="your-webhook-secret"
                className="flex-1"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowWhatsappSecret(!showWhatsappSecret)}
              >
                {showWhatsappSecret ? 'Hide' : 'Show'}
              </Button>
            </div>
          </Field>
        </div>
      </Card>

      {/* ── Instagram ── */}
      <Card>
        <CardHeader>
          <CardTitle>📸 Instagram Credentials</CardTitle>
          <CardDescription>
            Meta Graph API credentials for Instagram messaging. When set here, they override the
            INSTAGRAM_* environment variables.
          </CardDescription>
        </CardHeader>
        <div className="space-y-5">
          <Field label="Page Access Token" hint="Meta Graph API page access token.">
            <div className="flex gap-2">
              <Input
                type={showInstaToken ? 'text' : 'password'}
                value={instagramPageAccessToken}
                onChange={(e) => setInstagramPageAccessToken(e.target.value)}
                placeholder="EAAx..."
                className="flex-1"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowInstaToken(!showInstaToken)}
              >
                {showInstaToken ? 'Hide' : 'Show'}
              </Button>
            </div>
          </Field>
          <Field label="App Secret" hint="Instagram app secret for webhook signature verification.">
            <div className="flex gap-2">
              <Input
                type={showInstaSecret ? 'text' : 'password'}
                value={instagramAppSecret}
                onChange={(e) => setInstagramAppSecret(e.target.value)}
                placeholder="abc123..."
                className="flex-1"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowInstaSecret(!showInstaSecret)}
              >
                {showInstaSecret ? 'Hide' : 'Show'}
              </Button>
            </div>
          </Field>
          <Field label="Verify Token" hint="Webhook verification token.">
            <Input
              value={instagramVerifyToken}
              onChange={(e) => setInstagramVerifyToken(e.target.value)}
              placeholder="your-verify-token"
            />
          </Field>
        </div>
      </Card>

      {/* ── Save ── */}
      <div className="flex items-center justify-end gap-4">
        <Button variant="ghost" onClick={load} disabled={saving}>
          Reset
        </Button>
        <Button onClick={save} isLoading={saving}>
          Save Platform Settings
        </Button>
      </div>
    </div>
  );
}
