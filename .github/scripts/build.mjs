#!/usr/bin/env node
/**
 * Builds the static shell into _site/.
 *
 *   node .github/scripts/build.mjs
 *
 * Concepts and questions live in Firestore and are rendered by the server, so
 * this only produces what never changes: the standalone pages, the assets, and
 * a fallback landing page for when the database is unreachable.
 *
 * Both this and the server render through shared/render.mjs, so a page built
 * here and a page served live come out byte-identical.
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { renderLanding, resolveIncludes, SITE } from '../../shared/render.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = join(ROOT, 'src');
const TEMPLATES = join(SRC, '_templates');
const OUT = join(ROOT, '_site');

/* Partials are passed to the renderer rather than read by it. */
export function readPartials(dir = TEMPLATES) {
  return Object.fromEntries(
    readdirSync(dir).filter(f => f.endsWith('.html')).map(f => [f, readFileSync(join(dir, f), 'utf8')]));
}

const partials = readPartials();
const seed = JSON.parse(readFileSync(join(SRC, 'home-data.json'), 'utf8'));

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

cpSync(SRC, OUT, { recursive: true, filter: src => !src.startsWith(TEMPLATES) });
/* The renderer is pure, so the browser is a third caller alongside the build
   and the server — that is what lets the contribute form preview a concept
   through the same code that renders the real page. Extensions are kept so
   the modules' own relative imports resolve. */
for (const file of ['model.mjs', 'render.mjs', 'icons.mjs']) {
  cpSync(join(ROOT, 'shared', file), join(OUT, 'assets', file));
}
if (existsSync(join(ROOT, 'media'))) cpSync(join(ROOT, 'media'), join(OUT, 'media'), { recursive: true });
for (const file of ['CNAME', '.nojekyll']) {
  if (existsSync(join(ROOT, file))) cpSync(join(ROOT, file), join(OUT, file));
}

/* Landing fallback — the server renders this live from Firestore, but a
   static copy means the site still answers if the database is down. */
const landing = readFileSync(join(SRC, 'index.html'), 'utf8')
  .replace('<!--SLOT:LANDING-->', renderLanding({
    concepts: [], questions: [], stats: { concepts: 0, contributors: 0, connections: 0 }, seed,
  }));
writeFileSync(join(OUT, 'index.html'), resolveIncludes(landing, partials));

for (const page of ['about/index.html', 'contribute/index.html', 'publish/index.html', 'admin/index.html', '404.html']) {
  const file = join(OUT, page);
  if (existsSync(file)) writeFileSync(file, resolveIncludes(readFileSync(file, 'utf8'), partials));
}

writeFileSync(join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);

console.log(`Built static shell into _site/.`);
