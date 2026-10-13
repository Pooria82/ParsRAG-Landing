// Languages: a live workspace preview that switches between Persian (RTL) and English (LTR).
// Elements glide to their mirrored positions (FLIP) while their labels cross-fade.
export function initMorph({ gsap, reduce }) {
  const root = document.querySelector('[data-morph]');
  const toggle = document.querySelector('[data-morph-toggle]');
  if (!root || !toggle) return;
  const app = root.querySelector('[data-morph-app]');
  const strings = JSON.parse(root.querySelector('[data-morph-strings]').textContent);
  const start = root.dataset.start;
  let lang = start;

  const fill = (l) => {
    const s = strings[l];
    app.dir = s.dir;
    app.lang = l;
    app.querySelectorAll('[data-m]').forEach((el) => { el.textContent = s[el.dataset.m] ?? ''; });
  };
  fill(lang);

  const moving = () => [...app.querySelectorAll('.morph__side, .morph__main, .morph__q, .morph__badge, .morph__src, .morph__docs, .morph__mode, .morph__brand, .morph__new')];

  toggle.addEventListener('click', () => {
    const next = lang === 'en' ? 'fa' : 'en';
    const els = moving();
    const before = els.map((el) => el.getBoundingClientRect());
    const swap = () => {
      fill(next);
      lang = next;
      toggle.setAttribute('aria-pressed', String(lang !== start));
      toggle.textContent = lang === start ? toggle.dataset.to : toggle.dataset.back;
    };
    if (reduce) { swap(); return; }
    gsap.to(app.querySelectorAll('[data-m]'), {
      opacity: 0,
      duration: 0.16,
      onComplete: () => {
        swap();
        // Play each element from where it was to where the new direction puts it.
        els.forEach((el, i) => {
          const a = before[i];
          const b = el.getBoundingClientRect();
          gsap.fromTo(el, { x: a.left - b.left, y: a.top - b.top }, { x: 0, y: 0, duration: 0.7, ease: 'power3.inOut', clearProps: 'transform' });
        });
        gsap.to(app.querySelectorAll('[data-m]'), { opacity: 1, duration: 0.3, delay: 0.35, stagger: 0.01 });
      },
    });
  });
}
