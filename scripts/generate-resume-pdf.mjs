import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const rootDir = process.cwd();
const outputDir = path.join(rootDir, 'dist');
const resumePath = path.join(rootDir, 'resume.html');
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });

async function buildPdf(theme, fileName) {
  const page = await browser.newPage({ colorScheme: theme });
  const resumeUrl = `${pathToFileURL(resumePath).href}?theme=${theme}`;

  await page.goto(resumeUrl, { waitUntil: 'load' });
  await page.emulateMedia({ media: 'screen', colorScheme: theme });

  await page.pdf({
    path: path.join(outputDir, fileName),
    format: 'A4',
    printBackground: true,
    margin: {
      top: '12mm',
      right: '12mm',
      bottom: '12mm',
      left: '12mm'
    }
  });

  await page.close();
}

await buildPdf('light', 'resume.pdf');
await buildPdf('dark', 'resume-dark.pdf');

await browser.close();
