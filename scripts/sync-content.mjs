// Regenerates the shared sections of index.html and resume.html from data/profile.json.
// Usage: node scripts/sync-content.mjs [--check]
//   --check  exit with an error instead of writing when a page is out of sync (used in CI).
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { applyRegions, loadProfile, renderRegions } from './lib/content.mjs';

const rootDir = path.resolve(import.meta.dirname, '..');
const check = process.argv.includes('--check');

const profile = await loadProfile(rootDir);
const stale = [];

for (const [fileName, regions] of Object.entries(renderRegions(profile))) {
  const filePath = path.join(rootDir, fileName);
  const current = await readFile(filePath, 'utf8');
  const next = applyRegions(current, regions, fileName);

  if (current === next) {
    continue;
  }
  stale.push(fileName);
  if (!check) {
    await writeFile(filePath, next);
    console.log(`Updated ${fileName}`);
  }
}

if (check && stale.length) {
  console.error(`Out of sync with data/profile.json: ${stale.join(', ')}`);
  console.error('Edit data/profile.json (not the marked regions) and run "npm run content".');
  process.exit(1);
}
