// Presentation mode for the product tour.
//
// Every slide is a fixed stage (1600 x 900, or 900 x 1500 on portrait phones) scaled to fit
// the screen, so all slides share one size and none of them scrolls. Each chapter opens with
// a title slide; each section becomes a content slide laid out for what it holds (a list, a
// table, a terminal, a screenshot...). A slide whose content does not fit first shrinks its
// type a little, then splits into two slides.
import { lockScroll } from './chrome.js';
import { chapterIcon } from './chapter-icons.js';

const LAND = { w: 1600, h: 900 };
const PORT = { w: 900, h: 1500 };
const ACCENTS = ['#3ee0cf', '#f6b94d', '#8fa6ff'];
const MIN_SCALE = 0.72;
const MAX_SCALE = 1.4;

const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};

export function initPresent(ctx, { chapters, currentChapter }) {
  const { gsap, reduce, rtl, lang } = ctx;
  const present = document.querySelector('[data-present]');
  if (!present || !chapters.length) return;
  const viewport = present.querySelector('[data-present-viewport]');
  const count = present.querySelector('[data-present-count]');
  const bar = present.querySelector('[data-present-progress]');
  const gridBtn = present.querySelector('[data-present-grid]');
  const S = JSON.parse(present.querySelector('[data-present-strings]').textContent);
  const n = (v) => (lang === 'fa' ? String(v).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]) : String(v));
  const pad = (v) => n(String(v).padStart(2, '0'));

  let slides = [];
  let index = 0;
  let size = LAND;
  let built = '';
  let opener = null;
  let closeTimer = 0;

  // ---------- Building ----------

  const chapterInfo = chapters.map((ch, i) => {
    const head = ch.querySelector('.chapter__head');
    const plain = (sel) => {
      const node = head.querySelector(sel)?.cloneNode(true);
      node?.querySelectorAll('.ref').forEach((r) => r.remove());
      return node?.innerHTML.trim() || '';
    };
    return { id: ch.id, i, title: plain('.chapter__title'), lede: plain('.chapter__lede'), accent: ACCENTS[i % ACCENTS.length] };
  });

  const frame = (info, kind) => {
    const slide = el('div', `slide slide--${kind}`);
    slide.dataset.chapter = info.id;
    const stage = el('div', 'stage');
    stage.style.setProperty('--acc', info.accent);
    stage.innerHTML = `
      <div class="stage__bg" aria-hidden="true"><span class="stage__glow"></span><span class="stage__grid"></span>${chapterIcon(info.id, 'stage__mark')}</div>
      <header class="stage__top">
        <span class="stage__chip">${chapterIcon(info.id)}<b>${pad(info.i + 1)}</b><span>${info.title}</span></span>
        <span class="stage__count" data-slide-count></span>
      </header>
      <div class="stage__body"></div>
      <footer class="stage__foot" aria-hidden="true">
        <span class="stage__brand">${document.querySelector('.brand .mark')?.outerHTML || ''}<b>${document.querySelector('.brand__name')?.textContent || ''}</b></span>
        <span class="stage__track">${chapterInfo.map((c) => `<i class="${c.i < info.i ? 'is-past' : c.i === info.i ? 'is-now' : ''}"></i>`).join('')}</span>
      </footer>`;
    slide.append(stage);
    return slide;
  };

  const titleSlide = (info) => {
    const slide = frame(info, 'title');
    slide.querySelector('.stage__body').innerHTML = `
      <div class="ts__text">
        <p class="ts__kicker" data-a>${S.chapterOf.replace('{n}', n(info.i + 1)).replace('{total}', n(chapters.length))}</p>
        <h2 class="ts__title" data-a>${info.title}</h2>
        <p class="ts__lede" data-a>${info.lede}</p>
      </div>
      <div class="ts__art" aria-hidden="true" data-a>
        <span class="ts__num">${pad(info.i + 1)}</span>
        <span class="ts__ring ts__ring--1"></span><span class="ts__ring ts__ring--2"></span><span class="ts__ring ts__ring--3"></span>
        <span class="ts__orbit"><i></i></span><span class="ts__orbit ts__orbit--2"><i></i></span>
        <span class="ts__core">${chapterIcon(info.id)}</span>
      </div>`;
    return slide;
  };

  // Turns a block from the tour page into its slide form.
  const blockFor = (node) => {
    if (node.matches('.tour__list')) {
      const items = [...node.children];
      const ol = el('ol', 's-list');
      ol.dataset.count = items.length;
      items.forEach((li, k) => ol.append(el('li', null, `<span class="s-list__n">${n(k + 1)}</span><span class="s-list__t">${li.innerHTML}</span>`)));
      return { kind: 'list', node: ol, items: items.length };
    }
    if (node.matches('.tour__table')) {
      const t = el('div', 's-table', node.querySelector('table').outerHTML);
      return { kind: 'table', node: t, items: node.querySelectorAll('tbody tr').length };
    }
    if (node.matches('.tour__code')) {
      const t = el('div', 's-term', `<div class="s-term__bar" aria-hidden="true"><i></i><i></i><i></i></div>${node.outerHTML}`);
      return { kind: 'code', node: t, visual: true };
    }
    if (node.matches('.tour__figure')) {
      const f = el('figure', 's-shot');
      const img = node.querySelector('img').cloneNode();
      img.loading = 'eager';
      f.append(el('div', 's-shot__frame'), el('figcaption', null, node.querySelector('figcaption')?.innerHTML || ''));
      f.firstChild.append(img);
      if (node.matches('.tour__figure--narrow')) f.classList.add('s-shot--narrow');
      return { kind: 'figure', node: f, visual: true };
    }
    if (node.matches('.tour__cards')) {
      const g = el('div', 's-cards');
      [...node.children].forEach((c) => g.append(el('div', 's-card', c.innerHTML)));
      return { kind: 'cards', node: g, items: node.children.length };
    }
    if (node.matches('.tour__kv')) return { kind: 'kv', node: el('dl', 's-kv', node.innerHTML), items: node.children.length };
    if (node.matches('.tour__note')) return { kind: 'note', node: el('p', 's-note', node.innerHTML) };
    if (node.matches('.tour__docs')) return { kind: 'docs', node: el('p', 's-docs', node.innerHTML) };
    if (node.matches('p')) return { kind: 'p', node: el('p', 's-p', node.innerHTML) };
    return { kind: 'other', node: node.cloneNode(true) };
  };

  const contentSlide = (info, heading, blocks, part) => {
    const slide = frame(info, 'content');
    const body = slide.querySelector('.stage__body');
    const visual = blocks.filter((b) => b.visual);
    const text = blocks.filter((b) => !b.visual);
    const kinds = blocks.map((b) => b.kind);
    body.dataset.kinds = kinds.join(' ');
    if (heading) {
      const h = el('h3', 'cs__title', heading);
      h.dataset.a = '';
      body.append(h);
    }
    const grid = el('div', `cs__grid ${visual.length && text.length ? 'cs__grid--split' : 'cs__grid--full'}`);
    const col = (list, cls) => {
      const c = el('div', cls);
      list.forEach((b) => { b.node.dataset.a = ''; c.append(b.node.cloneNode(true)); });
      return c;
    };
    if (visual.length && text.length) grid.append(col(text, 'cs__text'), col(visual, 'cs__visual'));
    else grid.append(col(blocks, 'cs__text'));
    // A statement on its own (one paragraph, maybe a note) is set large.
    if (blocks.every((b) => ['p', 'note', 'docs'].includes(b.kind))) grid.classList.add('cs__grid--statement');
    body.append(grid);
    slide.dataset.part = part;
    return slide;
  };

  const fits = (slide) => {
    const body = slide.querySelector('.stage__body');
    return body.scrollHeight <= body.clientHeight + 1 && body.scrollWidth <= body.clientWidth + 1;
  };

  // Finds the largest type scale at which the slide's content fits: short sections grow to
  // fill the stage, long ones shrink. Returns false if even the smallest size overflows.
  const fit = (slide, max = MAX_SCALE) => {
    const stage = slide.querySelector('.stage');
    const set = (k) => stage.style.setProperty('--k', k.toFixed(3));
    set(MIN_SCALE);
    if (!fits(slide)) return false;
    let lo = MIN_SCALE;
    let hi = max;
    for (let step = 0; step < 7; step++) {
      const mid = (lo + hi) / 2;
      set(mid);
      if (fits(slide)) lo = mid; else hi = mid;
    }
    set(lo);
    return true;
  };

  // Splits the blocks of a section into two halves (by block, or by list item / table row).
  const halve = (blocks) => {
    if (blocks.length > 1) {
      const mid = Math.ceil(blocks.length / 2);
      return [blocks.slice(0, mid), blocks.slice(mid)];
    }
    const b = blocks[0];
    if (b.kind === 'list' || b.kind === 'cards' || b.kind === 'kv') {
      const items = [...b.node.children];
      if (items.length < 2) return null;
      const mid = Math.ceil(items.length / 2);
      const a = b.node.cloneNode(false);
      const c = b.node.cloneNode(false);
      items.slice(0, mid).forEach((x) => a.append(x.cloneNode(true)));
      items.slice(mid).forEach((x) => c.append(x.cloneNode(true)));
      a.dataset.count = mid;
      c.dataset.count = items.length - mid;
      c.style.counterReset = `item ${mid}`;
      return [[{ ...b, node: a }], [{ ...b, node: c }]];
    }
    if (b.kind === 'table') {
      const rows = [...b.node.querySelectorAll('tbody tr')];
      if (rows.length < 2) return null;
      const mid = Math.ceil(rows.length / 2);
      const make = (list) => {
        const t = b.node.cloneNode(true);
        const tb = t.querySelector('tbody');
        tb.innerHTML = '';
        list.forEach((r) => tb.append(r.cloneNode(true)));
        return { ...b, node: t };
      };
      return [[make(rows.slice(0, mid))], [make(rows.slice(mid))]];
    }
    return null;
  };

  const layoutPart = (info, heading, blocks, part, measure) => {
    const slide = contentSlide(info, heading, blocks, part);
    measure.append(slide);
    if (fit(slide)) return [slide];
    const halves = halve(blocks);
    if (!halves) return [slide];
    slide.remove();
    return [
      ...layoutPart(info, heading, halves[0], part, measure),
      ...layoutPart(info, heading ? `${heading} <span class="cs__cont">${S.cont}</span>` : '', halves[1], part, measure),
    ];
  };

  function build() {
    const portrait = viewport.clientWidth / Math.max(1, viewport.clientHeight) < 0.9;
    size = portrait ? PORT : LAND;
    const key = portrait ? 'p' : 'l';
    present.classList.toggle('is-portrait', portrait);
    viewport.style.setProperty('--w', size.w);
    viewport.style.setProperty('--h', size.h);
    if (built === key) return;
    built = key;
    viewport.querySelectorAll('.slide').forEach((s) => s.remove());
    slides = [];
    const measure = el('div', 'present__measure');
    viewport.append(measure);
    chapters.forEach((ch, i) => {
      const info = chapterInfo[i];
      const t = titleSlide(info);
      measure.append(t);
      // Chapter openers keep their designed size; only long ledes shrink.
      fit(t, 1);
      slides.push(t);
      ch.querySelectorAll('.tour__part').forEach((part, p) => {
        const nodes = [...part.children];
        if (!nodes.length) return;
        const h = nodes[0].matches('.tour__h') ? nodes.shift().innerHTML : '';
        const blocks = nodes.map(blockFor);
        if (!blocks.length) return;
        slides.push(...layoutPart(info, h, blocks, p, measure));
      });
    });
    slides.forEach((s, k) => {
      s.hidden = true;
      s.setAttribute('role', 'group');
      s.setAttribute('aria-roledescription', 'slide');
      const label = S.slideOf.replace('{n}', n(k + 1)).replace('{total}', n(slides.length));
      s.setAttribute('aria-label', label);
      s.querySelector('[data-slide-count]').textContent = `${n(k + 1)} / ${n(slides.length)}`;
      s.querySelectorAll('[id]').forEach((x) => x.removeAttribute('id'));
      viewport.append(s);
    });
    measure.remove();
  }

  // Scale the stage to the space available, letterboxed.
  const scale = () => {
    const s = Math.min(viewport.clientWidth / size.w, viewport.clientHeight / size.h);
    viewport.style.setProperty('--s', s.toFixed(4));
  };

  // ---------- Showing ----------

  const enter = (cur, dir) => {
    const parts = cur.querySelectorAll('[data-a]');
    const shift = (rtl ? -1 : 1) * dir;
    // The slide wrapper moves; the stage inside keeps the CSS transform that fits it to the screen.
    gsap.fromTo(cur, { autoAlpha: 0, xPercent: 6 * shift, scale: 0.97, rotateY: -6 * shift }, { autoAlpha: 1, xPercent: 0, scale: 1, rotateY: 0, duration: 0.7, ease: 'expo.out', clearProps: 'transform' });
    gsap.fromTo(parts, { y: 26, autoAlpha: 0, filter: 'blur(6px)' }, { y: 0, autoAlpha: 1, filter: 'blur(0px)', duration: 0.7, ease: 'expo.out', stagger: 0.05, delay: 0.12, clearProps: 'filter' });
    if (cur.matches('.slide--title')) {
      gsap.fromTo(cur.querySelector('.ts__num'), { autoAlpha: 0, scale: 0.86, y: 30 }, { autoAlpha: 1, scale: 1, y: 0, duration: 1.2, ease: 'expo.out' });
    }
  };

  const show = (i, dir = 1) => {
    const next = Math.max(0, Math.min(slides.length - 1, i));
    const prev = slides[index];
    const cur = slides[next];
    index = next;
    slides.forEach((s) => { if (s !== prev && s !== cur) s.hidden = true; });
    cur.hidden = false;
    count.textContent = S.slideOf.replace('{n}', n(index + 1)).replace('{total}', n(slides.length));
    bar.style.width = `${((index + 1) / slides.length) * 100}%`;
    if (reduce || !prev || prev === cur) {
      if (prev && prev !== cur) prev.hidden = true;
      return;
    }
    const shift = (rtl ? -1 : 1) * dir;
    gsap.to(prev, {
      autoAlpha: 0, xPercent: -5 * shift, scale: 0.95, duration: 0.4, ease: 'power2.in',
      onComplete: () => { prev.hidden = true; gsap.set(prev, { clearProps: 'transform,opacity,visibility' }); },
    });
    enter(cur, dir);
  };

  // ---------- Overview (all slides as thumbnails) ----------

  const setOverview = (on) => {
    present.classList.toggle('is-overview', on);
    gridBtn?.setAttribute('aria-pressed', String(on));
    if (on) {
      slides.forEach((s, k) => {
        s.hidden = false;
        s.classList.toggle('is-current', k === index);
        gsap.killTweensOf(s);
        gsap.set(s, { clearProps: 'transform,opacity,visibility' });
      });
      const thumb = slides[0].getBoundingClientRect().width;
      viewport.style.setProperty('--ts', (thumb / size.w).toFixed(4));
      slides[index].scrollIntoView({ block: 'center' });
      slides[index].focus?.({ preventScroll: true });
    } else {
      slides.forEach((s, k) => { s.hidden = k !== index; s.classList.remove('is-current'); });
      viewport.scrollTop = 0;
      scale();
    }
  };
  viewport.addEventListener('click', (e) => {
    if (!present.classList.contains('is-overview')) return;
    const s = e.target.closest('.slide');
    if (!s) return;
    index = slides.indexOf(s);
    setOverview(false);
    show(index);
  });
  gridBtn?.addEventListener('click', () => setOverview(!present.classList.contains('is-overview')));

  // ---------- Open / close ----------

  const open = async (from) => {
    clearTimeout(closeTimer);
    opener = from || document.activeElement;
    const r = from?.getBoundingClientRect?.();
    present.style.setProperty('--cx', r ? `${r.left + r.width / 2}px` : '50%');
    present.style.setProperty('--cy', r ? `${r.top + r.height / 2}px` : '50%');
    present.classList.remove('is-closing', 'is-overview');
    if (present.hidden) {
      present.hidden = false;
      lockScroll(ctx, true);
      document.documentElement.classList.add('present-open');
    }
    await document.fonts?.ready;
    build();
    scale();
    requestAnimationFrame(() => requestAnimationFrame(() => present.classList.add('is-open')));
    // Start from the chapter currently on screen.
    const ch = currentChapter();
    const start = ch ? slides.findIndex((s) => s.dataset.chapter === ch) : 0;
    index = Math.max(0, start);
    slides.forEach((s) => { s.hidden = true; });
    show(index);
    present.querySelector('[data-present-next]').focus({ preventScroll: true });
    if (location.hash !== '#present') history.replaceState(null, '', '#present');
  };
  const close = () => {
    if (present.hidden || present.classList.contains('is-closing')) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    history.replaceState(null, '', location.pathname);
    const chapter = document.getElementById(slides[index]?.dataset.chapter);
    present.classList.add('is-closing');
    present.classList.remove('is-open');
    closeTimer = setTimeout(() => {
      present.hidden = true;
      present.classList.remove('is-closing', 'is-overview');
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

  let resizeTimer = 0;
  addEventListener('resize', () => {
    if (present.hidden) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const before = slides[index];
      const ch = before?.dataset.chapter;
      const part = before?.dataset.part;
      const was = built;
      build();
      if (built !== was) {
        // Orientation changed: the deck was rebuilt; go back to the same section.
        index = Math.max(0, slides.findIndex((s) => s.dataset.chapter === ch && (part == null || s.dataset.part === part)));
        slides.forEach((s) => { s.hidden = true; });
        show(index);
      }
      scale();
    }, 120);
  });

  document.addEventListener('keydown', (e) => {
    if (present.hidden) return;
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
    const back = rtl ? 'ArrowRight' : 'ArrowLeft';
    if (e.key === 'Escape') {
      e.preventDefault();
      if (present.classList.contains('is-overview')) setOverview(false);
      else close();
    } else if (present.classList.contains('is-overview')) {
      return;
    } else if ([forward, 'PageDown', ' '].includes(e.key)) { e.preventDefault(); show(index + 1, 1); }
    else if ([back, 'PageUp'].includes(e.key)) { e.preventDefault(); show(index - 1, -1); }
    else if (e.key === 'Home') { e.preventDefault(); show(0, -1); }
    else if (e.key === 'End') { e.preventDefault(); show(slides.length - 1, 1); }
    else if (e.key === 'o' || e.key === 'O' || e.key === 'g') { e.preventDefault(); setOverview(true); }
    else if (e.key === 'Tab') {
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
    if (touchX == null || present.classList.contains('is-overview')) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) < 50) return;
    const forwardSwipe = rtl ? dx > 0 : dx < 0;
    show(index + (forwardSwipe ? 1 : -1), forwardSwipe ? 1 : -1);
  });

  if (location.hash === '#present') open(null);
}
