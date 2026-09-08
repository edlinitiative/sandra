/** Upload a binary file to a Drive folder as-is (SA). Usage: tsx scripts/upload-file.ts <folderId> <filePath> [mime] */
import { getToken } from './gdoc-lib';
import { readFileSync } from 'fs';
import { basename } from 'path';
(async () => {
  const [, , folderId, filePath, mime] = process.argv;
  const ct = mime || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const t = await getToken();
  const boundary = 'rcun_up_boundary_44z';
  const meta = { name: basename(filePath), parents: [folderId] };
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${ct}\r\n\r\n`),
    readFileSync(filePath),
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink',
    { method: 'POST', headers: { Authorization: `Bearer ${t}`, 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
  if (!res.ok) throw new Error(res.status + ' ' + (await res.text()).slice(0, 300));
  const f = await res.json() as any;
  console.log('✅ uploaded:', f.name, '→', f.webViewLink);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
