/** Replace a Google Doc's content with formatted HTML (keeps same ID/URL). Usage: tsx scripts/push-doc.ts <docId> <htmlFile> */
import { getToken } from './gdoc-lib';
import { readFileSync } from 'fs';
(async () => {
  const [, , id, htmlPath] = process.argv;
  const t = await getToken();
  const html = readFileSync(htmlPath, 'utf8');
  const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media&supportsAllDrives=true`,
    { method: 'PATCH', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'text/html' }, body: html });
  console.log(res.ok ? '✅ pushed ' + id : '❌ ' + res.status + ' ' + (await res.text()).slice(0, 200));
})().catch(e => { console.error(e.message); process.exit(1); });
