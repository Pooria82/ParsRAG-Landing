# ParsRAG website — design

## Brief

- **Subject:** ParsRAG, an offline-first workspace that answers questions about Persian and English documents and cites the exact page every claim came from.
- **Audience:** Persian-speaking developers, researchers, students, and organizations who cannot send documents to a cloud chatbot.
- **Primary job:** within seconds, a visitor should *try* it — ask a document, open the citation, see the passage — and understand that it runs on their own machine. Then: run it locally, or read the full product tour.

## Concept: Hashiye (حاشیه, marginalia)

Persian manuscripts carried *hashiye*: commentary written in the margins, pointing back to the passage it explains. ParsRAG does the same with software: every answer sentence is tied to a source page.

- answers are typeset like a manuscript page,
- **gold citation threads** tie each claim to the passage it came from,
- **the site cites itself:** every product claim carries a numbered marker that quotes the ParsRAG repository, verified at build time. The site behaves the way the product does.

The gold thread is the one memorable element; it runs through the whole page: from the hero headline to the demo, between a citation and its passage, between claim, evidence and source, and down the page margin as the reading trail.

## Tokens

### Color (Persian illumination on night green)

| Name | Hex | Role |
| --- | --- | --- |
| Night green | `#0F2E27` | Main canvas (a colored ground, not a tinted black) |
| Deep green | `#0A221C` | Alternate sections, panels |
| Paper | `#E6EBE1` → `#DDE4D6` | Document pages; softened with a top light and grain so it isn't a flat white slab |
| Brand green | `#146A57` | Product color on paper |
| Spark mint | `#79C5AA` | Focus rings, live states, "stays local" |
| Illumination gold | `#D2B06A` | Threads, citation markers, the primary action |
| Lapis | `#4A6FC0` | Rare: the external-API path only |
| Brick | `#A0472F` | Refusals and "not found" |

Text on night green: `#E7EFEA` / `#A3BBB1`. Text on paper: `#173129` / `#4A6158`.

### Type

- **Display:** *Markazi Text*, a Naskh-derived serif for Persian and Latin, at large sizes and for answers on paper.
- **Body/UI:** *Vazirmatn*, the product's own typeface.
- Perfect fourth from 17px. Persian gets a larger size and 1.9 line-height. Persian text is never split into characters; reveals animate whole words.

## Page structure

```
HERO          letters of the page language gather into the mark; headline sharpens from ink;
              a gold thread runs from "page" around the copy to the demo
LIVE DEMO     4 sample document sets, @ mentions, 3 modes, streamed answer, numbered chips,
              source viewer with the cited passage highlighted, thread chip→passage,
              refusals with the app's real messages, compare all three modes
EVIDENCE      claim ─thread─ evidence ─thread─ source; "remove the evidence" removes the claim
HOW IT WORKS  pinned stage: one page morphs through 6 real steps; "under the hood" per step
PRIVACY       illuminated workstation frame with a gate; where-each-step-happens table
              (cards on phones) compared with a cloud chatbot
MEASURED      only numbers the repository records, each cited, plus the honest caveat
FORMATS       book spines
LANGUAGES     a live workspace preview that flips RTL/LTR on request
INSTALL       terminal for the visitor's OS (PowerShell or sh) and setup
TOUR TEASER   the 14 chapters
CODA          the mark drawn by a thread; "Your documents. Your machine. Your evidence."
```

The product tour is a separate page: a sticky chapter index (a horizontal strip on narrow screens) and chapters built from structured content; "Present" turns each chapter opening and section into a slide.

## Principles

1. **One bold thing:** the gold thread. No gradient washes, glow cards or decorative blobs.
2. **Motion explains cause and effect:** one orchestrated hero moment; after that, motion follows scroll position or a click (citation → passage, remove evidence → claim disappears, provider → data path changes).
3. **Product-led:** the first interaction is asking a document, not watching an animation.
4. **Evidence-first copy:** real formats, modes, limits, commands, labels and messages from the release. No invented stats or testimonials; measured numbers carry their source and their limits.
5. **Each language is complete:** the English page contains no Persian text (including the glyph field, the share card and documents); the Persian page is designed right-to-left with Persian numerals and dates, and Persian summaries of English-only documents.
6. **Quality floor:** responsive from 360px through tablets in both orientations, visible focus, keyboard-operable controls, `prefers-reduced-motion` (static compositions, no pinning), no layout shift, one bundled script, content painted before scripts run.

## Review against generic defaults

- *Dark page + one bright accent* → a saturated green ground with gold and mint from Persian illumination.
- *Big-number stat row* → measured results shown as before/after with their method and caveat, not as hero stats.
- *Numbered steps* only for the processing sequence and tour chapters, which are real sequences.
- *Bento grids, fade-up sections, all-caps eyebrows, middle-dot meta strings, arrows on buttons* → absent. Button labels say what happens.
