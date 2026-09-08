/** Dump a Google Doc's text (paragraphs + bullets) via the service account. Usage: tsx scripts/read-doc.ts <docId> */
import { getToken, api } from './gdoc-lib';
(async () => {
  const id = process.argv[2];
  const t = await getToken();
  const doc = await api(t, `https://docs.googleapis.com/v1/documents/${id}?fields=title,body.content(paragraph(elements.textRun.content,bullet,paragraphStyle.namedStyleType))`);
  console.log('TITLE: ' + doc.title + '\n---');
  for (const c of doc.body.content || []) {
    const p = c.paragraph; if (!p) continue;
    const txt = (p.elements || []).map((e: any) => e.textRun?.content || '').join('').replace(/\n$/, '');
    console.log((p.bullet ? '• ' : '') + txt);
  }
})().catch(e => { console.error(e.message); process.exit(1); });
