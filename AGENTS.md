# Project rules

## Structure

- Static site on GitHub Pages. Pages: `index.html`, `resume.html`, and `manifesto.html`, each with a Spanish `.es.html` twin, plus `404.html` (English only).
- `css/`, `fonts/`, `images/`, and `js/` are published as-is. `scripts/` is build tooling and is never published.
- `npm run build` writes the deployable site to `dist/`. The resume PDFs, Open Graph images, and `sitemap.xml` only exist there.
- `npm run resume` renders only the resume PDFs (`resume.pdf`, `resume-dark.pdf`, `resume-es.pdf`, `resume-es-dark.pdf`) into `dist/`, inside the same Playwright container CI uses (needs Docker), so they match the deployed PDFs.

## Shared content

The summary, current role, experience, and open source sections (plus the JSON-LD in the home page head) are generated from `data/profile.json` into the home and resume pages of both languages, between `<!-- content:NAME -->` and `<!-- /content:NAME -->` markers.

- Change `data/profile.json` and run `npm run content`. Never edit inside the markers by hand: CI runs `npm run content:check` and fails when a page drifts.
- `stars` in the JSON are fallbacks. The build fetches live counts from the GitHub API.
- `roles` lists every job, newest first; the first one is the current role on the home page. Dates are `YYYY-MM` (`end: null` while current) and are formatted per language.
- Texts that change with the language are `{ "en": …, "es": … }` objects. Job titles, company names, the headline, and technology chips stay in English on both.
- The home page shows only the first 5 highlights of the current role and links to the resume for the rest, so keep the most important ones first.
- `<time data-last-updated>` dates and the sitemap `lastmod` are stamped by the build from git history, so don't bump them by hand.

## Colors

- Sections, cards, and items take one of the site's tones with a `tone-*` class (`rose`, `peach`, `sage`, `lilac`, `butter`, defined in `css/style.css`). `--tone-rgb` tints backgrounds and borders; `--tone-ink` colors dots, headings, and links. Rose is the default.
- Give neighbouring blocks different tones. On the resume, a second role at the same company keeps the tone and adds `resume-entry--continued`.
- Section headings use `.section-title` and technology chips use `.tag-list`, on every page.
- On the manifesto, "Mistakes I have seen" is `tone-peach` and "How I think it should work" is `tone-sage`, in both languages.

## Languages

- Every page except the 404 exists in English (`NAME.html`) and Spanish (`NAME.es.html`). Keep each pair's hand-written parts in sync (sections, heading ids, order, links), and point Spanish pages at Spanish pages.
- Both pages of a pair carry the `hreflang` alternates and the EN | ES `.language-switcher` as the first item of their toolbar, so it sits in the same place on every page. Its links use `language-switcher__link`, not the toolbar link classes, so page-specific toolbar styles never change it. The page wrappers (`.container`, `.container-left`, `.resume-page`) share the same box for the same reason. The build lists the alternates in `sitemap.xml` (`PAGES` in `scripts/build.mjs`).
- Scripts read `document.documentElement.lang` for their visible text (`js/site-shell.js`, `js/home.js`). The link-playground states keep Argo CD's English names in both languages.
- The site never picks a language for the visitor: the URL decides, and the switcher changes it.

## Resume

- The PDFs are the resume pages with `html.export-pdf` (rules at the end of `css/resume.css`), one per language and theme; the download button's `data-pdf` names the language's file. After changing the resume, run `npm run resume` and check that all four PDFs still report 2 pages. Spanish runs longer, so check it first.

## Links playground

The home page links are plain `<a class="link-pill">` elements that `js/home.js` turns into a physics toy with Matter.js (vendored unmodified in `js/vendor/`, don't edit it). The script measures the pills, stacks them in a pile, and owns their `transform`. Without JavaScript, or with reduced motion, they stay a wrapped list, so each one must still work as a plain link. The first links in the HTML end up on top of the pile.

## Landscape scene

The animated landscape scene and the theme toggle (sun/moon) are injected on every page by `js/site-shell.js`. Night (the dark theme) is the default, set in `js/theme-boot.js`; the toggle remembers the visitor's choice. Change them there, not in the HTML. The scene is sky-only — no ground elements (hills, trees, grass, flowers, etc.).

- Sky and cloud colors live in the `--sky-*` and `--cloud-*` palette at the top of `css/style.css`. A theme switch animates through dusk or dawn (`sky-dusk`, `sky-dawn`); a page load does not.
- The moon shows the real phase of the day, computed in `moonSvg`.
- The night-sky constellations react to hover through the empty sides of the page wrappers (`.container`, `.container-left`, `.resume-page` set `pointer-events:none` and give it back to their children). Do the same for any new full-width wrapper.

## Manifesto

`manifesto.html` and `manifesto.es.html` are translations of each other (see Languages).

## 404 page

GitHub Pages serves `404.html` for missing paths at any depth, so its asset and link URLs must be root-relative (`/css/style.css`, not `css/style.css`).
