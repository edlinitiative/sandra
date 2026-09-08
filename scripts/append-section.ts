/** Append a formatted section to the END of a Google Doc (non-destructive). Usage: tsx scripts/append-section.ts <specJsonFile>
 * spec: { docId, paras: [ {kind:'h1'|'h2'|'p'|'li', text, boldLead?:number} ] } */
import { getToken, api } from './gdoc-lib';
import { readFileSync } from 'fs';
const CRAN = { color: { rgbColor: { red: 0.757, green: 0.071, blue: 0.247 } } };
(async () => {
  const spec = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const t = await getToken();
  const doc = await api(t, `https://docs.googleapis.com/v1/documents/${spec.docId}?fields=body.content(endIndex)`);
  const maxEnd = Math.max(...doc.body.content.map((c: any) => c.endIndex || 0));
  const base = maxEnd - 1;                       // insert before the doc's final newline
  const T = '\n' + spec.paras.map((p: any) => p.text).join('\n');
  const reqs: any[] = [{ insertText: { location: { index: base }, text: T } }];
  let pos = base + 1;
  for (const p of spec.paras) {
    const L = p.text.length;
    const named = p.kind === 'h1' ? 'HEADING_1' : p.kind === 'h2' ? 'HEADING_2' : 'NORMAL_TEXT';
    reqs.push({ updateParagraphStyle: { range: { startIndex: pos, endIndex: pos + L + 1 }, paragraphStyle: { namedStyleType: named }, fields: 'namedStyleType' } });
    if (p.kind === 'h1' || p.kind === 'h2')
      reqs.push({ updateTextStyle: { range: { startIndex: pos, endIndex: pos + L }, textStyle: { bold: true, foregroundColor: { color: CRAN.color } }, fields: 'bold,foregroundColor' } });
    if (p.kind === 'li')
      reqs.push({ createParagraphBullets: { range: { startIndex: pos, endIndex: pos + L + 1 }, bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE' } });
    if (p.boldLead)
      reqs.push({ updateTextStyle: { range: { startIndex: pos, endIndex: pos + p.boldLead }, textStyle: { bold: true }, fields: 'bold' } });
    pos += L + 1;
  }
  await api(t, `https://docs.googleapis.com/v1/documents/${spec.docId}:batchUpdate`, 'POST', { requests: reqs });
  console.log('✅ appended section to', spec.docId);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
