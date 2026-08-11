#!/usr/bin/env node
/**
 * Checks every concepts/<slug>/concept.json before it can reach the site.
 *
 *   node .github/scripts/validate.mjs
 *
 * Runs on every pull request that touches a concept, and again before each
 * deploy. No dependencies — plain Node, so it works with a bare checkout.
 */

import { loadConcepts } from './concepts.mjs';

const { concepts, errors, warnings } = loadConcepts();

for (const message of warnings) console.warn(`warning  ${message}`);

if (errors.length) {
  for (const message of errors) console.error(`error    ${message}`);
  console.error(`\n${errors.length} problem${errors.length === 1 ? '' : 's'} found.`);
  process.exit(1);
}

const explorations = concepts.reduce((total, concept) => total + concept.explorations.length, 0);
console.log(
  `Valid — ${concepts.length} concept${concepts.length === 1 ? '' : 's'}, ` +
  `${explorations} exploration${explorations === 1 ? '' : 's'}, ` +
  `${warnings.length} warning${warnings.length === 1 ? '' : 's'}.`
);
