# Admin Portal Overview

The Sandra Admin Portal is your central hub for managing integrations, monitoring system health, and configuring Sandra's behavior for your organization.

---

## Accessing the Admin Portal

1. Navigate to your Sandra instance (e.g., `https://sandra.yourcompany.com`)
2. Click **Log in** and sign in with your Google account
3. Once logged in, click **Admin** in the navigation bar, or go directly to `/admin`

> **Note:** Only users with the `admin` role can access the Admin Portal. If you see a "Not Authorized" page, contact your Sandra platform administrator to upgrade your role.

---

## Dashboard Layout

The Admin Portal has **three main sections**, accessible via the top navigation tabs:

### 1. Dashboard (`/admin`)

The main dashboard contains five sub-tabs:

| Tab | Purpose |
|-----|---------|
| **System** | View system health, connected services status, trigger repository indexing |
| **Analytics** | Event totals, channel breakdown, language usage, popular tools, response times |
| **Actions** | Human-in-the-loop action queue — approve or reject pending actions Sandra wants to take |
| **Gaps** | View unhandled user requests — discover capability gaps and auto-generate new tools |
| **Tools** | Manage dynamic tools — enable/disable, view handler code, delete unused tools |

### 2. Integrations (`/admin/integrations`)

Connect Sandra to external APIs and services:

- **External API Connections** — Register any API with an OpenAPI spec
- **Tool Management** — Toggle individual tools on/off per connection
- **API Keys** — Generate and manage tenant-scoped API keys for programmatic access

### 3. Settings (`/admin/settings`)

Configure Sandra's identity and behavior:

- Agent name, organization branding
- Custom system prompt and additional context
- Supported languages
- Topic guardrails (allowed topics, off-topic responses)

---

## System Health at a Glance

The **System** tab shows the health status of all connected services:

```
┌─────────────────────────────────────────────────────┐
│  System Health                                       │
├──────────────────┬──────────────────────────────────┤
│  Google Workspace │  ● Connected — Last check: 2m ago │
│  Zoom            │  ● Connected — Last check: 5m ago │
│  WhatsApp        │  ● Connected — Last check: 1m ago │
│  AI Providers    │  ● 3/3 configured (OpenAI, Gemini, │
│                  │    Anthropic) — fallback active    │
│  Voice Providers │  ● 2/2 configured (OpenAI, Gemini) │
│  Database        │  ● Connected — Last check: 10s ago│
└──────────────────┴──────────────────────────────────┘
```

Each connector shows:
- **Status indicator** — Green (connected), yellow (degraded), red (disconnected)
- **Last health check** — When the connection was last verified
- **Capabilities** — What features the connection enables
- **Fallback status** — For AI and Voice providers, shows how many providers are configured and whether fallback is active

---

## Quick Start Checklist

If you're setting up Sandra for the first time, follow this order:

1. ✅ **Log in** to the Admin Portal
2. 🔗 **[Connect Google Workspace](./connect-google-workspace.md)** — Gmail, Calendar, Drive (most essential)
3. 📹 **[Connect Zoom](./connect-zoom.md)** — Meeting scheduling
4. 💬 **[Connect WhatsApp](./connect-whatsapp.md)** *(optional)* — Messaging channel
5. 📸 **[Connect Instagram](./connect-instagram.md)** *(optional)* — DM channel
6. 🐙 **[Connect GitHub](./connect-github.md)** *(optional)* — Code knowledge
7. ⚙️ **[Configure Agent Settings](./agent-settings.md)** — Customize Sandra's personality
8. 🔌 **[Add External APIs](./connect-external-apis.md)** *(optional)* — Extend capabilities

---

## Managing the Action Queue

Sandra sometimes needs human approval before taking sensitive actions. The **Actions** tab shows pending requests:

- **Review details** — See exactly what Sandra wants to do (e.g., send an email, create a calendar event)
- **Approve** — Let Sandra proceed with the action
- **Reject** — Block the action with an optional explanation

---

## Capability Gap Detection

The **Gaps** tab is one of Sandra's most powerful features:

1. Sandra tracks requests she couldn't fulfill
2. These appear as "capability gaps" in the admin dashboard
3. You can review each gap and click **Generate Tool** to auto-create a new tool
4. Sandra will generate the tool handler code and make it available immediately

This means Sandra gets smarter over time based on what your team actually needs.

---

## Next Steps

Ready to connect your first platform? Start with [Google Workspace →](./connect-google-workspace.md)
