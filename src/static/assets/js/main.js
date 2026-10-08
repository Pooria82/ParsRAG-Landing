// Boots the page. Content is visible without JavaScript; scripts add motion and
// interaction on top. Heavy sections start only when they come near the viewport.
import { initChrome } from './chrome.js';
import { initHero } from './hero.js';
import { initPlayground } from './playground.js';
import { initContract } from './contract.js';
import { initJourney } from './journey.js';
import { initBoundary } from './boundary.js';
import { initMeasured } from './measured.js';
import { initShelf } from './shelf.js';
import { initMorph } from './morph.js';
import { initTerminal } from './terminal.js';
import { initCoda } from './coda.js';
import { initTour } from './tour.js';

const html = document.documentElement;

function markReady(isStatic) {
  clearTimeout(window.__revealFailsafe);
  html.classList.add('is-ready');
  if (isStatic) html.classList.add('is-static');
}

const run = (fn, ctx) => {
  try {
    const result = fn(ctx);
    if (result?.catch) result.catch((e) => console.error(`[ParsRAG] ${fn.name}`, e));
  } catch (error) {
    console.error(`[ParsRAG] ${fn.name} failed`, error);
  }
};

/** Starts `fn` once `selector` is within `margin` of the viewport. */
function whenNear(selector, fn, ctx, margin = '600px') {
  const el = document.querySelector(selector);
  if (!el) return;
  if (!('IntersectionObserver' in window)) return run(fn, ctx);
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    run(fn, ctx);
    ctx.ST?.refresh();
  }, { rootMargin: `${margin} 0px` });
  io.observe(el);
}

function boot() {
  const { gsap, ScrollTrigger, Lenis } = window;
  const ctx = {
    gsap,
    ST: ScrollTrigger,
    rtl: html.dir === 'rtl',
    lang: html.lang,
    reduce: matchMedia('(prefers-reduced-motion: reduce)').matches,
  };

  if (!gsap || !ScrollTrigger) {
    markReady(true);
    run(initChrome, ctx);
    return;
  }
  gsap.registerPlugin(ScrollTrigger);

  // Smooth wheel scrolling on desktop pointers only; touch and trackpad-free devices keep native scrolling.
  if (!ctx.reduce && Lenis && matchMedia('(pointer: fine) and (hover: hover)').matches) {
    const lenis = new Lenis({ lerp: 0.12, smoothWheel: true, anchors: { offset: -8 }, autoRaf: false });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    ctx.lenis = lenis;
  }

  run(initChrome, ctx);

  if (html.dataset.page === 'tour') {
    run(initTour, ctx);
    markReady(ctx.reduce);
    return;
  }

  // Order matters for pinned sections: create them top to bottom.
  run(initHero, ctx);
  markReady(ctx.reduce);
  run(initContract, ctx);
  run(initJourney, ctx);
  run(initBoundary, ctx);
  run(initShelf, ctx);
  run(initCoda, ctx);
  whenNear('[data-playground]', initPlayground, ctx, '900px');
  whenNear('[data-measured]', initMeasured, ctx, '200px');
  whenNear('[data-morph]', initMorph, ctx);
  whenNear('[data-term]', initTerminal, ctx);
  // Pinned sections measure layout: recalculate once fonts settle, and whenever content
  // above them changes height (an answer streaming into the demo, a dialog-free resize).
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  let lastHeight = document.body.scrollHeight;
  let refreshTimer;
  new ResizeObserver(() => {
    const height = document.body.scrollHeight;
    if (Math.abs(height - lastHeight) < 2) return;
    lastHeight = height;
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 250);
  }).observe(document.body);
}

boot();
