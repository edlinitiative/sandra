# Connect External APIs

One of Sandra's most powerful features is the ability to connect to **any external API** that has an OpenAPI (Swagger) specification. This means you can extend Sandra with tools from your own internal services, third-party SaaS products, or any REST API.

---

## What This Enables

| Capability | Description |
|-----------|-------------|
| **Custom tools** | Each API endpoint becomes a tool Sandra can use in conversations |
| **Any REST API** | Works with any API that has an OpenAPI 3.x spec |
| **Multiple auth types** | Supports API keys, Bearer tokens, Basic auth, OAuth2 client credentials, and custom headers |
| **Instant activation** | New tools are available to Sandra immediately after registration |
| **Per-tool control** | Enable or disable individual endpoints independently |

### Example Use Cases

- Connect your **CRM API** so Sandra can look up customer information
- Connect a **project management tool** (Jira, Linear, Asana) for task updates
- Connect your **internal HR system** for employee directory lookups
- Connect a **shipping API** to track orders
- Connect **any SaaS with an API** — if it has an OpenAPI spec, Sandra can use it

---

## Prerequisites

- [ ] **Sandra Admin Portal access**
- [ ] An **OpenAPI 3.x specification** (JSON or YAML) for the API you want to connect
- [ ] **API credentials** (API key, token, or OAuth2 client credentials)
- [ ] ~10 minutes per API

> **Where to find OpenAPI specs:** Most modern APIs publish their spec. Look for links like "API Reference," "Swagger," or "OpenAPI" in the service's developer documentation. The URL often ends in `/openapi.json` or `/swagger.json`.

---

## Step 1: Open the Integrations Dashboard

1. Log in to the Sandra Admin Portal (`/admin`)
2. Click the **Integrations** tab
3. You'll see the **External API Connections** panel

---

## Step 2: Add a New Connection

1. Click **+ New Connection**
2. Fill in the connection details:

| Field | Description | Example |
|-------|-------------|---------|
| **Connection Name** | A friendly name for this API | `Acme CRM` |
| **Base URL** | The API's base URL | `https://api.acme.com/v2` |
| **OpenAPI Spec** | Paste or upload the OpenAPI 3.x spec | JSON or YAML |

### Providing the OpenAPI Spec

You have two options:

**Option A: Paste the spec**
- Copy the OpenAPI JSON/YAML content
- Paste it into the spec field

**Option B: Upload a file**
- Click **Upload** and select your `.json` or `.yaml` file

---

## Step 3: Configure Authentication

Select the authentication type your API uses:

### API Key
```
Auth Type: API Key
Header Name: X-API-Key
API Key: your-api-key-here
```

### Bearer Token
```
Auth Type: Bearer Token
Token: your-bearer-token-here
```

### Basic Auth
```
Auth Type: Basic
Username: your-username
Password: your-password
```

### OAuth2 Client Credentials
```
Auth Type: OAuth2 Client Credentials
Client ID: your-client-id
Client Secret: your-client-secret
Token URL: https://auth.example.com/oauth/token
```

### Custom Header
```
Auth Type: Custom Header
Header Name: Authorization
Header Value: Custom your-value-here
```

---

## Step 4: Save and Test

1. Click **Save Connection**
2. Sandra will parse the OpenAPI spec and auto-generate tools for each endpoint
3. Click **Test Connection** to verify Sandra can reach the API

You'll see a health check indicator:
- ✅ **Connected** — API is reachable and credentials work
- ❌ **Failed** — Check your base URL and credentials

---

## Step 5: Manage Individual Tools

After saving, you'll see a list of auto-generated tools — one for each API endpoint:

```
┌──────────────────────────────────────────────────────────┐
│  Acme CRM — 8 tools generated                           │
├──────────────────────────────────────────────────────────┤
│  ✅  GET  /customers        → List Customers            │
│  ✅  GET  /customers/{id}   → Get Customer Details       │
│  ✅  POST /customers        → Create Customer           │
│  ❌  DELETE /customers/{id} → Delete Customer (disabled) │
│  ✅  GET  /orders           → List Orders               │
│  ✅  GET  /orders/{id}      → Get Order Details          │
│  ✅  POST /orders           → Create Order              │
│  ✅  GET  /reports/summary  → Get Report Summary         │
└──────────────────────────────────────────────────────────┘
```

You can:
- **Toggle tools on/off** — Disable endpoints you don't want Sandra to use (e.g., DELETE endpoints)
- **View handler code** — See the auto-generated tool handler
- **Test individual tools** — Verify specific endpoints work

---

## How It Works

```
┌──────────┐   "Look up customer #123"   ┌──────────┐
│   User   │ ──────────────────────────▶ │  Sandra  │
└──────────┘                             └────┬─────┘
                                              │
                                   Sandra selects the
                                   "Get Customer" tool
                                              │
                                              ▼
                                   ┌──────────────────┐
                                   │  Dynamic Tool    │
                                   │  Handler         │
                                   │  GET /customers/ │
                                   │      {id}: 123   │
                                   └────────┬─────────┘
                                            │
                                   Uses stored credentials
                                            │
                                            ▼
                                   ┌──────────────────┐
                                   │  External API    │
                                   │  api.acme.com    │
                                   └────────┬─────────┘
                                            │
                                   Returns customer data
                                            │
                                            ▼
┌──────────┐  "Customer #123 is..."   ┌──────────┐
│   User   │ ◀────────────────────── │  Sandra  │
└──────────┘                         └──────────┘
```

1. Sandra parses the OpenAPI spec to understand available endpoints, parameters, and response schemas
2. Each endpoint becomes a **dynamic tool** with a natural-language description
3. When a user asks a relevant question, Sandra's AI automatically selects the right tool
4. Sandra executes the API call with the stored credentials
5. The response is formatted and presented to the user

---

## Managing Connections

### Edit Credentials
1. Find your connection in the Integrations dashboard
2. Click **Edit**
3. Update the credentials
4. Click **Save** and **Test Connection**

### Disable a Connection
- Toggle the connection to **Inactive** — all its tools will be disabled but the configuration is preserved

### Delete a Connection
- Click **Delete** — this removes the connection and all its auto-generated tools
- This action cannot be undone

---

## Best Practices

### Start with read-only endpoints
Enable GET endpoints first. Only enable POST/PUT/DELETE after testing thoroughly.

### Review auto-generated tools
Sandra auto-generates tool descriptions from the OpenAPI spec. Review them to make sure the descriptions are clear — better descriptions help Sandra choose the right tool.

### Use specific API specs
If an API has hundreds of endpoints, consider providing a trimmed OpenAPI spec with only the endpoints relevant to your use case. Fewer, more focused tools = better accuracy.

### Set up rate limiting
If your API has rate limits, Sandra respects them. Check the connection settings for rate limit configuration.

---

## Troubleshooting

### "Invalid OpenAPI spec" error
- **Version:** Sandra requires OpenAPI 3.x (not Swagger 2.0). Use [Swagger Editor](https://editor.swagger.io) to validate
- **Format:** Ensure the JSON/YAML is well-formed

### "Connection test failed"
- **Base URL:** Make sure it doesn't have a trailing slash and includes the version prefix if needed
- **Credentials:** Double-check auth type and credentials
- **Network:** Ensure Sandra's server can reach the API (not blocked by firewall)

### Sandra doesn't use the right tool
- **Tool descriptions:** Improve the OpenAPI `summary` and `description` fields for better tool matching
- **Too many tools:** If you have many similar endpoints, disable the ones you don't need
- **Be specific:** Ask Sandra to use a specific tool by name if automatic selection isn't working

### API returns errors
- **Check scopes:** Your API credentials might not have access to all endpoints
- **Check parameters:** Review the tool handler to see what parameters Sandra is sending
- **Rate limits:** You may be hitting the API's rate limit

---

## Security Notes

- All API credentials are **encrypted at rest** in Sandra's database
- Credentials are never exposed to end users or included in chat responses
- Each API call is logged for audit purposes
- You can revoke access at any time by updating or deleting the connection
- Sandra only calls endpoints that are **explicitly enabled** as tools

---

## Next Steps

- [Configure Agent Settings →](./agent-settings.md) to control how Sandra uses these tools
- [Admin Portal Overview →](./admin-portal-overview.md) to manage the tools dashboard
