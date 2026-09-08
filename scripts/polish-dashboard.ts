import { getToken, api } from './gdoc-lib';
const SHEET = '1ioTWMHNiQzBULTeyOrlaiEGlAReBOwYaYdL0HWtgQJM';

const cranberry = { red: 0.757, green: 0.071, blue: 0.247 };
const cranberryDeep = { red: 0.62, green: 0.055, blue: 0.20 };
const bone = { red: 0.965, green: 0.945, blue: 0.906 };
const lightCran = { red: 0.980, green: 0.918, blue: 0.937 };
const gray = { red: 0.42, green: 0.40, blue: 0.447 };
const white = { red: 1, green: 1, blue: 1 };
const gold = { red: 0.757, green: 0.569, blue: 0.184 };

const TABS = { dash: 0, yearly: 1799422183, funds: 160819460, community: 572177154, service: 1304169299 };

const rng = (sheetId: number, r0: number, r1: number, c0: number, c1: number) =>
  ({ sheetId, startRowIndex: r0, endRowIndex: r1, startColumnIndex: c0, endColumnIndex: c1 });

const fmt = (range: any, f: any) => ({ repeatCell: { range, cell: { userEnteredFormat: f }, fields: 'userEnteredFormat(' + Object.keys(f).join(',') + ')' } });
const merge = (range: any) => ({ mergeCells: { range, mergeType: 'MERGE_ALL' } });
const freeze = (sheetId: number) => ({ updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } });
const rowH = (sheetId: number, i: number, px: number) => ({ updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: i, endIndex: i + 1 }, properties: { pixelSize: px }, fields: 'pixelSize' } });

const headerBand = (sheetId: number, cols: number) => fmt(rng(sheetId, 0, 1, 0, cols),
  { backgroundColor: cranberry, horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE',
    textFormat: { foregroundColor: white, bold: true, fontSize: 10 } });
const headerBoldOnly = (sheetId: number, cols: number) => fmt(rng(sheetId, 0, 1, 0, cols),
  { textFormat: { foregroundColor: cranberryDeep, bold: true } });

const requests: any[] = [
  // ── Dashboard landing ──
  merge(rng(TABS.dash, 0, 1, 0, 6)),
  fmt(rng(TABS.dash, 0, 1, 0, 6), { backgroundColor: cranberry, horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE',
    textFormat: { foregroundColor: bone, bold: true, fontSize: 15 } }),
  rowH(TABS.dash, 0, 46),
  merge(rng(TABS.dash, 1, 2, 0, 6)),
  fmt(rng(TABS.dash, 1, 2, 0, 6), { horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE', wrapStrategy: 'WRAP',
    textFormat: { foregroundColor: gray, italic: true, fontSize: 9 } }),
  rowH(TABS.dash, 1, 34),
  // KPI numbers (row 4 → index 3)
  fmt(rng(TABS.dash, 3, 4, 0, 6), { backgroundColor: lightCran, horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE',
    textFormat: { foregroundColor: cranberryDeep, bold: true, fontSize: 18 } }),
  rowH(TABS.dash, 3, 42),
  // KPI labels (row 5 → index 4)
  fmt(rng(TABS.dash, 4, 5, 0, 6), { backgroundColor: lightCran, horizontalAlignment: 'CENTER', verticalAlignment: 'TOP', wrapStrategy: 'WRAP',
    textFormat: { foregroundColor: gray, bold: true, fontSize: 8 } }),
  rowH(TABS.dash, 4, 30),
  // borders around the KPI card block A4:F5
  { updateBorders: { range: rng(TABS.dash, 3, 5, 0, 6),
    top: { style: 'SOLID_MEDIUM', color: gold }, bottom: { style: 'SOLID_MEDIUM', color: gold },
    left: { style: 'SOLID', color: gold }, right: { style: 'SOLID', color: gold },
    innerVertical: { style: 'SOLID', color: { red: 0.85, green: 0.72, blue: 0.45 } } } },

  // ── data tabs ──
  headerBand(TABS.yearly, 5),
  headerBand(TABS.funds, 6),
  headerBoldOnly(TABS.community, 11), freeze(TABS.community),
  headerBoldOnly(TABS.service, 7), freeze(TABS.service),
];

async function banding(token: string) {
  // subtle alternating rows on the two clean tables (best-effort)
  for (const [id, cols, rows] of [[TABS.yearly, 5, 20], [TABS.funds, 6, 20]] as const) {
    try {
      await api(token, `https://sheets.googleapis.com/v4/spreadsheets/${SHEET}:batchUpdate`, 'POST', {
        requests: [{ addBanding: { bandedRange: { range: rng(id, 1, rows, 0, cols),
          rowProperties: { firstBandColor: white, secondBandColor: { red: 0.984, green: 0.965, blue: 0.933 } } } } }],
      });
      console.log(`  ✅ banding on tab ${id}`);
    } catch (e) { console.log(`  ℹ️ banding skipped on ${id}: ${(e as Error).message.slice(0, 80)}`); }
  }
}

(async () => {
  const t = await getToken();
  await api(t, `https://sheets.googleapis.com/v4/spreadsheets/${SHEET}:batchUpdate`, 'POST', { requests });
  console.log('✅ Core dashboard formatting applied.');
  await banding(t);
  console.log('Done.');
})().catch((e) => { console.error('Fatal:', e.message); process.exit(1); });
