// Copies the generated mission data (../data) into public/data so the app bundles it
// and works offline. Runs automatically before `npm run dev` and `npm run build`.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
const cpSync = (a, b) => writeFileSync(b, readFileSync(a)); // overwrite in place
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', '..', 'data');
const dest = join(here, '..', 'public', 'data');
if (!existsSync(join(src, 'daily.json'))) {
  console.warn('[sync-data] ../data/daily.json not found. Run the Python scripts in /scripts first. Using existing public/data.');
  process.exit(0);
}
mkdirSync(join(dest, 'nasa'), { recursive: true });
for (const f of readdirSync(src)) if (f.endsWith('.json')) cpSync(join(src, f), join(dest, f));
for (const f of readdirSync(join(src, 'nasa'))) if (f.endsWith('.json')) cpSync(join(src, 'nasa', f), join(dest, 'nasa', f));
console.log('[sync-data] copied mission data into public/data');
