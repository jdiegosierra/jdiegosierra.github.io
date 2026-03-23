import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const rootDir = process.cwd();
const outputDir = path.join(rootDir, 'dist');
const resumePath = path.join(rootDir, 'resume.html');
const resumeUrl = `${pathToFileURL(resumePath).href}?theme=light`;

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ colorScheme: 'light' });

await page.goto(resumeUrl, { waitUntil: 'load' });
await page.emulateMedia({ media: 'print', colorScheme: 'light' });

await page.pdf({
  path: path.join(outputDir, 'resume.pdf'),
  format: 'A4',
  printBackground: true,
  margin: {
    top: '12mm',
    right: '12mm',
    bottom: '12mm',
    left: '12mm'
  }
});

await browser.close();
