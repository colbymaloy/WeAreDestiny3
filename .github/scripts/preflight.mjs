#!/usr/bin/env node
/**
 * Production readiness check.
 *
 *   node .github/scripts/preflight.mjs
 *
 * Concepts live in Firestore now, so this checks the things that ship from
 * this repository: the shared renderer, the static shell, the share card, and
 * whether the server has everything it needs bundled.
 */

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = p => readFileSync(join(ROOT, p), 'utf8');
const has = p => existsSync(join(ROOT, p));

const blockers = [];
const advisories = [];
const passed = [];
const check = (label, ok, detail, blocking = true) => {
  if (ok) passed.push(label);
  else (blocking ? blockers : advisories).push(`${label} — ${detail}`);
};

/* --- the shared renderer must stay pure ---------------------------------- */

for (const file of ['model.mjs', 'graph.mjs', 'render.mjs']) {
  const src = has(`shared/${file}`) ? read(`shared/${file}`) : '';
  check(`shared/${file} exists`, Boolean(src), 'missing');
  if (src) {
    check(`shared/${file} has no Node dependencies`, !/from 'node:/.test(src),
      'it must run unchanged in the browser and on the server');
  }
}

/* --- the server bundles what it renders from ------------------------------ */

const bundled = ['model.mjs', 'graph.mjs', 'render.mjs'].every(f => has(`functions/${f}`));
check('Server bundle present', bundled && has('functions/templates'),
  'run `npm --prefix functions run bundle`', false);

if (bundled) {
  for (const file of ['model.mjs', 'graph.mjs', 'render.mjs']) {
    check(`functions/${file} in sync`, read(`functions/${file}`) === read(`shared/${file}`),
      `differs from shared/${file} — run \`npm --prefix functions run bundle\``);
  }
}

/* --- share previews ------------------------------------------------------- */

const CARD = 'media/branding/social-card.jpg';
check('Social card exists', has(CARD), `${CARD} is the default og:image`);
if (has(CARD)) {
  const kb = statSync(join(ROOT, CARD)).size / 1024;
  check('Social card is a sane size', kb < 900, `${kb.toFixed(0)} KB`, false);
}
check('README banner exists', has('media/branding/banner.jpg'), 'missing', false);

/* --- config --------------------------------------------------------------- */

const config = has('src/assets/firebase-config.js') ? read('src/assets/firebase-config.js') : '';
check('Firebase web config filled in', /apiKey:\s*'[^']+'/.test(config),
  'src/assets/firebase-config.js has no apiKey');
check('Firebase project alias set', has('.firebaserc'), 'missing');
check('Hosting configured', has('firebase.json') && read('firebase.json').includes('"hosting"'),
  'firebase.json has no hosting block');

/* --- nothing large committed ---------------------------------------------- */

const walk = dir => !existsSync(dir) ? [] : readdirSync(dir, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
const heavy = walk(join(ROOT, 'media')).filter(f => statSync(f).size > 5 * 1024 * 1024);
check('No oversized committed media', heavy.length === 0,
  `${heavy.map(f => f.slice(ROOT.length + 1)).join(', ')} over 5 MB`, false);

/* --- report --------------------------------------------------------------- */

const line = '─'.repeat(64);
console.log(`\n${line}\nPreflight\n${line}`);
for (const l of passed) console.log(`  ok        ${l}`);
for (const a of advisories) console.log(`  advisory  ${a}`);
for (const b of blockers) console.log(`  BLOCKER   ${b}`);
console.log(line);

if (blockers.length) {
  console.error(`${blockers.length} blocker(s). Do not deploy.\n`);
  process.exit(1);
}
console.log(advisories.length
  ? `Ready to deploy. ${advisories.length} advisory item(s).\n`
  : 'Ready to deploy.\n');
