// Product tour: the chapter index follows the reader, and "Present" turns the chapters
// into full-screen slides (one for each chapter opening, one for each of its sections).
// The presentation opens as a circle of light growing from the button that started it.
import { lockScroll } from './chrome.js';

export function initTour(ctx) {
  const { gsap, reduce, rtl, lang } = ctx;
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
      card.append(...[...ch.querySelector('.chapter__head').children].map((n) => {
        const c = document.createElement('span');
        c.className = n.className;
        c.style.display = 'block';
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

  // ---------- Presentation ----------
  const present = document.querySelector('[data-present]');
  const viewport = present.querySelector('[data-present-viewport]');
  const count = present.querySelector('[data-present-count]');
  const bar = present.querySelector('[data-present-progress]');
  const S = JSON.parse(present.querySelector('[data-present-strings]').textContent);
  const n = (v) => (lang === 'fa' ? String(v).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]) : String(v));

  const slides = [];
  chapters.forEach((ch) => {
    const head = ch.querySelector('.chapter__head');
    const title = document.createElement('div');
    title.className = 'slide slide--title';
    title.append(head.cloneNode(true));
    slides.push({ el: title, chapter: ch.id });
    ch.querySelectorAll('.tour__part').forEach((part) => {
      if (!part.children.length) return;
      const s = document.createElement('div');
      s.className = 'slide';
      const crumb = document.createElement('p');
      crumb.className = 'chapter__n';
      crumb.textContent = head.querySelector('.chapter__title').textContent;
      s.append(crumb, part.cloneNode(true));
      slides.push({ el: s, chapter: ch.id });
    });
  });
  slides.forEach(({ el }, i) => {
    el.hidden = true;
    el.setAttribute('role', 'group');
    el.setAttribute('aria-roledescription', 'slide');
    el.setAttribute('aria-label', S.slideOf.replace('{n}', n(i + 1)).replace('{total}', n(slides.length)));
    el.querySelectorAll('[id]').forEach((x) => x.removeAttribute('id'));
    viewport.append(el);
  });

  let index = 0;
  let opener = null;
  const show = (i, dir = 1) => {
    const next = Math.max(0, Math.min(slides.length - 1, i));
    const prev = slides[index].el;
    const cur = slides[next].el;
    index = next;
    slides.forEach(({ el }) => { if (el !== prev && el !== cur) el.hidden = true; });
    cur.hidden = false;
    count.textContent = S.slideOf.replace('{n}', n(index + 1)).replace('{total}', n(slides.length));
    bar.style.width = `${((index + 1) / slides.length) * 100}%`;
    if (reduce || prev === cur) {
      prev.hidden = prev !== cur;
    } else {
      const shift = (rtl ? -1 : 1) * dir * 60;
      gsap.fromTo(cur, { autoAlpha: 0, x: shift }, { autoAlpha: 1, x: 0, duration: 0.45, ease: 'power3.out' });
      gsap.to(prev, { autoAlpha: 0, x: -shift, duration: 0.3, ease: 'power2.in', onComplete: () => { prev.hidden = true; gsap.set(prev, { clearProps: 'all' }); } });
    }
    cur.scrollTop = 0;
  };

  let closeTimer = 0;
  const open = (from) => {
    clearTimeout(closeTimer);
    opener = from || document.activeElement;
    // The circle grows from the centre of the button that opened it.
    const r = from?.getBoundingClientRect?.();
    present.style.setProperty('--cx', r ? `${r.left + r.width / 2}px` : '50%');
    present.style.setProperty('--cy', r ? `${r.top + r.height / 2}px` : '50%');
    present.classList.remove('is-closing');
    if (present.hidden) {
      present.hidden = false;
      lockScroll(ctx, true);
      document.documentElement.classList.add('present-open');
    }
    requestAnimationFrame(() => requestAnimationFrame(() => present.classList.add('is-open')));
    // Start from the chapter currently on screen.
    const current = chapters.find((c) => visible.get(c.id) > 0);
    const start = current ? slides.findIndex((s) => s.chapter === current.id) : 0;
    index = Math.max(0, start);
    slides.forEach(({ el }) => { el.hidden = true; });
    show(index);
    present.querySelector('[data-present-next]').focus({ preventScroll: true });
    if (location.hash !== '#present') history.replaceState(null, '', '#present');
  };
  const close = () => {
    if (present.hidden || present.classList.contains('is-closing')) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    history.replaceState(null, '', location.pathname);
    const chapter = document.getElementById(slides[index].chapter);
    present.classList.add('is-closing');
    present.classList.remove('is-open');
    closeTimer = setTimeout(() => {
      present.hidden = true;
      present.classList.remove('is-closing');
      document.documentElement.classList.remove('present-open');
      lockScroll(ctx, false);
      if (ctx.lenis) ctx.lenis.scrollTo(chapter, { immediate: true, offset: -8 });
      else chapter?.scrollIntoView({ block: 'start' });
      opener?.focus?.({ preventScroll: true });
    }, reduce ? 0 : 560);
  };

  document.querySelectorAll('[data-present-start]').forEach((b) => b.addEventListener('click', () => {
    open(b);
    if (matchMedia('(pointer: fine)').matches) present.requestFullscreen?.().catch(() => {});
  }));
  present.querySelector('[data-present-exit]').addEventListener('click', close);
  present.querySelector('[data-present-prev]').addEventListener('click', () => show(index - 1, -1));
  present.querySelector('[data-present-next]').addEventListener('click', () => show(index + 1, 1));
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && !present.hidden) present.focus(); });

  document.addEventListener('keydown', (e) => {
    if (present.hidden) return;
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
    const back = rtl ? 'ArrowRight' : 'ArrowLeft';
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if ([forward, 'PageDown', ' '].includes(e.key)) { e.preventDefault(); show(index + 1, 1); }
    else if ([back, 'PageUp'].includes(e.key)) { e.preventDefault(); show(index - 1, -1); }
    else if (e.key === 'Home') { e.preventDefault(); show(0, -1); }
    else if (e.key === 'End') { e.preventDefault(); show(slides.length - 1, 1); }
    else if (e.key === 'Tab') {
      // Keep focus inside the presentation.
      const focusables = [...present.querySelectorAll('button, a[href], [tabindex="0"]')].filter((x) => !x.closest('[hidden]'));
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  let touchX = null;
  viewport.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  viewport.addEventListener('touchend', (e) => {
    if (touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) < 50) return;
    const forwardSwipe = rtl ? dx > 0 : dx < 0;
    show(index + (forwardSwipe ? 1 : -1), forwardSwipe ? 1 : -1);
  });

  if (location.hash === '#present') open(null);
}
