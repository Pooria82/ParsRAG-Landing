// Builds the static bilingual site into dist/.
//
// Templates (src/pages/*.html) use three kinds of placeholders:
//   {{key.path}}   a string from the merged dictionaries in src/i18n/<lang>/*.json
//   {{@partial}}   the contents of src/partials/<partial>.(html|svg); partials may nest
//   {{ref:id}}     a numbered citation to src/content/claims.json, verified against the
//                  ParsRAG release snapshot in src/content/upstream (the build fails if
//                  a quoted sentence is not in the release)
// Run `node scripts/sync-content.mjs` first to refresh the snapshot from GitHub.
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';
import YAML from 'yaml';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const dist = join(root, 'dist');
const upstream = join(src, 'content', 'upstream');
const SITE = 'https://pooria82.github.io/ParsRAG-Landing/';
const REPO_URL = 'https://github.com/Pooria82/ParsRAG';

const LANGS = {
  en: { prefix: '', dir: 'ltr', locale: 'en-US' },
  fa: { prefix: 'fa/', dir: 'rtl', locale: 'fa-IR-u-ca-persian' },
};
const PAGES = [
  { id: 'home', path: '' },
  { id: 'tour', path: 'tour/' },
];

const read = (...p) => readFile(join(...p), 'utf8');
const readJSON = async (...p) => JSON.parse(await read(...p));
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const lookup = (dict, path) => path.split('.').reduce((node, key) => (node == null ? undefined : node[key]), dict);
const deepMerge = (a, b) => {
  for (const [k, v] of Object.entries(b)) {
    a[k] = v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' ? deepMerge(a[k], v) : v;
  }
  return a;
};
const digits = (s, lang) => (lang === 'fa' ? String(s).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]) : String(s));

// ---------- Upstream release ----------

const release = await readJSON(upstream, 'release.json');
const upstreamFiles = {};
for (const entry of await readdir(upstream, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || entry.name === 'release.json') continue;
  const rel = join(entry.parentPath, entry.name).slice(upstream.length + 1).replaceAll('\\', '/');
  upstreamFiles[rel] = (await read(upstream, rel)).replaceAll('\r\n', '\n');
}
const blobUrl = (file, from, to) => `${REPO_URL}/blob/${release.tag}/${file}${from ? `#L${from}${to && to !== from ? `-L${to}` : ''}` : ''}`;

// ---------- Claims: every quoted sentence must exist in the release ----------

const normalize = (s) => s.replace(/[`*_]/g, '').replace(/\s+/g, ' ').trim();
function locate(file, quote) {
  const text = upstreamFiles[file];
  if (text == null) throw new Error(`claims: ${file} is not in the upstream snapshot`);
  const lines = text.split('\n');
  const q = normalize(quote);
  // Find the shortest run of lines whose normalized text contains the quote.
  for (let i = 0; i < lines.length; i++) {
    let joined = '';
    for (let j = i; j < Math.min(lines.length, i + 12); j++) {
      joined = normalize(`${joined} ${lines[j]}`);
      if (joined.includes(q)) {
        let start = i;
        while (start < j && normalize(lines.slice(start + 1, j + 1).join(' ')).includes(q)) start++;
        return { from: start + 1, to: j + 1 };
      }
    }
  }
  throw new Error(`claims: quote not found in ${file} at ${release.tag}:\n  "${quote}"`);
}

const claimsSource = await readJSON(src, 'content', 'claims.json');
const claims = {};
for (const [id, byLang] of Object.entries(claimsSource)) {
  claims[id] = {};
  for (const [lang, c] of Object.entries(byLang)) {
    const { from, to } = locate(c.file, c.quote);
    claims[id][lang] = { file: c.file, quote: c.display || c.quote, translated: Boolean(c.display), from, to, url: blobUrl(c.file, from, to) };
  }
}

// ---------- Documents shown in dialogs ----------

const marked = new Marked({ gfm: true });
const mdToHtml = (md) => marked.parse(md)
  .replace(/<a href="(?!https?:|#|mailto:)([^"]+)"/g, (_, href) => `<a href="${REPO_URL}/blob/${release.tag}/${href}"`)
  .replace(/<a href="(https?:[^"]+)"/g, '<a href="$1" target="_blank" rel="noopener"');

function changelogSection(version) {
  const md = upstreamFiles['CHANGELOG.md'];
  const start = md.indexOf(`## [${version}]`);
  if (start < 0) return '';
  const next = md.indexOf('\n## [', start + 5);
  return md.slice(start, next < 0 ? undefined : next).replace(/^## \[[^\]]+\][^\n]*\n/, '');
}

function citationFormats() {
  const cff = YAML.parse(upstreamFiles['CITATION.cff']);
  const authors = cff.authors.map((a) => `${a['family-names']}, ${a['given-names']}`);
  const year = String(cff['date-released']).slice(0, 4);
  const bibtex = [
    `@software{${cff.authors[0]['family-names'].toLowerCase()}_parsrag_${year},`,
    `  author  = {${authors.join(' and ')}},`,
    `  title   = {${cff.title}},`,
    `  version = {${cff.version}},`,
    `  year    = {${year}},`,
    `  url     = {${cff['repository-code']}},`,
    '}',
  ].join('\n');
  const initials = cff.authors.map((a) => `${a['family-names']}, ${a['given-names'][0]}.`).join(', ');
  const apa = `${initials} (${year}). ${cff.title} (Version ${cff.version}) [Computer software]. ${cff['repository-code']}`;
  return { bibtex, apa };
}

async function buildDocs(lang, dict) {
  const outDir = join(dist, 'docs', lang);
  await mkdir(outDir, { recursive: true });
  const t = dict.docs;
  const fa = lang === 'fa';
  const official = (html) => (fa
    ? `<details class="doc-original" dir="ltr" lang="en"><summary dir="rtl" lang="fa">${t.showOriginal}</summary><div class="md">${html}</div></details>`
    : `<div class="md">${html}</div>`);
  const summary = async (id) => {
    if (!fa) return '';
    // Release notes are summarized per version; a newer release falls back to a short notice.
    const file = id === 'changelog' ? `changelog-${release.version}.md` : `${id}.md`;
    const md = await read(src, 'content', 'docs-fa', file).catch(() => (id === 'changelog' ? `> ${t.noSummary}` : null));
    if (md == null) throw new Error(`[fa] missing src/content/docs-fa/${file}`);
    return `<div class="md">${mdToHtml(md)}</div>`;
  };
  const { bibtex, apa } = citationFormats();

  const docs = {
    license: { file: 'LICENSE', body: `${await summary('license')}${official(`<pre class="legal">${escapeHtml(upstreamFiles.LICENSE)}</pre>`)}` },
    citation: {
      file: 'CITATION.cff',
      body: `<p>${escapeHtml(t.citeIntro)}</p>
        <div class="cite-block"><div class="cite-block__head"><span>APA</span><button type="button" class="copy-mini" data-copy-target="cite-apa">${escapeHtml(t.copy)}</button></div><p id="cite-apa" dir="ltr">${escapeHtml(apa)}</p></div>
        <div class="cite-block"><div class="cite-block__head"><span>BibTeX</span><button type="button" class="copy-mini" data-copy-target="cite-bib">${escapeHtml(t.copy)}</button></div><pre id="cite-bib" dir="ltr">${escapeHtml(bibtex)}</pre></div>
        <details class="doc-original" dir="ltr" lang="en"><summary${fa ? ' dir="rtl" lang="fa"' : ''}>CITATION.cff</summary><pre>${escapeHtml(upstreamFiles['CITATION.cff'])}</pre></details>`,
    },
    security: { file: 'SECURITY.md', body: `${await summary('security')}${official(mdToHtml(upstreamFiles['SECURITY.md']))}` },
    contributing: { file: 'CONTRIBUTING.md', body: `${await summary('contributing')}${official(mdToHtml(upstreamFiles['CONTRIBUTING.md']))}` },
    conduct: { file: 'CODE_OF_CONDUCT.md', body: `${await summary('conduct')}${official(mdToHtml(upstreamFiles['CODE_OF_CONDUCT.md']))}` },
    notice: { file: 'NOTICE.md', body: `${await summary('notice')}${official(mdToHtml(upstreamFiles['NOTICE.md']))}` },
    changelog: {
      file: 'CHANGELOG.md',
      body: `<p class="doc-meta">${escapeHtml(dict.release.name)}, ${escapeHtml(dict.release.date)}</p>${await summary('changelog')}${official(mdToHtml(changelogSection(release.version)))}`,
    },
  };
  for (const [id, d] of Object.entries(docs)) {
    const html = `<article class="doc-view" data-doc-id="${id}">
  <header class="doc-view__head"><h2 class="doc-view__title" id="doc-title">${escapeHtml(t.titles[id])}</h2>
  <a class="doc-view__source" href="${blobUrl(d.file)}" target="_blank" rel="noopener">${escapeHtml(t.viewSource)} <span dir="ltr">${d.file}</span></a></header>
  <div class="doc-view__body">${d.body}</div>
</article>\n`;
    await writeFile(join(outDir, `${id}.html`), html);
  }
}

// ---------- Product tour ----------

// Chapters are structured content in src/i18n/<lang>/tour.json. Text may contain {{keys}}
// and {{ref:id}} citations; they are resolved with the rest of the page.
function renderBlock(b, dict, lang) {
  if (b.h) return `</div><div class="tour__part"><h3 class="tour__h">${b.h}</h3>`;
  if (b.p) return `<p>${b.p}</p>`;
  if (b.note) return `<p class="tour__note">${b.note}</p>`;
  if (b.list) return `<ul class="tour__list">${b.list.map((li) => `<li>${li}</li>`).join('')}</ul>`;
  if (b.code) return `<pre class="tour__code" dir="ltr"><code>${escapeHtml(b.code)}</code></pre>`;
  if (b.kv) return `<dl class="tour__kv">${b.kv.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
  if (b.cards) return `<div class="tour__cards">${b.cards.map((c) => `<div class="tour__card"><h4>${c.t}</h4><p>${c.d}</p></div>`).join('')}</div>`;
  if (b.table) {
    const { head, rows } = b.table;
    return `<div class="tour__table" role="region" tabindex="0" aria-label="${escapeHtml(head.join(', '))}"><table><thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => (i === 0 ? `<th scope="row">${c}</th>` : `<td>${c}</td>`)).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  if (b.figure) {
    const f = b.figure;
    return `<figure class="tour__figure${f.narrow ? ' tour__figure--narrow' : ''}"><img src="{{root}}assets/img/shots/${f.src}.webp" alt="${escapeHtml(f.alt)}" loading="lazy" decoding="async" width="${f.narrow ? 580 : 1440}" height="${f.narrow ? 1000 : 900}"><figcaption>${f.cap}</figcaption></figure>`;
  }
  if (b.docs) {
    return `<p class="tour__docs">${b.docs.map((id) => `<a class="btn btn--line btn--sm" href="${REPO_URL}" data-doc="${id}">${escapeHtml(dict.docs.titles[id])}</a>`).join('')}</p>`;
  }
  throw new Error(`[${lang}] unknown tour block: ${JSON.stringify(b).slice(0, 80)}`);
}

function renderTour(dict, lang) {
  const chapters = dict.tour.chapters;
  const index = chapters
    .map((c, i) => `<li><a href="{{nav.tourHref}}#${c.id}"><span class="tour-index__n">${digits(i + 1, lang)}</span><span>${c.title}</span></a></li>`)
    .join('');
  const body = chapters.map((c, i) => `
      <section class="chapter" id="${c.id}" aria-labelledby="ch-${c.id}" data-chapter>
        <header class="chapter__head">
          <span class="chapter__n" aria-hidden="true">${digits(String(i + 1).padStart(2, '0'), lang)}</span>
          <h2 class="chapter__title" id="ch-${c.id}">${c.title}</h2>
          <p class="chapter__lede">${c.lede}</p>
        </header>
        <div class="chapter__body"><div class="tour__part">${c.blocks.map((b) => renderBlock(b, dict, lang)).join('')}</div></div>
      </section>`).join('\n');
  return { index, body };
}

// ---------- Templates ----------

const partials = {};
for (const file of await readdir(join(src, 'partials'))) {
  partials[file.replace(/\.(svg|html)$/, '')] = (await read(src, 'partials', file)).trim();
}

function render(template, dict, lang) {
  const tour = renderTour(dict, lang);
  let html = template.replace('<!--tour-index-->', tour.index).replace('<!--tour-body-->', tour.body);
  for (let pass = 0; pass < 6 && /\{\{@/.test(html); pass++) {
    html = html.replace(/\{\{@([\w-]+)\}\}/g, (_, name) => {
      if (!(name in partials)) throw new Error(`[${lang}] unknown partial @${name}`);
      return partials[name];
    });
  }
  const refs = [];
  html = html.replace(/\{\{ref:([\w-]+)\}\}/g, (_, id) => {
    const c = claims[id]?.[lang];
    if (!c) throw new Error(`[${lang}] claim "${id}" has no ${lang} source in claims.json`);
    if (!refs.includes(id)) refs.push(id);
    const n = digits(refs.indexOf(id) + 1, lang);
    return `<a class="ref" href="${c.url}" data-ref="${id}" aria-label="${escapeHtml(dict.refs.label)} ${n}"><span aria-hidden="true">${n}</span></a>`;
  });
  const missing = new Set();
  // {{json:path}} embeds a dictionary subtree as JSON, for strings that scripts need.
  html = html.replace(/\{\{json:([\w.]+)\}\}/g, (_, path) => {
    const value = lookup(dict, path);
    if (value === undefined) missing.add(`json:${path}`);
    return JSON.stringify(value ?? null).replace(/</g, '\\u003c');
  });
  html = html.replace(/\{\{([\w.]+)\}\}/g, (_, path) => {
    const value = lookup(dict, path);
    if (typeof value !== 'string' && typeof value !== 'number') missing.add(path);
    return value ?? '';
  });
  if (missing.size) throw new Error(`[${lang}] unresolved keys: ${[...missing].join(', ')}`);
  const refData = Object.fromEntries(refs.map((id) => [id, claims[id][lang]]));
  return html.replace('<!--refs-->', `<script type="application/json" id="refs-data">${JSON.stringify(refData).replace(/</g, '\\u003c')}</script>`);
}

async function loadDict(lang) {
  const dict = {};
  const dir = join(src, 'i18n', lang);
  for (const f of (await readdir(dir)).sort()) deepMerge(dict, await readJSON(dir, f));
  const published = new Date(release.published);
  dict.release = {
    ...dict.release,
    tag: release.tag,
    version: digits(release.version, lang),
    versionLatin: release.version,
    name: release.name,
    url: release.url,
    iso: release.published.slice(0, 10),
    date: new Intl.DateTimeFormat(LANGS[lang].locale, { year: 'numeric', month: 'long', day: 'numeric' }).format(published),
  };
  dict.repo = { url: REPO_URL, tag: release.tag };
  return dict;
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(join(src, 'static'), dist, { recursive: true });
// One stylesheet, concatenated from src/styles in name order.
const styleFiles = (await readdir(join(src, 'styles'))).filter((f) => f.endsWith('.css')).sort();
await mkdir(join(dist, 'assets', 'css'), { recursive: true });
await writeFile(join(dist, 'assets', 'css', 'site.css'), (await Promise.all(styleFiles.map((f) => read(src, 'styles', f)))).join('\n'));
await mkdir(join(dist, 'assets', 'demo'), { recursive: true });
for (const lang of Object.keys(LANGS)) await cp(join(src, 'content', 'demo', `${lang}.json`), join(dist, 'assets', 'demo', `${lang}.json`));

for (const [lang, L] of Object.entries(LANGS)) {
  const dict = await loadDict(lang);
  await buildDocs(lang, dict);
  for (const page of PAGES) {
    const template = await read(src, 'pages', `${page.id}.html`);
    const rel = `${L.prefix}${page.path}`;
    const up = '../'.repeat(rel.split('/').filter(Boolean).length);
    const otherLang = lang === 'en' ? 'fa' : 'en';
    const pageDict = {
      ...dict,
      lang,
      dir: L.dir,
      root: up,
      page: { id: page.id, url: `${SITE}${rel}`, ...dict.pages[page.id] },
      alt: {
        ...dict.alt,
        href: `${up}${LANGS[otherLang].prefix}${page.path}`,
        hrefEn: `${SITE}${page.path}`,
        hrefFa: `${SITE}fa/${page.path}`,
      },
      mock: dict.mock ? { ...dict.mock, cur: dict.mock[lang] } : undefined,
      nav: { ...dict.nav, home: `${up}${L.prefix}` || './', tourHref: `${up}${L.prefix}tour/` },
    };
    const out = join(dist, rel, 'index.html');
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, render(template, pageDict, lang));
  }
}

// ---------- Sitemap ----------

const urls = PAGES.flatMap((p) => ['', 'fa/'].map((prefix) => {
  const alternates = [['en', ''], ['fa', 'fa/'], ['x-default', '']]
    .map(([hl, pre]) => `    <xhtml:link rel="alternate" hreflang="${hl}" href="${SITE}${pre}${p.path}"/>`).join('\n');
  return `  <url>\n    <loc>${SITE}${prefix}${p.path}</loc>\n    <lastmod>${release.published.slice(0, 10)}</lastmod>\n${alternates}\n  </url>`;
}));
await writeFile(
  join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`,
);
await writeFile(join(dist, '.nojekyll'), '');
await writeFile(join(dist, 'release.json'), `${JSON.stringify(release)}\n`);

console.log(`Built dist/ for ${release.tag}: ${PAGES.length} pages x ${Object.keys(LANGS).length} languages, ${Object.keys(claims).length} verified claims`);
