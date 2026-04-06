# Connect Zoom

Give Sandra the ability to schedule Zoom meetings, send invitations, and manage meeting settings on behalf of your organization.

---

## What Sandra Can Do With Zoom

Once connected, Sandra can:

| Capability | Description |
|-----------|-------------|
| **Schedule meetings** | Create Zoom meetings with a topic, date/time, duration, and timezone |
| **Invite attendees** | Automatically add attendee emails as meeting invitees |
| **Share join links** | Provide the meeting join URL and start URL |
| **Configure settings** | Meetings are created with waiting room, host & participant video enabled by default |

### Example Requests

> *"Schedule a Zoom meeting with Alice and Bob tomorrow at 3pm for 30 minutes"*
>
> *"Set up a team standup on Zoom for Monday at 9am, 15 minutes"*
>
> *"Create a Zoom meeting called 'Project Review' for next Friday at 2pm"*

---

## Prerequisites

Before you begin, make sure you have:

- [ ] **Zoom account** with admin or developer access
- [ ] Access to the [Zoom App Marketplace](https://marketplace.zoom.us)
- [ ] **Sandra Admin Portal access**
- [ ] ~10 minutes for setup

---

## Step 1: Create a Server-to-Server OAuth App

Sandra uses Zoom's **Server-to-Server OAuth** (not a standard OAuth flow), so no individual user sign-in is required.

1. Go to the [Zoom App Marketplace](https://marketplace.zoom.us)
2. Click **Develop** (top-right) → **Build App**
3. Choose **Server-to-Server OAuth** and click **Create**

   > ⚠️ Don't choose "OAuth" or "Webhook Only" — you need specifically **Server-to-Server OAuth**

4. Give the app a name: `Sandra AI` or similar
5. Click **Create**

---

## Step 2: Copy Your Credentials

On the **App Credentials** page, you'll see three values. Copy them all:

| Field | Example Value | What It Is |
|-------|-------------|-----------|
| **Account ID** | `AbCdEfGhIjKlMn` | Your Zoom account identifier |
| **Client ID** | `xYzAbCdEfGhIjKl` | The app's unique identifier |
| **Client Secret** | `a1b2c3d4e5f6...` | The app's secret key (keep this safe!) |

---

## Step 3: Add Required Scopes

1. In your app settings, go to the **Scopes** tab
2. Click **+ Add Scopes**
3. Search for and add these scopes:

| Scope | Description |
|-------|-------------|
| `meeting:write:admin` | Create and manage meetings for any user in the account |
| `meeting:write` | Create and manage meetings |

4. Click **Done** to save the scopes

---

## Step 4: Activate the App

1. Go to the **Activation** tab
2. Click **Activate your app**
3. The status should change to **Active** ✅

---

## Step 5: Configure Sandra

### Option A: Via Environment Variables (self-hosted)

```bash
ZOOM_ACCOUNT_ID=AbCdEfGhIjKlMn
ZOOM_CLIENT_ID=xYzAbCdEfGhIjKl
ZOOM_CLIENT_SECRET=a1b2c3d4e5f6...
```

### Option B: Via the Admin Portal

1. Log in to the Sandra Admin Portal (`/admin`)
2. Go to **Settings**
3. Under **Zoom Connection**:
   - Enter the **Account ID**
   - Enter the **Client ID**
   - Enter the **Client Secret**
4. Click **Save** and **Test Connection**

---

## Step 6: Verify the Connection

1. In the Admin Portal, go to **Dashboard → System**
2. Check that **Zoom** shows a green status indicator
3. Try a test in the Sandra chat:
   - Ask: *"Schedule a Zoom meeting for tomorrow at 2pm, 30 minutes"*
   - Sandra should return a meeting link

---

## How It Works Behind the Scenes

```
┌──────────┐    "Schedule a meeting"    ┌──────────┐
│   User   │ ────────────────────────▶ │  Sandra  │
└──────────┘                           └─────┬────┘
                                             │
                                    Token exchange:
                                    Client ID + Secret
                                             │
                                             ▼
                                    ┌────────────────┐
                                    │   Zoom API     │
                                    │ (S2S OAuth)    │
                                    └────────┬───────┘
                                             │
                                    Creates meeting,
                                    returns join URL
                                             │
                                             ▼
┌──────────┐   "Here's your Zoom link"  ┌──────────┐
│   User   │ ◀──────────────────────── │  Sandra  │
└──────────┘                           └──────────┘
```

- Sandra exchanges your Client ID + Secret for a short-lived access token
- Tokens are cached for 1 hour and automatically refreshed
- All meetings are created under your Zoom account (not a personal account)

---

## Troubleshooting

### "Invalid credentials" error

- **Double-check credentials:** Ensure Account ID, Client ID, and Client Secret are correctly entered with no extra spaces
- **App activated?** Go back to marketplace.zoom.us and verify the app status is **Active**

### "Insufficient scopes" error

- **Check scopes:** Make sure both `meeting:write:admin` and `meeting:write` are added
- **Re-activate:** After adding scopes, you may need to deactivate and reactivate the app

### Meetings created but no invitees

- **Check attendee emails:** Sandra sends invites to the email addresses provided in the request — make sure they're valid
- **Zoom plan limits:** Free Zoom plans have meeting participant limits

### Token errors

- **Regenerate credentials:** If you rotated the Client Secret on Zoom's side, update it in Sandra
- **Check Zoom service status:** Visit [status.zoom.us](https://status.zoom.us) for outages

---

## Security Notes

- Sandra uses **Server-to-Server OAuth**, which means no user-facing browser redirects
- Credentials are encrypted at rest in Sandra's database
- Access tokens are short-lived (1 hour) and never exposed to end users
- The app only has `meeting:write` scope — it cannot read recordings, chat messages, or other data
- You can revoke access at any time by deactivating the app on marketplace.zoom.us

---

## Next Steps

- [Connect WhatsApp →](./connect-whatsapp.md) to enable messaging
- [Connect Google Workspace →](./connect-google-workspace.md) if you haven't already
