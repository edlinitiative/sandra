import { readFileSync } from 'fs';
import { createSign } from 'crypto';
import { resolve } from 'path';

const sa = JSON.parse(readFileSync(resolve(__dirname, '..', 'sandra_ai_service_acccount_json'), 'utf-8'));

async function main() {
  // Build a JWT to get an access token, impersonating sandra@edlight.org
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    sub: 'sandra@edlight.org',
    scope: 'https://www.googleapis.com/auth/admin.directory.user.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })).toString('base64url');

  const sign = createSign('RSA-SHA256');
  sign.update(header + '.' + payload);
  const signature = sign.sign(sa.private_key, 'base64url');
  const jwt = header + '.' + payload + '.' + signature;

  // Exchange JWT for access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + jwt,
  });
  const tokenData = await tokenRes.json() as any;
  if (!tokenData.access_token) {
    console.error('❌ Token exchange failed:', JSON.stringify(tokenData, null, 2));
    process.exit(1);
  }
  console.log('✅ Access token obtained!');

  // Test 1: List directory users
  console.log('\n--- Directory API ---');
  const dirRes = await fetch('https://admin.googleapis.com/admin/directory/v1/users?domain=edlight.org&maxResults=10', {
    headers: { Authorization: 'Bearer ' + tokenData.access_token },
  });
  const dirData = await dirRes.json() as any;
  if (dirData.users) {
    console.log('✅ Directory API working! Users found:', dirData.users.length);
    for (const u of dirData.users) {
      console.log('  👤', u.primaryEmail, '-', u.name?.fullName || '(no name)');
    }
  } else {
    console.log('⚠️  Directory response:', JSON.stringify(dirData, null, 2));
  }

  // Test 2: Drive (impersonate sandra@edlight.org)
  console.log('\n--- Drive API ---');
  const driveJwtPayload = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    sub: 'sandra@edlight.org',
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })).toString('base64url');
  const driveSign = createSign('RSA-SHA256');
  driveSign.update(header + '.' + driveJwtPayload);
  const driveSig = driveSign.sign(sa.private_key, 'base64url');
  const driveJwt = header + '.' + driveJwtPayload + '.' + driveSig;

  const driveTokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + driveJwt,
  });
  const driveTokenData = await driveTokenRes.json() as any;
  if (!driveTokenData.access_token) {
    console.log('⚠️  Drive token failed:', JSON.stringify(driveTokenData, null, 2));
  } else {
    const driveRes = await fetch('https://www.googleapis.com/drive/v3/files?pageSize=5&fields=files(id,name,mimeType)', {
      headers: { Authorization: 'Bearer ' + driveTokenData.access_token },
    });
    const driveData = await driveRes.json() as any;
    if (driveData.files) {
      console.log('✅ Drive API working! Files found:', driveData.files.length);
      for (const f of driveData.files) {
        console.log('  📄', f.name, `(${f.mimeType})`);
      }
    } else {
      console.log('⚠️  Drive response:', JSON.stringify(driveData, null, 2));
    }
  }

  // Test 3: Gmail (impersonate sandra@edlight.org)
  console.log('\n--- Gmail API ---');
  const gmailJwtPayload = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    sub: 'sandra@edlight.org',
    scope: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.compose',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })).toString('base64url');
  const gmailSign = createSign('RSA-SHA256');
  gmailSign.update(header + '.' + gmailJwtPayload);
  const gmailSig = gmailSign.sign(sa.private_key, 'base64url');
  const gmailJwt = header + '.' + gmailJwtPayload + '.' + gmailSig;

  const gmailTokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + gmailJwt,
  });
  const gmailTokenData = await gmailTokenRes.json() as any;
  if (!gmailTokenData.access_token) {
    console.log('⚠️  Gmail token failed:', JSON.stringify(gmailTokenData, null, 2));
  } else {
    console.log('✅ Gmail token obtained! (send/compose scopes)');
    // List drafts as a non-destructive test
    const draftsRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts?maxResults=3', {
      headers: { Authorization: 'Bearer ' + gmailTokenData.access_token },
    });
    const draftsData = await draftsRes.json() as any;
    console.log('  Drafts result:', draftsData.resultSizeEstimate !== undefined ? `✅ ${draftsData.resultSizeEstimate} drafts` : JSON.stringify(draftsData));
  }

  console.log('\n🎉 Delegation verification complete!');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
