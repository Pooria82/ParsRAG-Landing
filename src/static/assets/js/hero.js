// Hero: the product window plays one real exchange. The question is typed, the answer
// streams in with numbered citations, and each citation lights its passage on the page.
// After that it is interactive: any citation or source row opens its page.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// A cheap check only: creating a real WebGL context just to test for it costs up to a second
// on machines without a GPU. If the scene later fails to start, the 2D version stays.
function supportsWebGL() {
  return 'WebGLRenderingContext' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * The tunnel of text behind the headline (three.js). It loads after the page is idle so it
 * never competes with the first paint, and is skipped for reduced motion or data saving.
 */
function startTunnel({ reduce, rtl }) {
  const bg = document.querySelector('.hero__bg');
  const src = document.querySelector('[data-playground]')?.dataset.src;
  if (!bg || !src || reduce || navigator.connection?.saveData || !supportsWebGL()) return;
  // Start on the visitor's first move (pointer, scroll, touch or key), so the scene never
  // competes with loading the page.
  const events = ['pointermove', 'scroll', 'touchstart', 'keydown', 'wheel'];
  const go = () => {
    events.forEach((e) => removeEventListener(e, go));
    load();
  };
  events.forEach((e) => addEventListener(e, go, { passive: true, once: true }));
  const load = async () => {
    try {
      const data = await (await fetch(src)).json();
      const lines = data.corpora.flatMap((c) => c.passages.map((p) => p.text)).slice(0, 16);
      const { createTunnel } = await import('./scenes/hero3d.js');
      createTunnel(bg, { lines, rtl, small: innerWidth < 700 });
      requestAnimationFrame(() => bg.classList.add('is-3d'));
    } catch { /* the static backdrop stays */ }
  };
}

export function initHero({ reduce, rtl }) {
  startTunnel({ reduce, rtl });
  const app = document.querySelector('[data-hero-app]');
  if (!app) return;
  const q = app.querySelector('[data-hq]');
  const text = app.querySelector('[data-ha]');
  const sentences = [...text.querySelectorAll('[data-hs]')];
  const chips = [...text.querySelectorAll('.pg__chip')];
  const triggers = [...app.querySelectorAll('[data-hc]')];
  const pages = [...app.querySelectorAll('[data-hp]')];
  const stages = [...app.querySelectorAll('.app__stages li')];
  const svg = app.querySelector('.app__beam');
  const path = svg.querySelector('path');
  const end = svg.querySelector('circle');
  let current = 0;

  const drawBeam = (animate) => {
    const chip = chips[current - 1];
    const mark = pages[current - 1]?.querySelector('mark');
    if (!chip || !mark || getComputedStyle(svg).display === 'none') return;
    const box = app.getBoundingClientRect();
    const a = chip.getBoundingClientRect();
    const m = mark.getClientRects()[0] || mark.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    const x1 = a.left + a.width / 2 - box.left;
    const y1 = a.top + a.height / 2 - box.top;
    // The passage's reading start: its left edge in English, its right edge in Persian.
    const x2 = (rtl ? m.right + 4 : m.left - 4) - box.left;
    const y2 = m.top + m.height / 2 - box.top;
    const dx = Math.abs(x2 - x1) * 0.5;
    const dir = x2 > x1 ? 1 : -1;
    path.setAttribute('d', `M${x1},${y1} C${x1 + dx * dir},${y1} ${x2 - dx * dir},${y2} ${x2},${y2}`);
    end.setAttribute('cx', x2);
    end.setAttribute('cy', y2);
    path.style.transition = 'none';
    path.style.strokeDashoffset = animate ? '1' : '0';
    end.style.opacity = animate ? '0' : '1';
    if (!animate) return;
    path.getBoundingClientRect();
    path.style.transition = 'stroke-dashoffset 0.9s cubic-bezier(0.65, 0, 0.35, 1)';
    path.style.strokeDashoffset = '0';
    setTimeout(() => { end.style.transition = 'opacity 0.3s'; end.style.opacity = '1'; }, 800);
  };

  const show = (n, animate = !reduce) => {
    if (n === current) return;
    current = n;
    chips.forEach((c, i) => c.classList.toggle('is-active', i === n - 1));
    triggers.forEach((t) => t.setAttribute('aria-pressed', String(Number(t.dataset.hc) === n)));
    pages.forEach((p, i) => {
      p.classList.toggle('is-shown', i === n - 1);
      p.classList.remove('is-lit');
    });
    const page = pages[n - 1];
    if (animate) setTimeout(() => page.classList.add('is-lit'), 260);
    else page.classList.add('is-lit');
    drawBeam(animate);
  };

  triggers.forEach((t) => t.addEventListener('click', () => {
    app.classList.add('is-done');
    show(Number(t.dataset.hc));
  }));
  new ResizeObserver(() => current && drawBeam(false)).observe(app);

  const finish = () => {
    app.classList.add('is-done', 'is-answered');
    show(1, false);
  };
  if (reduce) { finish(); return; }

  // The window keeps its final size from the first frame: every word of the answer is already
  // in place and only fades in, so the page height never changes while it plays (a changing
  // height would make the pinned sections below recalculate on every word).
  const words = sentences.map((s) => {
    const parts = s.textContent.split(/(\s+)/);
    s.textContent = '';
    return parts.map((part) => {
      if (!part.trim()) { s.append(part); return null; }
      const w = document.createElement('span');
      w.className = 'w';
      w.textContent = part;
      s.append(w);
      return w;
    }).filter(Boolean);
  });

  async function play() {
    app.classList.add('is-playing');
    await wait(150);
    app.classList.add('is-sent');
    await wait(450);
    app.classList.add('is-asked');
    for (const li of stages) {
      li.classList.add('is-active');
      await wait(520);
      li.classList.remove('is-active');
      li.classList.add('is-done');
    }
    app.classList.add('is-answering');
    for (let s = 0; s < sentences.length; s++) {
      for (const w of words[s]) {
        w.classList.add('is-on');
        await wait(55);
      }
      chips[s].classList.add('is-in');
      await wait(160);
    }
    app.classList.add('is-answered');
    await wait(500);
    show(1);
    await wait(2600);
    if (!app.classList.contains('is-done')) show(2);
    app.classList.add('is-done');
  }

  // Start once the window is on screen (it is below the fold on short phones) and the visitor
  // has moved, scrolled or pressed a key: the page settles first, then the exchange plays.
  let seen = false;
  let moved = false;
  const start = () => {
    if (!seen || !moved || app.dataset.played) return;
    app.dataset.played = '1';
    setTimeout(() => play().catch(finish), 350);
  };
  const events = ['pointermove', 'scroll', 'touchstart', 'keydown', 'wheel'];
  const onMove = () => {
    events.forEach((e) => removeEventListener(e, onMove));
    moved = true;
    start();
  };
  events.forEach((e) => addEventListener(e, onMove, { passive: true }));
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    seen = true;
    start();
  }, { threshold: 0.15 });
  io.observe(app);
}
