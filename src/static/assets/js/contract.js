// Evidence contract: a claim is tied by gold threads to its passage and its source.
// Removing the passage breaks the threads, and the claim gives way to a refusal.
const NS = 'http://www.w3.org/2000/svg';

export function initContract({ gsap, ST, reduce }) {
  const root = document.querySelector('[data-contract]');
  if (!root) return;
  const svg = root.querySelector('.contract__threads');
  const claim = root.querySelector('[data-c="claim"]');
  const chip = claim.querySelector('.pg__chip');
  const evidence = root.querySelector('[data-c="evidence"]');
  const mark = evidence.querySelector('mark');
  const source = root.querySelector('[data-c="source"]');
  const refused = root.querySelector('[data-c-refused]');
  const status = root.querySelector('[data-c-status]');
  const toggle = root.querySelector('[data-c-toggle]');
  let broken = false;

  const mk = () => {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('class', 'thread');
    p.setAttribute('pathLength', '1');
    svg.append(p);
    return p;
  };
  const paths = [mk(), mk()];

  const curve = (a, b) => {
    const box = root.getBoundingClientRect();
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    const sx = ra.left + ra.width / 2 - box.left;
    const sy = ra.bottom - box.top + 2;
    const ex = rb.left + Math.min(rb.width / 2, 60) - box.left;
    const ey = rb.top - box.top - 2;
    const dy = (ey - sy) * 0.6;
    return `M${sx},${sy} C${sx},${sy + dy} ${ex},${ey - dy} ${ex},${ey}`;
  };
  const layout = () => {
    const box = root.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    paths[0].setAttribute('d', curve(chip, mark));
    paths[1].setAttribute('d', curve(mark, source.querySelector('bdi') || source));
  };
  layout();
  new ResizeObserver(layout).observe(root);

  const drawIn = () => {
    if (reduce) { paths.forEach((p) => { p.style.strokeDashoffset = 0; }); return; }
    gsap.fromTo(paths, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.9, stagger: 0.35, ease: 'power2.inOut' });
  };
  if (reduce) drawIn();
  else ST.create({ trigger: root, start: 'top 72%', once: true, onEnter: drawIn });

  toggle.addEventListener('click', () => {
    broken = !broken;
    toggle.setAttribute('aria-pressed', String(broken));
    toggle.textContent = broken ? toggle.dataset.restore : toggle.dataset.remove;
    status.textContent = broken ? toggle.dataset.gone : toggle.dataset.ok;
    root.classList.toggle('is-broken', broken);
    refused.hidden = !broken;
    if (reduce) {
      paths.forEach((p) => { p.style.strokeDashoffset = broken ? 1 : 0; });
      return;
    }
    if (broken) {
      // The thread retracts from the source back to the claim.
      gsap.to([...paths].reverse(), { strokeDashoffset: -1, duration: 0.5, stagger: 0.12, ease: 'power2.in' });
      gsap.fromTo(refused, { autoAlpha: 0, y: -6 }, { autoAlpha: 1, y: 0, duration: 0.4, delay: 0.35 });
    } else {
      layout();
      drawIn();
    }
  });
}
