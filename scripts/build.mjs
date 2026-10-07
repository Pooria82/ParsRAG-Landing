// Builds the static bilingual site into dist/ from src/page.html and the i18n dictionaries.
// No dependencies: `node scripts/build.mjs`.
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const dist = join(root, 'dist');
const SITE = 'https://pooria82.github.io/ParsRAG/';

const template = await readFile(join(src, 'page.html'), 'utf8');

const partials = {};
for (const file of await readdir(join(src, 'partials'))) {
  partials[file.replace(/\.svg$/, '')] = (await readFile(join(src, 'partials', file), 'utf8')).trim();
}

const lookup = (dict, path) => path.split('.').reduce((node, key) => (node == null ? undefined : node[key]), dict);

function render(dict) {
  const missing = new Set();
  const html = template
    .replace(/\{\{@([\w-]+)\}\}/g, (_, name) => {
      if (!(name in partials)) missing.add(`@${name}`);
      return partials[name] ?? '';
    })
    .replace(/\{\{([\w.]+)\}\}/g, (_, path) => {
      const value = lookup(dict, path);
      if (typeof value !== 'string') missing.add(path);
      return value ?? '';
    });
  if (missing.size) throw new Error(`[${dict.lang}] unresolved keys: ${[...missing].join(', ')}`);
  return html;
}

await rm(dist, { recursive: true, force: true });
await mkdir(join(dist, 'fa'), { recursive: true });
await cp(join(src, 'static'), dist, { recursive: true });

for (const [lang, out] of [['en', 'index.html'], ['fa', 'fa/index.html']]) {
  const dict = JSON.parse(await readFile(join(src, 'i18n', `${lang}.json`), 'utf8'));
  await writeFile(join(dist, out), render(dict));
}

const alternates = ['en', 'fa', 'x-default']
  .map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${SITE}${l === 'fa' ? 'fa/' : ''}"/>`)
  .join('\n');
const urls = [SITE, `${SITE}fa/`]
  .map((loc) => `  <url>\n    <loc>${loc}</loc>\n${alternates}\n  </url>`)
  .join('\n');
await writeFile(
  join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`,
);
await writeFile(join(dist, '.nojekyll'), '');

console.log('Built dist/ (en, fa)');
