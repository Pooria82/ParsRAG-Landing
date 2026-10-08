// Live demo: ask sample documents in the browser. Retrieval is a real (small) BM25 search
// with ParsRAG-style normalization; answers to the suggested questions are pre-written,
// typed questions are answered extractively from the passages found. Every citation
// opens the cited passage in the source viewer and is tied to it by a gold thread.
import { createIndex, parseMentions, hasEvidence } from './retrieval.js';
import { clamp, localDigits } from './util.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MODES = ['strict', 'hybrid', 'free'];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function initPlayground({ gsap, ST, reduce, rtl, lang }) {
  const root = document.querySelector('[data-playground]');
  if (!root) return;
  const T = JSON.parse(root.querySelector('[data-pg-strings]').textContent);
  const el = (sel) => root.querySelector(sel);
  const cases = el('[data-pg-cases]');
  const docsBar = el('[data-pg-docs]');
  const feed = el('[data-pg-feed]');
  const suggest = el('[data-pg-suggest]');
  const form = el('[data-pg-form]');
  const input = el('[data-pg-input]');
  const mentionList = el('[data-pg-mentions]');
  const modeGroup = el('[data-pg-modes]');
  const sendBtn = el('[data-pg-send]');
  const viewer = el('[data-pg-viewer]');
  const viewerBody = el('[data-pg-viewer-body]');
  const viewerHead = el('[data-pg-viewer-head]');
  const compareBtn = el('[data-pg-compare]');
  const compareBox = el('[data-pg-compare-box]');
  const svg = el('.pg__threads');
  const stage = el('.pg__stage');

  let data;
  try {
    data = await (await fetch(root.dataset.src)).json();
  } catch {
    feed.innerHTML = `<p class="pg__error">${esc(T.loadError)}</p>`;
    return;
  }

  const n = (v) => localDigits(v, lang);
  let corpus = null;
  let index = null;
  let mode = 'strict';
  let busy = false;
  let last = null; // { question, preset }
  let runId = 0;

  // ---------- Corpus (use case) switching ----------

  cases.innerHTML = data.corpora.map((c, i) => `<button type="button" role="tab" class="pg__case" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-case="${c.id}">${esc(c.label)}</button>`).join('');
  const caseButtons = [...cases.querySelectorAll('[data-case]')];
  caseButtons.forEach((b, i) => {
    b.addEventListener('click', () => selectCorpus(i, true));
    b.addEventListener('keydown', (e) => {
      const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      const j = (i + step + caseButtons.length) % caseButtons.length;
      caseButtons[j].focus();
      selectCorpus(j, true);
    });
  });

  function selectCorpus(i, fromUser) {
    runId++;
    busy = false;
    corpus = data.corpora[i];
    index = createIndex(corpus.passages, data.stopwords);
    caseButtons.forEach((b, j) => { b.setAttribute('aria-selected', String(j === i)); b.tabIndex = j === i ? 0 : -1; });
    docsBar.innerHTML = corpus.docs.map((d) => `<span class="pg__doc"><span class="pg__type pg__type--${d.type.toLowerCase()}">${d.type}</span><bdi>${esc(d.name)}</bdi></span>`).join('');
    suggest.querySelector('[data-pg-suggest-list]').innerHTML = corpus.questions
      .map((q, k) => `<button type="button" class="pg__q" data-q="${k}">${renderQuestion(q.q)}</button>`).join('');
    suggest.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => ask(corpus.questions[+b.dataset.q].q)));
    feed.innerHTML = `<p class="pg__empty">${esc(T.empty)}</p>`;
    closeViewer(true);
    compareBox.hidden = true;
    compareBtn.hidden = true;
    clearThreads();
    if (fromUser && !reduce) gsap.fromTo(suggest.querySelectorAll('.pg__q'), { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, stagger: 0.06, duration: 0.4, ease: 'power2.out' });
  }

  const renderQuestion = (q) => esc(q).replace(/@\{([^}]+)\}/g, '<span class="pg__mention"><bdi>@$1</bdi></span>');

  // ---------- Mode switch ----------

  const modeButtons = [...modeGroup.querySelectorAll('[data-mode]')];
  modeButtons.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode, true)));
  function setMode(m, rerun) {
    mode = m;
    modeButtons.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === m)));
    if (rerun && last && !busy) ask(last.question);
  }

  // ---------- @ mentions in the composer ----------

  let mentionIndex = 0;
  let mentionMatch = null;
  const mentionRe = /(?:^|[\s([{])(@([^\n@{}]{0,80}))$/;
  function updateMentions() {
    const before = input.value.slice(0, input.selectionStart);
    const m = before.match(mentionRe);
    if (!m) return hideMentions();
    const query = m[2].toLowerCase();
    const items = corpus.docs.filter((d) => d.name.toLowerCase().includes(query)).slice(0, 8);
    mentionMatch = { start: before.length - m[1].length, end: before.length, items };
    mentionIndex = 0;
    mentionList.innerHTML = items.length
      ? items.map((d, i) => `<li role="option" id="pg-m-${i}" aria-selected="${i === 0}" data-i="${i}"><span class="pg__type pg__type--${d.type.toLowerCase()}">${d.type}</span><bdi>${esc(d.name)}</bdi></li>`).join('')
      : `<li class="pg__mentions-empty">${esc(T.noMentions)}</li>`;
    mentionList.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    input.setAttribute('aria-activedescendant', items.length ? 'pg-m-0' : '');
    mentionList.querySelectorAll('[data-i]').forEach((li) => li.addEventListener('mousedown', (e) => { e.preventDefault(); pickMention(+li.dataset.i); }));
  }
  function hideMentions() {
    mentionMatch = null;
    mentionList.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }
  function pickMention(i) {
    const d = mentionMatch?.items[i];
    if (!d) return;
    const text = `@{${d.name.replace(/[{}]/g, '\\$&')}} `;
    input.value = input.value.slice(0, mentionMatch.start) + text + input.value.slice(mentionMatch.end);
    const caret = mentionMatch.start + text.length;
    input.setSelectionRange(caret, caret);
    hideMentions();
    input.focus();
  }
  input.addEventListener('input', updateMentions);
  input.addEventListener('click', updateMentions);
  input.addEventListener('blur', () => setTimeout(hideMentions, 120));
  input.addEventListener('keydown', (e) => {
    if (mentionMatch && mentionMatch.items.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        mentionIndex = (mentionIndex + (e.key === 'ArrowDown' ? 1 : -1) + mentionMatch.items.length) % mentionMatch.items.length;
        mentionList.querySelectorAll('[data-i]').forEach((li, i) => li.setAttribute('aria-selected', String(i === mentionIndex)));
        input.setAttribute('aria-activedescendant', `pg-m-${mentionIndex}`);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pickMention(mentionIndex); return; }
    }
    if (e.key === 'Escape') hideMentions();
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q || busy) return;
    input.value = '';
    hideMentions();
    ask(q);
  });

  // ---------- Answering ----------

  /** Builds an answer: { segments: [{kind:'doc'|'model'|'note', text, cite:[n]}], sources, consulted, badge, message } */
  function compose(question, m) {
    const preset = corpus.questions.find((p) => p.q === question);
    const byId = Object.fromEntries(corpus.passages.map((p) => [p.id, p]));
    const sources = [];
    const cite = (ids) => ids.map((id) => {
      if (!sources.includes(id)) sources.push(id);
      return sources.indexOf(id) + 1;
    });

    // Retrieval runs for every mode except Open conversation, so "passages consulted" is real.
    const clauses = parseMentions(question, corpus.docs);
    const retrieved = m === 'free' ? [] : clauses.map((c) => ({ clause: c, ...index.search(c.text, c.doc) }));
    const consultedIds = [...new Set(retrieved.flatMap((r) => r.results.slice(0, 3).map((x) => x.passage.id)))];

    if (m === 'free') {
      return { segments: [{ kind: 'note', text: data.free }], sources: [], consulted: [], badge: 'general' };
    }

    let segments;
    let badge;
    let message = null;
    if (preset) {
      const plan = m === 'hybrid' && preset.hybrid ? preset.hybrid : preset.strict;
      const gap = plan.some((s) => s.gap);
      if (gap && m === 'strict') {
        message = clauses.some((c) => c.doc) ? T.outcomes.partial : T.outcomes.noEvidence;
        segments = [];
        badge = 'notFound';
      } else {
        segments = plan.map((s) => (s.doc ? { kind: 'doc', text: s.doc, cite: cite(s.cite) } : { kind: 'model', text: s.model }));
        badge = m === 'hybrid' && preset.hybrid ? (preset.hybridOutcome === 'model' ? 'general' : 'hybrid') : m === 'hybrid' ? 'hybrid' : 'documents';
      }
    } else {
      // Typed question: answer each clause from its best passage, or admit there is no evidence.
      segments = [];
      let missing = 0;
      for (const r of retrieved) {
        const top = r.results[0];
        if (hasEvidence(top)) {
          segments.push({ kind: 'doc', text: top.passage.answer || top.passage.text, cite: cite([top.passage.id]) });
          const second = r.results[1];
          if (second && second.score >= top.score * 0.8 && hasEvidence(second)) {
            segments.push({ kind: 'doc', text: second.passage.answer || second.passage.text, cite: cite([second.passage.id]) });
          }
        } else {
          missing++;
          if (m === 'hybrid') segments.push({ kind: 'model', text: T.hybridNoModel });
        }
      }
      if (m === 'strict' && missing) {
        message = clauses.length > 1 && clauses.some((c) => c.doc) ? T.outcomes.partial : T.outcomes.noEvidence;
        segments = [];
        badge = 'notFound';
      } else if (m === 'hybrid') {
        badge = segments.some((s) => s.kind === 'doc') ? 'hybrid' : 'general';
      } else {
        badge = 'documents';
      }
    }
    const consulted = consultedIds.filter((id) => !sources.includes(id));
    return { segments, sources: sources.map((id) => byId[id]), consulted: consulted.map((id) => byId[id]), badge, message };
  }

  async function ask(question) {
    const id = ++runId;
    busy = true;
    sendBtn.disabled = true;
    last = { question };
    clearThreads();
    closeViewer(true);
    compareBox.hidden = true;
    const answer = compose(question, mode);
    const stages = mode === 'free' ? ['understanding', 'generating'] : ['understanding', 'retrieving', 'generating'];

    feed.innerHTML = `
      <div class="pg__msg pg__msg--user"><p dir="auto">${renderQuestion(question)}</p></div>
      <div class="pg__msg pg__msg--answer">
        <p class="pg__byline">${esc(T.brand)}<span class="pg__badge" hidden></span></p>
        <ol class="pg__stages">${stages.map((s) => `<li data-stage="${s}">${esc(T.stages[s])}</li>`).join('')}</ol>
        <div class="pg__answer" dir="auto"></div>
        <div class="pg__sources" hidden></div>
      </div>`;
    const stageEls = [...feed.querySelectorAll('[data-stage]')];
    const answerEl = feed.querySelector('.pg__answer');
    const live = id === runId;

    for (const li of stageEls) {
      if (!live || id !== runId) return;
      li.classList.add('is-active');
      await wait(reduce ? 0 : 520);
      li.classList.remove('is-active');
      li.classList.add('is-done');
    }
    if (id !== runId) return;
    feed.querySelector('.pg__stages').classList.add('is-collapsed');

    if (answer.message) {
      answerEl.innerHTML = `<p class="pg__outcome">${esc(answer.message)}</p>`;
    } else {
      answerEl.innerHTML = answer.segments.map((s) => {
        const chips = (s.cite || []).map((k) => `<button type="button" class="pg__chip" data-cite="${k}" aria-label="${esc(T.showSource.replace('{n}', n(k)))}">${n(k)}</button>`).join('');
        return `<span class="pg__seg pg__seg--${s.kind}">${esc(s.text)}</span>${chips} `;
      }).join('');
    }
    // Stream the words in, the way ParsRAG 1.0 streams tokens.
    const words = [];
    answerEl.querySelectorAll('.pg__seg, .pg__outcome').forEach((seg) => {
      const parts = seg.textContent.split(/(\s+)/);
      seg.textContent = '';
      parts.forEach((p) => {
        if (/^\s+$/.test(p) || !p) { seg.append(p); return; }
        const w = document.createElement('span');
        w.className = 'w';
        w.textContent = p;
        seg.append(w);
        words.push(w);
      });
    });
    const chips = [...answerEl.querySelectorAll('.pg__chip')];
    if (!reduce) {
      gsap.set([...words, ...chips], { autoAlpha: 0 });
      const tl = gsap.timeline();
      tl.to(words, { autoAlpha: 1, duration: 0.18, stagger: 0.045, ease: 'none' });
      chips.forEach((c) => {
        const prevWord = c.previousElementSibling?.querySelector('.w:last-child');
        const at = prevWord ? words.indexOf(prevWord) * 0.045 + 0.1 : 0;
        tl.fromTo(c, { autoAlpha: 0, scale: 0.4 }, { autoAlpha: 1, scale: 1, duration: 0.3, ease: 'back.out(3)' }, at);
      });
      await new Promise((r) => tl.eventCallback('onComplete', r));
    }
    if (id !== runId) return;

    const badge = feed.querySelector('.pg__badge');
    const count = answer.sources.length;
    badge.hidden = false;
    badge.className = `pg__badge pg__badge--${answer.badge}`;
    badge.textContent = T.badges[answer.badge] + (count && answer.badge !== 'general' ? ` · ${T.sourceCount.replace('{count}', n(count))}` : '');

    renderSources(feed.querySelector('.pg__sources'), answer);
    chips.forEach((c) => c.addEventListener('click', () => openSource(answer.sources[+c.dataset.cite - 1], c)));
    busy = false;
    sendBtn.disabled = false;
    compareBtn.hidden = false;
    // Open the first citation so the thread is visible without a click.
    if (chips[0] && window.matchMedia('(min-width: 1000px)').matches) openSource(answer.sources[0], chips[0]);
  }

  function renderSources(box, answer) {
    if (!answer.sources.length && !answer.consulted.length) return;
    box.hidden = false;
    const card = (p, k) => {
      const doc = corpus.docs.find((d) => d.id === p.doc);
      return `<li><button type="button" class="pg__src" data-pid="${p.id}">${k ? `<span class="pg__src-n">${n(k)}</span>` : ''}<span class="pg__src-text">${esc(p.text.slice(0, 110))}${p.text.length > 110 ? '…' : ''}</span><span class="pg__src-loc"><bdi>${esc(doc.name)}</bdi> · ${esc(T.loc[p.loc])} ${n(p.n)}</span></button></li>`;
    };
    box.innerHTML = `${answer.sources.length ? `<p class="pg__src-title">${esc(T.sourcesTitle)}</p><ol class="pg__src-list">${answer.sources.map((p, i) => card(p, i + 1)).join('')}</ol>` : ''}
      ${answer.consulted.length ? `<details class="pg__more"><summary>${esc(T.more.replace('{count}', n(answer.consulted.length)))}</summary><ul class="pg__src-list">${answer.consulted.map((p) => card(p, 0)).join('')}</ul></details>` : ''}`;
    box.querySelectorAll('[data-pid]').forEach((b) => b.addEventListener('click', () => openSource(corpus.passages.find((p) => p.id === b.dataset.pid), b)));
  }

  // ---------- Source viewer and threads ----------

  let activeThread = null;
  function openSource(passage, from) {
    if (!passage) return;
    const doc = corpus.docs.find((d) => d.id === passage.doc);
    const pages = corpus.passages.filter((p) => p.doc === doc.id);
    viewerHead.innerHTML = `<span class="pg__type pg__type--${doc.type.toLowerCase()}">${doc.type}</span><bdi class="pg__viewer-name">${esc(doc.name)}</bdi><span class="pg__viewer-loc">${esc(T.loc[passage.loc])} ${n(passage.n)}</span>`;
    viewerBody.innerHTML = `<p class="pg__viewer-title">${esc(doc.title)}</p>${pages.map((p) => `
      <section class="pg__page${p.id === passage.id ? ' is-cited' : ''}" data-page="${p.id}">
        <p class="pg__page-loc">${esc(T.loc[p.loc])} ${n(p.n)}</p>
        <p class="pg__page-text">${p.id === passage.id ? `<mark>${esc(p.text)}</mark>` : esc(p.text)}</p>
      </section>`).join('')}`;
    viewer.classList.add('is-open');
    viewer.setAttribute('aria-hidden', 'false');
    root.classList.add('has-viewer');
    root.querySelectorAll('.pg__chip, .pg__src').forEach((c) => c.classList.toggle('is-active', c === from));
    const target = viewerBody.querySelector('.is-cited');
    target.scrollIntoView({ block: 'nearest' });
    const mark = target.querySelector('mark');
    if (!reduce) gsap.fromTo(mark, { '--hl': 0 }, { '--hl': 1, duration: 0.6, ease: 'power2.out', delay: 0.15 });
    else mark.style.setProperty('--hl', 1);
    activeThread = { from, to: mark };
    drawThread(true);
    if (!window.matchMedia('(min-width: 1000px)').matches) viewer.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }
  function closeViewer(silent) {
    viewer.classList.remove('is-open');
    viewer.setAttribute('aria-hidden', 'true');
    root.classList.remove('has-viewer');
    activeThread = null;
    clearThreads();
    if (!silent) feed.querySelector('.pg__chip')?.focus();
  }
  el('[data-pg-viewer-close]').addEventListener('click', () => closeViewer(false));

  function clearThreads() { svg.replaceChildren(); }
  function drawThread(animate) {
    clearThreads();
    if (!activeThread || !window.matchMedia('(min-width: 1000px)').matches) return;
    const box = stage.getBoundingClientRect();
    const a = activeThread.from.getBoundingClientRect();
    const b = activeThread.to.getBoundingClientRect();
    if (!a.width || !b.width) return;
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    const toRight = b.left > a.right;
    const sx = (toRight ? a.right : a.left) - box.left;
    const sy = a.top + a.height / 2 - box.top;
    const ex = (toRight ? b.left : b.right) - box.left;
    const ey = clamp(b.top + Math.min(b.height, 24) / 2 - box.top, 0, box.height);
    const dx = (ex - sx) * 0.55;
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', `M${sx},${sy} C${sx + dx},${sy} ${ex - dx},${ey} ${ex},${ey}`);
    path.setAttribute('class', 'thread');
    path.setAttribute('pathLength', '1');
    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('class', 'thread-end');
    dot.setAttribute('cx', ex);
    dot.setAttribute('cy', ey);
    dot.setAttribute('r', 3.4);
    svg.append(path, dot);
    if (animate && !reduce) {
      gsap.fromTo(path, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.7, ease: 'power2.inOut' });
      gsap.fromTo(dot, { opacity: 0 }, { opacity: 1, delay: 0.6, duration: 0.2 });
    } else {
      path.style.strokeDashoffset = 0;
      dot.style.opacity = 1;
    }
  }
  new ResizeObserver(() => drawThread(false)).observe(stage);
  viewerBody.addEventListener('scroll', () => drawThread(false), { passive: true });
  el('[data-pg-feed]').addEventListener('scroll', () => drawThread(false), { passive: true });

  // ---------- Compare all three modes ----------

  compareBtn.addEventListener('click', () => {
    if (!last) return;
    compareBox.hidden = false;
    compareBox.innerHTML = MODES.map((m) => {
      const a = compose(last.question, m);
      const body = a.message
        ? `<p class="pg__outcome">${esc(a.message)}</p>`
        : a.segments.map((s) => `<span class="pg__seg pg__seg--${s.kind}">${esc(s.text)}</span>${(s.cite || []).map((k) => `<span class="pg__chip pg__chip--static">${n(k)}</span>`).join('')} `).join('');
      return `<article class="pg__cmp"><h4>${esc(T.modes[m])}</h4><p class="pg__badge pg__badge--${a.badge}">${esc(T.badges[a.badge])}</p><div class="pg__answer" dir="auto">${body}</div><dl class="pg__facts"><div><dt>${esc(T.retrieval)}</dt><dd>${esc(T.facts[m].r)}</dd></div><div><dt>${esc(T.knowledge)}</dt><dd>${esc(T.facts[m].k)}</dd></div></dl></article>`;
    }).join('');
    if (!reduce) gsap.fromTo(compareBox.children, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, stagger: 0.08, duration: 0.45, ease: 'power3.out' });
    compareBox.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  });

  // ---------- Start ----------

  selectCorpus(0, false);
  setMode('strict', false);
  // The first time the demo is seen, it asks the first suggested question by itself.
  ST.create({
    trigger: root,
    start: 'top 65%',
    once: true,
    onEnter: () => { if (!last) ask(corpus.questions[0].q); },
  });
}
