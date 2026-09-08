/**
 * One command to sync the corrected RCUN files to the RotaractNYC shared Drive.
 *  - Replaces the Board Pack + Email Templates PDFs IN PLACE (same file IDs → links unchanged)
 *  - Removes the stray RCUN-Letterhead-01-Classic.docx left in My Drive
 *
 * Self-contained: uses only Node built-ins. Needs the Sandra service-account JSON,
 * read from either the GOOGLE_SA_JSON env var or a GOOGLE_SA_JSON=... line in sandra/.env.
 *
 * Run:  npx tsx scripts/fix-drive.ts
 */
import { createSign } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const DL = join(homedir(), 'Downloads');
const BOARD = { id: '1L4FImy8YvDmYbPBkLnSMzPV9zxx1Rs32', file: 'RCUN-Board-Pack-2026-2027.pdf' };
const EMAIL = { id: '14byMNZJpUu_HM_IIDMDDpkyr57dKap5s', file: 'RCUN-Email-Templates.pdf' };
const STRAY = '18O8iWerxAYlpfgkSA2JCP4o0SwHBh2Ev'; // duplicate letterhead in My Drive

function loadSA(): { client_email: string; private_key: string } {
  let raw = process.env.GOOGLE_SA_JSON;
  if (!raw) {
    const envPath = join(process.cwd(), '.env');
    if (existsSync(envPath)) {
      const line = readFileSync(envPath, 'utf8').split('\n').find((l) => l.startsWith('GOOGLE_SA_JSON='));
      if (line) raw = line.slice('GOOGLE_SA_JSON='.length).trim().replace(/^['"]|['"]$/g, '');
    }
  }
  if (!raw) throw new Error('GOOGLE_SA_JSON not found (set the env var or add it to sandra/.env).');
  // Env loaders often expand \n in the private key into real newlines — invalid control
  // chars inside a JSON string literal. Re-escape all control chars before parsing.
  let safe = '';
  for (const ch of raw) {
    const code = ch.charCodeAt(0);
    if (code >= 0x20) { safe += ch; continue; }
    if (ch === '\n') safe += '\\n';
    else if (ch === '\r') safe += '\\r';
    else if (ch === '\t') safe += '\\t';
    else safe += '\\u' + code.toString(16).padStart(4, '0');
  }
  return JSON.parse(safe);
}

async function getToken(): Promise<string> {
  const sa = loadSA();
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const claim = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  })}`;
  const sig = createSign('RSA-SHA256').update(claim).sign(sa.private_key, 'base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${claim}.${sig}` }),
  });
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error(`Token exchange failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function replace(token: string, id: string, file: string) {
  const path = join(DL, file);
  if (!existsSync(path)) throw new Error(`missing local file: ${path}`);
  const url = `https://www.googleapis.com/upload/drive/v3/files/${id}` +
    `?uploadType=media&supportsAllDrives=true&fields=id,name,size,webViewLink`;
  const res = await fetch(url, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/pdf' }, body: readFileSync(path) });
  if (!res.ok) throw new Error(`${file}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  const f = (await res.json()) as { name: string; size: string; webViewLink?: string };
  console.log(`  ✅ replaced ${f.name} (${(Number(f.size) / 1024).toFixed(0)}KB) ${f.webViewLink}`);
}

async function remove(token: string, id: string) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?supportsAllDrives=true`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 204) { console.log('  ✅ removed stray My Drive letterhead'); return; }
  console.log(`  ⚠️  could not delete stray (${res.status}) — it's in a personal My Drive; delete it by hand:`);
  console.log(`      https://drive.google.com/file/d/${id}/view`);
}

(async () => {
  const token = await getToken();
  console.log('✅ authenticated as service account');
  await replace(token, BOARD.id, BOARD.file);
  await replace(token, EMAIL.id, EMAIL.file);
  await remove(token, STRAY);
  console.log('🎉 Drive sync complete.');
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
