/**
 * Standardize Miriam's name to the board-canonical "Miriam Zapata Ponce" in the
 * shared-drive native CRM sheets (find/replace, matchCase). Reversible via history.
 * Run: npx dotenv-cli -e .env.production.local -- npx tsx scripts/standardize-miriam.ts
 */
import { createSign } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const FIND = 'Miriam Sophia Zapata';
const REPLACE = 'Miriam Zapata Ponce';
// Native Google Sheets in the RCUN shared drive (0ADWZPQOHjpGhUk9PVA) only.
const SHEETS = [
  { id: '1gebRTtHZWgAkACbwQz313IsTjxY4AdjrWbqUZEbi-mM', name: 'RCUN CRM — Working Contact List' },
  { id: '1nm-8vXHIBCcWQouEbFRnYjluoqNp2BfD1KyZS0cv1kM', name: 'Rotaract NYC – Full CRM' },
];

function loadSA(): { client_email: string; private_key: string } {
  let raw = process.env.GOOGLE_SA_JSON;
  if (!raw) {
    for (const n of ['.env.production.local', '.env']) {
      const p = join(process.cwd(), n);
      if (!existsSync(p)) continue;
      const line = readFileSync(p, 'utf8').split('\n').find((l) => l.startsWith('GOOGLE_SA_JSON='));
      if (line) { raw = line.slice('GOOGLE_SA_JSON='.length).trim().replace(/^['"]|['"]$/g, ''); break; }
    }
  }
  if (!raw) throw new Error('GOOGLE_SA_JSON not found.');
  let safe = ''; for (const ch of raw) { const c = ch.charCodeAt(0); safe += c >= 0x20 ? ch : c === 10 ? '\\n' : c === 13 ? '\\r' : c === 9 ? '\\t' : '\\u' + c.toString(16).padStart(4, '0'); }
  return JSON.parse(safe);
}
async function getToken(): Promise<string> {
  const sa = loadSA();
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const sig = createSign('RSA-SHA256').update(head).sign(sa.private_key, 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${sig}` }) });
  const d = (await r.json()) as { access_token?: string; error?: string };
  if (!d.access_token) throw new Error(d.error || JSON.stringify(d));
  return d.access_token;
}

(async () => {
  const token = await getToken();
  console.log(`✅ authenticated · "${FIND}" → "${REPLACE}"`);
  for (const s of SHEETS) {
    const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${s.id}:batchUpdate`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ findReplace: { find: FIND, replacement: REPLACE, matchCase: true, allSheets: true } }], includeSpreadsheetInResponse: false }),
    });
    if (!r.ok) { console.log(`  ⚠️  ${s.name}: ${r.status} ${(await r.text()).slice(0, 160)}`); continue; }
    const res = (await r.json()) as { replies?: Array<{ findReplace?: { occurrencesChanged?: number } }> };
    console.log(`  ✅ ${s.name}: ${res.replies?.[0]?.findReplace?.occurrencesChanged ?? 0} change(s)`);
  }
  console.log('\n🎉 Done.');
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
