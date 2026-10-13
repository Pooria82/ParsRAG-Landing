# ParsRAG website

The bilingual (English and Persian) website for [ParsRAG](https://github.com/Pooria82/ParsRAG),
published at <https://pooria82.github.io/ParsRAG-Landing/>. It has two pages in each language:

- **Landing page:** a live demo that searches sample documents in the browser and opens every
  citation, the evidence contract, how a page is processed, privacy, measured results, formats,
  languages and installation.
- **Product tour** (`/tour/`): every feature of the current release in 14 chapters, which can also
  be presented full screen as slides.

The design concept and principles are in [DESIGN.md](DESIGN.md).

## The site follows the ParsRAG release

`scripts/sync-content.mjs` downloads the latest ParsRAG release and the files the site quotes
(README, CHANGELOG, LICENSE, CITATION.cff and others) into `src/content/upstream/`. The build uses
that snapshot for:

- the version and release date shown on every page (the page also checks GitHub at runtime, so a
  newer release appears before the next build);
- the release notes, license, citation formats, security policy and other documents, which open
  in dialogs with a link to the source on GitHub;
- **self-citations:** each claim on the site carries a numbered marker that shows the exact quote
  from the repository. Claims are listed in `src/content/claims.json`, and the build **fails** if a
  quoted sentence is no longer in the release. When that happens after a new release, update the
  quote (and the page copy, if the fact changed).

Persian summaries of the English-only documents are in `src/content/docs-fa/`. Release notes are
summarized per version (`changelog-<version>.md`); a newer release shows a short notice until its
summary is added.

## Structure

```
src/
  pages/              home.html and tour.html templates
  partials/           head, header, footer and inline SVG icons
  i18n/en, i18n/fa    copy for common chrome, the landing page and the tour (tour chapters are
                      structured blocks rendered by the build)
  content/upstream/   snapshot of the ParsRAG release
  content/claims.json quotes behind the self-citations
  content/demo/       sample documents and questions for the in-browser demo
  content/docs-fa/    Persian summaries of repository documents
  styles/             CSS, concatenated and minified into assets/css/site.css
  static/             fonts, images, vendor libraries and JS modules (bundled into one file)
  og/card.html        source of the share cards
scripts/
  sync-content.mjs    pull the latest release
  build.mjs           render pages, documents and sitemap into dist/
  og.py               render assets/img/og-card-en.png and og-card-fa.png
.github/workflows/
  pages.yml           sync, build and deploy on push, daily, on demand, or on a
                      "parsrag-release" repository dispatch from ParsRAG
```

Templates use `{{key}}` for dictionary strings, `{{@partial}}` for partials, `{{ref:id}}` for a
verified citation and `{{json:path}}` to hand strings to scripts.

## Build and preview

Node.js 20 or later.

```bash
npm ci
```

```bash
npm run sync
```

```bash
npm run build
```

```bash
npm run serve
```

`npm run sync` needs network access; set `GITHUB_TOKEN` to avoid API rate limits. The share cards
are rendered with Playwright for Python while the site is being served (`npm run og`).

## Publish

Push to `main`. The **Deploy site** workflow syncs, builds and publishes `dist/` to GitHub Pages
(Settings → Pages → Source: GitHub Actions). It also runs daily, so a new ParsRAG release reaches
the site within a day; for an immediate update, send a `parsrag-release` repository dispatch or
run the workflow by hand.

## Third-party code and fonts

- [GSAP 3.15](https://gsap.com) with ScrollTrigger (standard "no charge" GSAP license), vendored in `assets/vendor/`.
- [Lenis 1.3](https://github.com/darkroomengineering/lenis) (MIT) for smooth wheel scrolling on desktop pointers; off for touch and reduced motion.
- [Vazirmatn](https://github.com/rastikerdar/vazirmatn) and [Markazi Text](https://fonts.google.com/specimen/Markazi+Text), both under the SIL Open Font License (`assets/fonts/OFL.md`).
- Build tools: [marked](https://marked.js.org), [yaml](https://eemeli.org/yaml/) and [esbuild](https://esbuild.github.io).
