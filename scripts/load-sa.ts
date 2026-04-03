/**
 * Helper: Load Google service account credentials from GOOGLE_SA_JSON env var.
 * Used by local diagnostic scripts only. Production reads from ConnectedProvider DB.
 */

import 'dotenv/config';

export function loadServiceAccount() {
  const raw = process.env.GOOGLE_SA_JSON;
  if (!raw) {
    console.error('❌ GOOGLE_SA_JSON not set in .env — add the service account JSON as a single-line string.');
    process.exit(1);
  }
  try {
    return JSON.parse(raw) as {
      type: string;
      project_id: string;
      private_key_id: string;
      private_key: string;
      client_email: string;
      client_id: string;
      token_uri: string;
      [key: string]: string;
    };
  } catch {
    console.error('❌ GOOGLE_SA_JSON is not valid JSON.');
    process.exit(1);
  }
}
