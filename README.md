# ParsRAG landing page

The bilingual (English / Persian) landing page for [ParsRAG](https://github.com/Pooria82/ParsRAG),
published at <https://pooria82.github.io/ParsRAG/> from the repository's `docs/` folder.

The design concept, tokens and principles are in [DESIGN.md](DESIGN.md).

## Structure

```
src/
  page.html          one template for both languages ({{key}} and {{@partial}} placeholders)
  i18n/en.json       English copy, metadata and direction
  i18n/fa.json       Persian copy (RTL, Persian numerals)
  partials/          inline SVGs (mark, icons)
  static/            copied as-is: CSS, JS modules, fonts, vendor libraries, images
  og/                source for assets/img/og-card.png (the share image)
scripts/
  build.mjs          renders dist/index.html and dist/fa/index.html, sitemap, .nojekyll
  deploy.mjs         replaces the landing files in ParsRAG/docs with dist/
```

Each section has its own module in `src/static/assets/js/`: `hero.js` (glyph field that gathers
into the mark), `marginalia.js` (pinned cited answer with gold threads), `journey.js` (ingestion
sequence), `modes.js`, `boundary.js` (privacy frame), `shelf.js`, `compare.js`, `terminal.js`, `coda.js`.

## Build and preview

No dependencies beyond Node.js 18+.

```bash
node scripts/build.mjs
```

```bash
python -m http.server 8765 --directory dist
```

## Publish

Build, then copy into the ParsRAG repository and open a pull request there:

```bash
node scripts/deploy.mjs ../ParsRAG/docs
```

`deploy.mjs` only replaces the landing files (`index.html`, `fa/`, `assets/`, `sitemap.xml`,
`.nojekyll`); `docs/architecture/`, `docs/screenshots/`, `social-preview.png` and the Markdown
docs are left alone.

## Third-party code and fonts

- [GSAP 3.15](https://gsap.com) with ScrollTrigger (standard "no charge" GSAP license), vendored in `assets/vendor/`.
- [Lenis 1.3](https://github.com/darkroomengineering/lenis) (MIT) for smooth scrolling; disabled when reduced motion is requested.
- [Vazirmatn](https://github.com/rastikerdar/vazirmatn) and [Markazi Text](https://fonts.google.com/specimen/Markazi+Text), both under the SIL Open Font License (`assets/fonts/OFL.md`).
