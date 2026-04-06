/**
 * NextAuth v5 (Auth.js) configuration.
 *
 * Supports multiple auth providers:
 * - Google OAuth
 * - Facebook OAuth (env-gated: AUTH_FACEBOOK_ID + AUTH_FACEBOOK_SECRET)
 * - Email OTP (Credentials provider — codes sent via SMTP)
 * - Phone/SMS OTP (Credentials provider — codes sent via Twilio)
 *
 * No DB adapter — users are upserted into Sandra's own User table via callbacks.
 */

import NextAuth, { type DefaultSession } from 'next-auth';
import Google from 'next-auth/providers/google';
import Facebook from 'next-auth/providers/facebook';
import Credentials from 'next-auth/providers/credentials';
import { db } from '@/lib/db';
import { resolveUserByExternalId } from '@/lib/db/users';
import { verifyOtp } from '@/lib/auth/otp';
import { createLogger } from '@/lib/utils';

const log = createLogger('auth:nextauth');

// ── Module augmentation ───────────────────────────────────────────────────────

declare module 'next-auth' {
  interface Session {
    user: {
      /** Sandra's internal user ID (cuid) */
      id: string;
      /** External identity string, e.g. "google:1234567890" */
      externalId: string;
      /** Sandra role: guest | student | educator | admin */
      role: string;
    } & DefaultSession['user'];
  }

  interface JWT {
    sandraUserId?: string;
    externalId?: string;
    role?: string;
  }
}

// ── Auth config ───────────────────────────────────────────────────────────────

// Build the providers list dynamically based on configured env vars
const providers = [
  Google({
    // AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are read automatically from env
    authorization: {
      params: {
        prompt: 'select_account',
      },
    },
  }),

  // Facebook OAuth — only active when credentials are set
  ...(process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET
    ? [Facebook({
        // AUTH_FACEBOOK_ID and AUTH_FACEBOOK_SECRET are read automatically from env
      })]
    : []),

  // Email / Phone OTP — Credentials provider
  Credentials({
    id: 'otp',
    name: 'One-Time Code',
    credentials: {
      identifier: { label: 'Email or Phone', type: 'text' },
      code: { label: 'Verification Code', type: 'text' },
      type: { label: 'Type', type: 'text' }, // "email" | "phone"
    },
    async authorize(credentials) {
      const identifier = credentials?.identifier as string | undefined;
      const code = credentials?.code as string | undefined;
      const type = credentials?.type as string | undefined;

      if (!identifier || !code || !type) return null;

      // Verify the OTP
      const valid = await verifyOtp(identifier, code);
      if (!valid) {
        log.warn('OTP verification failed', { identifier, type });
        return null;
      }

      // Build external ID
      const externalId =
        type === 'phone' ? `phone:${identifier}` : `email:${identifier.toLowerCase().trim()}`;

      // Resolve or create the user
      try {
        const sandraUser = await resolveUserByExternalId(db, {
          externalId,
          email: type === 'email' ? identifier.toLowerCase().trim() : undefined,
          channel: 'web',
        });

        // If phone login, store phone on the user
        if (type === 'phone' && identifier) {
          await db.user.update({
            where: { id: sandraUser.id },
            data: { phone: identifier.trim() },
          }).catch(() => {}); // Ignore duplicate phone errors
        }

        return {
          id: sandraUser.id,
          name: sandraUser.name,
          email: sandraUser.email,
          // Custom fields passed to jwt callback via user object
          externalId: sandraUser.externalId,
          role: sandraUser.role,
        } as Record<string, unknown>;
      } catch (error) {
        log.error('OTP authorize: failed to resolve user', {
          identifier,
          error: error instanceof Error ? error.message : 'unknown',
        });
        return null;
      }
    },
  }),
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,

  session: {
    strategy: 'jwt',
    // 30-day session
    maxAge: 30 * 24 * 60 * 60,
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  callbacks: {
    /**
     * Called after sign-in succeeds (OAuth or Credentials).
     * For OAuth providers, upserts the user into Sandra's User table.
     * For Credentials (OTP), the user was already resolved in authorize().
     */
    async signIn({ user, account }) {
      if (!account) return false;

      // Credentials (OTP) — user already resolved in authorize()
      if (account.provider === 'otp') return true;

      // OAuth providers (Google, Facebook)
      if (!user.email) return false;
      const externalId = `${account.provider}:${account.providerAccountId}`;

      try {
        await resolveUserByExternalId(db, {
          externalId,
          email: user.email,
          name: user.name ?? undefined,
          channel: 'web',
        });
        return true;
      } catch (error) {
        log.error('Failed to upsert user on sign-in', {
          provider: account.provider,
          email: user.email,
          error: error instanceof Error ? error.message : 'unknown',
        });
        return false;
      }
    },

    /**
     * Called to build / refresh the JWT.
     * On first sign-in (account is present), loads the Sandra user ID and role.
     */
    async jwt({ token, account, user }) {
      if (account) {
        if (account.provider === 'otp') {
          // Credentials — user object has Sandra fields from authorize()
          const u = user as Record<string, unknown>;
          token.sandraUserId = u.id as string;
          token.externalId = u.externalId as string;
          token.role = (u.role as string) ?? 'student';
        } else {
          // OAuth — look up the Sandra user by externalId
          const externalId = `${account.provider}:${account.providerAccountId}`;
          try {
            const sandraUser = await db.user.findUnique({ where: { externalId } });
            token.sandraUserId = sandraUser?.id;
            token.externalId = externalId;
            token.role = sandraUser?.role ?? 'student';
          } catch (error) {
            log.warn('Could not load Sandra user into JWT', {
              externalId,
              error: error instanceof Error ? error.message : 'unknown',
            });
          }
        }
      }
      return token;
    },

    /**
     * Called whenever a session is checked.
     * Exposes Sandra's user fields on the session object.
     */
    async session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: (token.sandraUserId as string) ?? '',
          externalId: (token.externalId as string) ?? '',
          role: (token.role as string) ?? 'student',
        },
      };
    },
  },
});
