/**
 * Reword member-facing "includes RI registration" claims + the Exec Plan "fully part of RCUN"
 * line, per the club keeping all dues and the lighter Associate tier. Reversible via history.
 * Run: npx dotenv-cli -e .env.production.local -- npx tsx scripts/reword-ri.ts
 */
import { createSign } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const EXEC_PLAN = '1rTv0SLlJNRXWYvxFsmPDQS2h1uhE8gLVwj2U-_RSHqQ';
const DUES_EMAIL = '15ITkh3DZUdJfEnCxP_WwKj4mfOoMqJ_J4QouUJcXkVo';

const DOC_EDITS: Record<string, Array<{ find: string; replace: string }>> = {
  [EXEC_PLAN]: [
    { find: 'open an Associate Member path for Rotaractors from other clubs who want to be fully part of RCUN.',
      replace: 'open an Associate Member path for Rotaractors from other clubs who want to take part in RCUN alongside their home club.' },
  ],
  [DUES_EMAIL]: [
    { find: ' (includes your Rotary International registration)', replace: '' },
    { find: 'Your dues keep our service projects, events, and RI membership going',
      replace: 'Your dues keep our service projects and events going' },
  ],
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
  const head = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/documents', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const sig = createSign('RSA-SHA256').update(head).sign(sa.private_key, 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${sig}` }) });
  const d = (await r.json()) as { access_token?: string; error?: string };
  if (!d.access_token) throw new Error(d.error || JSON.stringify(d));
  return d.access_token;
}

(async () => {
  const token = await getToken();
  console.log('✅ authenticated');
  for (const [id, edits] of Object.entries(DOC_EDITS)) {
    const requests = edits.map((e) => ({ replaceAllText: { containsText: { text: e.find, matchCase: true }, replaceText: e.replace } }));
    const r = await fetch(`https://docs.googleapis.com/v1/documents/${id}:batchUpdate`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ requests }) });
    const res = (await r.json()) as { replies?: Array<{ replaceAllText?: { occurrencesChanged?: number } }> };
    console.log(r.ok ? `  ✅ ${id}: [${(res.replies || []).map((x) => x.replaceAllText?.occurrencesChanged ?? 0).join(',')}]` : `  ⚠️  ${id}: ${JSON.stringify(res).slice(0, 160)}`);
  }
  console.log('\n🎉 Done.');
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
