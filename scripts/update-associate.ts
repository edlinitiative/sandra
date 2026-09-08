/**
 * Rewrite the Associate Member paragraph in the Executive Plan 2026–2027 to match
 * the confirmed model (no dues → no perks, non-member event pricing, no vote/office/chair,
 * 3-month committee rule, convert-by-paying, 40% cap). Reversible via version history.
 * Run: npx dotenv-cli -e .env.production.local -- npx tsx scripts/update-associate.ts
 */
import { createSign } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const EXEC_PLAN = '1rTv0SLlJNRXWYvxFsmPDQS2h1uhE8gLVwj2U-_RSHqQ';
const FIND = 'Launch the Associate Member category: Rotaractors from other clubs pay full RCUN dues and enjoy full benefits, and may chair committees, but do not vote in elections or hold executive office; capped at 40% of active membership.';
const REPLACE = 'Launch the Associate Member category: an active Rotaractor from another club may take part in RCUN as an Associate. Because Rotary does not charge RI dues twice, Associates pay no RCUN dues — and so pay the standard (non-member) rate for events and receive no member perks or partner discounts. Associates do not vote on club matters, hold elected office, or chair committees; after an initial three months they are expected to join a committee and participate actively. An Associate who wants member benefits and a vote becomes a full member by paying club dues. Associate membership is capped at 40% of active membership.';

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
  const r = await fetch(`https://docs.googleapis.com/v1/documents/${EXEC_PLAN}:batchUpdate`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ replaceAllText: { containsText: { text: FIND, matchCase: true }, replaceText: REPLACE } }] }),
  });
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
  const res = (await r.json()) as { replies?: Array<{ replaceAllText?: { occurrencesChanged?: number } }> };
  const n = res.replies?.[0]?.replaceAllText?.occurrencesChanged ?? 0;
  console.log(n > 0 ? `✅ Executive Plan: Associate paragraph rewritten (${n} match)` : `⚠️  0 matches — the source text may differ; re-check the current paragraph.`);
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
