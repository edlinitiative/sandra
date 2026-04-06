# Sandra Admin Guides

Welcome to the Sandra admin documentation. These guides walk you through connecting Sandra to your organization's platforms, configuring her behavior, and managing integrations — all from the **Admin Portal**.

---

## 📖 Table of Contents

### Getting Started

- [**Admin Portal Overview**](./admin-portal-overview.md) — Logging in, navigating the dashboard, and understanding admin capabilities

### Platform Integrations

Connect Sandra to the services your organization uses:

| Guide | What It Connects | Time to Set Up |
|-------|-----------------|----------------|
| [Google Workspace](./connect-google-workspace.md) | Gmail, Calendar, Drive, Tasks, Forms, Contacts | ~20 min |
| [Zoom](./connect-zoom.md) | Meeting scheduling, invitations | ~10 min |
| [WhatsApp](./connect-whatsapp.md) | WhatsApp Business messaging channel | ~30 min |
| [Instagram](./connect-instagram.md) | Instagram DM messaging channel | ~20 min |
| [GitHub](./connect-github.md) | Repository knowledge indexing | ~5 min |
| [External APIs](./connect-external-apis.md) | Any API with an OpenAPI spec | ~10 min |

### Configuration

- [**Agent Settings**](./agent-settings.md) — Customize Sandra's name, personality, languages, and topic guardrails
- [**API Keys**](./api-keys.md) — Generate and manage programmatic access keys
- [**Dynamic Tools**](./dynamic-tools.md) — Review and manage auto-generated tools

### AI Provider & Voice Resilience

Sandra supports **multi-provider fallback** for both AI chat and voice:

| Layer | Primary | Fallback | Env Var |
|-------|---------|----------|--------|
| **Chat / Tools** | OpenAI (`gpt-4o`) | Gemini (`gemini-2.0-flash`) → Anthropic (`claude-3-5-sonnet`) | `AI_PROVIDER_PRIORITY` |
| **STT (Speech-to-Text)** | OpenAI Whisper | Gemini multimodal | `GEMINI_API_KEY` |
| **TTS (Text-to-Speech)** | OpenAI `tts-1` | Gemini `gemini-2.5-flash-preview-tts` | `GEMINI_TTS_MODEL` |
| **Embeddings** | OpenAI `text-embedding-3-small` | — (always OpenAI) | `OPENAI_API_KEY` |

If the primary provider hits a quota limit, rate limit, or server error, Sandra automatically retries with the next provider. Configure API keys in the **Settings** tab or via environment variables.

---

## 🏗 How Sandra Integrations Work

Unlike consumer tools that ask each user to "Sign in with Google," Sandra uses **organization-level credentials** — service accounts, server-to-server tokens, and API keys. This means:

1. **One-time setup** — An admin connects each platform once for the whole organization
2. **No per-user OAuth** — Team members don't need to individually authorize Sandra
3. **Centralized control** — Admins manage all connections from a single dashboard
4. **Secure credentials** — All secrets are encrypted at rest and never exposed to end users

```
┌──────────────┐     Admin Portal      ┌──────────────────┐
│  Your Admin  │ ──── configures ────▶ │  Sandra Platform  │
└──────────────┘                       └────────┬─────────┘
                                                │
                              Uses org credentials to access:
                                                │
                    ┌───────────┬───────────┬────┴──────┬──────────┐
                    ▼           ▼           ▼           ▼          ▼
               Google WS     Zoom      WhatsApp    Instagram   GitHub
               (Service     (S2S       (Cloud      (Messaging  (PAT)
                Account)    OAuth)      API)        API)
```

---

## 🔐 Prerequisites

Before setting up integrations, make sure you have:

- [ ] **Admin access** to Sandra (your account must have the `admin` role)
- [ ] **Admin access** to your organization's Google Workspace, Zoom, Meta Business, etc.
- [ ] The relevant admin consoles open in your browser

---

## 💬 Need Help?

If you run into issues during setup:

1. Check the **System Health** tab in the admin dashboard for connection status
2. Each integration has a **Test Connection** button to verify credentials
3. Reach out to your Sandra platform administrator for support
