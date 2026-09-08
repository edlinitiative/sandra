/**
 * Shared-Drive cleanup for RotaractNYC (audit points 2–4). Does NOT touch credentials (point 1).
 * All removals go to TRASH (reversible), never hard-delete.
 *
 *  2) Trash 4 junk temp files loose at the drive root
 *  3) Trash the stray RCUN-Letterhead-01-Classic.docx in My Drive (may need manual removal — reported)
 *  4) Move the duplicate calendars out of "00 - Start Here" into "99 - Archive/Duplicates - Do Not Delete",
 *     keeping the polished Doc "RCUN Annual Calendar 2026–2027" as the canonical copy.
 *
 * Self-contained (Node built-ins only). Needs GOOGLE_SA_JSON in env or sandra/.env(.production.local).
 * Run:  npx dotenv-cli -e .env.production.local -- npx tsx scripts/cleanup-drive.ts
 */
import { createSign } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT_JUNK = [
  { id: '1r2z7aK5s6jcydw1WBAydGGV71wIJEwmGIrPdMzBkH0Y', name: '__t_1781549644970' },
  { id: '1RhlSNjzDGOGA9v_A2x8tTJrQAvjU_kO34HY1HrWVR-o', name: '__t_1781549649388' },
  { id: '1J_9qZ98Ic7bAvWk481EWtYFeGLAx1sKZ2esnCnHonsY', name: '__tmp_an_1781544949428' },
  { id: '14mLM31VDvOCB9FOHkRHaIZPwXXVbh0s2dX8mBPd2FJo', name: '__t_1781546532855' },
];
const STRAY = { id: '18O8iWerxAYlpfgkSA2JCP4o0SwHBh2Ev', name: 'RCUN-Letterhead-01-Classic.docx (My Drive dupe)' };

const START_HERE = '15m8gxL5AoSNK93MPNBeYiZiP6ZEZPYSA'; // 00 - Start Here
const DUP_ARCHIVE = '15BIJ_c2isk1rPkvcnSN4uY1Kv1M7eym5'; // 99 - Archive / Duplicates - Do Not Delete
// duplicate calendars to relocate (canonical kept = Doc 18L0acwTi3Qp-icCnYKLi1n_inqW8xL7FhZXv4abfNhc)
const DUP_CALENDARS = [
  { id: '1CMF0oL5z_V3gSHiggH6_-rXUXJBdwTsn', name: 'RCUN-Annual-Calendar-2026-2027.xlsx' },
  { id: '1kuGB_98tR4XRsPPI7KubzJ4fra4wyVsldAeQJAwO3yo', name: 'RCUN Annual Calendar (old Sheet)' },
];

function loadSA(): { client_email: string; private_key: string } {
  let raw = process.env.GOOGLE_SA_JSON;
  if (!raw) {
    for (const name of ['.env', '.env.production.local', '.env.local']) {
      const p = join(process.cwd(), name);
      if (!existsSync(p)) continue;
      const line = readFileSync(p, 'utf8').split('\n').find((l) => l.startsWith('GOOGLE_SA_JSON='));
      if (line) { raw = line.slice('GOOGLE_SA_JSON='.length).trim().replace(/^['"]|['"]$/g, ''); break; }
    }
  }
  if (!raw) throw new Error('GOOGLE_SA_JSON not found (set the env var or add it to sandra/.env).');
  // Env loaders often expand \n inside the private key into real newlines, which are invalid
  // control chars inside a JSON string literal — re-escape all control chars before parsing.
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

async function patch(token: string, id: string, params: string, body: unknown) {
  return fetch(`https://www.googleapis.com/drive/v3/files/${id}?supportsAllDrives=true&${params}`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

async function trash(token: string, id: string, name: string) {
  const res = await patch(token, id, 'fields=id,trashed', { trashed: true });
  if (res.ok) console.log(`  🗑️  trashed ${name}`);
  else console.log(`  ⚠️  could not trash ${name} (${res.status}) — remove by hand: https://drive.google.com/file/d/${id}/view`);
}

async function moveTo(token: string, id: string, name: string, addParent: string, removeParent: string) {
  const res = await patch(token, id, `addParents=${addParent}&removeParents=${removeParent}&fields=id,parents`, {});
  if (res.ok) console.log(`  📦 archived ${name}`);
  else console.log(`  ⚠️  could not move ${name} (${res.status}): ${(await res.text()).slice(0, 200)}`);
}

(async () => {
  const token = await getToken();
  console.log('✅ authenticated as service account\n2) Root junk files:');
  for (const f of ROOT_JUNK) await trash(token, f.id, f.name);
  console.log('3) Stray letterhead:');
  await trash(token, STRAY.id, STRAY.name);
  console.log('4) Duplicate calendars → 99 - Archive/Duplicates:');
  for (const f of DUP_CALENDARS) await moveTo(token, f.id, f.name, DUP_ARCHIVE, START_HERE);
  console.log('\n🎉 Cleanup complete. (Point 5 needs human review — see the meeting notes.)');
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
