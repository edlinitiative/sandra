# Connect Google Workspace

Give Sandra access to your organization's Gmail, Google Calendar, Drive, Tasks, Forms, and Contacts. This is the most impactful integration — it lets Sandra manage email, schedule meetings, find documents, and more.

---

## What Sandra Can Do With Google Workspace

Once connected, Sandra gains these capabilities:

| Service | Capabilities |
|---------|-------------|
| **Gmail** | Send emails, create drafts, read & search messages, reply to threads |
| **Calendar** | Create events (with Google Meet), list upcoming events, update & cancel events |
| **Drive** | Search files, read documents, create Google Docs & Sheets, share files |
| **Tasks** | Create to-do items, list tasks, mark complete, delete tasks |
| **Forms** | Create forms with questions, read form responses |
| **Contacts** | Look up team members by email, list directory users, find birthdays |

---

## Prerequisites

Before you begin, make sure you have:

- [ ] **Google Workspace admin access** (Super Admin or delegated admin)
- [ ] **Google Cloud Console access** for your organization
- [ ] **Sandra Admin Portal access**
- [ ] ~20 minutes for the full setup

---

## Step 1: Create a Google Cloud Project

If you don't already have a Cloud project for Sandra:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click the **project selector** at the top → **New Project**
3. Name it something like `Sandra AI Assistant`
4. Select your organization
5. Click **Create**

---

## Step 2: Enable Required APIs

In your Google Cloud project, enable the following APIs:

1. Go to **APIs & Services → Library**
2. Search for and enable each of these:

| API | Required For |
|-----|-------------|
| **Gmail API** | Email sending, reading, drafts |
| **Google Calendar API** | Event management |
| **Google Drive API** | File search, reading, creation |
| **Google Tasks API** | Task management |
| **Google Forms API** | Form creation and responses |
| **Admin SDK API** | Directory/contacts lookup |
| **Google Sheets API** | Spreadsheet reading |
| **People API** | Contact details, birthdays |

> **Tip:** You can also enable these from the search bar — just search each API name and click **Enable**.

---

## Step 3: Create a Service Account

Sandra uses a **service account** (not a personal Google account) to access your Workspace. This is more secure and doesn't require individual user sign-ins.

1. Go to **APIs & Services → Credentials**
2. Click **+ Create Credentials → Service Account**
3. Fill in the details:
   - **Name:** `Sandra AI`
   - **ID:** `sandra-ai` (auto-generated, you can customize)
   - **Description:** `Service account for Sandra AI assistant`
4. Click **Create and Continue**
5. Skip the optional role assignment → click **Continue**
6. Skip the user access section → click **Done**

### Download the Key File

1. Click on your new service account (`sandra-ai@...`)
2. Go to the **Keys** tab
3. Click **Add Key → Create new key**
4. Select **JSON** format
5. Click **Create** — a `.json` file will download

> ⚠️ **Keep this file safe!** It contains the private key Sandra will use. You'll upload it to Sandra in a later step.

The key file looks like this:
```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...",
  "client_email": "sandra-ai@your-project.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  ...
}
```

**Note the `client_id` value** — you'll need it in the next step.

---

## Step 4: Set Up Domain-Wide Delegation

This step authorizes your service account to act on behalf of users in your Workspace domain.

1. Go to [Google Workspace Admin Console](https://admin.google.com)
2. Navigate to **Security → Access and data control → API controls**
3. Click **Manage Domain Wide Delegation**
4. Click **Add new**
5. Enter the following:

| Field | Value |
|-------|-------|
| **Client ID** | The `client_id` from your service account JSON (numeric, e.g., `123456789`) |
| **OAuth scopes** | Copy and paste the full list below |

### Required OAuth Scopes

Copy this entire comma-separated list:

```
https://www.googleapis.com/auth/drive.readonly,https://www.googleapis.com/auth/drive.file,https://www.googleapis.com/auth/gmail.send,https://www.googleapis.com/auth/gmail.compose,https://www.googleapis.com/auth/gmail.readonly,https://www.googleapis.com/auth/gmail.modify,https://www.googleapis.com/auth/admin.directory.user.readonly,https://www.googleapis.com/auth/admin.directory.group.readonly,https://www.googleapis.com/auth/calendar,https://www.googleapis.com/auth/calendar.events,https://www.googleapis.com/auth/tasks,https://www.googleapis.com/auth/forms.body,https://www.googleapis.com/auth/forms.responses.readonly,https://www.googleapis.com/auth/contacts.readonly,https://www.googleapis.com/auth/spreadsheets.readonly
```

6. Click **Authorize**

> **What this does:** It tells Google Workspace that your service account is trusted to access Gmail, Calendar, Drive, etc. on behalf of your organization's users — without each user needing to individually sign in.

---

## Step 5: Configure Sandra

Now bring the credentials into Sandra:

### Option A: Via Environment Variables (self-hosted)

If you're running Sandra yourself, set these environment variables:

```bash
# The entire JSON key file contents, base64 encoded:
GOOGLE_SA_KEY_JSON=$(cat your-service-account-key.json | base64)

# Your Workspace domain
GOOGLE_WORKSPACE_DOMAIN=yourcompany.com

# An admin email in your org (Sandra impersonates this for directory lookups)
GOOGLE_ADMIN_EMAIL=admin@yourcompany.com

# The email Sandra will send emails from
GOOGLE_DRIVE_IMPERSONATE_EMAIL=sandra@yourcompany.com

# Optional: Specific Drive folder IDs to index
GOOGLE_DRIVE_FOLDER_IDS=folder-id-1,folder-id-2
```

### Option B: Via the Admin Portal

1. Log in to the Sandra Admin Portal (`/admin`)
2. Go to the **Settings** tab
3. Under **Google Workspace Connection**:
   - Upload or paste the service account JSON key
   - Enter your Workspace domain
   - Enter the admin email (for directory lookups)
   - Enter Sandra's email address (for sending emails)
   - Optionally specify Drive folder IDs to index
4. Click **Save** and then **Test Connection**

---

## Step 6: Verify the Connection

1. In the Admin Portal, go to the **Dashboard → System** tab
2. Check that **Google Workspace** shows a green status indicator
3. Try a test:
   - In the Sandra chat, ask: *"What meetings do I have this week?"*
   - Or: *"Search my Drive for the quarterly report"*
   - Or: *"Send a test email to myself"*

---

## What Each Scope Does

Here's a breakdown of why each permission is needed:

| Scope | Permission Level | Why Sandra Needs It |
|-------|-----------------|-------------------|
| `drive.readonly` | Read-only | Search and read files in Google Drive |
| `drive.file` | Read/write (files Sandra creates) | Create Google Docs and Sheets |
| `gmail.send` | Send only | Send emails on behalf of users |
| `gmail.compose` | Create drafts | Save email drafts |
| `gmail.readonly` | Read-only | Search and read email messages |
| `gmail.modify` | Mark read/labels | Mark emails as read after processing |
| `admin.directory.user.readonly` | Read-only | Look up team members in the directory |
| `admin.directory.group.readonly` | Read-only | Look up groups/teams |
| `calendar` | Full access | Create, read, update, delete calendar events |
| `calendar.events` | Events only | Manage calendar events |
| `tasks` | Full access | Create, list, complete, delete tasks |
| `forms.body` | Create/edit | Create Google Forms with questions |
| `forms.responses.readonly` | Read-only | Read form submission responses |
| `contacts.readonly` | Read-only | Look up contact details and birthdays |
| `spreadsheets.readonly` | Read-only | Read data from Google Sheets |

---

## Troubleshooting

### "Insufficient permissions" errors

- **Check Domain-Wide Delegation:** Go back to the Google Workspace Admin Console and verify the scopes are correctly configured
- **Verify the Client ID:** Make sure you used the numeric `client_id` from the JSON key file, not the email address

### "Token exchange failed" errors

- **Check the key file:** Ensure the full JSON key file was uploaded/configured correctly
- **Check expiration:** Service account keys don't expire, but if you deleted/rotated the key in Cloud Console, generate a new one

### "User not found" errors

- **Check the admin email:** The configured admin email must be a real Super Admin in your Workspace
- **Check the domain:** Make sure the domain matches your Workspace domain exactly

### Sandra can't find Drive files

- **Check folder permissions:** The service account needs access to the folders, or use the Domain-Wide Delegation scopes
- **Trigger reindexing:** Go to Dashboard → System and click **Index Repositories** to rebuild the knowledge base
- **Check folder IDs:** If you specified specific folder IDs, make sure they're correct

---

## Security Notes

- The service account JSON key is **encrypted at rest** in Sandra's database
- Sandra accesses your Workspace via **impersonation** — she acts as a designated user (the admin email), not as an external entity
- All API calls go through Google's standard OAuth2 token exchange
- Access tokens are short-lived (1 hour) and automatically refreshed
- You can revoke access at any time by deleting the service account key or removing Domain-Wide Delegation

---

## Next Steps

- [Connect Zoom →](./connect-zoom.md) for meeting scheduling
- [Configure Agent Settings →](./agent-settings.md) to customize Sandra's email signature and behavior
