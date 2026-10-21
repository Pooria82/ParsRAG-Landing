// Install terminal: commands for the visitor's system (PowerShell or a POSIX shell)
// and setup, taken from the ParsRAG README. Copy puts only the commands on the clipboard.
const REPO = 'https://github.com/Pooria82/ParsRAG.git';

function detectOS() {
  const p = `${navigator.userAgentData?.platform || ''} ${navigator.platform || ''} ${navigator.userAgent}`;
  if (/win/i.test(p)) return 'windows';
  if (/mac|iphone|ipad/i.test(p)) return 'macos';
  return 'linux';
}

function script(os, setup, t) {
  const lines = [];
  if (setup === 'host') lines.push({ c: t.cmt.pull }, { l: 'ollama pull qwen2.5:7b' });
  lines.push(
    { c: t.cmt.clone }, { l: `git clone ${REPO}` }, { l: 'cd ParsRAG' },
    { c: t.cmt.env }, { l: os === 'windows' ? 'Copy-Item .env.example .env' : 'cp .env.example .env' },
  );
  if (setup === 'host') {
    // The README's complete setup: the app reaches the computer's own Ollama.
    lines.push({ c: t.cmt.model });
    if (os === 'linux') lines.push({ c: t.cmt.linuxHost }, { l: 'sudo systemctl edit ollama.service' });
    lines.push({ c: t.cmt.run }, { l: 'docker compose up -d --build' });
  } else if (setup === 'cpu') {
    lines.push({ c: t.cmt.start },
      { l: 'docker compose --profile local-model up -d qdrant ollama' },
      { l: 'docker compose --profile local-model run --rm ollama-init' },
      { l: 'docker compose --profile local-model up -d --build app' });
  } else {
    lines.push({ c: t.cmt.apiEnv }, { c: t.cmt.apiStart }, { l: 'docker compose up -d --build' });
  }
  return lines;
}

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

export function initTerminal({ gsap, ST, reduce }) {
  const root = document.querySelector('[data-term]');
  if (!root) return;
  const t = JSON.parse(root.querySelector('[data-term-strings]').textContent);
  const out = root.querySelector('[data-term-out]');
  const osButtons = [...root.querySelectorAll('[data-os]')];
  const setupButtons = [...root.querySelectorAll('[data-setup]')];
  const copyBtn = root.querySelector('[data-copy-btn]');
  const copyLabel = root.querySelector('[data-copy-label]');
  let os = detectOS();
  let setup = 'host';
  let current = [];

  const render = (animate) => {
    current = script(os, setup, t);
    out.style.setProperty('--prompt', os === 'windows' ? '"PS> "' : '"$ "');
    out.innerHTML = `<code>${current.map((x) => (x.l ? `<span class="l">${esc(x.l)}</span>` : x.c ? `<span class="c"># ${esc(x.c)}</span>` : `<span class="note">${esc(x.note)}</span>`)).join('')}</code>`;
    osButtons.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.os === os)));
    setupButtons.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.setup === setup)));
    if (animate && !reduce) {
      const lines = out.querySelectorAll('.l, .c, .note');
      gsap.fromTo(lines, { autoAlpha: 0, x: -6 }, { autoAlpha: 1, x: 0, duration: 0.25, stagger: 0.035, ease: 'power2.out' });
    }
  };

  const radios = (buttons, key, set) => {
    buttons.forEach((b, i) => {
      b.tabIndex = 0;
      b.addEventListener('click', () => { set(b.dataset[key]); render(true); });
      b.addEventListener('keydown', (e) => {
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (!step) return;
        e.preventDefault();
        const dir = document.documentElement.dir === 'rtl' && /Left|Right/.test(e.key) ? -step : step;
        const next = buttons[(i + dir + buttons.length) % buttons.length];
        next.focus();
        next.click();
      });
    });
  };
  radios(osButtons, 'os', (v) => { os = v; });
  radios(setupButtons, 'setup', (v) => { setup = v; });
  render(false);

  // First view: type the commands in, line by line.
  if (!reduce && ST) {
    const lines = out.querySelectorAll('.l, .c');
    gsap.set(lines, { clipPath: 'inset(0 100% 0 0)' });
    ST.create({
      trigger: root,
      start: 'top 75%',
      once: true,
      onEnter: () => {
        const tl = gsap.timeline();
        lines.forEach((line) => {
          const n = line.textContent.length + 2;
          tl.to(line, { clipPath: 'inset(0 0% 0 0)', duration: Math.min(0.8, n * 0.012), ease: `steps(${n})` }, '+=0.06');
        });
      },
    });
  }

  let resetTimer;
  copyBtn.addEventListener('click', async () => {
    const text = current.filter((x) => x.l).map((x) => x.l).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      copyLabel.textContent = t.copied;
    } catch {
      const r = document.createRange();
      r.selectNodeContents(out);
      getSelection().removeAllRanges();
      getSelection().addRange(r);
    }
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => { copyLabel.textContent = t.copy; }, 1800);
  });
}
