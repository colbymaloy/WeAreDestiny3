/**
 * Normalisation and the citation graph.
 *
 * Pure — no filesystem, no Firestore, no Node built-ins. Takes plain concept
 * and question objects from wherever they came from and returns the same
 * shape the renderers expect, with every citation resolved and its reverse
 * edge attached to the cited concept.
 *
 * That reverse edge is why "Referenced by 7 concepts" needs nobody to
 * maintain it: it is derived here, every time, from the forward links.
 */

import { TEXT_FIRST } from './model.mjs';

export function normalizeConcept(raw) {
  const explorations = (raw.explorations ?? []).map((exploration, index) => ({
    ...exploration,
    number: String(index + 1).padStart(2, '0'),
    keep: exploration.keep ?? [],
    drop: exploration.drop ?? [],
    tools: exploration.tools ?? [],
  }));

  const byId = Object.fromEntries(explorations.map(e => [e.id, e]));

  /* `cover` may name an exploration instead of repeating its media. */
  const cover = typeof raw.cover === 'string'
    ? (byId[raw.cover]
        ? { type: byId[raw.cover].type, media: byId[raw.cover].media, thumbnail: byId[raw.cover].thumbnail }
        : null)
    : raw.cover ?? null;

  const moments = (raw.moments ?? []).map(moment => {
    const source = moment.from ? byId[moment.from] : null;
    return {
      ...moment,
      type: moment.type ?? source?.type,
      media: moment.media ?? source?.media,
      thumbnail: moment.thumbnail ?? source?.thumbnail,
      sourceNumber: source?.number ?? null,
    };
  });

  return {
    ...raw,
    cover,
    explorations,
    moments,
    body: raw.body ?? [],
    directions: raw.directions ?? [],
    takeaways: raw.takeaways ?? [],
    tools: raw.tools ?? [],
    connections: (raw.connections ?? []).map(c => ({ ...c })),
    citedBy: [],
    featured: raw.featured === true,
    textFirst: TEXT_FIRST.has(raw.type) || !cover,
    url: `/concepts/${raw.slug}/`,
  };
}

export function normalizeQuestion(raw) {
  return { ...raw, concepts: [], url: `/questions/${raw.slug}/` };
}

/**
 * Resolves citations and question links in place.
 * Returns any dangling references as human-readable strings — the static
 * build treats them as errors; the server just drops them.
 */
export function linkGraph(concepts, questions) {
  const problems = [];
  const bySlug = Object.fromEntries(concepts.map(c => [c.slug, c]));
  const questionsBySlug = Object.fromEntries(questions.map(q => [q.slug, q]));

  for (const question of questions) question.concepts = [];
  for (const concept of concepts) concept.citedBy = [];

  for (const concept of concepts) {
    if (concept.question) {
      const question = questionsBySlug[concept.question];
      if (question) question.concepts.push(concept);
      else problems.push(`concepts/${concept.slug}: "question" is "${concept.question}", which does not exist`);
    }

    for (const connection of concept.connections) {
      const target = bySlug[connection.concept];
      if (!target) {
        problems.push(`concepts/${concept.slug}: cites "${connection.concept}", which is not a concept`);
        continue;
      }
      if (target.slug === concept.slug) {
        problems.push(`concepts/${concept.slug}: a concept cannot cite itself`);
        continue;
      }

      /* A citation may point at one exploration inside the target, and at a
         time range inside that — four seconds rather than a whole concept. */
      let exploration = null;
      if (connection.exploration) {
        exploration = target.explorations.find(e => e.id === connection.exploration);
        if (!exploration) {
          problems.push(`concepts/${concept.slug}: cites "${connection.exploration}", not an exploration in "${target.slug}"`);
          continue;
        }
      }

      connection.target = target;
      connection.explorationRef = exploration;

      target.citedBy.push({
        rel: connection.rel,
        source: concept,
        note: connection.note,
        explorationRef: exploration,
        t: connection.t,
      });
    }
  }

  return problems;
}

/** Newest first, then alphabetical so ordering is stable without dates. */
export function sortConcepts(concepts) {
  return concepts.sort((a, b) =>
    String(b.date || '').localeCompare(String(a.date || '')) || a.slug.localeCompare(b.slug));
}

export function sortQuestions(questions) {
  return questions.sort((a, b) =>
    b.concepts.length - a.concepts.length || a.slug.localeCompare(b.slug));
}

/** Only counts things that exist. No engagement metrics — nothing measures them. */
export function projectStats(concepts, questions) {
  const contributors = new Set();
  let explorations = 0;
  let connections = 0;

  for (const concept of concepts) {
    contributors.add(concept.creator);
    explorations += concept.explorations.length;
    connections += concept.connections.length;
  }

  return {
    concepts: concepts.length,
    contributors: contributors.size,
    explorations,
    connections,
    questions: questions.length,
    openQuestions: questions.filter(q => q.concepts.length === 0).length,
  };
}
