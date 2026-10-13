// Site chrome shared by every page: the top bar, the mobile drawer, document sheets,
// self-citation popovers, scroll reveals, and the live "latest release" check.
import { localDigits } from './util.js';

const strings = () => JSON.parse(document.getElementById('site-strings')?.textContent || '{}');
const html = document.documentElement;

/**
 * Locks the page behind an overlay. Smooth scrolling (Lenis) is stopped too, otherwise it
 * keeps taking wheel events and the page moves underneath the overlay. Overlays mark their
 * own scrolling regions with data-lenis-prevent so the wheel scrolls them natively.
 */
let locks = 0;
export function lockScroll(ctx, on) {
  locks = Math.max(0, locks + (on ? 1 : -1));
  const locked = locks > 0;
  if (locked && !html.classList.contains('is-locked')) {
    html.style.setProperty('--sbw', `${Math.max(0, window.innerWidth - html.clientWidth)}px`);
  }
  html.classList.toggle('is-locked', locked);
  if (locked) ctx.lenis?.stop();
  else ctx.lenis?.start();
}

/**
 * Opens a native modal dialog with an enter transition, and closes it with an exit
 * transition before it leaves the top layer. Returns { open, close }.
 */
function animatedDialog(dlg, ctx, { onOpen, onClose, duration = 520 } = {}) {
  let timer = 0;
  const open = () => {
    clearTimeout(timer);
    dlg.classList.remove('is-closing');
    if (!dlg.open) {
      dlg.showModal();
      lockScroll(ctx, true);
    }
    // Two frames so the closed styles are painted before the open ones apply.
    requestAnimationFrame(() => requestAnimationFrame(() => dlg.classList.add('is-open')));
    onOpen?.();
  };
  const finish = () => {
    dlg.classList.remove('is-open', 'is-closing');
    if (dlg.open) dlg.close();
  };
  const close = () => {
    if (!dlg.open || dlg.classList.contains('is-closing')) return;
    dlg.classList.add('is-closing');
    dlg.classList.remove('is-open');
    timer = setTimeout(finish, ctx.reduce ? 0 : duration);
  };
  // Escape fires "cancel": run the exit animation instead of closing at once.
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dlg.addEventListener('close', () => {
    dlg.classList.remove('is-open', 'is-closing');
    lockScroll(ctx, false);
    onClose?.();
  });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  return { open, close };
}

/** Top bar: becomes a floating pill after scrolling; a light slides under hovered links. */
function initTopbar() {
  const bar = document.querySelector('[data-topbar]');
  if (!bar) return;
  let ticking = false;
  const update = () => {
    ticking = false;
    bar.classList.toggle('is-solid', scrollY > 24);
  };
  addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();

  const nav = bar.querySelector('[data-topnav]');
  const light = nav?.querySelector('.topnav__hover');
  if (!nav || !light) return;
  const moveTo = (a) => {
    light.style.width = `${a.offsetWidth}px`;
    light.style.transform = `translate(${a.offsetLeft}px, ${a.offsetTop}px)`;
  };
  nav.querySelectorAll('a').forEach((a) => {
    a.addEventListener('pointerenter', () => {
      if (!nav.classList.contains('is-hovering')) {
        light.style.transition = 'none';
        moveTo(a);
        light.getBoundingClientRect();
        light.style.transition = '';
      }
      nav.classList.add('is-hovering');
      moveTo(a);
    });
    a.addEventListener('focus', () => { nav.classList.add('is-hovering'); moveTo(a); });
    a.addEventListener('blur', () => nav.classList.remove('is-hovering'));
  });
  nav.addEventListener('pointerleave', () => nav.classList.remove('is-hovering'));

  // The link for the section in view is marked current.
  const links = [...nav.querySelectorAll('[data-section]')];
  const sections = links.map((a) => document.getElementById(a.dataset.section)).filter(Boolean);
  if (!sections.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((a) => a.setAttribute('aria-current', String(a.dataset.section === e.target.id)));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach((s) => io.observe(s));
}

/** Drawer navigation for phones and tablets. */
function initDrawer(ctx) {
  const drawer = document.querySelector('[data-drawer]');
  const opener = document.querySelector('[data-menu-open]');
  if (!drawer || !opener) return;
  const d = animatedDialog(drawer, ctx, {
    duration: 520,
    onOpen: () => opener.setAttribute('aria-expanded', 'true'),
    onClose: () => {
      opener.setAttribute('aria-expanded', 'false');
      opener.focus({ preventScroll: true });
    },
  });
  opener.addEventListener('click', d.open);
  drawer.querySelector('[data-drawer-close]')?.addEventListener('click', d.close);
  drawer.querySelectorAll('[data-drawer-link]').forEach((a) => a.addEventListener('click', (e) => {
    // Same-page anchors: close first, then scroll, so the page is unlocked when it moves.
    const url = new URL(a.href, location.href);
    if (url.pathname === location.pathname && url.hash) {
      e.preventDefault();
      d.close();
      setTimeout(() => {
        const target = document.querySelector(url.hash);
        if (ctx.lenis) ctx.lenis.scrollTo(target, { offset: -8 });
        else target?.scrollIntoView({ behavior: ctx.reduce ? 'auto' : 'smooth' });
        history.replaceState(null, '', url.hash);
      }, ctx.reduce ? 0 : 380);
    }
  }));
  matchMedia('(min-width: 1100px)').addEventListener('change', (e) => { if (e.matches && drawer.open) d.close(); });
}

/** Repository documents open in a sheet; without JavaScript the links go to GitHub. */
function initDocs(ctx) {
  const dlg = document.querySelector('[data-docdlg]');
  if (!dlg) return;
  const body = dlg.querySelector('[data-docdlg-body]');
  const head = dlg.querySelector('[data-docdlg-head]');
  const progress = dlg.querySelector('[data-docdlg-progress]');
  const grip = dlg.querySelector('.sheet__grip');
  const S = strings();
  const cache = new Map();
  let opener = null;
  const loading = body.textContent.trim();

  const d = animatedDialog(dlg, ctx, {
    duration: 620,
    onClose: () => opener?.focus({ preventScroll: true }),
  });

  const setProgress = () => {
    const max = body.scrollHeight - body.clientHeight;
    progress.style.setProperty('--p', max > 0 ? (body.scrollTop / max).toFixed(4) : '0');
  };
  body.addEventListener('scroll', setProgress, { passive: true });

  async function show(id) {
    const url = `${S.root}docs/${S.lang}/${id}.html`;
    if (!cache.has(id)) {
      head.replaceChildren();
      body.innerHTML = `<p class="sheet__loading">${loading}</p>`;
    }
    d.open();
    try {
      if (!cache.has(id)) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(res.status);
        cache.set(id, await res.text());
      }
      body.innerHTML = cache.get(id);
      // The title and source link stay above the scrolling text.
      head.replaceChildren(...[body.querySelector('.doc-view__head')].filter(Boolean));
    } catch {
      head.replaceChildren();
      body.innerHTML = `<p class="sheet__loading">${S.docError}</p>`;
    }
    body.scrollTop = 0;
    setProgress();
    body.focus({ preventScroll: true });
  }

  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-doc]');
    if (!link || e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
    e.preventDefault();
    opener = link;
    // A document link inside the drawer: the sheet opens on top of it.
    show(link.dataset.doc);
  });
  dlg.querySelector('[data-docdlg-close]').addEventListener('click', d.close);

  // Phones: drag the sheet down by its grip to close it.
  if (grip) {
    let startY = null;
    grip.addEventListener('pointerdown', (e) => {
      startY = e.clientY;
      grip.setPointerCapture(e.pointerId);
      dlg.classList.add('is-dragging');
    });
    grip.addEventListener('pointermove', (e) => {
      if (startY == null) return;
      dlg.style.setProperty('--drag', `${Math.max(0, e.clientY - startY)}px`);
    });
    const end = (e) => {
      if (startY == null) return;
      const dy = e.clientY - startY;
      startY = null;
      dlg.classList.remove('is-dragging');
      dlg.style.removeProperty('--drag');
      if (dy > 120) d.close();
    };
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
  }

  // Copy buttons inside documents (the citation formats).
  body.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-copy-target]');
    if (!btn) return;
    const text = body.querySelector(`#${btn.dataset.copyTarget}`)?.textContent || '';
    try {
      await navigator.clipboard.writeText(text);
      const label = btn.textContent;
      btn.textContent = S.copied;
      setTimeout(() => { btn.textContent = label; }, 1600);
    } catch { /* the text stays selectable */ }
  });
}

/** Numbered markers that show the exact source text from the ParsRAG repository. */
function initRefs() {
  const pop = document.querySelector('[data-refpop]');
  const dataEl = document.getElementById('refs-data');
  if (!pop || !dataEl) return;
  const refs = JSON.parse(dataEl.textContent);
  const S = strings();
  const quote = pop.querySelector('[data-refpop-quote]');
  const note = pop.querySelector('[data-refpop-note]');
  const link = pop.querySelector('[data-refpop-link]');
  const file = pop.querySelector('[data-refpop-file]');
  const translatedLabel = pop.dataset.translated || '';
  let current = null;
  let hideTimer = 0;

  const place = (anchor) => {
    const r = anchor.getBoundingClientRect();
    const w = pop.offsetWidth;
    const h = pop.offsetHeight;
    const left = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), window.innerWidth - w - 12);
    const below = r.bottom + 10 + h < window.innerHeight;
    pop.style.left = `${left}px`;
    pop.style.top = `${below ? r.bottom + 10 : Math.max(12, r.top - h - 10)}px`;
    pop.style.setProperty('--ox', `${r.left + r.width / 2 - left}px`);
    pop.style.setProperty('--oy', below ? '0%' : '100%');
  };
  const hide = () => {
    if (!current) return;
    current.setAttribute('aria-expanded', 'false');
    current = null;
    pop.classList.remove('is-in');
    hideTimer = setTimeout(() => { pop.hidden = true; }, 200);
  };
  const show = (anchor) => {
    const c = refs[anchor.dataset.ref];
    if (!c) return;
    clearTimeout(hideTimer);
    if (current) current.setAttribute('aria-expanded', 'false');
    current = anchor;
    anchor.setAttribute('aria-expanded', 'true');
    quote.textContent = c.quote;
    quote.dir = c.translated ? 'auto' : /[؀-ۿ]/.test(c.quote) ? 'rtl' : 'ltr';
    note.textContent = c.translated ? translatedLabel : '';
    link.href = c.url;
    const lines = c.from === c.to ? `${c.from}` : `${c.from}–${c.to}`;
    file.textContent = `${c.file} · ${S.lines} ${lines}`;
    pop.hidden = false;
    place(anchor);
    requestAnimationFrame(() => pop.classList.add('is-in'));
  };

  document.querySelectorAll('.ref[data-ref]').forEach((a) => {
    a.setAttribute('aria-expanded', 'false');
    a.setAttribute('aria-haspopup', 'dialog');
  });
  // One listener for every marker, including copies made later (the 3D model's panels).
  document.addEventListener('click', (e) => {
    const a = e.target.closest('.ref[data-ref]');
    if (a) {
      e.preventDefault();
      if (current === a) hide();
      else show(a);
      return;
    }
    if (current && !pop.contains(e.target)) hide();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && current) {
      const a = current;
      hide();
      a.focus();
    }
  });
  window.addEventListener('scroll', () => current && place(current), { passive: true });
  window.addEventListener('resize', hide);
}

/** Elements with [data-reveal] rise into place the first time they enter the viewport. */
function initReveal(ctx) {
  const items = document.querySelectorAll('[data-reveal]');
  if (!items.length) return;
  if (ctx.reduce || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  items.forEach((el) => io.observe(el));
}

/** Cards with [data-spot] get a soft light that follows the pointer. */
function initSpotlight() {
  if (!matchMedia('(hover: hover)').matches) return;
  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest?.('[data-spot]');
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    card.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });
}

/**
 * The build stamps the release it was made from; this checks GitHub for a newer one
 * so the version shown stays current between builds. Cached for an hour.
 */
async function initRelease() {
  const targets = document.querySelectorAll('[data-release]');
  if (!targets.length) return;
  const KEY = 'parsrag-latest-release';
  const S = strings();
  let rel = null;
  try {
    const cached = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (cached && Date.now() - cached.at < 3_600_000) rel = cached.rel;
  } catch { /* storage unavailable */ }
  if (!rel) {
    try {
      const res = await fetch('https://api.github.com/repos/Pooria82/ParsRAG/releases/latest', { headers: { Accept: 'application/vnd.github+json' } });
      if (!res.ok) return;
      const j = await res.json();
      rel = { tag: j.tag_name, url: j.html_url };
      try { sessionStorage.setItem(KEY, JSON.stringify({ at: Date.now(), rel })); } catch { /* ignore */ }
    } catch {
      return;
    }
  }
  if (!rel?.tag) return;
  const version = localDigits(rel.tag.replace(/^v/, ''), S.lang);
  targets.forEach((el) => {
    if (el.dataset.release === 'version') el.textContent = version;
    if (el.dataset.release === 'link') el.href = rel.url;
  });
}

export function initChrome(ctx) {
  initTopbar();
  initDrawer(ctx);
  initDocs(ctx);
  initRefs();
  initReveal(ctx);
  initSpotlight();
  // The release check waits until the page is idle so it never competes with first paint.
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 2000));
  idle(() => initRelease(), { timeout: 4000 });
}
