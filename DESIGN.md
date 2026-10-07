# ParsRAG landing — design plan

## Brief

- **Subject:** ParsRAG, an offline-first workspace that answers questions about Persian and English documents and cites the exact page every claim came from.
- **Audience:** Persian-speaking developers, researchers, students, and organizations who cannot send documents to a cloud chatbot.
- **Primary job:** make a visitor feel, within ten seconds, *"it reads my Persian documents and shows me where every answer came from — on my own machine,"* then get them to GitHub or the quick start.

## Concept: Hashiye (حاشیه, marginalia)

Persian manuscripts carried *hashiye*: commentary written in the margins, pointing back to the passage it explains. ParsRAG does the same thing with software: every answer sentence is tied to a source page. The page is built around that idea:

- answers are typeset like a manuscript page,
- citations live in the margin as notes,
- **gold citation threads** connect each note to the highlighted line it came from.

The citation thread is the one memorable element. Everything else stays quiet.

## Tokens

### Color (Persian illumination on night-green)

| Name | Hex | Role |
| --- | --- | --- |
| Night green | `#0F2E27` | Main canvas (a colored ground, not a tinted black) |
| Deep green | `#0A221C` | Recessed panels, shadows |
| Paper | `#EEF2EA` | Document pages, answer page |
| Brand green | `#146A57` | Product color, primary button on paper |
| Spark mint | `#79C5AA` | The brand spark, focus rings, live states |
| Illumination gold | `#D2B06A` | Citation threads, margin notes, one CTA (tazhib gold) |
| Lapis | `#4A6FC0` | Rare: the external-API path in the trust diagram only |

Text on night green: `#E7EFEA` (body), `#9FB8AE` (secondary). Text on paper: `#173129`.

### Type

- **Display:** *Markazi Text*, a Naskh-inspired serif covering Persian and Latin. It gives headlines the voice of a manuscript in both languages. Used at large sizes only.
- **Body/UI:** *Vazirmatn*, the product's own typeface, so the site and the app read as one family.
- **Scale:** a perfect fourth (1.333) from 17px: 17 / 23 / 30 / 40 / 53 / 71 / 95. Persian gets +8% size and a 1.9 line-height, Latin a 1.6 line-height. Measure ≤ 70ch.
- **Persian text is never split into characters**, because that would break the joined script. Reveals animate whole words or lines.

### Layout

```
HERO (100vh, night green)
  glyph field: Persian letters drift like ink dust,
  then gather into the ParsRAG mark (two pages + spark)
  headline (Markazi), one-line explanation, two actions

MARGINALIA DEMO (pinned while scrolling)
  ┌──────── answer page (paper) ────────┐ ┌ margin ┐
  │ question being typed with @file     │ │ note 1 │──gold thread──▶ source page card
  │ stages: understanding/retrieving/…  │ │ note 2 │──gold thread──▶ source page card
  │ answer lines ink in                 │ └────────┘
  └─────────────────────────────────────┘

A PAGE'S JOURNEY (true sequence → numbered steps beside one pinned stage)
  one page morphs: upload → OCR beam → located passages (one bridges
  pages 3–4) → vectors → Qdrant collection → question finds 3 sources

THREE WAYS TO ANSWER (one question, three answers, segmented control)

THE WORKSTATION FRAME (illuminated border; data stays inside;
  toggle "external API" → a lapis gate opens + disclosure)

SHELF OF FORMATS (book spines: PDF, DOCX, PPTX, images, text, code)

TWO DIRECTIONS (drag divider between Persian RTL and English LTR screenshots)

QUICK START (terminal) → closing line + actions
```

Alignment: content follows the reading direction (right-aligned in Persian, left in English). The hero is centered because it's a single composition; every other section is direction-aligned.

## Principles

1. **One bold thing:** citation threads. No gradient washes, glow cards, or decorative blobs.
2. **Motion answers the reader:** one orchestrated hero sequence on load. After that, motion only follows scroll position or a click (pinned demo, journey, toggles). No fade-up on every section.
3. **Persian first:** the Persian page is designed RTL-native rather than mirrored; the English page mirrors it.
4. **Real content:** real formats, modes, limits, and commands from the README. No invented stats or testimonials.
5. **Quality floor:** responsive to 360px, visible focus, `prefers-reduced-motion` (static composition, no pinning), contrast ≥ 4.5:1, no layout shift, Lighthouse-friendly static HTML with SEO metadata (hreflang, OG, JSON-LD, sitemap).

## Review against generic defaults

- *Dark page + one bright accent* is a default. Changed: the ground is a saturated green, and the accent pair is gold + mint taken from Persian illumination and the brand, so there's no acid neon.
- *Serif display* can read as the cream-serif default. Kept, but on night green with Naskh-derived letterforms. It's tied to the manuscript concept rather than to a "premium" look.
- *Numbered steps* are used only for the page's journey, which is a real sequence.
- *Bento card grid* and *fade-up sections* are deliberately absent. Features are shown through the demo, the journey, and the shelf.
- *Eyebrow labels, middle-dot meta strings, and arrows appended to buttons* are excluded; button labels say what happens.

## Changes made while building

- **Journey:** a pinned stage where one page morphs through the six steps replaced the horizontal track. It keeps the reading direction simple in RTL and shows each step as a change to the same object.
- **Modes legend:** cited text, model knowledge and declined parts are underlined differently, and the underline is inked in with the streamed words.
- **Reduced motion:** every scroll scene renders its final composition; the global rule uses `transition-duration: 0s` so layout reads are never mid-transition.
