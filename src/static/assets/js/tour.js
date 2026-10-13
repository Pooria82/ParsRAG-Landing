// Product tour: the chapter index follows the reader, the hero deck previews the first
// chapters, and "Present" turns the tour into slides (see present.js).
import { initPresent } from './present.js';

export function initTour(ctx) {
  const { reduce } = ctx;
  const chapters = [...document.querySelectorAll('[data-chapter]')];
  if (!chapters.length) return;
  const links = new Map([...document.querySelectorAll('[data-toc] a')].map((a) => [a.hash.slice(1), a]));
  const toc = document.querySelector('.tour__toc');

  // ---------- Current chapter in the index ----------
  const visible = new Map();
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => visible.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0));
    const best = chapters.find((c) => visible.get(c.id) > 0) || null;
    links.forEach((a, id) => a.setAttribute('aria-current', String(best?.id === id)));
    const active = best && links.get(best.id);
    // On narrow screens the index is a horizontal strip; keep the current chapter in view.
    if (active && toc && toc.scrollWidth > toc.clientWidth) {
      const target = active.offsetLeft - toc.clientWidth / 2 + active.offsetWidth / 2;
      toc.scrollTo({ left: target, behavior: reduce ? 'auto' : 'smooth' });
    }
  }, { rootMargin: '-30% 0px -60% 0px', threshold: [0, 0.01] });
  chapters.forEach((c) => io.observe(c));

  // ---------- Hero deck: the first three chapter openings, stacked ----------
  const deck = document.querySelector('[data-deck]');
  if (deck) {
    const icon = document.querySelector('[data-present-start] .icon')?.cloneNode(true);
    chapters.slice(0, 3).forEach((ch, k) => {
      const card = document.createElement('span');
      card.className = 'deck__card';
      card.style.setProperty('--k', k);
      card.setAttribute('aria-hidden', 'true');
      // Spans, not headings: the deck is a button, which may only hold phrasing content.
      const head = ch.querySelector('.chapter__head');
      const parts = [head.querySelector('.chapter__n'), head.querySelector('.chapter__title'), head.querySelector('.chapter__lede')].filter(Boolean);
      card.append(...parts.map((n) => {
        const c = document.createElement('span');
        c.className = n.className;
        if (!n.classList.contains('chapter__n')) c.style.display = 'block';
        c.textContent = [...n.childNodes].filter((x) => !x.classList?.contains('ref')).map((x) => x.textContent).join('');
        return c;
      }));
      if (k === 0 && icon) {
        const play = document.createElement('span');
        play.className = 'deck__play';
        play.append(icon);
        card.append(play);
      }
      deck.append(card);
    });
  }

  initPresent(ctx, { chapters, currentChapter: () => chapters.find((c) => visible.get(c.id) > 0)?.id || null });
}
