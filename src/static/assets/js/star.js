// Star on GitHub: the orbits move only while the card is on screen, and the live star
// count is fetched once, when the section comes near. Without it the button still works.
import { localDigits } from './util.js';

export function initStar({ lang }) {
  const section = document.querySelector('.star');
  const count = section?.querySelector('[data-star-count]');
  if (!section || !count) return;
  let fetched = false;
  new IntersectionObserver(([e]) => {
    section.classList.toggle('is-live', e.isIntersecting);
    if (!e.isIntersecting || fetched) return;
    fetched = true;
    fetch('https://api.github.com/repos/Pooria82/ParsRAG', { headers: { Accept: 'application/vnd.github+json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((repo) => {
        const n = repo?.stargazers_count;
        if (typeof n !== 'number') return;
        count.textContent = `★ ${localDigits(n.toLocaleString('en-US'), lang)}`;
        count.hidden = false;
      })
      .catch(() => {});
  }, { rootMargin: '300px 0px' }).observe(section);
}
