# Connect GitHub

Give Sandra access to your GitHub repositories so she can index code, documentation, and READMEs into her knowledge base. This lets your team ask Sandra questions about your codebase and get accurate answers.

---

## What Sandra Can Do With GitHub

| Capability | Description |
|-----------|-------------|
| **Code knowledge** | Answer questions about your codebase, architecture, and APIs |
| **Documentation lookup** | Find and reference README files, docs, and inline comments |
| **Repository browsing** | Navigate directory structures and read file contents |
| **Knowledge indexing** | Automatically chunk, embed, and index repo content for semantic search |

### Example Requests

> *"How does our authentication flow work?"*
>
> *"What does the UserService class do?"*
>
> *"Show me the API endpoints for the payments module"*
>
> *"What's in the README for our frontend repo?"*

---

## Prerequisites

- [ ] A **GitHub account** with access to the repositories you want Sandra to index
- [ ] Ability to create a **Personal Access Token** (PAT)
- [ ] **Sandra Admin Portal access**
- [ ] ~5 minutes for setup

---

## Step 1: Create a GitHub Personal Access Token

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Click **Generate new token** → **Generate new token (classic)**
3. Configure the token:

   | Setting | Value |
   |---------|-------|
   | **Note** | `Sandra AI - Repo Access` |
   | **Expiration** | Choose an appropriate expiration (90 days recommended) |
   | **Scopes** | Check the boxes below |

4. Required scopes:

   | Scope | Why |
   |-------|-----|
   | ✅ `repo` | Full access to read repository content |

   > **Minimal alternative:** If you only need public repos, select just `public_repo`

5. Click **Generate token** and **copy the token**

> ⚠️ **Save this token!** It won't be shown again. If you lose it, you'll need to generate a new one.

---

## Step 2: Configure Sandra

### Option A: Via Environment Variables (self-hosted)

```bash
# Your GitHub Personal Access Token
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

### Option B: Via the Admin Portal

1. Log in to the Sandra Admin Portal (`/admin`)
2. Go to **Settings**
3. Under **GitHub Connection**:
   - Enter the **Personal Access Token**
4. Click **Save**

---

## Step 3: Register Repositories

Tell Sandra which repositories to index:

1. In the Admin Portal, go to **Dashboard → System**
2. Under **Registered Repositories**, click **Add Repository**
3. Enter the repository in `owner/repo` format:
   - Example: `your-org/frontend-app`
   - Example: `your-org/api-service`
4. Repeat for each repository you want indexed

---

## Step 4: Index the Repositories

1. In the Admin Portal, go to **Dashboard → System**
2. Click **Index Repositories**
3. Sandra will:
   - Fetch all files from each registered repo
   - Filter by relevant file types (code, docs, configs)
   - Skip large binary files and dependencies (`node_modules`, etc.)
   - Chunk the content into meaningful segments
   - Generate vector embeddings for semantic search
   - Store everything in the knowledge base

> **Note:** Initial indexing may take a few minutes depending on repository size. Subsequent re-indexes are faster thanks to content hash-based change detection.

---

## Step 5: Verify

1. In the Sandra chat, ask a question about your code:
   - *"What does the main README say about getting started?"*
   - *"How is authentication implemented in our API?"*
2. Sandra should reference specific files and code from your repos

---

## How Indexing Works

```
┌─────────────┐    Fetch files     ┌─────────────┐
│   GitHub     │ ◀─────────────── │   Sandra    │
│   API        │ ─────────────── ▶│   Indexer   │
└─────────────┘    Repo content    └──────┬──────┘
                                          │
                                   Filter & chunk
                                          │
                                          ▼
                                   ┌──────────────┐
                                   │  Embedding   │
                                   │  (OpenAI)    │
                                   └──────┬───────┘
                                          │
                                   Vector embeddings
                                          │
                                          ▼
                                   ┌──────────────┐
                                   │  pgvector    │
                                   │  Knowledge   │
                                   │  Base        │
                                   └──────────────┘
```

- **Change detection:** Sandra hashes file content. On re-index, only changed files are re-processed.
- **File filtering:** Only code and documentation files are indexed (no images, binaries, or lock files).
- **Chunking:** Large files are split into meaningful chunks for accurate search retrieval.

---

## Keeping Knowledge Up to Date

- **Manual re-index:** Click **Index Repositories** in the admin dashboard whenever you want to refresh
- **Automatic:** Set up a cron job or CI/CD hook to trigger re-indexing on push (via Sandra's API)

---

## Troubleshooting

### "Authentication failed" error

- **Check token:** Verify the PAT hasn't expired and is entered correctly
- **Token permissions:** Ensure the `repo` scope is selected

### Repository not found

- **Access:** Make sure the PAT has access to the repository (the token owner must be a collaborator or org member)
- **Format:** Use `owner/repo` format, not the full URL

### Incomplete indexing

- **Large repos:** Very large repositories may take longer — check the admin dashboard for indexing status
- **Rate limits:** GitHub has API rate limits (5,000 requests/hour for authenticated users). Very large organizations may need to index in batches

### Sandra gives wrong answers about code

- **Stale index:** Re-index to pick up recent changes
- **Ambiguous questions:** Be specific about which repo or file you're asking about
- **Missing repos:** Make sure all relevant repositories are registered

---

## Security Notes

- The GitHub PAT is encrypted at rest in Sandra's database
- Sandra only **reads** from repositories — she never pushes code, creates issues, or modifies anything
- Indexed content is stored as vector embeddings in Sandra's database, not as raw files
- You can rotate the PAT at any time by generating a new one on GitHub and updating Sandra

---

## Token Rotation Reminder

GitHub PATs have expiration dates. Set a calendar reminder to:

1. Generate a new PAT before the current one expires
2. Update the token in Sandra's admin settings
3. Verify the connection still works

---

## Next Steps

- [Add External APIs →](./connect-external-apis.md) to extend Sandra with custom tools
- [Configure Agent Settings →](./agent-settings.md) to customize Sandra's behavior
