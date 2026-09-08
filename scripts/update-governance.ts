/**
 * Apply the confirmed 2026–27 chair slate + fixes across the live governance docs.
 * Docs edited via Docs API replaceAllText; the Board Directory via Sheets API.
 * All changes are reversible through Google's version history.
 *
 * Slate: Membership=Christina · Community Service=Amado · Events & Fellowship=Amado
 *        Professional Development=Yetunde · Communications & Marketing=Miriam Zapata Ponce
 *
 * Needs GOOGLE_SA_JSON (env or pulled .env.production.local).
 * Run: npx dotenv-cli -e .env.production.local -- npx tsx scripts/update-governance.ts
 */
import { createSign } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const DIRECTORY = '1G8qhCvvvcwgUAdjEHbPKhjoQumL4Jmn0EobEk-5oVvw';
const EXEC_PLAN = '1rTv0SLlJNRXWYvxFsmPDQS2h1uhE8gLVwj2U-_RSHqQ';
const CHARTERS_INDEX = '1xR82lkYr8H1Itbdiz1ZS9Mp0VGaWYEUAWkD85OT4I3w';
const COMMS_CHARTER = '1NEZQn_7GT8NExjolntLTJmNXqaA3fADTXflqsIQDFK8';
const EVENTS_CHARTER = '15CAIYS2jaTnnL8kgwxK7QRPxZZXHkj3Znmk-b5D8YVc';
const PROFDEV_CHARTER = '1_5CWUzjcd5-R7Xo-Fzq4QmPgRu9rmmwndsqQRrWEcEM';

// Docs: fileId → list of {find, replace} (order-independent; strings are unique in each doc)
const DOC_EDITS: Record<string, Array<{ find: string; replace: string }>> = {
  [EXEC_PLAN]: [
    { find: 'more than $137,000 raised and over $14,600 directed to external causes.',
      replace: 'more than $137,000 raised across the club’s history.' },
    { find: '— [Your name], President, and the Executive Board',
      replace: '— Ted O’Jacquet, President, and the Executive Board' },
    { find: 'It guides how the board and committees focus their work. — [Your name], President',
      replace: 'It guides how the board and committees focus their work. — Ted O’Jacquet, President' },
  ],
  [CHARTERS_INDEX]: [
    { find: '[add chair] · Board liaison: Vice President or Club Service Director',
      replace: 'Amado Suarez · Board liaison: Vice President or Club Service Director' },
    { find: '[add chair] · Board liaison: Secretary or Public Image Officer',
      replace: 'Miriam Zapata Ponce · Board liaison: Secretary or Public Image Officer' },
    { find: '[add chair] · Board liaison: Vice President',
      replace: 'Yetunde · Board liaison: Vice President' },
  ],
  [COMMS_CHARTER]: [{ find: 'Committee Chair — [add chair].', replace: 'Committee Chair — Miriam Zapata Ponce.' }],
  [EVENTS_CHARTER]: [{ find: 'Committee Chair — [add chair].', replace: 'Committee Chair — Amado Suarez.' }],
  [PROFDEV_CHARTER]: [{ find: 'Committee Chair — [add chair].', replace: 'Committee Chair — Yetunde.' }],
};

// Board Directory row updates, keyed by the Position cell (col A).
const DIR_FILL: Record<string, { name: string; email: string; note: string }> = {
  'Director of Events / Social': { name: 'Amado Suarez', email: 'amado.suarez07@gmail.com', note: '' },
  'Director of Professional Development': { name: 'Yetunde', email: '', note: 'Contact to confirm' },
  'Director of Public Relations / Marketing': { name: 'Miriam Zapata Ponce', email: 'mszp85@gmail.com', note: 'Also Co-Secretary' },
};
const DIR_DELETE_ROLE = 'Director of International Service';

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

async function editDoc(token: string, id: string, edits: Array<{ find: string; replace: string }>) {
  const requests = edits.map((e) => ({ replaceAllText: { containsText: { text: e.find, matchCase: true }, replaceText: e.replace } }));
  const r = await fetch(`https://docs.googleapis.com/v1/documents/${id}:batchUpdate`, { method: 'POST', headers: H(token), body: JSON.stringify({ requests }) });
  if (!r.ok) { console.log(`  ⚠️  doc ${id}: ${r.status} ${(await r.text()).slice(0, 160)}`); return; }
  const res = (await r.json()) as { replies?: Array<{ replaceAllText?: { occurrencesChanged?: number } }> };
  const counts = (res.replies || []).map((x) => x.replaceAllText?.occurrencesChanged ?? 0);
  console.log(`  ✅ doc ${id}: replaced ${counts.reduce((a, b) => a + b, 0)} occurrence(s) [${counts.join(',')}]`);
}

async function updateDirectory(token: string) {
  const meta = (await (await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${DIRECTORY}?fields=sheets(properties(sheetId,title))`, { headers: H(token) })).json()) as { sheets: Array<{ properties: { sheetId: number; title: string } }> };
  const sheet = meta.sheets[0].properties;
  const valRes = (await (await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${DIRECTORY}/values/${encodeURIComponent(sheet.title)}`, { headers: H(token) })).json()) as { values?: string[][] };
  const rows = valRes.values || [];
  const rowOf = (role: string) => rows.findIndex((r) => (r[0] || '').trim() === role);

  // 1) Fill appointee rows (B=name, C=email, E=notes). A1 rows are 1-based.
  const data: Array<{ range: string; values: string[][] }> = [];
  for (const [role, v] of Object.entries(DIR_FILL)) {
    const i = rowOf(role);
    if (i < 0) { console.log(`  ⚠️  directory: role not found: ${role}`); continue; }
    const r1 = i + 1;
    data.push({ range: `${sheet.title}!B${r1}:C${r1}`, values: [[v.name, v.email]] });
    data.push({ range: `${sheet.title}!E${r1}:E${r1}`, values: [[v.note]] });
  }
  if (data.length) {
    const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${DIRECTORY}/values:batchUpdate`, { method: 'POST', headers: H(token), body: JSON.stringify({ valueInputOption: 'RAW', data }) });
    console.log(r.ok ? `  ✅ directory: filled ${Object.keys(DIR_FILL).length} chair rows` : `  ⚠️  directory fill: ${r.status} ${(await r.text()).slice(0, 160)}`);
  }

  // 2) Delete the obsolete International Service row (do last so indices above are unaffected).
  const di = rowOf(DIR_DELETE_ROLE);
  if (di >= 0) {
    const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${DIRECTORY}:batchUpdate`, { method: 'POST', headers: H(token), body: JSON.stringify({ requests: [{ deleteDimension: { range: { sheetId: sheet.sheetId, dimension: 'ROWS', startIndex: di, endIndex: di + 1 } } }] }) });
    console.log(r.ok ? `  ✅ directory: removed "${DIR_DELETE_ROLE}" row` : `  ⚠️  directory delete: ${r.status} ${(await r.text()).slice(0, 160)}`);
  } else console.log(`  ℹ️  directory: "${DIR_DELETE_ROLE}" row not found (already removed?)`);
}

(async () => {
  const token = await getToken();
  console.log('✅ authenticated\nDocs:');
  for (const [id, edits] of Object.entries(DOC_EDITS)) await editDoc(token, id, edits);
  console.log('Board Directory:');
  await updateDirectory(token);
  console.log('\n🎉 Governance docs updated.');
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
