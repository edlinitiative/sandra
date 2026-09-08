/**
 * Export a Drive file as text using the sandra-workspace service account.
 *
 * Google Docs/Sheets/Slides are exported (text/csv/plain); binary files are
 * downloaded raw only if --raw <outPath> is given.
 *
 * Read-only. Run: node scripts/export-drive-doc.mjs <fileId> [--raw <outPath>]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const KEY_PATH =
  process.env.SANDRA_SA_KEY ?? '/Users/tedjacquet/Downloads/sandra-492104-f2d8eb0c821f.json';

const fileId = process.argv[2];
const rawIdx = process.argv.indexOf('--raw');
const rawOut = rawIdx > -1 ? process.argv[rawIdx + 1] : null;
if (!fileId) {
  console.error('usage: node scripts/export-drive-doc.mjs <fileId> [--raw <outPath>]');
  process.exit(1);
}

const sa = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
sa.private_key = sa.private_key.replace(/\\n/g, '\n');
const b64 = (s) => Buffer.from(s).toString('base64url');

async function getToken() {
  const now = Math.floor(Date.now() / 1000);
  const unsigned =
    b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) +
    '.' +
    b64(
      JSON.stringify({
        iss: sa.client_email,
        scope: 'https://www.googleapis.com/auth/drive.readonly',
        aud: sa.token_uri ?? 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      }),
    );
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signer.sign(sa.private_key, 'base64url')}`,
    }),
  });
  const d = await res.json();
  if (!d.access_token) throw new Error('token failed: ' + JSON.stringify(d));
  return d.access_token;
}

const EXPORT_AS = {
  'application/vnd.google-apps.document': 'text/plain',
  'application/vnd.google-apps.spreadsheet': 'text/csv',
  'application/vnd.google-apps.presentation': 'text/plain',
};

const token = await getToken();

const metaRes = await fetch(
  `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true&fields=id,name,mimeType,size`,
  { headers: { Authorization: 'Bearer ' + token } },
);
const meta = await metaRes.json();
if (meta.error) {
  console.error('error:', meta.error.message);
  process.exit(1);
}
console.error(`# ${meta.name}  (${meta.mimeType})`);

const exportMime = EXPORT_AS[meta.mimeType];
const url = exportMime
  ? `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportMime)}&supportsAllDrives=true`
  : `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;

const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
if (!res.ok) {
  console.error('download failed:', res.status, await res.text());
  process.exit(1);
}

if (rawOut) {
  writeFileSync(rawOut, Buffer.from(await res.arrayBuffer()));
  console.error('wrote', rawOut);
} else {
  process.stdout.write(await res.text());
}
