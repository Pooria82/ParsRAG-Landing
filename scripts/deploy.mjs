// Replaces the landing page inside the ParsRAG repository's GitHub Pages folder with dist/.
// Usage: node scripts/deploy.mjs ../ParsRAG/docs
// Only landing-page files are replaced; docs such as architecture/, screenshots/ and *.md stay.
import { cp, readdir, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const target = process.argv[2] && resolve(process.argv[2]);
if (!target) {
  console.error('Usage: node scripts/deploy.mjs <path-to-ParsRAG/docs>');
  process.exit(1);
}
await stat(join(dist, 'index.html')).catch(() => {
  console.error('dist/ is missing; run `node scripts/build.mjs` first.');
  process.exit(1);
});

// Files and folders owned by the landing page.
const owned = ['index.html', 'fa', 'assets', 'sitemap.xml', '.nojekyll'];
for (const name of owned) await rm(join(target, name), { recursive: true, force: true });
for (const name of await readdir(dist)) await cp(join(dist, name), join(target, name), { recursive: true });

console.log(`Landing page deployed to ${target}`);
