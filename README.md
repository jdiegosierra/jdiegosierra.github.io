# Diego Sierra Portfolio

Source for [jdiegosierra.github.io](https://jdiegosierra.github.io): portfolio, resume (web and PDF), and an engineering manifesto in English and Spanish. It is a static site (plain HTML, CSS, and JavaScript, originally based on LittleLink) deployed to GitHub Pages.

## Structure

| Path | Contents |
| --- | --- |
| `index.html`, `resume.html`, `manifesto.html`, `manifesto.es.html`, `404.html` | Pages |
| `data/profile.json` | Content shared by the home page and the resume |
| `css/`, `fonts/`, `images/`, `js/` | Static assets, published as-is |
| `scripts/` | Build tooling (not published) |

## Editing shared content

The summary, current role, and open source projects live in `data/profile.json`. After changing it, regenerate the pages:

```bash
npm ci
npm run content
```

CI fails if `index.html` or `resume.html` are out of sync with the JSON.

## Local preview

For a quick look at the pages, serve the repository root and open `http://localhost:8000`:

```bash
python3 -m http.server
```

The resume PDFs, Open Graph images, and sitemap are generated at build time, so "Download PDF" only works in the full build:

```bash
npm ci
npx playwright install chromium
npm run build
python3 -m http.server -d dist
```

## Deployment

Every push to `main` runs `.github/workflows/deploy.yml`. It checks the shared content, builds `dist/` in the Playwright container (live GitHub star counts, "last updated" dates from git, sitemap, Open Graph images, resume PDFs), and deploys it to GitHub Pages.

`.github/workflows/links.yml` checks for broken links every week.
