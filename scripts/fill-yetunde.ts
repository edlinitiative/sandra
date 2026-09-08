/**
 * Fill Yetunde Durotoye's full name + email into the governance docs where only
 * "Yetunde" was placed. Reversible via version history.
 * Run: npx dotenv-cli -e .env.production.local -- npx tsx scripts/fill-yetunde.ts
 */
import { createSign } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const DIRECTORY = '1G8qhCvvvcwgUAdjEHbPKhjoQumL4Jmn0EobEk-5oVvw';
const CHARTERS_INDEX = '1xR82lkYr8H1Itbdiz1ZS9Mp0VGaWYEUAWkD85OT4I3w';
const PROFDEV_CHARTER = '1_5CWUzjcd5-R7Xo-Fzq4QmPgRu9rmmwndsqQRrWEcEM';
const FULL = 'Yetunde Durotoye';
const EMAIL = 'yetunde.durotoye@gmail.com';
const ROLE = 'Director of Professional Development';

const DOC_EDITS: Record<string, Array<{ find: string; replace: string }>> = {
  [CHARTERS_INDEX]: [{ find: 'Yetunde · Board liaison: Vice President', replace: `${FULL} · Board liaison: Vice President` }],
  [PROFDEV_CHARTER]: [{ find: 'Committee Chair — Yetunde.', replace: `Committee Chair — ${FULL}.` }],
};

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
  const head = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const sig = createSign('RSA-SHA256').update(head).sign(sa.private_key, 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${sig}` }) });
  const d = (await r.json()) as { access_token?: string; error?: string };
  if (!d.access_token) throw new Error(d.error || JSON.stringify(d));
  return d.access_token;
}
const H = (t: string) => ({ Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' });

(async () => {
  const token = await getToken();
  console.log('✅ authenticated\nDocs:');
  for (const [id, edits] of Object.entries(DOC_EDITS)) {
    const requests = edits.map((e) => ({ replaceAllText: { containsText: { text: e.find, matchCase: true }, replaceText: e.replace } }));
    const r = await fetch(`https://docs.googleapis.com/v1/documents/${id}:batchUpdate`, { method: 'POST', headers: H(token), body: JSON.stringify({ requests }) });
    const res = (await r.json()) as { replies?: Array<{ replaceAllText?: { occurrencesChanged?: number } }> };
    console.log(r.ok ? `  ✅ ${id}: ${(res.replies || []).map((x) => x.replaceAllText?.occurrencesChanged ?? 0).join(',')}` : `  ⚠️  ${id}: ${JSON.stringify(res).slice(0, 160)}`);
  }
  // Directory: fill name+email, clear the "Contact to confirm" note.
  const meta = (await (await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${DIRECTORY}?fields=sheets(properties(title))`, { headers: H(token) })).json()) as { sheets: Array<{ properties: { title: string } }> };
  const title = meta.sheets[0].properties.title;
  const rows = ((await (await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${DIRECTORY}/values/${encodeURIComponent(title)}`, { headers: H(token) })).json()) as { values?: string[][] }).values || [];
  const i = rows.findIndex((r) => (r[0] || '').trim() === ROLE);
  if (i < 0) { console.log(`  ⚠️  directory: role not found`); }
  else {
    const r1 = i + 1;
    const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${DIRECTORY}/values:batchUpdate`, { method: 'POST', headers: H(token), body: JSON.stringify({ valueInputOption: 'RAW', data: [{ range: `${title}!B${r1}:C${r1}`, values: [[FULL, EMAIL]] }, { range: `${title}!E${r1}:E${r1}`, values: [['']] }] }) });
    console.log(r.ok ? `  ✅ directory: filled ${FULL} <${EMAIL}>` : `  ⚠️  directory: ${(await r.text()).slice(0, 160)}`);
  }
  console.log('\n🎉 Done.');
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
