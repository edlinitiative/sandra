# Agent Settings

Customize Sandra's identity, personality, language support, and topic guardrails. These settings control how Sandra presents herself and what she's allowed to discuss.

---

## Accessing Agent Settings

1. Log in to the Sandra Admin Portal (`/admin`)
2. Click the **Settings** tab
3. You'll see the Agent Configuration panel

---

## Identity & Branding

### Agent Name
The name Sandra uses to introduce herself and sign emails.

| Field | Default | Example |
|-------|---------|---------|
| **Agent Name** | `Sandra` | `Sandra`, `Aria`, `Company Assistant` |

### Organization Info
Help Sandra represent your organization correctly.

| Field | Description | Example |
|-------|-------------|---------|
| **Organization Name** | Your company/org name | `Acme Corp` |
| **Organization Description** | Brief description of your org | `A leading SaaS platform for project management` |
| **Website URL** | Your organization's website | `https://acme.com` |
| **Contact Email** | Support/contact email | `support@acme.com` |

> Sandra uses this information when answering questions about the organization, composing emails, and introducing herself.

---

## System Prompt

The system prompt defines Sandra's core personality and instructions. This is the most powerful way to customize her behavior.

### System Prompt Override
Replace Sandra's default system prompt entirely with your own.

```
You are Sandra, an AI assistant for Acme Corp. You help team members
with scheduling, email, and project management. Always be professional
but friendly. When unsure, ask for clarification rather than guessing.
```

### Additional Context
Add extra instructions **on top of** the default system prompt (without replacing it).

```
- Our fiscal year starts in April
- The CEO is Jane Smith (jane@acme.com)
- Team standup is every day at 9am EST
- Use metric units for all measurements
```

> **Tip:** Use "Additional Context" for facts and guidelines. Use "System Prompt Override" only if you need to completely change Sandra's personality.

---

## Language Support

Configure which languages Sandra can communicate in.

### Supported Languages
Add language codes for languages your team uses:

| Code | Language |
|------|----------|
| `en` | English |
| `fr` | French |
| `es` | Spanish |
| `ar` | Arabic |
| `pt` | Portuguese |
| `zh` | Chinese |

Sandra will automatically detect the language of incoming messages and respond in the same language (if it's in the supported list).

> **Default:** If no languages are configured, Sandra defaults to English.

---

## Topic Guardrails

Control what Sandra is allowed to discuss. This is important for keeping conversations professional and on-brand.

### Allowed Topics
Define the topics Sandra should engage with. Leave empty for no restrictions.

**Examples:**
```
- Company policies and procedures
- Meeting scheduling and calendar management
- Email management
- Project status and updates
- HR questions (benefits, PTO, onboarding)
- IT support and troubleshooting
```

### Off-Topic Response
Define how Sandra responds when asked about topics outside the allowed list.

**Example:**
```
I appreciate the question, but I'm specifically designed to help with
work-related tasks at Acme Corp. For that topic, I'd recommend
reaching out to the appropriate department. Is there anything
work-related I can help you with?
```

---

## Tool & Capability Configuration

### Enabled Tools
Control which tools Sandra has access to. You can selectively enable/disable:

- ✅ Gmail (send, read, draft)
- ✅ Calendar (create, list, update events)
- ✅ Drive (search, read, create files)
- ✅ Zoom (schedule meetings)
- ✅ Tasks (create, list, complete)
- ❌ Forms (disabled for this org)

### Tool Confirmation
Configure which tools require user confirmation before execution:

- **Always confirm:** Sandra asks the user before taking action (safest)
- **Confirm for writes:** Only ask before sending emails, creating events, etc.
- **Never confirm:** Sandra acts immediately (fastest, use with caution)

---

## Saving Changes

1. Make your changes in any of the sections above
2. Click **Save** at the bottom of the Settings page
3. Changes take effect immediately — no restart needed
4. Test in the Sandra chat to verify the new behavior

---

## Configuration Examples

### Customer Support Bot
```yaml
Agent Name: Support Assistant
Org Name: Acme Corp
System Prompt Override: |
  You are the Acme Corp support assistant. Help customers with:
  - Account questions
  - Billing inquiries
  - Product troubleshooting
  Always be empathetic and professional. If you can't resolve
  an issue, offer to escalate to a human agent.
Allowed Topics:
  - Product support
  - Billing
  - Account management
Off-Topic Response: |
  I'm here to help with Acme product support. For other
  questions, please visit acme.com/contact.
```

### Internal Team Assistant
```yaml
Agent Name: Sandra
Org Name: Acme Corp
Additional Context: |
  - Our tech stack: Next.js, PostgreSQL, AWS
  - Sprint planning is every Monday at 10am
  - Use Jira for task tracking (project key: ACME)
  - Code reviews required before merging to main
Supported Languages: en, fr
Allowed Topics: (none - unrestricted)
```

### Multilingual Org Assistant
```yaml
Agent Name: Sandra
Org Name: EdLight
System Prompt Override: |
  You are Sandra, the AI assistant for EdLight. You support
  a multilingual team across Haiti, the US, and France.
  Always respond in the language the user writes to you in.
  Be culturally aware and inclusive.
Supported Languages: en, fr, ht, es
Additional Context: |
  - EdLight operates in education technology
  - Main offices: Port-au-Prince, New York, Paris
  - School year follows the Haitian calendar
```

---

## AI Provider Configuration

Sandra supports multiple AI providers with automatic fallback. If the primary provider is unavailable (quota exceeded, rate limited, server error), Sandra automatically retries with the next configured provider.

### Chat Providers

| Priority | Provider | Model | API Key Env Var |
|----------|----------|-------|-----------------|
| 1 | OpenAI | `gpt-4o` | `OPENAI_API_KEY` |
| 2 | Google Gemini | `gemini-2.0-flash` | `GEMINI_API_KEY` |
| 3 | Anthropic | `claude-3-5-sonnet-20241022` | `ANTHROPIC_API_KEY` |

Priority order can be changed via the `AI_PROVIDER_PRIORITY` environment variable (comma-separated, e.g. `gemini,openai,anthropic`).

> **Note:** Only providers with a valid API key are included in the fallback chain. If only one provider is configured, Sandra uses it directly without fallback.

### Voice Providers

Speech-to-Text (STT) and Text-to-Speech (TTS) also support fallback:

| Priority | Provider | STT | TTS | API Key Env Var |
|----------|----------|-----|-----|-----------------|
| 1 | OpenAI | Whisper | `tts-1` | `OPENAI_API_KEY` |
| 2 | Google Gemini | Multimodal STT | `gemini-2.5-flash-preview-tts` | `GEMINI_API_KEY` |

Voice names are automatically mapped between providers (e.g. `alloy` → Gemini's `Kore`, `nova` → `Leda`).

### Error Behavior

When all providers fail, Sandra shows a user-friendly error message based on the error type:
- **Quota exceeded** → "AI service quota exhausted. Please try again later or contact your admin."
- **Rate limited** → "Too many requests — please wait a moment."
- **Authentication error** → "AI service authentication error. Contact your admin."
- **Server error / timeout** → "AI service temporarily unavailable. Try again shortly."

---

## Best Practices

### Keep the system prompt focused
Don't overload the system prompt with too many instructions. Sandra works best with clear, concise guidance.

### Use Additional Context for facts
Put factual information (team members, schedules, policies) in Additional Context rather than the system prompt. This keeps the prompt clean.

### Test after changes
After saving new settings, test Sandra in the chat to make sure she behaves as expected. Try edge cases.

### Start permissive, then restrict
Begin without topic restrictions and add guardrails as you identify off-topic patterns.

### Review capability gaps
Check the **Gaps** tab in the admin dashboard regularly. If Sandra is being asked about topics you've restricted, consider expanding her scope or improving the off-topic response.

---

## Next Steps

- [Admin Portal Overview →](./admin-portal-overview.md) for the full dashboard guide
- [Connect Google Workspace →](./connect-google-workspace.md) if you haven't connected services yet
- [API Keys →](./api-keys.md) for programmatic access to Sandra
