/** Create a new Google Doc from HTML in a Drive folder (SA). Usage: tsx scripts/create-doc.ts <folderId> <name> <htmlFile> */
import { getToken } from './gdoc-lib';
import { readFileSync } from 'fs';
(async () => {
  const [, , folderId, name, htmlPath] = process.argv;
  const t = await getToken();
  const html = readFileSync(htmlPath, 'utf8');
  const boundary = 'rcun_cal_boundary_71x';
  const meta = { name, parents: [folderId], mimeType: 'application/vnd.google-apps.document' };
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n${html}\r\n--${boundary}--`;
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink',
    { method: 'POST', headers: { Authorization: `Bearer ${t}`, 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
  if (!res.ok) throw new Error(res.status + ' ' + (await res.text()).slice(0, 300));
  const f = await res.json() as any;
  console.log('✅ created:', f.name, '→', f.webViewLink);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
