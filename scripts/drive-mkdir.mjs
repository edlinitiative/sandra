/**
 * Create a project folder (optionally with subfolders) in a Google shared Drive.
 *
 * Authenticates as the Sandra service account itself — no impersonation. The SA is a
 * member of the RotaractNYC shared Drive, so supportsAllDrives=true is enough to write.
 *
 * Idempotent: a folder that already exists under the same parent is reused rather than
 * duplicated, so re-running to add a subfolder to an existing tree is safe.
 *
 * Run:
 *   node scripts/drive-mkdir.mjs <parentFolderId> "<Folder Name>" ["<Sub 1>" "<Sub 2>" ...]
 *
 * Example — the St. Francis mentorship tree under "04 - Service Projects":
 *   node scripts/drive-mkdir.mjs 1U71HDkNA2mE59jHBjNrInmCGD9jYpPFz \
 *     "St. Francis Mentorship Program" \
 *     "01 - Program Design" "02 - Partners & Agreements"
 *
 * Needs: the SA key, from ~/Downloads/sandra-*.json or GOOGLE_SA_JSON in .env.local
 */
import { createSign } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const SCOPE = 'https://www.googleapis.com/auth/drive';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

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
      const raw = line.slice('GOOGLE_SA_JSON='.length).trim().replace(/^['"]|['"]$/g, '');
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

async function ensureFolder(token, name, parentId) {
  const q = encodeURIComponent(
    `name = '${name.replace(/'/g, "\\'")}' and '${parentId}' in parents ` +
      `and mimeType = '${FOLDER_MIME}' and trashed = false`
  );
  const findUrl =
    `https://www.googleapis.com/drive/v3/files?q=${q}` +
    `&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const found = await (await fetch(findUrl, { headers: { Authorization: `Bearer ${token}` } })).json();
  if (found.files?.length) return { ...found.files[0], reused: true };

  const res = await fetch(
    'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
    }
  );
  const out = await res.json();
  if (!res.ok) throw new Error(`Create failed (${res.status}): ${JSON.stringify(out)}`);
  return { ...out, reused: false };
}

async function main() {
  const [parentId, name, ...subs] = process.argv.slice(2);
  if (!parentId || !name) {
    console.error('Usage: node scripts/drive-mkdir.mjs <parentFolderId> "<Folder Name>" ["<Sub>" ...]');
    process.exit(1);
  }

  const sa = loadSA();
  console.log(`Authenticating as ${sa.client_email}`);
  const token = await getToken(sa);

  const root = await ensureFolder(token, name, parentId);
  console.log(`${root.reused ? 'Reused ' : 'Created'}  ${name}`);
  console.log(`  id    ${root.id}`);
  console.log(`  link  https://drive.google.com/drive/folders/${root.id}`);

  for (const sub of subs) {
    const f = await ensureFolder(token, sub, root.id);
    console.log(`  ${f.reused ? 'reused ' : 'created'}  ${sub}  (${f.id})`);
  }
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
