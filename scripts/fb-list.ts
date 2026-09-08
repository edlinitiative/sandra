/**
 * Read-only: list the RotaractNYC website's Firebase Storage bucket to understand structure.
 * Needs FIREBASE_SERVICE_ACCOUNT + FIREBASE_STORAGE_BUCKET in env.
 * Run: npx dotenv-cli -e ~/.env.local -- npx tsx scripts/fb-list.ts
 */
import { createSign } from 'crypto';

function parseSA(raw: string): { client_email: string; private_key: string } {
  let s = raw.trim().replace(/^['"]|['"]$/g, '');
  // may be base64-encoded
  if (!s.startsWith('{')) {
    try { const d = Buffer.from(s, 'base64').toString('utf8'); if (d.trim().startsWith('{')) s = d; } catch { /* ignore */ }
  }
  let safe = '';
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    if (c >= 0x20) { safe += ch; continue; }
    safe += ch === '\n' ? '\\n' : ch === '\r' ? '\\r' : ch === '\t' ? '\\t' : '\\u' + c.toString(16).padStart(4, '0');
  }
  return JSON.parse(safe);
}

async function gcsToken(): Promise<string> {
  const sa = parseSA(process.env.FIREBASE_SERVICE_ACCOUNT || '');
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/devstorage.read_only',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  })}`;
  const sig = createSign('RSA-SHA256').update(head).sign(sa.private_key, 'base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${sig}` }),
  });
  const d = (await res.json()) as { access_token?: string; error?: string };
  if (!d.access_token) throw new Error(d.error || JSON.stringify(d));
  return d.access_token;
}

(async () => {
  const bucket = (process.env.FIREBASE_STORAGE_BUCKET || '').replace(/^gs:\/\//, '');
  if (!bucket) throw new Error('FIREBASE_STORAGE_BUCKET not set');
  const token = await gcsToken();
  console.log(`✅ authed; listing gs://${bucket}\n`);

  const byPrefix: Record<string, { n: number; bytes: number; img: number }> = {};
  let total = 0, images = 0, bytes = 0, pageToken: string | undefined;
  do {
    const u = new URL(`https://storage.googleapis.com/storage/v1/b/${bucket}/o`);
    u.searchParams.set('maxResults', '1000');
    if (pageToken) u.searchParams.set('pageToken', pageToken);
    const res = await fetch(u, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`list ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as { items?: Array<{ name: string; size?: string; contentType?: string }>; nextPageToken?: string };
    for (const o of data.items || []) {
      total++;
      const sz = Number(o.size || 0); bytes += sz;
      const isImg = (o.contentType || '').startsWith('image/') || /\.(jpe?g|png|heic|webp|gif)$/i.test(o.name);
      if (isImg) images++;
      const top = o.name.includes('/') ? o.name.split('/')[0] + '/' : '(root)';
      (byPrefix[top] ??= { n: 0, bytes: 0, img: 0 });
      byPrefix[top].n++; byPrefix[top].bytes += sz; if (isImg) byPrefix[top].img++;
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  console.log(`TOTAL: ${total} objects, ${images} images, ${(bytes / 1e6).toFixed(1)} MB\n`);
  console.log('Top-level prefixes (objects / images / size):');
  for (const [p, s] of Object.entries(byPrefix).sort((a, b) => b[1].n - a[1].n)) {
    console.log(`  ${p.padEnd(28)} ${String(s.n).padStart(5)} / ${String(s.img).padStart(5)} img / ${(s.bytes / 1e6).toFixed(1)} MB`);
  }
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
