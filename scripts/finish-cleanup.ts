/**
 * Finish RotaractNYC cleanup — audit point 5 + the stray letterhead (point 3).
 *   - Rename the 3 ambiguous "Untitled form" archives to dated, flagged placeholders (SA, shared drive).
 *   - Try to trash the stray My Drive letterhead by impersonating the owner via domain-wide delegation;
 *     if DWD isn't configured, report the manual link (the SA has no direct rights on My Drive).
 *
 * Self-contained. Needs GOOGLE_SA_JSON in env or a pulled .env.production.local.
 * Run:  npx dotenv-cli -e .env.production.local -- npx tsx scripts/finish-cleanup.ts
 */
import { createSign } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const OWNER = 'info@edlight.org';
const STRAY = '18O8iWerxAYlpfgkSA2JCP4o0SwHBh2Ev';
const FORM_RENAMES: Array<{ id: string; name: string }> = [
  { id: '1l2bbJZAoPTUof6OjQfhRS7eG-xgl34dY8n2euDqXKek', name: 'Form (2024) — open to identify & rename' },
  { id: '1-y3C0lnaTRhpu9n6FYskx39h-AxLO4WooooRsv6jVGE', name: 'Form (2022-06) — open to identify & rename' },
  { id: '1anLSh0FI91XMz1g4O5Tdbs-hoQEQXw6TFBPmM2XmNDo', name: 'Form (2022-01) — open to identify & rename' },
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
  if (!raw) throw new Error('GOOGLE_SA_JSON not found.');
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

async function getToken(subject?: string): Promise<string> {
  const sa = loadSA();
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const claim: Record<string, unknown> = {
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  };
  if (subject) claim.sub = subject;
  const head = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64(claim)}`;
  const sig = createSign('RSA-SHA256').update(head).sign(sa.private_key, 'base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${sig}` }),
  });
  const data = (await res.json()) as { access_token?: string; error?: string };
  if (!data.access_token) throw new Error(data.error || JSON.stringify(data));
  return data.access_token;
}

async function patch(token: string, id: string, params: string, body: unknown) {
  return fetch(`https://www.googleapis.com/drive/v3/files/${id}?supportsAllDrives=true&${params}`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

(async () => {
  const token = await getToken();
  console.log('✅ authenticated as service account\n5) Renaming ambiguous archived forms:');
  for (const f of FORM_RENAMES) {
    const res = await patch(token, f.id, 'fields=id,name', { name: f.name });
    console.log(res.ok ? `  ✏️  renamed → ${f.name}` : `  ⚠️  ${f.id}: ${res.status} ${(await res.text()).slice(0, 150)}`);
  }
  console.log('3) Stray letterhead (via owner impersonation):');
  try {
    const ownerTok = await getToken(OWNER);
    const res = await patch(ownerTok, STRAY, 'fields=id,trashed', { trashed: true });
    console.log(res.ok ? '  🗑️  trashed the stray letterhead (impersonating owner)'
      : `  ⚠️  ${res.status} ${(await res.text()).slice(0, 150)}`);
  } catch (e) {
    console.log(`  ⚠️  domain-wide delegation not available (${e instanceof Error ? e.message : e}).`);
    console.log(`      Delete by hand (5s): https://drive.google.com/file/d/${STRAY}/view`);
  }
  console.log('\n🎉 Done.');
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
