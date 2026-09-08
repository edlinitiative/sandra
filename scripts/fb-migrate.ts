/**
 * Mirror the RotaractNYC website's Firebase Storage bucket into the shared Drive's
 * "Photos & Videos" folder, preserving the album/prefix structure. Resumable: skips
 * any file already present (by name) in its target Drive folder.
 *
 * Needs (from env):
 *   FIREBASE_SERVICE_ACCOUNT + FIREBASE_STORAGE_BUCKET  (read the bucket)
 *   GOOGLE_SA_JSON                                       (write to the shared Drive)
 * Run: npx dotenv-cli -e ~/.env.local -e .env.production.local -- npx tsx scripts/fb-migrate.ts
 */
import { createSign } from 'crypto';

const PHOTOS_PARENT = '1O6a708YBU26a3n8dGKG0g7Coc5d5QLQU'; // 07 - Marketing / Photos & Videos
const ROOT_NAME = 'Club Photo Archive (from website)';
const CONCURRENCY = 4;

function parseJSONcreds(raw: string) {
  let s = raw.trim().replace(/^['"]|['"]$/g, '');
  if (!s.startsWith('{')) { try { const d = Buffer.from(s, 'base64').toString('utf8'); if (d.trim().startsWith('{')) s = d; } catch { /* */ } }
  let safe = ''; for (const ch of s) { const c = ch.charCodeAt(0); safe += c >= 0x20 ? ch : c === 10 ? '\\n' : c === 13 ? '\\r' : c === 9 ? '\\t' : '\\u' + c.toString(16).padStart(4, '0'); }
  return JSON.parse(safe) as { client_email: string; private_key: string };
}

// --- token cache with refresh (tokens live 1h; re-mint after 45m) ---
const cache: Record<string, { tok: string; at: number }> = {};
async function mint(kind: 'gcs' | 'drive'): Promise<string> {
  const c = cache[kind];
  if (c && Date.now() - c.at < 45 * 60 * 1000) return c.tok;
  const sa = parseJSONcreds(process.env[kind === 'gcs' ? 'FIREBASE_SERVICE_ACCOUNT' : 'GOOGLE_SA_JSON'] || '');
  const scope = kind === 'gcs' ? 'https://www.googleapis.com/auth/devstorage.read_only' : 'https://www.googleapis.com/auth/drive';
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: sa.client_email, scope, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const sig = createSign('RSA-SHA256').update(head).sign(sa.private_key, 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${sig}` }) });
  const d = (await r.json()) as { access_token?: string; error?: string };
  if (!d.access_token) throw new Error(`${kind} token: ${d.error || JSON.stringify(d)}`);
  cache[kind] = { tok: d.access_token, at: Date.now() };
  return d.access_token;
}

const bucket = () => (process.env.FIREBASE_STORAGE_BUCKET || '').replace(/^gs:\/\//, '');

async function listBucket(): Promise<Array<{ name: string; size: number; ct: string }>> {
  const out: Array<{ name: string; size: number; ct: string }> = [];
  let pageToken: string | undefined;
  do {
    const u = new URL(`https://storage.googleapis.com/storage/v1/b/${bucket()}/o`);
    u.searchParams.set('maxResults', '1000');
    if (pageToken) u.searchParams.set('pageToken', pageToken);
    const r = await fetch(u, { headers: { Authorization: `Bearer ${await mint('gcs')}` } });
    if (!r.ok) throw new Error(`list ${r.status}`);
    const d = (await r.json()) as { items?: Array<{ name: string; size?: string; contentType?: string }>; nextPageToken?: string };
    for (const o of d.items || []) if (!o.name.endsWith('/')) out.push({ name: o.name, size: Number(o.size || 0), ct: o.contentType || 'application/octet-stream' });
    pageToken = d.nextPageToken;
  } while (pageToken);
  return out;
}

async function download(name: string): Promise<Buffer> {
  const u = `https://storage.googleapis.com/storage/v1/b/${bucket()}/o/${encodeURIComponent(name)}?alt=media`;
  const r = await fetch(u, { headers: { Authorization: `Bearer ${await mint('gcs')}` } });
  if (!r.ok) throw new Error(`download ${name}: ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

async function driveGet(url: string) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${await mint('drive')}` } });
  if (!r.ok) throw new Error(`drive GET ${r.status}: ${(await r.text()).slice(0, 150)}`);
  return r.json();
}

async function findFolder(parent: string, name: string): Promise<string | null> {
  const q = encodeURIComponent(`'${parent}' in parents and name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const d = (await driveGet(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives`)) as { files?: Array<{ id: string }> };
  return d.files?.[0]?.id ?? null;
}

async function createFolder(parent: string, name: string): Promise<string> {
  const r = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id', {
    method: 'POST', headers: { Authorization: `Bearer ${await mint('drive')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, parents: [parent], mimeType: 'application/vnd.google-apps.folder' }),
  });
  if (!r.ok) throw new Error(`mkdir ${name}: ${r.status}`);
  return (await r.json() as { id: string }).id;
}

async function childNames(folderId: string): Promise<Set<string>> {
  const names = new Set<string>(); let pageToken: string | undefined;
  do {
    const u = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${folderId}' in parents and trashed = false`)}&fields=files(name),nextPageToken&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const d = (await driveGet(u)) as { files?: Array<{ name: string }>; nextPageToken?: string };
    (d.files || []).forEach((f) => names.add(f.name));
    pageToken = d.nextPageToken;
  } while (pageToken);
  return names;
}

async function upload(folderId: string, name: string, ct: string, bytes: Buffer) {
  const boundary = 'rcun_fb_migrate_boundary';
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: [folderId] })}\r\n--${boundary}\r\nContent-Type: ${ct}\r\n\r\n`),
    bytes, Buffer.from(`\r\n--${boundary}--`),
  ]);
  const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id', {
    method: 'POST', headers: { Authorization: `Bearer ${await mint('drive')}`, 'Content-Type': `multipart/related; boundary=${boundary}` }, body,
  });
  if (!r.ok) throw new Error(`upload ${name}: ${r.status} ${(await r.text()).slice(0, 150)}`);
}

(async () => {
  console.log(`[${new Date().toISOString()}] Starting migration → "${ROOT_NAME}"`);
  const objects = await listBucket();
  console.log(`Found ${objects.length} objects in gs://${bucket()}`);

  // Phase 1: ensure the folder tree exists; cache folderId + existing child names per dir.
  const folderId: Record<string, string> = {};
  const existing: Record<string, Set<string>> = {};
  async function ensureDir(path: string): Promise<string> {
    if (folderId[path]) return folderId[path];
    const parts = path === '' ? [] : path.split('/');
    let parent = PHOTOS_PARENT, cur = '';
    for (const seg of [ROOT_NAME, ...parts]) {
      cur = cur ? `${cur}/${seg}` : seg;
      if (!folderId[cur]) {
        let id = await findFolder(parent, seg);
        if (id) { existing[cur] = await childNames(id); }
        else { id = await createFolder(parent, seg); existing[cur] = new Set(); }
        folderId[cur] = id;
      }
      parent = folderId[cur];
    }
    return parent;
  }
  const dirs = new Set(objects.map((o) => o.name.split('/').slice(0, -1).join('/')));
  for (const d of dirs) await ensureDir(d);
  console.log(`Folder tree ready (${Object.keys(folderId).length} folders).`);

  // Phase 2: upload files, skipping ones already present. Bounded concurrency.
  let done = 0, uploaded = 0, skipped = 0, failed = 0, mb = 0;
  const key = (o: { name: string }) => { const parts = o.name.split('/'); return { dir: parts.slice(0, -1).join('/'), file: parts[parts.length - 1] }; };
  let idx = 0;
  async function worker() {
    while (idx < objects.length) {
      const o = objects[idx++];
      const { dir, file } = key(o);
      const rootKey = dir === '' ? ROOT_NAME : `${ROOT_NAME}/${dir}`;
      try {
        if (existing[rootKey]?.has(file)) { skipped++; }
        else {
          const bytes = await download(o.name);
          await upload(folderId[rootKey], file, o.ct, bytes);
          existing[rootKey]?.add(file); uploaded++; mb += o.size / 1e6;
        }
      } catch (e) { failed++; console.log(`  ⚠️  ${o.name}: ${e instanceof Error ? e.message : e}`); }
      if (++done % 25 === 0 || done === objects.length) console.log(`  [${done}/${objects.length}] up ${uploaded} · skip ${skipped} · fail ${failed} · ${mb.toFixed(0)} MB`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`[${new Date().toISOString()}] DONE — uploaded ${uploaded}, skipped ${skipped}, failed ${failed}, ${mb.toFixed(0)} MB`);
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
