# Dynamic Tools

Sandra can automatically generate new tools to fill capability gaps. The Dynamic Tools panel lets you review, manage, and control these auto-generated tools.

---

## How Dynamic Tools Work

1. A user asks Sandra something she can't currently do
2. Sandra logs this as a **capability gap** in the admin dashboard
3. An admin reviews the gap and clicks **Generate Tool**
4. Sandra creates a new tool with handler code automatically
5. The tool is immediately available for all users

This means Sandra **gets smarter over time** based on what your team actually needs.

---

## Managing Dynamic Tools

### Viewing Tools

1. Go to the Admin Portal → **Dashboard → Tools** tab
2. You'll see a list of all dynamic tools with:

| Column | Description |
|--------|-------------|
| **Name** | The tool's identifier |
| **Description** | What the tool does (used by AI for tool selection) |
| **Source** | How it was created (auto-generated, from API connection, manual) |
| **Status** | Enabled or disabled |
| **Usage** | How many times the tool has been invoked |

### Enabling / Disabling Tools

- Toggle the **Enabled** switch to turn a tool on or off
- Disabled tools won't appear in Sandra's toolbox and can't be invoked

### Viewing Handler Code

- Click on a tool to see its handler code
- This is the JavaScript function that executes when the tool is called
- Review the code to ensure it does what you expect

### Deleting Tools

- Click **Delete** to permanently remove a tool
- This cannot be undone — but you can always regenerate from the Gaps tab

---

## From Capability Gaps to Tools

### Reviewing Gaps

1. Go to **Dashboard → Gaps** tab
2. You'll see unhandled user requests:

```
┌─────────────────────────────────────────────────────┐
│  Capability Gaps                                     │
├──────────────────────────────────────────────────────┤
│  "Can you check the weather in Port-au-Prince?"      │
│  Seen 12 times | Last: 2 hours ago                   │
│  [Generate Tool] [Dismiss]                           │
├──────────────────────────────────────────────────────┤
│  "What's the exchange rate for HTG to USD?"           │
│  Seen 8 times | Last: 5 hours ago                    │
│  [Generate Tool] [Dismiss]                           │
└──────────────────────────────────────────────────────┘
```

3. Click **Generate Tool** to have Sandra auto-create a tool for that capability
4. Or click **Dismiss** if it's not something Sandra should handle

---

## Best Practices

- **Review before enabling:** Always review auto-generated tool code before leaving it enabled
- **Monitor usage:** Check the usage count — tools that are never used might have unclear descriptions
- **Clean up:** Delete tools that are no longer needed to keep Sandra's toolbox focused
- **Test after generation:** Try the capability that triggered the gap to make sure the new tool works

---

## Next Steps

- [Agent Settings →](./agent-settings.md) to configure which tool categories are enabled
- [External APIs →](./connect-external-apis.md) for adding tools via OpenAPI specs
- [Admin Portal Overview →](./admin-portal-overview.md) for the full dashboard guide
