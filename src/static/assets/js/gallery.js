// The wall of screens: alternate columns move up and down at different speeds as the section
// passes, which reads as depth on the tilted plane.
export function initGallery({ gsap, ST, reduce }) {
  const wall = document.querySelector('[data-gallery]');
  if (!wall || reduce || !ST) return;
  const cols = [...wall.querySelectorAll('.gallery__col')];
  cols.forEach((col, i) => {
    const amp = 10 + (i % 3) * 5;
    const dir = i % 2 ? 1 : -1;
    gsap.fromTo(col, { yPercent: -amp * dir }, {
      yPercent: amp * dir,
      ease: 'none',
      scrollTrigger: { trigger: wall.parentElement, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
    });
  });
}
