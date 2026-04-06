# API Keys

Generate and manage API keys for programmatic access to Sandra. API keys let you integrate Sandra into your own applications, scripts, CI/CD pipelines, or custom workflows.

---

## What API Keys Are For

| Use Case | Description |
|----------|-------------|
| **Custom integrations** | Call Sandra's API from your own applications |
| **Automation** | Trigger Sandra actions from scripts or CI/CD |
| **Embedded chat** | Power a chat widget on your website |
| **Webhooks** | Authenticate webhook calls to Sandra |
| **Testing** | Access Sandra's API during development |

---

## Generating an API Key

1. Log in to the Sandra Admin Portal (`/admin`)
2. Go to the **Integrations** tab
3. Scroll to the **API Keys** section
4. Click **Generate New Key**
5. Give the key a descriptive name (e.g., `Website Chat Widget`, `CI/CD Pipeline`)
6. Click **Create**

### Important!

> ⚠️ **Copy the key immediately!** The full key is only shown once. After you close the dialog, you'll only see the prefix (`sandra_key_...xxxx`).

The key format looks like:
```
sandra_key_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

---

## Using Your API Key

Include the key in the `Authorization` header of your API requests:

```bash
curl -X POST https://your-sandra-instance.com/api/chat \
  -H "Authorization: Bearer sandra_key_a1b2c3d4..." \
  -H "Content-Type: application/json" \
  -d '{"message": "What meetings do I have today?"}'
```

---

## Managing Keys

### View Active Keys
The API Keys panel shows all active keys with:
- **Name** — The label you assigned
- **Prefix** — First few characters of the key (`sandra_key_...xxxx`)
- **Created** — When the key was generated
- **Last used** — When the key was last used (if tracked)

### Revoke a Key
1. Find the key in the API Keys panel
2. Click **Revoke**
3. Confirm the action

> ⚠️ **Revoking is immediate and permanent.** Any applications using this key will lose access instantly.

---

## Best Practices

- **One key per integration** — Don't share keys across different applications
- **Rotate regularly** — Generate new keys periodically and revoke old ones
- **Never commit keys** — Don't put API keys in source code or git repositories
- **Use environment variables** — Store keys in env vars or secret managers
- **Revoke unused keys** — Clean up keys that are no longer in use

---

## Security

- Keys are scoped to your **tenant** — they can only access your organization's Sandra instance
- All API calls with keys are **logged** for audit purposes
- Keys are stored as **hashed values** — Sandra cannot retrieve the full key after creation
- Use HTTPS for all API calls

---

## Next Steps

- [External APIs →](./connect-external-apis.md) to extend Sandra with custom APIs
- [Admin Portal Overview →](./admin-portal-overview.md) for the full admin guide
