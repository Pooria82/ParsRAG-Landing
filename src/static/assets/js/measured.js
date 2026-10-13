// Measured results: bars grow to their before/after values and the numbers count up to them
// when the section is reached. The final text is the build's own (Persian digits and decimal
// separator on the Persian page); counting only rewrites the digits on the way there.
const DIGITS = '۰۱۲۳۴۵۶۷۸۹';

function countUp(dd, duration) {
  const final = dd.textContent;
  const fa = /[۰-۹]/.test(final);
  const latin = final.replace(/[۰-۹]/g, (d) => DIGITS.indexOf(d)).replace('٫', '.');
  const target = Number(latin);
  if (!Number.isFinite(target)) return;
  const decimals = (latin.split('.')[1] || '').length;
  const format = (v) => {
    const s = v.toFixed(decimals);
    return fa ? s.replace('.', '٫').replace(/\d/g, (d) => DIGITS[d]) : s;
  };
  const start = performance.now();
  const tick = (now) => {
    const p = Math.min(1, (now - start) / duration);
    const e = 1 - Math.pow(1 - p, 3);
    dd.textContent = p < 1 ? format(target * e) : final;
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function initMeasured({ ST, reduce }) {
  const metrics = document.querySelectorAll('[data-metric]');
  metrics.forEach((m) => {
    const scale = Number(m.dataset.scale) || 1;
    const set = () => {
      m.querySelector('.metric__bar--before').style.setProperty('--v', Math.min(1, Number(m.dataset.before) / scale));
      m.querySelector('.metric__bar--after').style.setProperty('--v', Math.min(1, Number(m.dataset.after) / scale));
      if (!reduce) m.querySelectorAll('.metric__vals dd').forEach((dd, i) => countUp(dd, 1100 + i * 250));
    };
    if (reduce || !ST) set();
    else ST.create({ trigger: m, start: 'top 85%', once: true, onEnter: set });
  });
}
