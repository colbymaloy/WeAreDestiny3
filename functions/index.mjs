/**
 * The server.
 *
 *   submitConcept  someone posts an idea            → Firestore, pending
 *   moderate       an admin approves or declines it → Firestore, published
 *   ssr            renders the board and every concept and question page
 *
 * Firestore is the database, Storage holds the media, Hosting serves the
 * static shell and rewrites the dynamic routes here. There is no GitHub
 * credential anywhere in this file.
 *
 * Pages render server-side rather than in the browser so every concept keeps
 * a real URL and its own share preview.
 */

import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validateShape, slugify, SLUG_PATTERN, handleProblem, foldHandle,
} from './model.mjs';
import {
  normalizeConcept, normalizeQuestion, linkGraph,
  sortConcepts, sortQuestions, projectStats,
} from './graph.mjs';
import {
  renderLanding, renderConceptPage, renderQuestionPage, renderBrowsePage, resolveIncludes,
} from './render.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATES = join(HERE, 'templates');

/* Copied in at deploy time by `npm run prepare`, so the server renders from
   exactly the files the static build uses. */
const partials = Object.fromEntries(
  readdirSync(TEMPLATES).filter(f => f.endsWith('.html'))
    .map(f => [f, readFileSync(join(TEMPLATES, f), 'utf8')]));
const shell = readFileSync(join(HERE, 'index-shell.html'), 'utf8');
const seed = JSON.parse(readFileSync(join(HERE, 'home-data.json'), 'utf8'));

/* One submission a minute, twelve a day. Generous for a person, useless for
   a script. */
const RATE = { perMinute: 1, perDay: 12 };

const ORIGINS = [
  'https://wearedestiny3.com',
  'https://www.wearedestiny3.com',
  'http://localhost:8000',
];

initializeApp();
const db = getFirestore();

const concepts = () => db.collection('concepts');
const questions = () => db.collection('questions');
const handles = () => db.collection('handles');
const publishers = () => db.collection('publishers');

/* =============================================================
   Submitting
   ============================================================= */

export const submitConcept = onRequest(
  { cors: ORIGINS, region: 'us-central1', memory: '512MiB', timeoutSeconds: 60 },
  async (request, response) => {
    if (request.method !== 'POST') return response.status(405).json({ error: 'Use POST.' });

    const user = await authenticate(request, response);
    if (!user) return;

    const limited = await overRateLimit(user.uid);
    if (limited) return response.status(429).json({ error: limited });

    const concept = request.body?.concept;
    if (!concept || typeof concept !== 'object') {
      return response.status(400).json({ error: 'No concept in the request.' });
    }

    /* The byline is whatever handle this account claimed. Dropping the
       submitted value is what makes posting as someone else impossible,
       rather than merely inconvenient. */
    delete concept.creator;
    const handle = (await publishers().doc(user.uid).get()).data()?.handle;
    if (!handle) {
      return response.status(403).json({ error: 'Choose a handle before posting.' });
    }
    concept.creator = handle;

    concept.slug = slugify(concept.slug || concept.title || '');
    if (!SLUG_PATTERN.test(concept.slug)) {
      return response.status(400).json({ problems: ['That title does not produce a usable web address.'] });
    }

    const problems = validateShape(concept);
    if (problems.length) return response.status(400).json({ problems });

    /* Media has to be files this person actually uploaded. */
    if (!mediaBelongsTo(concept, user.uid)) {
      return response.status(400).json({ problems: ['Media must be uploaded through this form.'] });
    }

    if ((await concepts().doc(concept.slug).get()).exists) {
      return response.status(409).json({
        problems: [`A concept called "${concept.slug}" already exists. Change the title.`],
      });
    }

    for (const connection of concept.connections ?? []) {
      const target = await concepts().doc(connection.concept).get();
      if (!target.exists || target.data().review !== 'published') {
        return response.status(400).json({
          problems: [`Cited concept "${connection.concept}" is not on the board.`],
        });
      }
    }

    /* `status` belongs to the concept (exploring/direction/refined).
       `review` is the moderation state. Keeping them separate stops an
       approval from overwriting what the author said about their own idea. */
    await concepts().doc(concept.slug).set({
      ...concept,
      review: 'pending',
      submittedBy: user.uid,
      submittedAt: FieldValue.serverTimestamp(),
    });
    await record(user.uid, concept.slug);

    return response.json({ slug: concept.slug, status: 'pending' });
  },
);

async function authenticate(request, response) {
  const header = request.get('authorization') || '';
  const idToken = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!idToken) {
    response.status(401).json({ error: 'Sign in first.' });
    return null;
  }
  try {
    return await getAuth().verifyIdToken(idToken);
  } catch {
    response.status(401).json({ error: 'Your session expired. Sign in again.' });
    return null;
  }
}

/** Every media URL must sit under this user's own upload prefix. */
function mediaBelongsTo(concept, uid) {
  const prefix = encodeURIComponent(`media/${uid}/`);
  const urls = [];
  for (const exploration of concept.explorations ?? []) {
    urls.push(exploration.media, exploration.thumbnail);
  }
  /* Body images go through the same check as explorations. Miss this and the
     image block becomes the one place a submission can point at someone
     else's file. */
  for (const block of concept.body ?? []) {
    if (block?.type === 'image') urls.push(block.media);
  }
  if (concept.cover && typeof concept.cover === 'object') {
    urls.push(concept.cover.media, concept.cover.thumbnail);
  }
  return urls.filter(Boolean).every(url =>
    url.startsWith('https://firebasestorage.googleapis.com/') && url.includes(prefix));
}

async function overRateLimit(uid) {
  const now = Date.now();
  const snapshot = await publishers().doc(uid).get();
  const data = snapshot.data() ?? {};
  if (data.blocked) return 'This account cannot submit.';

  const recent = (data.submissions ?? []).filter(t => now - t < 24 * 60 * 60 * 1000);
  if (recent.some(t => now - t < 60 * 1000 * RATE.perMinute)) {
    return 'You just submitted something. Give it a minute.';
  }
  if (recent.length >= RATE.perDay) return `That is ${RATE.perDay} concepts today. Try again tomorrow.`;
  return null;
}

const record = (uid, slug) => publishers().doc(uid).set({
  submissions: FieldValue.arrayUnion(Date.now()),
  last: { slug, at: FieldValue.serverTimestamp() },
}, { merge: true });

/* =============================================================
   Claiming a handle

   One per account, permanent. Permanence is what lets a handle on an old
   concept still mean the person who wrote it, and it keeps this endpoint a
   single transaction with no release path to get wrong.
   ============================================================= */

export const claimHandle = onRequest(
  { cors: ORIGINS, region: 'us-central1', memory: '256MiB', timeoutSeconds: 30 },
  async (request, response) => {
    if (request.method !== 'POST') return response.status(405).json({ error: 'Use POST.' });

    const user = await authenticate(request, response);
    if (!user) return;

    const wanted = String(request.body?.handle ?? '').trim();
    const problem = handleProblem(wanted);
    if (problem) return response.status(400).json({ error: problem });

    const key = foldHandle(wanted);

    try {
      await db.runTransaction(async tx => {
        const [mine, taken] = await Promise.all([
          tx.get(publishers().doc(user.uid)),
          tx.get(handles().doc(key)),
        ]);
        if (mine.data()?.handle) throw new Conflict('You already have a handle.');
        if (taken.exists) throw new Conflict('That handle is taken.');

        tx.set(handles().doc(key), { claimedAt: FieldValue.serverTimestamp() });
        tx.set(publishers().doc(user.uid), { handle: wanted }, { merge: true });
      });
    } catch (error) {
      if (error instanceof Conflict) return response.status(409).json({ error: error.message });
      throw error;
    }

    return response.json({ handle: wanted });
  },
);

class Conflict extends Error {}

/* =============================================================
   Moderating
   ============================================================= */

export const moderate = onRequest(
  { cors: ORIGINS, region: 'us-central1', memory: '256MiB', timeoutSeconds: 60 },
  async (request, response) => {
    const user = await authenticate(request, response);
    if (!user) return;

    /* Admins are an explicit allowlist in Firestore, added by hand. */
    if (!(await db.collection('admins').doc(user.uid).get()).exists) {
      return response.status(403).json({ error: 'Not an admin.' });
    }

    if (request.method === 'GET') {
      const pending = await concepts().where('review', '==', 'pending').get();
      return response.json({
        pending: pending.docs.map(d => {
          const { submittedAt, ...rest } = d.data();
          return rest;
        }),
      });
    }

    const { slug, action, reason } = request.body ?? {};
    if (!SLUG_PATTERN.test(String(slug ?? ''))) {
      return response.status(400).json({ error: 'Bad slug.' });
    }

    const patch = {
      reviewedBy: user.uid,
      reviewedAt: FieldValue.serverTimestamp(),
    };

    if (action === 'approve') {
      Object.assign(patch, { review: 'published', date: new Date().toISOString().slice(0, 10) });
    } else if (action === 'decline') {
      Object.assign(patch, { review: 'declined', reason: String(reason ?? '').slice(0, 500) });
    } else {
      return response.status(400).json({ error: 'action must be approve or decline.' });
    }

    await concepts().doc(slug).update(patch);
    return response.json({ slug, action });
  },
);

/* =============================================================
   Rendering
   ============================================================= */

async function loadBoard() {
  const [conceptDocs, questionDocs] = await Promise.all([
    concepts().where('review', '==', 'published').get(),
    questions().get(),
  ]);

  const list = conceptDocs.docs.map(d => normalizeConcept(d.data()));
  const qs = questionDocs.docs.map(d => normalizeQuestion(d.data()));
  linkGraph(list, qs);
  sortConcepts(list);
  sortQuestions(qs);
  return { concepts: list, questions: qs, stats: projectStats(list, qs) };
}

const landingHtml = board =>
  resolveIncludes(shell.replace('<!--SLOT:LANDING-->', renderLanding({ ...board, seed })), partials);

export const ssr = onRequest(
  { region: 'us-central1', memory: '512MiB', timeoutSeconds: 60, concurrency: 40 },
  async (request, response) => {
    /* Held at the CDN for five minutes, so a burst of traffic does not become
       a burst of Firestore reads. */
    response.set('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600');

    const path = (request.path || '/').replace(/\/+$/, '') || '/';

    try {
      const board = await loadBoard();

      if (path === '/') return response.status(200).send(landingHtml(board));

      if (path === '/concepts') {
        return response.status(200).send(renderBrowsePage(board, {
          template: partials['browse.html'], partials, query: request.query ?? {},
        }));
      }

      const conceptMatch = /^\/concepts\/([a-z0-9-]+)$/.exec(path);
      if (conceptMatch) {
        const concept = board.concepts.find(c => c.slug === conceptMatch[1]);
        if (!concept) return notFound(response);
        const questionsBySlug = Object.fromEntries(board.questions.map(q => [q.slug, q]));
        return response.status(200).send(renderConceptPage(concept, {
          template: partials['concept.html'], partials, questionsBySlug,
          allConcepts: board.concepts,
        }));
      }

      const questionMatch = /^\/questions\/([a-z0-9-]+)$/.exec(path);
      if (questionMatch) {
        const question = board.questions.find(q => q.slug === questionMatch[1]);
        if (!question) return notFound(response);
        return response.status(200).send(renderQuestionPage(question, {
          template: partials['question.html'], partials,
        }));
      }

      if (path === '/concepts.json') {
        return response.status(200).json({
          stats: board.stats,
          concepts: board.concepts.map(publicShape),
          questions: board.questions.map(q => ({
            slug: q.slug, question: q.question, categories: q.categories,
            url: q.url, concepts: q.concepts.map(c => c.slug),
          })),
        });
      }

      return notFound(response);
    } catch (error) {
      console.error('render failed', error);
      /* A database outage degrades to the seeded board rather than a 500. */
      response.set('Cache-Control', 'no-store');
      return response.status(200).send(landingHtml({
        concepts: [], questions: [], stats: { concepts: 0, contributors: 0, connections: 0 },
      }));
    }
  },
);

const publicShape = c => ({
  slug: c.slug, title: c.title, creator: c.creator, type: c.type,
  categories: c.categories, status: c.status, summary: c.summary, url: c.url,
  question: c.question ?? null,
  explorations: c.explorations.map(e => ({ id: e.id, number: e.number, focus: e.focus, type: e.type })),
  connections: c.connections.map(x => ({
    rel: x.rel, concept: x.concept, exploration: x.exploration ?? null, t: x.t ?? null,
  })),
  citedBy: c.citedBy.map(x => ({ rel: x.rel, concept: x.source.slug })),
});

function notFound(response) {
  response.set('Cache-Control', 'no-store');
  return response.status(404).send(resolveIncludes(partials['notfound.html'] ?? '<h1>Not found</h1>', partials));
}


/* =============================================================
   One-shot seeding

   Writes the starter board. Refuses once any concept exists, so it
   cannot overwrite real submissions and needs no credential of its
   own. Safe to leave deployed.
   ============================================================= */

export const seedBoard = onRequest(
  { region: 'us-central1', memory: '512MiB', timeoutSeconds: 120 },
  async (request, response) => {
    /* Re-runnable while the board is still only seed content. The moment a
       real person has submitted anything, this refuses. */
    const existing = await concepts().get();
    const real = existing.docs.filter(d => d.data().submittedBy !== 'seed');
    if (real.length) {
      return response.status(409).json({
        error: `The board has ${real.length} real submission(s). Seeding is disabled.`,
      });
    }

    const data = JSON.parse(readFileSync(join(HERE, 'seed-data.json'), 'utf8'));
    const problems = [];

    for (const concept of data.concepts) {
      const found = validateShape(concept);
      if (found.length) problems.push(`${concept.slug}: ${found.join('; ')}`);
    }
    if (problems.length) return response.status(400).json({ problems });

    const batch = db.batch();
    for (const question of data.questions) {
      batch.set(questions().doc(question.slug), question);
    }
    /* Reserve every seeded byline. Without this, someone could claim
       @QuietSignal and appear to have written a concept already on the board.
       No uid is recorded, so this reserves the handle without granting it. */
    for (const creator of new Set(data.concepts.map(c => c.creator))) {
      batch.set(handles().doc(foldHandle(creator)), { reserved: true });
    }
    for (const concept of data.concepts) {
      /* loadBoard() filters on this exact field. */
      batch.set(concepts().doc(concept.slug), { ...concept, review: 'published', submittedBy: 'seed' });
    }
    await batch.commit();

    return response.json({
      seeded: { concepts: data.concepts.length, questions: data.questions.length },
    });
  },
);
