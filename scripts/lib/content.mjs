// Renders the sections shared by the home and resume pages, in English and Spanish, from
// data/profile.json. Each section lives between <!-- content:NAME --> and <!-- /content:NAME --> markers.
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// The home page lists only the first highlights of the current role; the resume has them all.
const HOME_HIGHLIGHTS = 5;
// Tone of each open source card, the same on both pages.
const OSS_TONES = { contributions: 'lilac', projects: 'sage' };

// The pages of each language, and the few interface strings the generated sections use.
const LANGUAGES = {
  en: {
    home: 'index.html',
    resume: 'resume.html',
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    present: 'Present',
    contributions: 'Contributions',
    projects: 'My Projects',
    fullResume: 'See the full resume →',
  },
  es: {
    home: 'index.es.html',
    resume: 'resume.es.html',
    months: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'],
    present: 'Actualidad',
    contributions: 'Contribuciones',
    projects: 'Mis proyectos',
    fullResume: 'Ver el currículum completo →',
  },
};

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

function formatMonth(value, text) {
  const [year, month] = value.split('-');
  return `${text.months[Number(month) - 1]} ${year}`;
}

function roleDates(role, text) {
  return `${formatMonth(role.start, text)} - ${role.end ? formatMonth(role.end, text) : text.present}`;
}

function tagList(items) {
  return ['<ul class="tag-list">', ...items.map((item) => `  <li>${escapeHtml(item)}</li>`), '</ul>'];
}

function renderHomeOpenSource(openSource, stars, lang, text) {
  const card = (title, tone, items) => [
    `<article class="tone-card tone-${tone}">`,
    `  <h3>${title}</h3>`,
    '  <div class="oss-list">',
    ...items.flatMap((item) => indentLines([
      `<a class="oss-item" href="https://github.com/${item.repo}" target="_blank" rel="noopener">`,
      `  <h4>${escapeHtml(item.name)}${starLabel(item, stars, 'star-count')}</h4>`,
      `  <p>${escapeHtml(item.description[lang])}</p>`,
      '</a>',
    ], 2)),
    '  </div>',
    '</article>',
  ];

  return [
    ...card(text.contributions, OSS_TONES.contributions, openSource.contributions),
    ...card(text.projects, OSS_TONES.projects, openSource.projects),
  ];
}

function renderResumeOpenSource(openSource, stars, lang, text) {
  const card = (title, tone, items) => [
    `<div class="resume-card tone-${tone}">`,
    `  <h3>${title}</h3>`,
    '  <div class="resume-oss-grid">',
    ...items.flatMap((item) => indentLines([
      '<div class="resume-oss-item">',
      `  <h4><a href="https://github.com/${item.repo}" target="_blank" rel="noopener">${escapeHtml(item.name)}</a>${starLabel(item, stars, 'resume-star-count')}</h4>`,
      `  <p>${escapeHtml(item.description[lang])}</p>`,
      '</div>',
    ], 2)),
    '  </div>',
    '</div>',
  ];

  return [
    ...card(text.contributions, OSS_TONES.contributions, openSource.contributions),
    ...card(text.projects, OSS_TONES.projects, openSource.projects),
  ];
}

// The current role on the home page: the first role, with only its first highlights.
function renderHomeCurrentRole(role, lang, text) {
  return [
    '<div class="role-header">',
    '  <div>',
    `    <h2 class="role-title" id="current-heading">${role.title}</h2>`,
    `    <p class="role-company">${role.company}</p>`,
    '  </div>',
    `  <p class="role-dates">${roleDates(role, text)}</p>`,
    '</div>',
    ...tagList(role.stack),
    '<ul class="feature-list">',
    ...role.highlights[lang].slice(0, HOME_HIGHLIGHTS).map((item) => `  <li>${item}</li>`),
    '</ul>',
    `<a class="role-more" href="${text.resume}">${text.fullResume}</a>`,
  ];
}

// Every role on the resume, as a timeline. A second role at the same company is "continued".
function renderExperience(roles, lang, text) {
  return roles.flatMap((role, index) => [
    ...(index ? [''] : []),
    `<div class="resume-entry${role.continued ? ' resume-entry--continued' : ''} tone-${role.tone}">`,
    '  <div class="resume-entry__header">',
    '    <div>',
    `      <h3>${role.title}</h3>`,
    `      <p class="resume-entry__company">${role.company}</p>`,
    '    </div>',
    `    <p class="resume-entry__meta">${roleDates(role, text)}</p>`,
    '  </div>',
    ...(role.stack.length ? indentLines(tagList(role.stack), 1) : []),
    '  <ul class="resume-list">',
    ...role.highlights[lang].map((item) => `    <li>${item}</li>`),
    '  </ul>',
    '</div>',
  ]);
}

function renderPersonJsonLd({ person, roles }) {
  const [currentRole] = roles;
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

// Returns { "page.html": { regionName: [lines] } } for every language, with the given live star counts.
export function renderRegions(profile, { stars = {} } = {}) {
  const { person, summary, roles, openSource } = profile;

  return Object.fromEntries(Object.entries(LANGUAGES).flatMap(([lang, text]) => [
    [text.home, {
      'person-jsonld': renderPersonJsonLd(profile),
      summary: summary[lang].map((paragraph) => `<p>${paragraph}</p>`),
      'current-role': renderHomeCurrentRole(roles[0], lang, text),
      'open-source': renderHomeOpenSource(openSource, stars, lang, text),
    }],
    [text.resume, {
      headline: [`<p class="resume-role">${person.headline}</p>`],
      summary: summary[lang].map((paragraph) => `<p>${paragraph}</p>`),
      'open-source': renderResumeOpenSource(openSource, stars, lang, text),
      experience: renderExperience(roles, lang, text),
    }],
  ]));
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
      ...lines.map((line) => (line ? indent + line : '')),
      `${indent}<!-- /content:${name} -->`,
    ].join('\n'));
  }, html);
}
