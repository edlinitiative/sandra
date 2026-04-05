/**
 * NextAuth v5 (Auth.js) configuration.
 *
 * Uses Google OAuth with JWT session strategy.
 * No DB adapter — users are upserted into Sandra's own User table via signIn callback.
 */

import NextAuth, { type DefaultSession } from 'next-auth';
import Google from 'next-auth/providers/google';
import { db } from '@/lib/db';
import { resolveUserByExternalId } from '@/lib/db/users';
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

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      // AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are read automatically from env
      authorization: {
        params: {
          // Request profile + email scopes (default for Google provider)
          prompt: 'select_account',
        },
      },
    }),
  ],

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
     * Called after OAuth sign-in succeeds.
     * Upserts the user into Sandra's User table.
     */
    async signIn({ user, account }) {
      if (!account || !user.email) return false;

      const externalId = `google:${account.providerAccountId}`;

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
    async jwt({ token, account }) {
      if (account) {
        // First sign-in — account is only available here on the initial call
        const externalId = `google:${account.providerAccountId}`;
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
