/**
 * Server-side Firebase ID token verification.
 *
 * Uses `jose` (already available via NextAuth/@auth/core) to verify
 * Firebase Auth ID tokens against Google's public JWKS.
 *
 * This avoids pulling in the heavy `firebase-admin` SDK.
 */

import { createRemoteJWKSet, jwtVerify } from 'jose';
import { createLogger } from '@/lib/utils';

const log = createLogger('auth:firebase');

const FIREBASE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1beta1/jwk/securetoken@system.gserviceaccount.com';

const JWKS = createRemoteJWKSet(new URL(FIREBASE_JWKS_URL));

export interface FirebaseTokenPayload {
  uid: string;
  phone?: string;
  email?: string;
}

/**
 * Verify a Firebase ID token and extract user claims.
 *
 * @param idToken – The raw JWT from the Firebase client SDK
 * @returns Decoded payload with uid, phone, email
 * @throws If the token is invalid, expired, or the project ID doesn't match
 */
export async function verifyFirebaseToken(idToken: string): Promise<FirebaseTokenPayload> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error('NEXT_PUBLIC_FIREBASE_PROJECT_ID is not set');
  }

  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });

  const uid = payload.sub;
  if (!uid) {
    throw new Error('Firebase token missing sub claim');
  }

  const phone = (payload as Record<string, unknown>).phone_number as string | undefined;
  const email = payload.email as string | undefined;

  log.info('Firebase token verified', {
    uid,
    phone: phone ? phone.replace(/.(?=.{3})/g, '*') : undefined,
  });

  return { uid, phone, email };
}
