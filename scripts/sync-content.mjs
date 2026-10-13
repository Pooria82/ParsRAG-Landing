// Pulls the latest ParsRAG release and the documents the site quotes from it into
// src/content/upstream/. The build only reads that snapshot, so it still works offline;
// CI runs this first so the published site follows each new release.
// Usage: node scripts/sync-content.mjs [tag]
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = 'Pooria82/ParsRAG';
const FILES = [
  'README.md', 'README.fa.md', 'CHANGELOG.md', 'LICENSE', 'CITATION.cff', 'SECURITY.md',
  'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md', 'NOTICE.md', 'ARCHITECTURE.md', 'DATA.md', '.env.example',
  'pyproject.toml', 'compose.yaml', '.github/workflows/quality.yml',
  'backend/infrastructure/parsers/ocr.py', 'backend/tests/e2e/test_end_to_end.py',
];

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'src', 'content', 'upstream');
const headers = { 'User-Agent': 'parsrag-landing-sync', Accept: 'application/vnd.github+json' };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

async function get(url, as = 'text') {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return as === 'json' ? res.json() : res.text();
}

const requested = process.argv[2];
const release = requested
  ? await get(`https://api.github.com/repos/${REPO}/releases/tags/${requested}`, 'json')
  : await get(`https://api.github.com/repos/${REPO}/releases/latest`, 'json');

await mkdir(out, { recursive: true });
for (const file of FILES) {
  const text = await get(`https://raw.githubusercontent.com/${REPO}/${release.tag_name}/${file}`);
  await mkdir(dirname(join(out, file)), { recursive: true });
  await writeFile(join(out, file), text.replace(/\r\n/g, '\n'));
}
await writeFile(
  join(out, 'release.json'),
  `${JSON.stringify({
    tag: release.tag_name,
    version: release.tag_name.replace(/^v/, ''),
    name: release.name,
    published: release.published_at,
    url: release.html_url,
  }, null, 2)}\n`,
);
console.log(`Synced ${REPO} ${release.tag_name} (${FILES.length} files)`);
