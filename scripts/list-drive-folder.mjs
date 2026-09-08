/**
 * List the contents of a Drive folder as the sandra-workspace service account.
 *
 * Read-only. Run: node scripts/list-drive-folder.mjs <folderId> [--recursive]
 */

import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const KEY_PATH =
  process.env.SANDRA_SA_KEY ?? '/Users/tedjacquet/Downloads/sandra-492104-f2d8eb0c821f.json';

const folderId = process.argv[2];
const recursive = process.argv.includes('--recursive');
if (!folderId) {
  console.error('usage: node scripts/list-drive-folder.mjs <folderId> [--recursive]');
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
  const jwt = `${unsigned}.${signer.sign(sa.private_key, 'base64url')}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('token failed: ' + JSON.stringify(data));
  return data.access_token;
}

const FIELDS = 'files(id,name,mimeType,size,modifiedTime),nextPageToken';
const FOLDER = 'application/vnd.google-apps.folder';

async function children(id, token) {
  const out = [];
  let pageToken;
  do {
    const params = new URLSearchParams({
      q: `'${id}' in parents and trashed = false`,
      pageSize: '200',
      orderBy: 'folder,name',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
      fields: FIELDS,
    });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await fetch('https://www.googleapis.com/drive/v3/files?' + params, {
      headers: { Authorization: 'Bearer ' + token },
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    out.push(...(data.files ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return out;
}

function human(bytes) {
  if (!bytes) return '';
  const n = Number(bytes);
  if (n < 1024) return n + 'B';
  if (n < 1024 ** 2) return (n / 1024).toFixed(0) + 'KB';
  if (n < 1024 ** 3) return (n / 1024 ** 2).toFixed(1) + 'MB';
  return (n / 1024 ** 3).toFixed(2) + 'GB';
}

const token = await getToken();

async function walk(id, depth) {
  const files = await children(id, token);
  for (const f of files) {
    const isDir = f.mimeType === FOLDER;
    const pad = '  '.repeat(depth);
    const meta = isDir ? '' : `  ${human(f.size)}  ${f.modifiedTime?.slice(0, 10) ?? ''}`;
    console.log(`${pad}${isDir ? '[DIR] ' : '      '}${f.name}${meta}`);
    if (isDir && recursive) await walk(f.id, depth + 1);
  }
  if (!files.length) console.log('  '.repeat(depth) + '(empty)');
}

await walk(folderId, 0);
