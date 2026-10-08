// Site chrome shared by every page: the mobile drawer, document dialogs,
// self-citation popovers, and the live "latest release" check.
import { localDigits } from './util.js';

const strings = () => JSON.parse(document.getElementById('site-strings')?.textContent || '{}');

/** Drawer navigation for phones and tablets (a native modal dialog). */
function initDrawer() {
  const drawer = document.querySelector('[data-drawer]');
  const open = document.querySelector('[data-menu-open]');
  if (!drawer || !open) return;
  const close = () => drawer.close();
  open.addEventListener('click', () => {
    drawer.showModal();
    open.setAttribute('aria-expanded', 'true');
  });
  drawer.addEventListener('close', () => {
    open.setAttribute('aria-expanded', 'false');
    open.focus();
  });
  drawer.querySelector('[data-drawer-close]')?.addEventListener('click', close);
  drawer.addEventListener('click', (e) => { if (e.target === drawer) close(); });
  drawer.querySelectorAll('[data-drawer-link]').forEach((a) => a.addEventListener('click', close));
  // The drawer is only for narrow screens; close it if the window grows.
  matchMedia('(min-width: 1180px)').addEventListener('change', (e) => { if (e.matches && drawer.open) close(); });
}

/** Repository documents open in a dialog; without JavaScript the links go to GitHub. */
function initDocs() {
  const dlg = document.querySelector('[data-docdlg]');
  if (!dlg) return;
  const body = dlg.querySelector('[data-docdlg-body]');
  const S = strings();
  const cache = new Map();
  let opener = null;

  async function show(id) {
    const url = `${S.root}docs/${S.lang}/${id}.html`;
    body.innerHTML = `<p class="docdlg__loading">${dlg.dataset.loading || ''}</p>`;
    if (!dlg.open) dlg.showModal();
    try {
      if (!cache.has(id)) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(res.status);
        cache.set(id, await res.text());
      }
      body.innerHTML = cache.get(id);
    } catch {
      body.innerHTML = `<p>${S.docError}</p>`;
    }
    body.scrollTop = 0;
    body.focus({ preventScroll: true });
  }

  dlg.dataset.loading = body.textContent.trim();
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-doc]');
    if (!link || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    opener = link;
    show(link.dataset.doc);
  });
  dlg.querySelector('[data-docdlg-close]').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => opener?.focus());

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

  const place = (anchor) => {
    const r = anchor.getBoundingClientRect();
    const w = pop.offsetWidth;
    const h = pop.offsetHeight;
    const left = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), window.innerWidth - w - 12);
    const below = r.bottom + 10 + h < window.innerHeight;
    pop.style.left = `${left}px`;
    pop.style.top = `${below ? r.bottom + 10 : Math.max(12, r.top - h - 10)}px`;
  };
  const hide = () => {
    if (!current) return;
    current.setAttribute('aria-expanded', 'false');
    current = null;
    pop.hidden = true;
  };
  const show = (anchor) => {
    const c = refs[anchor.dataset.ref];
    if (!c) return;
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
  };

  document.querySelectorAll('.ref[data-ref]').forEach((a) => {
    a.setAttribute('aria-expanded', 'false');
    a.setAttribute('aria-haspopup', 'dialog');
    a.addEventListener('click', (e) => {
      e.preventDefault();
      if (current === a) hide();
      else show(a);
    });
  });
  document.addEventListener('click', (e) => {
    if (current && !pop.contains(e.target) && !e.target.closest('.ref')) hide();
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
  const topbar = document.querySelector('[data-topbar]');
  if (topbar && ctx.ST) {
    ctx.ST.create({ start: 24, end: 'max', onToggle: (self) => topbar.classList.toggle('is-solid', self.isActive) });
  }
  initDrawer();
  initDocs();
  initRefs();
  initRelease();
}
