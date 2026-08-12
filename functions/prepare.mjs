#!/usr/bin/env node
/**
 * Copies everything the server renders from into functions/, because Firebase
 * packages only that directory at deploy time. Run by `npm run prepare`,
 * which firebase.json invokes as a predeploy hook.
 */
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

for (const file of ['model.mjs', 'graph.mjs', 'render.mjs', 'icons.mjs']) {
  cpSync(join(ROOT, 'shared', file), join(HERE, file));
}

rmSync(join(HERE, 'templates'), { recursive: true, force: true });
mkdirSync(join(HERE, 'templates'), { recursive: true });
cpSync(join(ROOT, 'src/_templates'), join(HERE, 'templates'), { recursive: true });

/* The landing shell, with its own head/body wrapper, minus the build slot. */
cpSync(join(ROOT, 'src/index.html'), join(HERE, 'index-shell.html'));
cpSync(join(ROOT, 'src/home-data.json'), join(HERE, 'home-data.json'));
/* seed-data.json already lives in functions/ and is committed. */

/* A tiny 404 the server can return without the static site. */
const notFound = readFileSync(join(ROOT, 'src/404.html'), 'utf8');
writeFileSync(join(HERE, 'templates/notfound.html'), notFound);

console.log('functions: renderer, templates and seed copied in');
