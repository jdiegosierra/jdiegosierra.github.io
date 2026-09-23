// Renders dist/resume.pdf and dist/resume-dark.pdf inside the Playwright image CI uses, so the
// local PDFs match the deployed ones (same Chromium, same fonts) and no browser is installed on
// the host. The container runs without network access and as the image's unprivileged user.
// Usage: npm run resume  (needs Docker)
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const rootDir = path.resolve(import.meta.dirname, '..');
const { devDependencies } = JSON.parse(await readFile(path.join(rootDir, 'package.json'), 'utf8'));
const image = `mcr.microsoft.com/playwright:v${devDependencies.playwright}-noble`;

const { status, error } = spawnSync('docker', [
  'run', '--rm', '--init',
  '--network', 'none',
  '--user', 'pwuser',
  '--volume', `${rootDir}:/work`,
  '--workdir', '/work',
  image,
  'node', 'scripts/build.mjs', '--resume',
], { stdio: 'inherit' });

if (error) {
  console.error(`Could not run docker (${error.message}). Without Docker, run: node scripts/build.mjs --resume`);
  process.exit(1);
}
process.exit(status ?? 1);
