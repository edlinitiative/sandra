/**
 * Read-only: list immediate sub-folders (prefixes) under a given prefix in the bucket.
 * Run: npx dotenv-cli -e ~/.env.local -- npx tsx scripts/fb-tree.ts albums/
 */
import { createSign } from 'crypto';

function parseSA(raw: string) {
  let s = raw.trim().replace(/^['"]|['"]$/g, '');
  if (!s.startsWith('{')) { try { const d = Buffer.from(s, 'base64').toString('utf8'); if (d.trim().startsWith('{')) s = d; } catch { /* */ } }
  let safe = ''; for (const ch of s) { const c = ch.charCodeAt(0); safe += c >= 0x20 ? ch : c === 10 ? '\\n' : c === 13 ? '\\r' : c === 9 ? '\\t' : '\\u' + c.toString(16).padStart(4, '0'); }
  return JSON.parse(safe) as { client_email: string; private_key: string };
}
async function gcsToken(): Promise<string> {
  const sa = parseSA(process.env.FIREBASE_SERVICE_ACCOUNT || '');
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/devstorage.read_only', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const sig = createSign('RSA-SHA256').update(head).sign(sa.private_key, 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${sig}` }) });
  const d = (await r.json()) as { access_token?: string; error?: string };
  if (!d.access_token) throw new Error(d.error || JSON.stringify(d));
  return d.access_token;
}
(async () => {
  const bucket = (process.env.FIREBASE_STORAGE_BUCKET || '').replace(/^gs:\/\//, '');
  const prefix = process.argv[2] || 'albums/';
  const token = await gcsToken();
  const prefixes: string[] = []; const files: Array<{ name: string; size: number }> = []; let pageToken: string | undefined;
  do {
    const u = new URL(`https://storage.googleapis.com/storage/v1/b/${bucket}/o`);
    u.searchParams.set('delimiter', '/'); u.searchParams.set('prefix', prefix); u.searchParams.set('maxResults', '1000');
    if (pageToken) u.searchParams.set('pageToken', pageToken);
    const r = await fetch(u, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 200)}`);
    const d = (await r.json()) as { prefixes?: string[]; items?: Array<{ name: string; size?: string }>; nextPageToken?: string };
    (d.prefixes || []).forEach((p) => prefixes.push(p));
    (d.items || []).forEach((o) => { if (o.name !== prefix) files.push({ name: o.name, size: Number(o.size || 0) }); });
    pageToken = d.nextPageToken;
  } while (pageToken);
  console.log(`Under "${prefix}" — ${prefixes.length} sub-folders, ${files.length} direct files:\n`);
  prefixes.forEach((p) => console.log('  📁 ' + p));
  files.slice(0, 15).forEach((f) => console.log(`  📄 ${f.name}  (${(f.size / 1e3).toFixed(0)} KB)`));
  if (files.length > 15) console.log(`  … +${files.length - 15} more files`);
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
