// Measured results: bars grow to their before/after values when the section is reached.
export function initMeasured({ ST, reduce }) {
  const metrics = document.querySelectorAll('[data-metric]');
  metrics.forEach((m) => {
    const scale = Number(m.dataset.scale) || 1;
    const set = () => {
      m.querySelector('.metric__bar--before').style.setProperty('--v', Math.min(1, Number(m.dataset.before) / scale));
      m.querySelector('.metric__bar--after').style.setProperty('--v', Math.min(1, Number(m.dataset.after) / scale));
    };
    if (reduce || !ST) set();
    else ST.create({ trigger: m, start: 'top 85%', once: true, onEnter: set });
  });
}
