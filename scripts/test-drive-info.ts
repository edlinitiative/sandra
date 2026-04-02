import { readFileSync } from 'fs';
import { createSign } from 'crypto';
import { resolve } from 'path';

const sa = JSON.parse(readFileSync(resolve(__dirname, '..', 'sandra_ai_service_acccount_json'), 'utf-8'));

async function main() {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');

  // Impersonate info@edlight.org for Drive access
  const payload = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    sub: 'info@edlight.org',
    scope: 'https://www.googleapis.com/auth/drive.readonly',
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
  if (!td.access_token) {
    console.error('❌ Token failed:', JSON.stringify(td, null, 2));
    process.exit(1);
  }
  console.log('✅ Token obtained (impersonating info@edlight.org)\n');

  // List files
  const fields = 'files(id,name,mimeType,modifiedTime,size,owners),nextPageToken';
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?pageSize=25&orderBy=modifiedTime+desc&fields=${encodeURIComponent(fields)}`, {
    headers: { Authorization: 'Bearer ' + td.access_token },
  });
  const data = await res.json() as any;

  if (data.files) {
    console.log(`📁 Found ${data.files.length} files in info@edlight.org's Drive:\n`);
    for (const f of data.files) {
      const size = f.size ? `${(parseInt(f.size) / 1024).toFixed(0)}KB` : '';
      const mod = f.modifiedTime ? f.modifiedTime.slice(0, 10) : '';
      console.log(`  ${f.mimeType?.includes('folder') ? '📂' : '📄'} ${f.name}  [${f.mimeType?.split('.').pop()}]  ${size}  ${mod}`);
    }
    if (data.nextPageToken) console.log('\n  ... more files available (paginated)');
  } else {
    console.log('Response:', JSON.stringify(data, null, 2));
  }

  // Also check shared drives
  console.log('\n--- Shared Drives ---');
  const sdRes = await fetch('https://www.googleapis.com/drive/v3/drives?pageSize=10', {
    headers: { Authorization: 'Bearer ' + td.access_token },
  });
  const sdData = await sdRes.json() as any;
  if (sdData.drives?.length) {
    for (const d of sdData.drives) console.log(`  🗄️  ${d.name} (${d.id})`);
  } else {
    console.log('  No shared drives found (or none accessible)');
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
