/**
 * One-off: upload RCUN letterheads + guide PDFs to Drive via the service worker.
 *
 * Impersonates info@edlight.org (domain-wide delegation) and multipart-uploads
 * local files into their destination folders. Works for Shared Drives via
 * supportsAllDrives=true. .docx files are kept native (no Google-Docs conversion).
 *
 * Run:  npx tsx scripts/upload-to-drive.ts
 * Needs: GOOGLE_SA_JSON in .env (service account with drive.file delegation).
 */

import { createSign } from 'crypto';
import { readFileSync, existsSync, statSync } from 'fs';
import { basename, join } from 'path';
import { homedir } from 'os';
import { loadServiceAccount } from './load-sa';

const SCOPE = 'https://www.googleapis.com/auth/drive';
const DOWNLOADS = join(homedir(), 'Downloads');

const MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

// Destination folders (verified via Drive search)
const LETTERHEAD_FOLDER = '1xHTchO6E87ANFF8GWefMEO0xDVpvC9eT'; // Brand Assets / Letterhead Templates
const GUIDES_FOLDER = '1rsVEs_SW6h95hgS7_sDESrdJqp0qDuTv'; // 03 Active Member Resources

const LETTERHEADS = [
  'RCUN-Letterhead-01-Classic.docx',
  'RCUN-Letterhead-01-Classic-print.pdf',
  'RCUN-Letterhead-02-Modern.docx',
  'RCUN-Letterhead-02-Modern-print.pdf',
  'RCUN-Letterhead-03-Branded.docx',
  'RCUN-Letterhead-03-Sidebar-print.pdf',
  'RCUN-Letterhead-05-Minimal.docx',
  'RCUN-Letterhead-05-Minimal-print.pdf',
  'RCUN-Letterhead-06-Formal.docx',
  'RCUN-Letterhead-06-Formal-Keyline-print.pdf',
];

const GUIDES = [
  'RCUN-Guide-events.pdf',
  'RCUN-Guide-marketing.pdf',
  'RCUN-Guide-membership.pdf',
  'RCUN-Guide-profdev.pdf',
  'Rotaract-NYC-Member-Guide.pdf',
];

async function getToken(): Promise<string> {
  const sa = loadServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      iss: sa.client_email,
      scope: SCOPE,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  ).toString('base64url');
  const s = createSign('RSA-SHA256');
  s.update(header + '.' + payload);
  const sig = s.sign(sa.private_key, 'base64url');
  const jwt = `${header}.${payload}.${sig}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error(`Token exchange failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function uploadFile(token: string, path: string, parentId: string): Promise<void> {
  const name = basename(path);
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
  const contentType = MIME[ext];
  if (!contentType) throw new Error(`Unknown file type for ${name}`);
  if (!existsSync(path)) throw new Error(`File not found: ${path}`);

  const bytes = readFileSync(path);
  const metadata = { name, parents: [parentId] };
  const boundary = 'sandra_upload_boundary_7c3f';

  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
        JSON.stringify(metadata) +
        `\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`,
    ),
    bytes,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const url =
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`Upload ${name} failed: ${res.status} — ${await res.text()}`);
  }
  const f = (await res.json()) as { id: string; name: string; webViewLink?: string };
  const kb = (statSync(path).size / 1024).toFixed(0);
  console.log(`  ✅ ${f.name}  (${kb}KB)  ${f.webViewLink ?? f.id}`);
}

async function uploadGroup(token: string, label: string, files: string[], parentId: string): Promise<number> {
  console.log(`\n📁 ${label} → folder ${parentId}`);
  let ok = 0;
  for (const f of files) {
    try {
      await uploadFile(token, join(DOWNLOADS, f), parentId);
      ok++;
    } catch (e) {
      console.error(`  ❌ ${f}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return ok;
}

async function main() {
  console.log('🔑 Authenticating as service account (direct, no impersonation)…');
  const token = await getToken();
  console.log('✅ Token obtained');

  const a = await uploadGroup(token, 'Letterheads', LETTERHEADS, LETTERHEAD_FOLDER);
  const b = await uploadGroup(token, 'Guides', GUIDES, GUIDES_FOLDER);

  console.log(`\n🎉 Done — ${a}/${LETTERHEADS.length} letterheads, ${b}/${GUIDES.length} guides uploaded.`);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
