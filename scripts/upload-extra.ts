/** One-off: push remaining templates (formal letters + email PDF) to Drive (SA identity). */
import { createSign } from 'crypto';
import { readFileSync, existsSync, statSync } from 'fs';
import { basename, join } from 'path';
import { homedir } from 'os';
import { loadServiceAccount } from './load-sa';

const SCOPE = 'https://www.googleapis.com/auth/drive';
const DOWNLOADS = join(homedir(), 'Downloads');

const LETTERHEAD_FOLDER = '1xHTchO6E87ANFF8GWefMEO0xDVpvC9eT'; // Brand Assets / Letterhead Templates
const COMMITTEE_LEADERSHIP = '1YPBzgysC2YnCJkQ6PSpshH4y3fcHYWFr'; // Committee Leadership Resources

const MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const JOBS: Array<[string, string]> = [
  ['RCUN-Letter-Post-Event-ThankYou.docx', LETTERHEAD_FOLDER],
  ['RCUN-Letter-Sponsor-ThankYou.docx', LETTERHEAD_FOLDER],
  ['RCUN-Letter-Donation-Receipt.docx', LETTERHEAD_FOLDER],
  ['RCUN-Letter-Membership-Verification.docx', LETTERHEAD_FOLDER],
  ['RCUN-Letter-Partnership-Proposal.docx', LETTERHEAD_FOLDER],
  ['RCUN-Email-Templates.pdf', COMMITTEE_LEADERSHIP],
];

async function getToken(): Promise<string> {
  const sa = loadServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: sa.client_email, scope: SCOPE, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  })).toString('base64url');
  const s = createSign('RSA-SHA256'); s.update(header + '.' + payload);
  const jwt = `${header}.${payload}.${s.sign(sa.private_key, 'base64url')}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error(`Token exchange failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function upload(token: string, file: string, parentId: string) {
  const path = join(DOWNLOADS, file);
  if (!existsSync(path)) throw new Error(`missing: ${file}`);
  const ext = file.slice(file.lastIndexOf('.')).toLowerCase();
  const contentType = MIME[ext];
  if (!contentType) throw new Error(`unknown type: ${file}`);
  const boundary = 'sandra_extra_boundary_9d2';
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify({ name: basename(path), parents: [parentId] }) +
      `\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`),
    readFileSync(path),
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink',
    { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
  if (!res.ok) throw new Error(`${file}: ${res.status} ${await res.text()}`);
  const f = (await res.json()) as { name: string; webViewLink?: string };
  console.log(`  ✅ ${f.name}  (${(statSync(path).size / 1024).toFixed(0)}KB)  ${f.webViewLink}`);
}

(async () => {
  const token = await getToken();
  console.log('✅ Token obtained');
  let ok = 0;
  for (const [file, parent] of JOBS) {
    try { await upload(token, file, parent); ok++; } catch (e) { console.error('  ❌', e instanceof Error ? e.message : e); }
  }
  console.log(`Done — ${ok}/${JOBS.length} uploaded.`);
})().catch((e) => { console.error('Fatal:', e); process.exit(1); });
