/**
 * Upload (or replace) a single local file in the RotaractNYC shared Drive.
 *
 * Authenticates as the Sandra service account itself — no impersonation. The SA is a
 * member of the shared Drive, so supportsAllDrives=true is enough to write there.
 *
 * If a file with the same name already exists in the target folder, its content is
 * updated in place so the existing share link keeps working, rather than creating a
 * second copy. Pass --new to force a fresh file instead.
 *
 * Run:  node scripts/drive-put.mjs <localPath> <folderId> [--new]
 * Needs: the SA key, from GOOGLE_SA_JSON (.env.local) or ~/Downloads/sandra-*.json
 */
import { createSign } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { basename, extname, join } from 'path';
import { homedir } from 'os';

const SCOPE = 'https://www.googleapis.com/auth/drive';
const MIME = {
  '.pdf': 'application/pdf',
  '.html': 'text/html',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.png': 'image/png',
};

function loadSA() {
  // Prefer the raw key file: no dotenv escaping games with the private key.
  const keyFile = join(homedir(), 'Downloads', 'sandra-492104-f2d8eb0c821f.json');
  if (existsSync(keyFile)) return JSON.parse(readFileSync(keyFile, 'utf8'));

  const envPath = join(process.cwd(), '.env.local');
  if (existsSync(envPath)) {
    const line = readFileSync(envPath, 'utf8')
      .split('\n')
      .find((l) => l.startsWith('GOOGLE_SA_JSON='));
    if (line) {
      let raw = line.slice('GOOGLE_SA_JSON='.length).trim().replace(/^['"]|['"]$/g, '');
      // Env loaders expand \n inside the private key into real newlines, which are
      // invalid control chars in a JSON string literal. Re-escape before parsing.
      let safe = '';
      for (const ch of raw) {
        const c = ch.charCodeAt(0);
        if (c >= 0x20) safe += ch;
        else if (ch === '\n') safe += '\\n';
        else if (ch === '\r') safe += '\\r';
        else if (ch === '\t') safe += '\\t';
        else safe += '\\u' + c.toString(16).padStart(4, '0');
      }
      return JSON.parse(safe);
    }
  }
  throw new Error('No service account credentials found.');
}

async function getToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const claim = enc({ iss: sa.client_email, scope: SCOPE, aud: sa.token_uri, iat: now, exp: now + 3600 });
  const head = enc({ alg: 'RS256', typ: 'JWT' });
  const sig = createSign('RSA-SHA256').update(`${head}.${claim}`).sign(sa.private_key, 'base64url');

  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${head}.${claim}.${sig}`,
    }),
  });
  const j = await res.json();
  if (!j.access_token) throw new Error(`Token failed: ${JSON.stringify(j)}`);
  return j.access_token;
}

async function findExisting(token, name, folderId) {
  const q = encodeURIComponent(`name = '${name.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const j = await res.json();
  return j.files?.[0] ?? null;
}

async function main() {
  const [localPath, folderId, ...flags] = process.argv.slice(2);
  if (!localPath || !folderId) {
    console.error('Usage: node scripts/drive-put.mjs <localPath> <folderId> [--new]');
    process.exit(1);
  }
  if (!existsSync(localPath)) throw new Error(`No such file: ${localPath}`);

  const name = basename(localPath);
  const mime = MIME[extname(localPath).toLowerCase()] ?? 'application/octet-stream';
  const bytes = readFileSync(localPath);

  const sa = loadSA();
  console.log(`Authenticating as ${sa.client_email}`);
  const token = await getToken(sa);

  const existing = flags.includes('--new') ? null : await findExisting(token, name, folderId);

  const boundary = '-'.repeat(20) + Date.now();
  const meta = existing ? { name } : { name, parents: [folderId] };
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`),
    bytes,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const url = existing
    ? `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink`;

  const res = await fetch(url, {
    method: existing ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
      'Content-Length': String(body.length),
    },
    body,
  });

  const out = await res.json();
  if (!res.ok) throw new Error(`Upload failed (${res.status}): ${JSON.stringify(out)}`);

  console.log(`${existing ? 'Replaced in place' : 'Uploaded'}: ${out.name}`);
  console.log(`  size   ${(bytes.length / 1024).toFixed(0)} KB`);
  console.log(`  fileId ${out.id}`);
  console.log(`  link   ${out.webViewLink}`);
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
