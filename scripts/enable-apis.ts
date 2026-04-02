import { readFileSync } from 'fs';
import { createSign } from 'crypto';
import { resolve } from 'path';

const sa = JSON.parse(readFileSync(resolve(__dirname, '..', 'sandra_ai_service_acccount_json'), 'utf-8'));

async function main() {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })).toString('base64url');

  const s = createSign('RSA-SHA256');
  s.update(header + '.' + payload);
  const sig = s.sign(sa.private_key, 'base64url');
  const jwt = header + '.' + payload + '.' + sig;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt,
  });
  const td = await tokenRes.json() as any;
  if (!td.access_token) { console.error('Token failed:', td); process.exit(1); }
  console.log('✅ Got cloud-platform token');

  const apis = ['drive.googleapis.com', 'gmail.googleapis.com', 'admin.googleapis.com'];
  for (const api of apis) {
    console.log(`\nEnabling ${api}...`);
    const r = await fetch(`https://serviceusage.googleapis.com/v1/projects/sandra-492104/services/${api}:enable`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + td.access_token, 'Content-Type': 'application/json' },
    });
    const d = await r.json() as any;
    if (d.error) {
      console.log(`  ❌ ${d.error.code}: ${d.error.message}`);
    } else {
      console.log(`  ✅ Done (operation: ${d.name || 'immediate'})`);
    }
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
