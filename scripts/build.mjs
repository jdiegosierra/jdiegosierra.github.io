// Builds the deployable site into dist/:
//   1. copies the static files,
//   2. renders the shared sections with live GitHub star counts,
//   3. stamps "last updated" dates and sitemap.xml from git history,
//   4. renders the Open Graph images and resume PDFs with Playwright.
// Usage: node scripts/build.mjs [--resume]  (set GITHUB_TOKEN to avoid GitHub API rate limits)
//   --resume  only build the resume pages (English and Spanish) and their PDFs, offline, with the
//             star counts from profile.json (npm run resume runs this inside the Playwright container CI uses).
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { allRepos, applyRegions, escapeHtml, fetchStars, loadProfile, renderRegions } from './lib/content.mjs';

const SITE_URL = 'https://jdiegosierra.github.io/';
const rootDir = path.resolve(import.meta.dirname, '..');
const distDir = path.join(rootDir, 'dist');
const resumeOnly = process.argv.includes('--resume');

const STATIC_ENTRIES = ['css', 'fonts', 'images', 'js', '404.html', 'robots.txt'];

// A page's "last updated" date is the latest commit touching any of its sources.
// alternates lists the page in each language, for the sitemap.
const HOME_ALTERNATES = { en: '', es: 'index.es.html' };
const RESUME_ALTERNATES = { en: 'resume.html', es: 'resume.es.html' };
const MANIFESTO_ALTERNATES = { en: 'manifesto.html', es: 'manifesto.es.html' };
const PAGES = [
  { file: 'index.html', url: SITE_URL, sources: ['index.html', 'data/profile.json'], alternates: HOME_ALTERNATES },
  { file: 'index.es.html', url: `${SITE_URL}index.es.html`, sources: ['index.es.html', 'data/profile.json'], alternates: HOME_ALTERNATES },
  { file: 'resume.html', url: `${SITE_URL}resume.html`, sources: ['resume.html', 'data/profile.json'], alternates: RESUME_ALTERNATES },
  { file: 'resume.es.html', url: `${SITE_URL}resume.es.html`, sources: ['resume.es.html', 'data/profile.json'], alternates: RESUME_ALTERNATES },
  { file: 'manifesto.html', url: `${SITE_URL}manifesto.html`, sources: ['manifesto.html'], alternates: MANIFESTO_ALTERNATES },
  { file: 'manifesto.es.html', url: `${SITE_URL}manifesto.es.html`, sources: ['manifesto.es.html'], alternates: MANIFESTO_ALTERNATES },
];
const RESUME_PAGES = Object.values(RESUME_ALTERNATES);

// Each resume page in both themes; site-shell.js builds the same names from the link's data-pdf.
const RESUME_PDFS = [
  { page: 'resume.html', theme: 'light', file: 'resume.pdf' },
  { page: 'resume.html', theme: 'dark', file: 'resume-dark.pdf' },
  { page: 'resume.es.html', theme: 'light', file: 'resume-es.pdf' },
  { page: 'resume.es.html', theme: 'dark', file: 'resume-es-dark.pdf' },
];

const OG_IMAGES = [
  { file: 'home.jpg', kicker: 'jdiegosierra.github.io', title: 'Diego Sierra', subtitle: 'Platform, SRE & AI Engineering' },
  { file: 'manifesto.jpg', kicker: 'Diego Sierra', title: "Diego's Manifesto", subtitle: 'My view of how engineering teams should work if they want to stay healthy over time.' },
  { file: 'manifesto-es.jpg', kicker: 'Diego Sierra', title: 'El manifiesto de Diego', subtitle: 'Mi visión de cómo deberían funcionar los equipos de ingeniería si quieren mantenerse sanos en el tiempo.' },
];

function lastCommitDate(files) {
  try {
    // safe.directory: in CI, git runs as root inside a container over a checkout owned by another user.
    const output = execFileSync('git', ['-c', 'safe.directory=*', 'log', '-1', '--format=%cI', '--', ...files], {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return output ? new Date(output) : null;
  } catch {
    return null;
  }
}

// Without git history the page keeps the date committed in its HTML.
function stampLastUpdated(html, date) {
  if (!date) {
    return html;
  }
  const lang = html.match(/<html[^>]*\blang="([^"]+)"/)?.[1] ?? 'en';
  const label = new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
  return html.replace(
    /<time data-last-updated datetime="[^"]*">[^<]*<\/time>/g,
    `<time data-last-updated datetime="${date.toISOString().slice(0, 7)}">${label}</time>`,
  );
}

function renderSitemap(pages) {
  const urls = pages.map(({ url, lastmod, alternates = {} }) => [
    '  <url>',
    `    <loc>${url}</loc>`,
    ...(lastmod ? [`    <lastmod>${lastmod}</lastmod>`] : []),
    ...Object.entries(alternates).map(([lang, file]) => `    <xhtml:link rel="alternate" hreflang="${lang}" href="${SITE_URL}${file}"/>`),
    '  </url>',
  ].join('\n'));

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

function ogImageHtml({ kicker, title, subtitle, avatar, fontFaces }) {
  return `<!doctype html>
<meta charset="utf-8">
<style>
  ${fontFaces}
  * { box-sizing: border-box; margin: 0; }
  body {
    width: 1200px;
    height: 630px;
    padding: 48px;
    font-family: 'Open Sans', sans-serif;
    background: linear-gradient(180deg, #b9e6ff 0%, #f6efbe 48%, #e8d5a3 100%);
  }
  .card {
    display: flex;
    align-items: center;
    gap: 64px;
    height: 100%;
    padding: 56px 72px;
    border: 2px solid rgba(196, 122, 149, 0.28);
    border-radius: 40px;
    background: linear-gradient(180deg, rgb(255, 251, 248), rgb(255, 255, 255));
    box-shadow: 0 22px 60px rgba(171, 128, 140, 0.18);
  }
  img {
    flex: none;
    width: 300px;
    height: 300px;
    object-fit: cover;
    border: 8px solid #fff;
    border-radius: 50%;
    box-shadow: 0 0 0 3px rgba(196, 122, 149, 0.5);
  }
  .kicker { color: #c47a95; font-size: 26px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
  h1 { margin: 12px 0 20px; color: #46384c; font-size: 76px; font-weight: 800; line-height: 1.05; letter-spacing: -0.03em; }
  p { color: #5e4f59; font-size: 34px; line-height: 1.35; }
</style>
<div class="card">
  <img src="${avatar}" alt="">
  <div>
    <div class="kicker">${escapeHtml(kicker)}</div>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(subtitle)}</p>
  </div>
</div>`;
}

async function renderOgImages(browser) {
  const dataUri = async (file, type) => `data:${type};base64,${(await readFile(path.join(rootDir, file))).toString('base64')}`;
  const avatar = await dataUri('images/avatar.jpeg', 'image/jpeg');
  const fontFaces = (await Promise.all([400, 700, 800].map(async (weight) => (
    `@font-face { font-family: 'Open Sans'; font-weight: ${weight}; src: url(${await dataUri(`fonts/open-sans-${weight}.woff2`, 'font/woff2')}) format('woff2'); }`
  )))).join('\n');

  await mkdir(path.join(distDir, 'images', 'og'), { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  for (const image of OG_IMAGES) {
    await page.setContent(ogImageHtml({ ...image, avatar, fontFaces }), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(distDir, 'images', 'og', image.file), type: 'jpeg', quality: 90 });
  }
  await page.close();
}

async function renderResumePdf(browser, { page: pageFile, theme, file: fileName }) {
  const page = await browser.newPage({ colorScheme: theme });
  await page.goto(`${pathToFileURL(path.join(distDir, pageFile)).href}?theme=${theme}&pdf=1`, { waitUntil: 'load' });
  await page.emulateMedia({ media: 'screen', colorScheme: theme });
  await page.evaluate(() => document.fonts.ready);

  // Relative links would otherwise point at the build machine's file system.
  await page.$$eval('a[href]', (links, siteUrl) => {
    links.forEach((link) => {
      const href = link.getAttribute('href');
      if (href && !/^(https?:|mailto:|#)/.test(href)) {
        link.setAttribute('href', siteUrl + href);
      }
    });
  }, SITE_URL);

  const pdf = await page.pdf({
    path: path.join(distDir, fileName),
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  });
  await page.close();

  const pageCount = pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)?.length ?? 0;
  console.log(`Rendered ${path.relative(process.cwd(), path.join(distDir, fileName))} (${pageCount} pages).`);
}

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });
for (const entry of STATIC_ENTRIES) {
  await cp(path.join(rootDir, entry), path.join(distDir, entry), { recursive: true });
}

const profile = await loadProfile(rootDir);
const repos = allRepos(profile);
let stars = {};
if (resumeOnly) {
  console.log('Resume only: using the star counts from profile.json.');
} else {
  stars = await fetchStars(repos, process.env.GITHUB_TOKEN);
  console.log(`Live star counts for ${Object.keys(stars).length}/${repos.length} repositories.`);
}
const regions = renderRegions(profile, { stars });

const sitemapPages = [];
for (const page of PAGES.filter(({ file }) => !resumeOnly || RESUME_PAGES.includes(file))) {
  let html = await readFile(path.join(rootDir, page.file), 'utf8');
  if (regions[page.file]) {
    html = applyRegions(html, regions[page.file], page.file);
  }
  const updated = lastCommitDate(page.sources);
  await writeFile(path.join(distDir, page.file), stampLastUpdated(html, updated));
  sitemapPages.push({ ...page, lastmod: updated?.toISOString().slice(0, 10) });
}
if (!resumeOnly) {
  await writeFile(path.join(distDir, 'sitemap.xml'), renderSitemap(sitemapPages));
}

const browser = await chromium.launch();
try {
  if (!resumeOnly) {
    await renderOgImages(browser);
  }
  for (const pdf of RESUME_PDFS) {
    await renderResumePdf(browser, pdf);
  }
} finally {
  await browser.close();
}
console.log(`Built ${path.relative(process.cwd(), distDir) || distDir}/`);
