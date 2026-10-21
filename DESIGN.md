# ParsRAG website — design

## Brief

- **Subject:** ParsRAG, an offline-first workspace that answers questions about Persian and English documents and cites the exact page every claim came from.
- **Audience:** Persian-speaking developers, researchers, students, and organizations who cannot send documents to a cloud chatbot.
- **Primary job:** within seconds, a visitor should *see* it work: a question, an answer with numbered citations, and the cited passage lit on its page, all on their own machine. Then: try the live demo, run it locally, or read the full product tour.

## Concept: Firouzeh (turquoise)

Two Persian colours light a night-lapis ground. **Turquoise** (firouzeh, the colour of Persian tilework) marks what stays on your machine: the local model, the reading rail, focus and progress. **Saffron** marks evidence: citation numbers, highlighted passages, and the line of light that joins a citation to its page. Documents appear as cool paper pages inside a dark glass interface, the way a real PDF sits inside the app.

The one memorable element is that line of light. It appears in the hero (citation → passage), the demo, the evidence card, and the presentation progress bar. Everything else stays quiet.

**The site cites itself:** every product claim carries a numbered marker that quotes the ParsRAG repository, verified at build time. The site behaves the way the product does.

## How the references shaped it

The redesign reviewed 30 AI product sites and galleries, among them Runway, ElevenLabs, Perplexity, Claude, OpenAI, Cursor, Linear-style app sites, Raycast, Granola, Spline, Mistral, Cohere, Replicate and v0. What they share, and what this site takes from it:

- **The product is the hero** (v0, Spline, Raycast, Granola): the hero is a working ParsRAG window, not an illustration.
- **Fast UI, slow reveals:** 160–320 ms for controls, 600–1000 ms for reveals, expo-out easing.
- **A header that changes on scroll** (Granola, Krea): transparent over the hero, then a floating glass pill with a hairline.
- **Sheets and menus that open with intent** (Claude, Raycast): the menu opens with a clip-path reveal and staggered links; dialogs slide or scale in and lock the page behind them.
- **A mono face for labels and numbers** next to one sans.

What it avoids because it is everywhere: purple-to-blue glows and blobs, gradient text on every heading, glass stacked on glass, logo marquees, bouncy easing on content. None of the 30 handles right-to-left well; this site treats Persian as a first language, not a mirrored afterthought.

## Tokens

### Colour

| Name | Value | Role |
| --- | --- | --- |
| Ground | `#05070b` / `#080b11` | Page, alternate sections |
| Panel | `#0d121a` / `#121925` | Windows, cards |
| Glass | white at 3.5–9% | Surfaces over the ground |
| Hairline | white at 8 / 14 / 22% | Borders: default, hover, strong |
| Turquoise | `#3ee0cf` (light `#9cf5ea`) | Local, live, focus, progress |
| Saffron | `#f6b94d` (light `#ffd88f`) | Citations, highlights, the line of light |
| Lapis | `#6d8cff` | Rare: the external-API path only |
| Rose | `#ff7a6b` | Refusals and "not found" |
| Page | `#e9edf1` → `#dfe5ea` | Document pages, ink `#111a24` |

Text on the ground: `#eef2f6` / `#a2acba` / `#6c7686`. The brand gradient runs turquoise → mint → saffron and always starts at the reading edge (left in English, right in Persian). It is used only on the hero's second line, measured results and the share cards.

### Type

- **One family:** Vazirmatn (variable) for both scripts, in weights 500–820. It is split into a Latin and a Persian subset (weights 400–850, `scripts/subset-font.py`); each page preloads the subsets it shows, with `font-display: optional` so a slow first visit never re-flows. English display sizes use tight tracking (−0.035 to −0.05 em); Persian is never letter-spaced and gets a taller line height (1.3–1.45 for headings, 1.95 for text).
- **Mono** (system) for labels, file extensions, commands and English section numbers.
- **Number badges** are fixed boxes whose digits are moved down by Vazirmatn's offset (0.15 em Latin, 0.11 em Persian, calibrated by measuring every badge in the browser), so numbers sit within a pixel of the middle. Badges never use the monospace face, whose metrics differ.

### Shape and motion

- Radius 8 / 12 / 16 / 22 / 30, pills for buttons and chips.
- Easing: expo-out `cubic-bezier(.16,1,.3,1)` for reveals, `(.32,.72,0,1)` for sheets and drawers, `(.65,0,.35,1)` for travel, a small spring only on chips.

## Depth: 3D and imagery

A second review of all 30 references (screenshots at seven scroll depths, phone and desktop, plus a scan of each page for WebGL, video, Lottie, Spline and scroll-driven CSS) showed what the strongest ones share: the product's own material is the imagery. Midjourney's hero is made of words, Scale explains its product as a stack of layers, Gamma and Subframe tilt real screens in perspective, and none of them fills space with empty boxes. The site follows that:

- **Text tunnel (hero, three.js):** rings of real lines from the sample documents, in the page's own language, drift toward the viewer; cited lines glow saffron. It starts on the visitor's first move and never delays the first paint.
- **Assembly line (how it works, three.js):** six stations on one platform, and the camera travels along them with the pinned scroll. A page passes an intake gate and is checked. A scanner lifts its lines off it. The lines regroup into passage cards tagged with their pages. The cards become points in a vector space beside a keyword column. The points are filed in this conversation's drawer. Finally a question pulls three of them into a cited answer, and a final shot down the line shows the citation arc returning to the highlighted passage. Every label is real text in the page's language. Step arrows and a scroll cue sit on the stage: the cue says to scroll at the start and that the page continues at the end. Selecting a station goes to its step. The scene is built over several frames and compiles its shaders asynchronously, so loading it never stalls scrolling.
- **Screen wall (inside the app):** the repository's real screenshots on a tilted plane whose columns move against each other while scrolling. Each language shows only its own screens.

three.js is split into chunks that load only when a scene is about to be seen; without WebGL or with reduced motion the 2D versions are drawn instead.

- **Vault (privacy):** the machine is a sealed ring around the local pipeline: documents, reading and OCR, vectors, history, the model adapter and Ollama. A gate on the ring opens only for an API model, and a beam then carries the question and excerpts to the outside. Choosing a provider also updates the list of where each step happens. On phones the gate faces down and the outside sits below the ring, so the section stays compact.

## Presentation

The product tour's slides are fixed stages (1600 x 900; 900 x 1500 on portrait phones) scaled to the screen, so every slide has the same size and none can scroll. Type grows to fill short slides and shrinks for long ones; a section that still does not fit becomes two slides. Chapters open with their own accent, line icon in an orbiting ring and a large outlined number; sections get a layout for what they hold (cards, framed tables, a terminal, a tilted screenshot, a large statement). O shows every slide as a thumbnail.

## Page structure

```
HERO          release pill, two-line headline over the text tunnel, product window: the
              question is sent, the answer lights up word by word with numbered citations,
              the cited page lights up (replayed on the visitor's first move)
LIVE DEMO     4 sample document sets, @ mentions, 3 modes, streamed answers, source viewer;
              a fixed size, so answers and sources never move the page
INSIDE        a tilted wall of the app's real screens
EVIDENCE      claim, evidence and source joined by the line; "remove the evidence"
HOW IT WORKS  pinned 3D assembly line: one page through 6 real steps; step arrows, scroll cue
PRIVACY       the vault: provider modes, a sealed ring with a gate, where each step happens
MEASURED      only numbers the repository records, each cited, plus the honest caveat
FORMATS       the selected format's card beside book spines on a glass ledge
LANGUAGES     a live workspace preview that flips RTL/LTR on request
INSTALL       instructions beside a terminal for the visitor's OS and setup (the computer's
              own Ollama first)
STAR          the live star count and links to star, follow releases and report an issue
TOUR TEASER   the 14 chapters in a lit panel
CODA          the mark drawn by a line of light; "Your documents. Your machine. Your evidence."
FOOTER        columns, release, documents (open in a sheet), a large faded wordmark
```

The product tour is a separate page: a hero with a stack of chapter cards that starts the presentation, a sticky chapter index (a glass card, or a pill strip on narrow screens), and chapters built from structured content. "Present" opens as a circle of light growing from the button and turns each chapter opening and section into a slide. Moving between the home page and the tour cross-fades with view transitions.

Each tour chapter is also published on its own page, at guide/<id>/ (and fa/guide/<id>/). These pages are built from the same content as the tour. Each has a search-oriented title, breadcrumbs, the chapter index with the current page marked, links to the previous and next chapters, and TechArticle and BreadcrumbList structured data. They are listed in the sitemap, and each tour chapter links to its page.

## Principles

1. **One bold thing:** the line of light between a citation and its page.
2. **Motion explains cause and effect:** the hero plays one real exchange; after that, motion follows scroll or a click (citation → passage, remove evidence → claim disappears, provider → data path changes).
3. **Product-led:** the first thing on screen is the product answering with sources.
4. **Evidence-first copy:** real formats, modes, limits, commands, labels and messages from the release. No invented stats or testimonials.
5. **Each language is complete:** the English page has no Persian text (including the share card and documents); the Persian page is written in natural Persian (not translated), right-to-left, with Persian numerals, and Persian summaries of English-only documents.
6. **Overlays behave:** a sheet, menu or presentation locks the page behind it and stops smooth scrolling; only the overlay scrolls, with the site's own scrollbar. Escape and the backdrop close it with the same animation in reverse.
7. **Quality floor:** responsive from 360 px through tablets in both orientations, visible focus, keyboard-operable controls, `prefers-reduced-motion` (static compositions, no pinning), no layout shift, one bundled script, content painted before scripts run.

## Performance

- **First view:** each page carries its own styles inline, preloads only its font subsets, and paints the hero without waiting for any script. Ambient motion and the hero's replay begin on the visitor's first move.
- **Below the fold:** sections are laid out only when they come near the screen (`content-visibility` with their measured heights). Their scripts start in idle moments, one section per task.
- **Stable layout:** nothing above the reader changes height. The demo has a fixed size, and its panels scroll inside themselves, never the page.
- **3D:** three.js scenes load near their section, build over several frames, compile shaders asynchronously, and render only while on screen.
