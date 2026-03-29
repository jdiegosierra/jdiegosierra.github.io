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
  const resumeUrl = `${pathToFileURL(resumePath).href}?theme=${theme}&pdf=1`;

  await page.goto(resumeUrl, { waitUntil: 'load' });
  await page.emulateMedia({ media: 'screen', colorScheme: theme });

  await page.$$eval('a[href]', (links) => {
    const base = 'https://jdiegosierra.github.io/';
    links.forEach((a) => {
      const href = a.getAttribute('href');
      if (href && !href.startsWith('http') && !href.startsWith('mailto:') && !href.startsWith('#')) {
        a.setAttribute('href', base + href);
      }
    });
  });

  await page.pdf({
    path: path.join(outputDir, fileName),
    format: 'A4',
    printBackground: true,
    margin: {
      top: '0',
      right: '0',
      bottom: '0',
      left: '0'
    }
  });

  await page.close();
}

await buildPdf('light', 'resume.pdf');
await buildPdf('dark', 'resume-dark.pdf');

await browser.close();
