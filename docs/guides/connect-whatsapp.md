# Connect WhatsApp

Let your team interact with Sandra through WhatsApp. Once connected, users can message Sandra directly from their phone, send images and voice notes, and get AI-powered responses — all through the familiar WhatsApp interface.

---

## What Sandra Can Do on WhatsApp

| Capability | Description |
|-----------|-------------|
| **Text conversations** | Full AI conversations via WhatsApp messages |
| **Image understanding** | Users can send photos — Sandra uses vision AI to understand them |
| **Voice notes** | Users can send voice messages — Sandra transcribes and responds |
| **Group chats** | Sandra can participate in WhatsApp group conversations (when mentioned) |
| **Identity linking** | Users can link their WhatsApp number to their Sandra account for personalized responses |

---

## Prerequisites

Before you begin, make sure you have:

- [ ] A **Meta Business Account** ([business.facebook.com](https://business.facebook.com))
- [ ] Access to the **Meta Developer Console** ([developers.facebook.com](https://developers.facebook.com))
- [ ] A **phone number** to use for Sandra (can be a virtual number)
- [ ] **Sandra Admin Portal access**
- [ ] ~30 minutes for setup

---

## Step 1: Set Up Meta Business & Developer Accounts

If you don't already have these:

1. Go to [business.facebook.com](https://business.facebook.com) and create a Meta Business Account
2. Go to [developers.facebook.com](https://developers.facebook.com) and register as a developer
3. Verify your business if prompted (may take 1-2 days)

---

## Step 2: Create a Meta App

1. Go to [developers.facebook.com/apps](https://developers.facebook.com/apps)
2. Click **Create App**
3. Select **Business** as the app type
4. Fill in:
   - **App name:** `Sandra AI`
   - **Contact email:** Your admin email
   - **Business Account:** Select your business
5. Click **Create App**

---

## Step 3: Add WhatsApp to Your App

1. From your app dashboard, click **Add Product**
2. Find **WhatsApp** and click **Set Up**
3. Follow the prompts to connect your Meta Business Account

---

## Step 4: Configure a Phone Number

1. In the WhatsApp section, go to **API Setup**
2. You'll see a **test phone number** provided by Meta — this works for development
3. For production, click **Add phone number** and register your business phone number
4. Complete the phone number verification process

**Note the following values:**

| Value | Where to Find It | Example |
|-------|-----------------|---------|
| **Phone Number ID** | WhatsApp → API Setup → Phone Number ID | `123456789012345` |
| **WhatsApp Business Account ID** | WhatsApp → API Setup | `987654321098765` |

---

## Step 5: Generate a Permanent Access Token

1. Go to **App Settings → Basic** and note your **App ID** and **App Secret**
2. In the WhatsApp API Setup page, you'll see a **Temporary access token** — this expires in 24 hours
3. For production, generate a **System User Token**:

   a. Go to [business.facebook.com/settings/system-users](https://business.facebook.com/settings/system-users)

   b. Click **Add** → create a system user named `Sandra Bot`

   c. Set the role to **Admin**

   d. Click **Generate Token**

   e. Select your app (`Sandra AI`)

   f. Add these permissions:
      - `whatsapp_business_messaging`
      - `whatsapp_business_management`

   g. Click **Generate Token** and **copy the token**

> ⚠️ **Save this token securely!** It won't be shown again.

---

## Step 6: Set Up the Webhook

Sandra needs to receive incoming WhatsApp messages via a webhook.

1. In your Meta app, go to **WhatsApp → Configuration**
2. Under **Webhook**, click **Edit**
3. Enter:

   | Field | Value |
   |-------|-------|
   | **Callback URL** | `https://your-sandra-domain.com/api/webhooks/whatsapp` |
   | **Verify Token** | A secret string you choose (e.g., `sandra-whatsapp-verify-2026`) |

4. Click **Verify and Save**
5. Under **Webhook fields**, subscribe to:
   - `messages` ✅

> **How it works:** When someone sends a WhatsApp message, Meta sends it to your Sandra webhook URL. Sandra processes it, generates a response, and sends it back via the WhatsApp Cloud API.

---

## Step 7: Configure Sandra

### Option A: Via Environment Variables (self-hosted)

```bash
# Your WhatsApp phone number ID
WHATSAPP_PHONE_NUMBER_ID=123456789012345

# The permanent access token from Step 5
WHATSAPP_ACCESS_TOKEN=EAAxxxxxxx...

# The verify token you chose for the webhook
WHATSAPP_WEBHOOK_SECRET=sandra-whatsapp-verify-2026

# API version (optional, defaults to v19.0)
WHATSAPP_API_VERSION=v19.0
```

### Option B: Via the Admin Portal

1. Log in to the Sandra Admin Portal (`/admin`)
2. Go to **Settings**
3. Under **WhatsApp Channel**:
   - Enter the **Phone Number ID**
   - Enter the **Access Token**
   - Enter the **Verify Token**
4. Click **Save**

---

## Step 8: Verify the Connection

1. Send a WhatsApp message to your Sandra phone number
2. You should receive an AI-powered response within a few seconds
3. Try sending:
   - A text message: *"Hello Sandra!"*
   - A photo: Sandra will describe what she sees
   - A voice note: Sandra will transcribe and respond

---

## Identity Linking

Users can link their WhatsApp number to their Sandra account for personalized responses:

1. User sends a message to Sandra on WhatsApp
2. Sandra asks if they'd like to link their account
3. User provides their email address
4. Sandra sends a verification code to that email
5. User confirms the code on WhatsApp
6. From now on, Sandra recognizes them across all channels (web, WhatsApp, email)

---

## Group Chat Behavior

Sandra can participate in WhatsApp groups:

- Sandra only responds when **mentioned by name** or **directly replied to**
- She maintains context of the group conversation
- Group privacy is respected — Sandra doesn't store individual messages without consent
- To add Sandra to a group, add the Sandra phone number as a participant

---

## Troubleshooting

### Messages not being received

- **Check webhook:** Verify the callback URL is correct and publicly accessible (HTTPS required)
- **Check subscription:** Make sure `messages` is subscribed under Webhook fields
- **Check verify token:** The verify token in Sandra must match what you entered in Meta

### "Message failed to send" errors

- **Check access token:** Permanent tokens don't expire, but if you regenerated it, update Sandra
- **24-hour window:** WhatsApp requires users to message Sandra first. Sandra can only respond within 24 hours of the last user message (unless using message templates)
- **Phone number active:** Ensure your phone number is still active and verified in Meta Business Manager

### Slow responses

- **Normal latency:** WhatsApp messages go through Meta's servers, so expect 2-5 second round-trip times
- **Voice notes:** Transcription adds 1-3 seconds of processing time

### Identity linking not working

- **Email delivery:** Check spam folders for the verification email
- **Correct email:** Make sure the user has an existing Sandra account with that email

---

## Security Notes

- All webhook payloads are verified using **HMAC-SHA256 signature validation** to prevent spoofing
- Message deduplication prevents processing the same message twice
- Access tokens are encrypted at rest in Sandra's database
- Sandra does not store message content long-term unless the user has opted into memory/learning features
- Voice notes are transcribed and then discarded — audio files are not stored

---

## Next Steps

- [Connect Instagram →](./connect-instagram.md) for another messaging channel
- [Connect Google Workspace →](./connect-google-workspace.md) if you haven't already
