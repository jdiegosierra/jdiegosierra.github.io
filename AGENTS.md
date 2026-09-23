# Project rules

## Structure

- Static site on GitHub Pages. Pages: `index.html`, `resume.html`, `manifesto.html`, `manifesto.es.html`, `404.html`.
- `css/`, `fonts/`, `images/`, and `js/` are published as-is. `scripts/` is build tooling and is never published.
- `npm run build` writes the deployable site to `dist/`. The resume PDFs, Open Graph images, and `sitemap.xml` only exist there.
- `npm run resume` renders only `dist/resume.pdf` and `dist/resume-dark.pdf`, inside the same Playwright container CI uses (needs Docker), so they match the deployed PDFs.

## Shared content

The summary, current role, and open source sections appear on both `index.html` and `resume.html` (plus the JSON-LD in the home page head). They are generated from `data/profile.json` between `<!-- content:NAME -->` and `<!-- /content:NAME -->` markers.

- Change `data/profile.json` and run `npm run content`. Never edit inside the markers by hand: CI runs `npm run content:check` and fails when a page drifts.
- `stars` in the JSON are fallbacks. The build fetches live counts from the GitHub API.
- The home page shows only the first 5 `currentRole.highlights` and links to the resume for the rest, so keep the most important ones first.
- `<time data-last-updated>` dates and the sitemap `lastmod` are stamped by the build from git history, so don't bump them by hand.

## Colors

- Sections, cards, and items take one of the site's tones with a `tone-*` class (`rose`, `peach`, `sage`, `lilac`, `butter`, defined in `css/style.css`). `--tone-rgb` tints backgrounds and borders; `--tone-ink` colors dots, headings, and links. Rose is the default.
- Give neighbouring blocks different tones. On the resume, a second role at the same company keeps the tone and adds `resume-entry--continued`.
- Section headings use `.section-title` and technology chips use `.tag-list`, on every page.
- On the manifesto, "Mistakes I have seen" is `tone-peach` and "How I think it should work" is `tone-sage`, in both languages.

## Resume

- The PDFs are the same page with `html.export-pdf` (rules at the end of `css/resume.css`). After changing the resume, run `npm run resume` and check it still reports 2 pages.

## Links playground

The home page links are plain `<a class="link-pill">` elements that `js/home.js` turns into a physics toy with Matter.js (vendored unmodified in `js/vendor/`, don't edit it). The script measures the pills, stacks them in a pile, and owns their `transform`. Without JavaScript, or with reduced motion, they stay a wrapped list, so each one must still work as a plain link. The first links in the HTML end up on top of the pile.

## Landscape scene

The animated landscape scene and the theme toggle (sun/moon) are injected on every page by `js/site-shell.js`. Change them there, not in the HTML. The scene is sky-only — no ground elements (hills, trees, grass, flowers, etc.).

## Manifesto

`manifesto.html` and `manifesto.es.html` are translations of each other: keep their sections, heading ids, and order in sync.

## 404 page

GitHub Pages serves `404.html` for missing paths at any depth, so its asset and link URLs must be root-relative (`/css/style.css`, not `css/style.css`).
