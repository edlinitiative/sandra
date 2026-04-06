# Sandra — Integration Guide for External Platforms

> This guide is for companies and developers who want to integrate Sandra into their own platforms, products, or workflows.

Sandra exposes a clean HTTP API and a set of webhook contracts. You do not need to run Sandra yourself — you connect to the hosted instance at `https://sandra.edlight.org`. For private deployments or white-labeled instances, contact the EdLight team to have a dedicated tenant provisioned.

---

## 1. The Simplest Integration: Chat API

Sandra's chat endpoint is the foundation of every integration. Any platform that can make HTTP requests can talk to Sandra.

### JSON (request/response)

```http
POST https://sandra.edlight.org/api/chat
Content-Type: application/json

{
  "message": "What courses are available on EdLight Academy?",
  "sessionId": "user-session-abc123",
  "userId": "your-platform-user-id",
  "language": "en",
  "channel": "web"
}
```

**Response:**
```json
{
  "response": "EdLight Academy offers courses in...",
  "sessionId": "user-session-abc123",
  "toolsUsed": ["searchKnowledgeBase"],
  "language": "en"
}
```

**Fields:**

| Field | Required | Description |
|---|---|---|
| `message` | ✅ | The user's message |
| `sessionId` | Recommended | Stable identifier for this conversation. Reuse across turns. Sandra uses it to maintain conversation history. |
| `userId` | Recommended | Stable identifier for this user. Sandra uses it to maintain long-term memory across sessions. |
| `language` | Optional | `en`, `fr`, or `ht` (Haitian Creole). If omitted, Sandra will detect or fall back to the user's stored preference. |
| `channel` | Optional | `web`, `whatsapp`, `instagram`, `email`, `voice`. Controls response formatting. Defaults to `web`. |

### Streaming (Server-Sent Events)

For real-time token streaming — ideal for chat UIs:

```http
POST https://sandra.edlight.org/api/chat/stream
Content-Type: application/json
Accept: text/event-stream

{
  "message": "What scholarships are available?",
  "sessionId": "user-session-abc123",
  "userId": "your-platform-user-id",
  "language": "en"
}
```

**SSE event types:**

| Event | Payload | Description |
|---|---|---|
| `start` | `{ sessionId }` | Stream has begun |
| `token` | `{ token: "..." }` | Incremental response text |
| `tool_call` | `{ tool, input, result }` | A tool was invoked; useful for showing "Sandra is searching…" |
| `done` | `{ response, sessionId, toolsUsed }` | Final response; stream is complete |
| `error` | `{ message }` | An error occurred |

**JavaScript example:**

```javascript
const response = await fetch('https://sandra.edlight.org/api/chat/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message, sessionId, userId, language: 'en' }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const lines = decoder.decode(value).split('\n');
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const event = JSON.parse(line.slice(6));
    if (event.type === 'token') appendToUI(event.token);
    if (event.type === 'done') finalizeMessage(event.response);
  }
}
```

---

## 2. Retrieving Conversation History

```http
GET https://sandra.edlight.org/api/conversations/{sessionId}
```

Returns the full message history for a session. Useful for rendering past conversations in your UI.

---

## 3. WhatsApp Integration

If you want Sandra to handle WhatsApp messages on behalf of your business number:

### Step 1 — Set up a Meta App
1. Go to [Meta for Developers](https://developers.facebook.com)
2. Create a new app → select "Business"
3. Add the WhatsApp product
4. Register your phone number

### Step 2 — Configure the webhook
In Meta Developer Console, set:
- **Webhook URL**: `https://sandra.edlight.org/api/webhooks/whatsapp`
- **Verify token**: the value of `META_VERIFY_TOKEN` in Sandra's environment
- **Subscribe to**: `messages`

Sandra will automatically verify the challenge and begin processing inbound messages.

### Step 3 — Configure credentials
Provide EdLight with:
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_ACCESS_TOKEN`

These are stored as tenant-level provider config so they are fully isolated.

### How it works
- Inbound WhatsApp messages → Sandra processes them as a standard agent conversation → replies via the WhatsApp Cloud API
- Sandra maintains conversation continuity per WhatsApp number
- Users can interact in English, French, or Haitian Creole

---

## 4. Instagram DM Integration

Same approach as WhatsApp:
- **Webhook URL**: `https://sandra.edlight.org/api/webhooks/instagram`
- Subscribe to `messages` in the Instagram product settings in Meta Developer Console
- Provide `INSTAGRAM_PAGE_ACCESS_TOKEN` to EdLight

---

## 5. Voice Integration

Sandra's voice interface uses the OpenAI Realtime API. You can embed it in any web app:

### Ephemeral session minting

```http
POST https://sandra.edlight.org/api/voice/realtime-session
Content-Type: application/json

{
  "userId": "your-platform-user-id",
  "language": "en"
}
```

**Response:**
```json
{
  "client_secret": { "value": "eph_key_abc..." },
  "expires_at": 1712345678
}
```

Use the returned ephemeral key in your WebRTC client to connect to `wss://api.openai.com/v1/realtime`. Sandra's full system prompt (identity, tools, memory) is pre-injected into every session.

### REST voice round-trip

For non-realtime voice (e.g., phone IVR, mobile apps without WebRTC):

```http
POST https://sandra.edlight.org/api/voice/process
Content-Type: multipart/form-data

audio=<audio-blob>
sessionId=user-session-abc123
userId=your-user-id
language=ht
```

Returns an audio response (TTS) plus the text transcript.

### Voice Bridge

The Voice Bridge (`https://voice.edlight.org`) is a standalone WebSocket relay service. Web clients connect to it directly for full-duplex voice without dealing with OpenAI Realtime credentials.

---

## 6. Email Integration

Sandra can be configured to monitor a Gmail inbox and respond to inbound emails as agent conversations. This is useful for support inboxes, enrollment inquiries, or automated workflows.

**How it works:**
1. Sandra polls the configured Gmail account every 5 minutes
2. Unread messages are processed as agent conversations
3. Sandra composes and sends a reply via Gmail
4. The thread is marked as read

To connect an inbox, provide a Google Workspace service account with Gmail delegation for the target address.

---

## 7. Multi-Tenant Setup

If you are embedding Sandra in your own product for multiple customers, each customer gets their own **tenant**. Tenants provide full isolation of:

- Conversation history
- User memory
- Tool configuration (enable/disable per tenant)
- Provider credentials (Google Workspace, Zoom)
- API keys

### Requesting a tenant

Contact EdLight to provision a tenant. You will receive:
- A `tenantId`
- A tenant API key for admin operations

### Per-tenant tool configuration

Each tenant can enable or disable any of Sandra's 66 tools. For example, a tenant that doesn't use Zoom can disable Zoom tools entirely. This is managed via the admin dashboard or the tenant management API.

### Per-tenant Google Workspace

If your organization uses Google Workspace, you can provide a service account scoped to your domain. Sandra will use your domain's delegation for Gmail, Drive, Calendar, Tasks, and Directory — completely isolated from other tenants.

---

## 8. Knowledge Base: Adding Your Own Content

Sandra's RAG pipeline can index content from any GitHub repository. To add your platform's documentation to Sandra's knowledge base:

### Option A — Register a GitHub repository

Provide EdLight with:
- GitHub repository URL
- Branch to index
- Docs path (e.g., `docs/`)

Sandra will index the content and use it to answer questions about your platform.

### Option B — Trigger indexing via API (admin key required)

```http
POST https://sandra.edlight.org/api/index
Content-Type: application/json
x-api-key: your-admin-api-key

{
  "repoId": "your-org/your-repo"
}
```

**Response:**
```json
{
  "success": true,
  "indexed": 42,
  "failed": 0
}
```

### Option C — Index all registered repos

Omit `repoId` to re-index everything:

```http
POST https://sandra.edlight.org/api/index
x-api-key: your-admin-api-key
```

---

## 9. Health & Monitoring

```http
GET https://sandra.edlight.org/api/health
```

**Response:**
```json
{
  "status": "ok",
  "db": "ok",
  "vectorStore": "ok",
  "toolsRegistered": 66,
  "indexedDocs": 411,
  "vectorChunks": 373
}
```

Use this endpoint for uptime monitoring, deployment verification, and load balancer health checks.

---

## 10. Authentication & Security

### API keys
Admin-only endpoints (`/api/repos`, `/api/index`) require:
```http
x-api-key: your-admin-api-key
```

### Webhook signature verification
WhatsApp and Instagram webhooks are verified using Meta's `X-Hub-Signature-256` header. Sandra validates every inbound webhook against `META_APP_SECRET`.

### User authentication
Sandra's web UI uses Google OAuth (NextAuth). Authenticated sessions unlock personalized features: role-based tool access, user memory, and admin controls.

For embedded integrations, you pass a stable `userId` with each request. Sandra links that ID to a canonical user record and maintains memory across all channels and sessions.

---

## 11. Supported Languages

Sandra responds natively in:

| Code | Language |
|---|---|
| `en` | English |
| `fr` | French |
| `ht` | Haitian Creole |

Language can be set:
- Per request (`"language": "ht"` in the request body)
- Per user (stored in user memory; used as fallback for new sessions)
- Auto-detected by Sandra when no preference is set

---

## 12. Quick Reference

| Endpoint | Method | Description | Auth |
|---|---|---|---|
| `/api/chat` | `POST` | Send a message, get JSON response | None |
| `/api/chat/stream` | `POST` | Send a message, get SSE stream | None |
| `/api/conversations/:sessionId` | `GET` | Get conversation history | None |
| `/api/webhooks/whatsapp` | `POST` / `GET` | WhatsApp inbound + challenge | Meta sig |
| `/api/webhooks/instagram` | `POST` / `GET` | Instagram inbound + challenge | Meta sig |
| `/api/voice/realtime-session` | `POST` | Mint ephemeral Realtime key | None |
| `/api/voice/transcribe` | `POST` | Transcribe audio (Whisper) | None |
| `/api/voice/tts` | `POST` | Text-to-speech | None |
| `/api/voice/process` | `POST` | Full voice round-trip | None |
| `/api/index` | `POST` | Trigger repo indexing | API key |
| `/api/repos` | `GET` | List repos + indexing status | API key |
| `/api/health` | `GET` | Service health check | None |

---

## Getting Help

Contact the EdLight team to:
- Provision a new tenant
- Register a GitHub repository for indexing
- Configure WhatsApp / Instagram webhook credentials
- Set up Google Workspace or Zoom for your tenant
- Request a private deployment

*Sandra V5 — April 2026*
