/**
 * Diagnostic: what Google Drive content can the sandra-workspace service account see?
 *
 * Authenticates as the service account ITSELF (no impersonation) — that is the
 * identity that sees folders shared directly with the SA's email address.
 *
 * Read-only. Run: node scripts/check-sa-drive-access.mjs [keyPath]
 */

import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const KEY_PATH = process.argv[2] ?? '/Users/tedjacquet/Downloads/sandra-492104-f2d8eb0c821f.json';

const sa = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
sa.private_key = sa.private_key.replace(/\\n/g, '\n');

console.log('=== SERVICE ACCOUNT ===');
console.log('client_email:', sa.client_email);
console.log('project_id  :', sa.project_id);

const b64 = (s) => Buffer.from(s).toString('base64url');

async function getToken(scope, impersonate) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: sa.client_email,
    scope,
    aud: sa.token_uri ?? 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  if (impersonate) payload.sub = impersonate;

  const unsigned = `${b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64(JSON.stringify(payload))}`;
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
  return res.json();
}

const FIELDS =
  'files(id,name,mimeType,modifiedTime,owners(emailAddress),driveId,capabilities(canEdit)),nextPageToken';
const ALL_DRIVES = 'supportsAllDrives=true&includeItemsFromAllDrives=true';

async function driveGet(path, token) {
  const res = await fetch('https://www.googleapis.com/drive/v3/' + path, {
    headers: { Authorization: 'Bearer ' + token },
  });
  return res.json();
}

function show(files) {
  if (!files?.length) return console.log('   (none)');
  for (const f of files) {
    const kind = f.mimeType?.includes('folder') ? 'DIR ' : 'FILE';
    const owner = f.owners?.[0]?.emailAddress ?? '?';
    const access = f.capabilities?.canEdit ? 'editor' : 'viewer';
    const mod = f.modifiedTime?.slice(0, 10) ?? '';
    console.log(`   ${kind} ${f.name}`);
    console.log(
      `        id=${f.id} owner=${owner} access=${access} modified=${mod}${f.driveId ? ' driveId=' + f.driveId : ''}`,
    );
  }
}

const token = (await getToken('https://www.googleapis.com/auth/drive')).access_token;
if (!token) {
  console.error('Could not obtain an access token.');
  process.exit(1);
}
console.log('token: OK');

console.log('\n-- everything visible to the service account --');
const all = await driveGet(
  `files?pageSize=100&orderBy=modifiedTime desc&${ALL_DRIVES}&fields=${encodeURIComponent(FIELDS)}`,
  token,
);
all.error ? console.log('   error:', all.error.message) : show(all.files);

console.log('\n-- name contains "website" --');
const site = await driveGet(
  `files?q=${encodeURIComponent("name contains 'website'")}&pageSize=50&${ALL_DRIVES}&fields=${encodeURIComponent(FIELDS)}`,
  token,
);
site.error ? console.log('   error:', site.error.message) : show(site.files);

console.log('\n-- shared drives the service account belongs to --');
const drives = await driveGet('drives?pageSize=50', token);
if (drives.error) console.log('   error:', drives.error.message);
else if (!drives.drives?.length) console.log('   (none)');
else drives.drives.forEach((d) => console.log(`   DRIVE ${d.name} (${d.id})`));
