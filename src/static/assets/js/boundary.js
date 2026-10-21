// Privacy: the vault. The machine is a sealed ring around the local pipeline; choosing a
// provider opens the gate (or keeps it shut) and updates where each step happens.
import { rovingGroup } from './util.js';

export function initBoundary({ gsap, rtl }) {
  const root = document.querySelector('[data-vault]');
  if (!root) return;
  const vault = root.querySelector('.vault');
  const beam = vault.querySelector('.vault__beam');
  const note = root.querySelector('.vault__note');
  const buttons = [...root.querySelectorAll('[data-mode]')].filter((b) => b.classList.contains('mode'));
  const cells = [...root.querySelectorAll('.ledger__list b')];

  const apply = (mode) => {
    vault.dataset.mode = mode;
    note.textContent = note.dataset[`note${mode[0].toUpperCase()}${mode.slice(1)}`];
    cells.forEach((b) => {
      b.textContent = b.dataset[mode];
      b.classList.toggle('is-out', (b.dataset.out || '').split(' ').includes(mode));
    });
  };

  rovingGroup({
    root,
    buttons,
    attr: 'aria-checked',
    rtl,
    gsap,
    onSelect: (i) => apply(buttons[i].dataset.mode),
  });

  // Packets travel the beam's full length, whichever way it points.
  const measure = () => {
    const r = beam.getBoundingClientRect();
    beam.style.setProperty('--len', `${Math.max(r.width, r.height) - 8}px`);
  };
  new ResizeObserver(measure).observe(beam);

  // Animate only while visible.
  new IntersectionObserver(([e]) => vault.classList.toggle('is-live', e.isIntersecting), { rootMargin: '80px 0px' }).observe(vault);
}
