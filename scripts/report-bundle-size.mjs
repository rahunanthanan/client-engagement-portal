// Prints raw and gzip sizes of the built assets, largest first. Run after `vite build`.
// "Measure before optimising": compare this table before and after a change.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const dir = join(process.cwd(), 'dist', 'assets');
let files;
try {
  files = readdirSync(dir).filter((f) => /\.(js|css)$/.test(f));
} catch {
  console.error('dist/assets not found. Run `pnpm build` first.');
  process.exit(1);
}

const kb = (n) => `${(n / 1024).toFixed(1)} kB`;
const rows = files
  .map((file) => {
    const buf = readFileSync(join(dir, file));
    return { file, raw: statSync(join(dir, file)).size, gzip: gzipSync(buf).length };
  })
  .sort((a, b) => b.gzip - a.gzip);

const width = Math.max(...rows.map((r) => r.file.length), 4);
console.log(`${'file'.padEnd(width)}  ${'raw'.padStart(10)}  ${'gzip'.padStart(10)}`);
for (const r of rows) console.log(`${r.file.padEnd(width)}  ${kb(r.raw).padStart(10)}  ${kb(r.gzip).padStart(10)}`);
const total = rows.reduce((acc, r) => ({ raw: acc.raw + r.raw, gzip: acc.gzip + r.gzip }), { raw: 0, gzip: 0 });
console.log(`${'TOTAL'.padEnd(width)}  ${kb(total.raw).padStart(10)}  ${kb(total.gzip).padStart(10)}`);
