// Renders the sections shared by index.html and resume.html from data/profile.json.
// Each section lives between <!-- content:NAME --> and <!-- /content:NAME --> markers.
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const CARD_TONES = ['peach', 'rose', 'sage', 'lilac'];

export async function loadProfile(rootDir) {
  return JSON.parse(await readFile(path.join(rootDir, 'data', 'profile.json'), 'utf8'));
}

export function allRepos(profile) {
  return [...profile.openSource.contributions, ...profile.openSource.projects].map((item) => item.repo);
}

// Rounds down to a short "+30K" / "+1.3K" / "+500" label; small counts are hidden.
export function formatStars(count) {
  if (!Number.isFinite(count) || count < 10) {
    return null;
  }
  if (count >= 10000) {
    return `+${Math.floor(count / 1000)}K`;
  }
  if (count >= 1000) {
    return `+${Math.floor(count / 100) / 10}K`;
  }
  const step = count >= 100 ? 100 : 10;
  return `+${Math.floor(count / step) * step}`;
}

// Returns { "owner/repo": stars } for every repo the GitHub API answered; failures are skipped.
export async function fetchStars(repos, token) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'jdiegosierra.github.io-build' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const entries = await Promise.all(repos.map(async (repo) => {
    try {
      const response = await fetch(`https://api.github.com/repos/${repo}`, { headers, signal: AbortSignal.timeout(10000) });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const { stargazers_count: stars } = await response.json();
      return [repo, stars];
    } catch (error) {
      console.warn(`Could not fetch stars for ${repo} (${error.message}); using the value from profile.json.`);
      return null;
    }
  }));

  return Object.fromEntries(entries.filter(Boolean));
}

export function escapeHtml(text) {
  return text.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);
}

function starLabel(item, stars, className) {
  const label = formatStars(stars[item.repo] ?? item.stars);
  return label ? ` <span class="${className}">${label} ★</span>` : '';
}

function indentLines(lines, depth) {
  return lines.map((line) => '  '.repeat(depth) + line);
}

function renderHomeOpenSource(openSource, stars) {
  const card = (title, items) => [
    '<article class="oss-split__card">',
    `  <h3>${title}</h3>`,
    '  <div class="oss-grid">',
    ...items.flatMap((item, index) => indentLines([
      `<a class="oss-grid__card oss-grid__card--${CARD_TONES[index % CARD_TONES.length]}" href="https://github.com/${item.repo}" target="_blank" rel="noopener">`,
      `  <h4>${escapeHtml(item.name)}${starLabel(item, stars, 'star-count')}</h4>`,
      `  <p>${escapeHtml(item.description)}</p>`,
      '</a>',
    ], 2)),
    '  </div>',
    '</article>',
  ];

  return [...card('Contributions', openSource.contributions), ...card('My Projects', openSource.projects)];
}

function renderResumeOpenSource(openSource, stars) {
  const card = (title, items) => [
    '<div class="resume-oss-card">',
    `  <h3>${title}</h3>`,
    '  <div class="resume-oss-grid">',
    ...items.flatMap((item) => indentLines([
      '<div class="resume-oss-item">',
      `  <h4><a href="https://github.com/${item.repo}" target="_blank" rel="noopener">${escapeHtml(item.name)}</a>${starLabel(item, stars, 'resume-star-count')}</h4>`,
      `  <p>${escapeHtml(item.description)}</p>`,
      '</div>',
    ], 2)),
    '  </div>',
    '</div>',
  ];

  return [...card('Contributions', openSource.contributions), ...card('My Projects', openSource.projects)];
}

function renderPersonJsonLd({ person, currentRole }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: person.name,
    alternateName: person.alternateName,
    url: person.url,
    image: person.image,
    jobTitle: currentRole.title,
    worksFor: { '@type': 'Organization', name: currentRole.company },
    address: { '@type': 'PostalAddress', addressLocality: person.locality, addressCountry: person.country },
    sameAs: person.sameAs,
    knowsAbout: person.knowsAbout,
  };
  // Escaping "<" keeps a stray "</script>" in the data from closing the tag.
  const json = JSON.stringify(data, null, 2).replace(/</g, '\\u003c');
  return ['<script type="application/ld+json">', ...json.split('\n'), '</script>'];
}

// Returns { "page.html": { regionName: [lines] } } with the given live star counts.
export function renderRegions(profile, { stars = {} } = {}) {
  const { summary, currentRole, openSource } = profile;
  const highlights = currentRole.highlights.map((item) => `  <li>${item}</li>`);

  return {
    'index.html': {
      'person-jsonld': renderPersonJsonLd(profile),
      summary: summary.map((paragraph) => `<p>${paragraph}</p>`),
      'current-role': [
        `<h2 id="current-heading">${currentRole.title} at ${currentRole.company}</h2>`,
        '<ul class="feature-list">',
        ...highlights,
        '</ul>',
      ],
      'open-source': renderHomeOpenSource(openSource, stars),
    },
    'resume.html': {
      headline: [`<p class="resume-role">${[currentRole.title, ...currentRole.headlineTags].join(' | ')}</p>`],
      summary: summary.map((paragraph) => `<p>${paragraph}</p>`),
      'open-source': renderResumeOpenSource(openSource, stars),
      'current-role': [
        '<div class="resume-entry">',
        '  <div class="resume-entry__header">',
        '    <div>',
        `      <h3>${currentRole.title}</h3>`,
        `      <p class="resume-entry__company">${currentRole.company}</p>`,
        '    </div>',
        `    <p class="resume-entry__meta">${currentRole.since} - Present</p>`,
        '  </div>',
        '  <ul class="resume-list">',
        ...indentLines(highlights, 1),
        '  </ul>',
        '</div>',
      ],
    },
  };
}

// Replaces every marked region in html, keeping the indentation of its start marker.
export function applyRegions(html, regions, fileName) {
  return Object.entries(regions).reduce((result, [name, lines]) => {
    const pattern = new RegExp(`^([ \\t]*)<!-- content:${name} -->\\n[\\s\\S]*?^[ \\t]*<!-- /content:${name} -->$`, 'm');
    if (!pattern.test(result)) {
      throw new Error(`${fileName}: missing <!-- content:${name} --> ... <!-- /content:${name} --> markers`);
    }
    return result.replace(pattern, (match, indent) => [
      `${indent}<!-- content:${name} -->`,
      ...lines.map((line) => indent + line),
      `${indent}<!-- /content:${name} -->`,
    ].join('\n'));
  }, html);
}
