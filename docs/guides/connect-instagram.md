# Connect Instagram

Let users interact with Sandra through Instagram Direct Messages. Once connected, Sandra can respond to DMs, understand images and voice messages, and provide AI-powered support through Instagram.

---

## What Sandra Can Do on Instagram

| Capability | Description |
|-----------|-------------|
| **DM conversations** | Full AI conversations via Instagram Direct Messages |
| **Image understanding** | Users can send photos — Sandra uses vision AI to understand them |
| **Voice messages** | Users can send audio — Sandra transcribes and responds |
| **Identity linking** | Users can link their Instagram to their Sandra account for personalized responses |

---

## Prerequisites

Before you begin, make sure you have:

- [ ] An **Instagram Business** or **Creator** account (not a personal account)
- [ ] A **Meta Business Account** linked to your Instagram
- [ ] Access to the **Meta Developer Console** ([developers.facebook.com](https://developers.facebook.com))
- [ ] **Sandra Admin Portal access**
- [ ] ~20 minutes for setup

> **Tip:** If you already set up WhatsApp, you can reuse the same Meta App — just add Instagram as another product.

---

## Step 1: Convert to a Business Account (if needed)

1. Open Instagram → **Settings → Account**
2. Tap **Switch to Professional Account**
3. Select **Business**
4. Connect to your Facebook/Meta Business Page

---

## Step 2: Create or Use a Meta App

If you already created a Meta App for WhatsApp, skip to Step 3.

1. Go to [developers.facebook.com/apps](https://developers.facebook.com/apps)
2. Click **Create App** → select **Business**
3. Name it `Sandra AI` and connect your Business Account
4. Click **Create App**

---

## Step 3: Add Instagram Messaging to Your App

1. From your Meta app dashboard, click **Add Product**
2. Find **Instagram** (or **Messenger** with Instagram) and click **Set Up**
3. Connect your Instagram Business Account when prompted

---

## Step 4: Generate an Access Token

1. Go to **App Settings → Advanced**
2. Create a **System User** (or reuse one from WhatsApp setup):

   a. Go to [business.facebook.com/settings/system-users](https://business.facebook.com/settings/system-users)

   b. Create a system user named `Sandra Instagram Bot`

   c. Click **Generate Token** for your app

   d. Add these permissions:
      - `instagram_basic`
      - `instagram_manage_messages`
      - `pages_messaging`
      - `pages_manage_metadata`

   e. Click **Generate Token** and copy it

---

## Step 5: Set Up the Webhook

1. In your Meta app, go to **Instagram → Webhooks** (or **Messenger → Webhooks**)
2. Click **Edit Subscription**
3. Enter:

   | Field | Value |
   |-------|-------|
   | **Callback URL** | `https://your-sandra-domain.com/api/channels/instagram` |
   | **Verify Token** | A secret string you choose (e.g., `sandra-ig-verify-2026`) |

4. Click **Verify and Save**
5. Subscribe to these webhook fields:
   - `messages` ✅
   - `messaging_postbacks` ✅

---

## Step 6: Configure Sandra

### Option A: Via Environment Variables (self-hosted)

```bash
# The page/app access token from Step 4
INSTAGRAM_ACCESS_TOKEN=EAAxxxxxxx...

# The verify token you chose for the webhook
INSTAGRAM_VERIFY_TOKEN=sandra-ig-verify-2026

# Webhook signature verification secret (from App Settings → Basic → App Secret)
INSTAGRAM_APP_SECRET=abcdef123456...

# API version (optional, defaults to v19.0)
INSTAGRAM_API_VERSION=v19.0
```

### Option B: Via the Admin Portal

1. Log in to the Sandra Admin Portal (`/admin`)
2. Go to **Settings**
3. Under **Instagram Channel**:
   - Enter the **Access Token**
   - Enter the **Verify Token**
   - Enter the **App Secret**
4. Click **Save**

---

## Step 7: Verify the Connection

1. Send a DM to your Instagram Business account
2. Sandra should respond within a few seconds
3. Try sending:
   - A text message: *"Hey Sandra, what can you do?"*
   - A photo: Sandra will analyze and describe it
   - A voice message: Sandra will transcribe and respond

---

## Instagram-Specific Behavior

### Message Formatting
Sandra automatically adapts her formatting for Instagram:
- Markdown (bold, code blocks, etc.) is stripped — Instagram DMs don't support rich text
- Long responses are automatically split into multiple messages to stay within Instagram's character limits

### Identity Linking
Just like WhatsApp, users can link their Instagram account to their Sandra profile:
1. User DMs Sandra
2. Sandra offers to link their account
3. User provides their email
4. Verification code sent to email
5. User confirms on Instagram

---

## Troubleshooting

### DMs not being received

- **Webhook URL:** Must be HTTPS and publicly accessible
- **Webhook subscription:** Verify `messages` is subscribed
- **Account type:** Must be a Business or Creator account — personal accounts don't support messaging APIs
- **App review:** For production, your Meta app may need to pass App Review for the `instagram_manage_messages` permission

### "Permission denied" errors

- **Check token permissions:** Ensure the system user token has all required permissions
- **Page connected:** Your Instagram account must be connected to a Facebook Page that's connected to your Meta Business Account

### Slow or no responses

- **Check Sandra logs:** The admin dashboard System tab will show Instagram channel events
- **Meta delays:** Instagram messaging API can have occasional delays during peak times

### App Review Required

For production use with users outside your business:
1. Go to **App Review** in your Meta app settings
2. Request approval for `instagram_manage_messages`
3. Provide a description of how Sandra uses Instagram messaging
4. Submit for review (typically takes 1-5 business days)

> **Note:** During development, you can test with accounts that have a role in your Meta app (Admin, Developer, Tester) without App Review.

---

## Security Notes

- All incoming webhook payloads are verified using **HMAC-SHA256 signature validation**
- Messages are deduplicated to prevent double-processing
- Access tokens are encrypted at rest
- Sandra processes messages serially per user to maintain conversation coherence
- Audio messages are transcribed in-memory and not stored as files

---

## Next Steps

- [Connect GitHub →](./connect-github.md) to index your code repositories
- [Configure Agent Settings →](./agent-settings.md) to customize how Sandra responds on Instagram
