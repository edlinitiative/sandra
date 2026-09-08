/**
 * One-shot: copy the service account key into .env.local as GOOGLE_SA_JSON.
 *
 * Stored single-quoted, because the JSON itself contains double quotes and
 * dotenv would expand \n inside a double-quoted value (which would corrupt the
 * private key). Idempotent — refuses to add a second copy.
 *
 * Run: node scripts/install-sa-env.mjs [keyPath]
 */

import { readFileSync, appendFileSync, existsSync } from 'node:fs';

const KEY_PATH = process.argv[2] ?? '/Users/tedjacquet/Downloads/sandra-492104-f2d8eb0c821f.json';
const ENV_PATH = new URL('../.env.local', import.meta.url).pathname;

if (!existsSync(KEY_PATH)) {
  console.error('key not found:', KEY_PATH);
  process.exit(1);
}

const sa = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
if (sa.type !== 'service_account' || !sa.private_key || !sa.client_email) {
  console.error('that file does not look like a service account key');
  process.exit(1);
}

const existing = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : '';
if (/^GOOGLE_SA_JSON=/m.test(existing)) {
  console.log('GOOGLE_SA_JSON is already present in .env.local — leaving it alone.');
  process.exit(0);
}

const oneLine = JSON.stringify(sa);
if (oneLine.includes("'")) {
  console.error('key JSON contains a single quote; cannot safely single-quote it');
  process.exit(1);
}

const lines = [
  existing.endsWith('\n') || existing === '' ? '' : '\n',
  '# Google Workspace service account (Drive/Docs/Gmail via domain-wide delegation)\n',
  `GOOGLE_SA_JSON='${oneLine}'\n`,
].join('');

appendFileSync(ENV_PATH, lines);
console.log('added GOOGLE_SA_JSON to .env.local');
console.log('  client_email:', sa.client_email);
console.log('  project_id  :', sa.project_id);

// Verify it round-trips the way loadServiceAccount() will read it.
const check = readFileSync(ENV_PATH, 'utf8').match(/^GOOGLE_SA_JSON='(.*)'$/m);
if (!check) {
  console.error('WROTE, BUT could not re-match the line — inspect .env.local');
  process.exit(1);
}
const parsed = JSON.parse(check[1]);
const keyOk = parsed.private_key.includes('-----BEGIN PRIVATE KEY-----\n');
console.log('  round-trip parse:', parsed.client_email === sa.client_email ? 'OK' : 'MISMATCH');
console.log('  private key newlines intact:', keyOk ? 'OK' : 'NO');
