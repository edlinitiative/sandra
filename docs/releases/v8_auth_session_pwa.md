# V8 — Auth Session Wiring, PWA, and Header Sign-In

**Date:** May 24, 2026
**Commit:** `4028837`

---

## Summary

Fixed the broken authentication bridge between the web/PWA frontend and the chat API. Before these fixes, signing in with Google OAuth was cosmetic — the chat API always treated you as `guest`, so Sandra couldn't use Google Workspace or Zoom tools on your behalf. Now signed-in users get their real role-based scopes.

---

## What Changed

### 1. Chat API now reads NextAuth session (`route.ts`, `stream/route.ts`)

**Files:** `src/app/api/chat/route.ts`, `src/app/api/chat/stream/route.ts`

**Before:** Both chat endpoints called `authenticateRequest()` which only checks `Authorization: Bearer` headers and `x-user-id` (dev only). The web frontend sends neither — so every request got `guest` scopes.

**After:** Both endpoints now try NextAuth first via `auth()` (dynamic import to not break tests), then fall back to Bearer token, then guest:

```
NextAuth cookie → Bearer token → guest fallback
```

When a user signed in via Google OAuth sends a message, the API now:
- Reads their Sandra user ID from the NextAuth session
- Looks up their real role (`student`, `educator`, `admin`)
- Derives scopes from that role (e.g. `admin` → `gmail:send`, `zoom:meeting`, `calendar:write`)

### 2. Fixed duplicate user creation (`canonical-user.ts`)

**File:** `src/lib/users/canonical-user.ts`

**Bug:** The frontend's `useUserIdentity` sends `session.user.id` (Sandra internal cuid like `user_abc123`) as the `userId` field. `resolveCanonicalUser()` passed this directly to `resolveUserByExternalId()` which looked it up in the `externalId` column. Since cuids don't match any `externalId`, it created a **new duplicate User row** on every single request.

**Fix:** Now checks if the ID looks like a Sandra internal cuid (starts with `user_` or matches cuid pattern) and does a `getUserById()` lookup first before falling back to external ID resolution.

### 3. PWA service worker

**File:** `public/sw.js` (new)

Added a cache-first service worker that caches static assets (home, chat, login pages, icons, manifest). Enables offline support and full PWA install capability.

**File:** `src/app/layout.tsx` — registers the service worker on page load.

### 4. Header sign-in/out UI

**File:** `src/components/layout/header.tsx`

**Before:** The account icon was decorative only — no click handlers, no auth state.

**After:**
- **Signed out:** Shows a "Sign in" button that redirects to Google OAuth → `/chat`
- **Signed in:** Shows user avatar/name dropdown with:
  - Name, email, role badge
  - Link to Chat
  - Link to Admin (admin only)
  - Sign out button
- **Loading:** Shows pulsing account icon
- Works identically on desktop and mobile

---

## Scope Resolution (What Users Get)

| Role | Can do |
|------|--------|
| `guest` | Search knowledge base, view repos |
| `student` | Above + read Gmail, draft emails, create calendar events, read Drive |
| `educator` | Above + write enrollments, write forms |
| `admin` | Everything: send Gmail, create Zoom meetings, full Drive access, admin tools |

---

## Test Impact

- 0 new test failures introduced
- 25 pre-existing failures remain (in `sandra.test.ts`, `integration.test.ts` — unrelated agent-level tests)
- 132 test files pass, 1515 tests pass
- TS check: 1 pre-existing error (voice-conversation test mock)
