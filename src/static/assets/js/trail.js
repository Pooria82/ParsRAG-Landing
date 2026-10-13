// Evidence trail: a gold thread in the page margin with a knot for each section.
// It fills as you read, and each knot jumps to its section. Wide screens only.
export function initTrail({ ST, lenis, reduce }) {
  const sections = [...document.querySelectorAll('main > section[id]')];
  if (!ST || sections.length < 3) return;
  const label = document.documentElement.lang === 'fa' ? 'بخش‌های صفحه' : 'Page sections';

  const nav = document.createElement('nav');
  nav.className = 'trail';
  nav.setAttribute('aria-label', label);
  nav.innerHTML = '<span class="trail__line" aria-hidden="true"><span class="trail__fill"></span></span>';
  const fill = nav.querySelector('.trail__fill');
  const knots = sections.map((s) => {
    const a = document.createElement('a');
    a.className = 'trail__knot';
    a.href = `#${s.id}`;
    const title = s.querySelector('h2')?.textContent.trim() || s.id;
    a.innerHTML = `<span class="trail__label">${title.replace(/[<&]/g, '')}</span>`;
    a.setAttribute('aria-label', title);
    a.addEventListener('click', (e) => {
      if (!lenis) return;
      e.preventDefault();
      lenis.scrollTo(s, { offset: -8, immediate: reduce });
    });
    nav.append(a);
    return { a, s };
  });
  document.body.append(nav);

  // Knots sit at their section's real scroll position, so pinned sections take their share.
  const place = () => {
    const max = ST.maxScroll(window) || 1;
    const first = knots[0].s.getBoundingClientRect().top + scrollY;
    knots.forEach(({ a, s }) => {
      const at = Math.max(0, s.getBoundingClientRect().top + scrollY - first) / Math.max(1, max - first);
      a.style.setProperty('--at', Math.min(1, at).toFixed(4));
    });
  };
  const update = () => {
    const max = ST.maxScroll(window) || 1;
    const first = knots[0].s.getBoundingClientRect().top + scrollY;
    const p = Math.min(1, Math.max(0, (scrollY + window.innerHeight * 0.35 - first) / Math.max(1, max - first)));
    fill.style.transform = `scaleY(${p})`;
    nav.classList.toggle('is-visible', scrollY > window.innerHeight * 0.6);
    let current = 0;
    knots.forEach(({ s }, i) => { if (s.getBoundingClientRect().top < window.innerHeight * 0.4) current = i; });
    knots.forEach(({ a }, i) => {
      a.classList.toggle('is-passed', i <= current);
      if (i === current) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  };
  ST.addEventListener('refresh', () => { place(); update(); });
  window.addEventListener('scroll', update, { passive: true });
  place();
  update();
}
