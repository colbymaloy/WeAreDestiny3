/**
 * The vocabulary of the project, in one place.
 *
 * Imported by the static build (.github/scripts) and by the publish function
 * (functions/), so the two can never disagree about what a valid type,
 * category, status or relationship is.
 *
 * Pure data and pure functions only — no filesystem, no Node built-ins — so
 * it also runs unchanged in the browser.
 */

/* What kind of contribution this is. A label, not a silo. */
export const TYPES = {
  vision:    { label: 'Vision',    blurb: 'Broad high-level direction' },
  design:    { label: 'Design',    blurb: 'A mechanic, system or gameplay idea' },
  world:     { label: 'World',     blurb: 'A destination or environment' },
  lore:      { label: 'Lore',      blurb: 'Narrative and worldbuilding' },
  visual:    { label: 'Visual',    blurb: 'Art, UI or animation exploration' },
  prototype: { label: 'Prototype', blurb: 'An interactive or playable experiment' },
};

/* Types whose substance is writing. These need a body, and get an editorial
   card instead of an image card. */
export const TEXT_FIRST = new Set(['vision', 'design', 'lore']);

export const CATEGORIES = [
  { id: 'gameplay',   label: 'Gameplay' },
  { id: 'worlds',     label: 'Worlds' },
  { id: 'lore',       label: 'Lore' },
  { id: 'systems',    label: 'Systems' },
  { id: 'ui',         label: 'UI' },
  { id: 'weapons',    label: 'Weapons' },
  { id: 'abilities',  label: 'Abilities' },
  { id: 'armor',      label: 'Armor' },
  { id: 'enemies',    label: 'Enemies' },
  { id: 'social',     label: 'Social' },
  { id: 'activities', label: 'Activities' },
  { id: 'audio',      label: 'Audio' },
  { id: 'misc',       label: 'Misc' },
];
export const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map(c => [c.id, c.label]));

/* How settled the idea is. A progression, not a quality grade. */
export const STATUSES = {
  exploring: 'Exploring',
  direction: 'Direction',
  refined:   'Refined',
};

/**
 * What a citation means, chosen by the person citing. `reverse` is what the
 * cited concept's own page says about the incoming edge — which is why the
 * board can show "referenced by 7 concepts" without anyone maintaining it.
 */
export const RELATIONS = {
  'builds-on':      { label: 'Builds on',      reverse: 'Built on by' },
  'inspired-by':    { label: 'Inspired by',    reverse: 'Inspired' },
  'references':     { label: 'References',     reverse: 'Referenced by' },
  'pairs-with':     { label: 'Pairs with',     reverse: 'Pairs with' },
  'alternative-to': { label: 'Alternative to', reverse: 'Alternative proposed by' },
  'challenges':     { label: 'Challenges',     reverse: 'Challenged by' },
};

/* Named for what each one produces on the concept page, not for the shape it
   takes in the database — this list is read by the person filling in the form. */
export const BODY_BLOCKS = {
  prose: {
    label: 'A section of writing',
    field: 'text',
    blurb: 'A heading and some paragraphs. Leave a blank line between them.',
    example: 'The Tower is a menu with a skybox. Everyone lands, opens three vendors, and leaves inside ninety seconds.',
  },
  list: {
    label: 'Key points',
    field: 'items',
    blurb: 'One per line. Each becomes a checked point.',
    example: 'Rewards teamwork and coordination',
  },
  flow: {
    label: 'How it works, in order',
    field: 'steps',
    blurb: 'One step per line. Drawn as a numbered sequence across the page.',
    example: 'Signal — actions that align create momentum',
  },
  timeline: {
    label: 'A timeline',
    field: 'steps',
    blurb: 'One entry per line, drawn down a vertical rail.',
    example: 'Year 1 — the Tower falls',
  },
  quote: {
    label: 'A pull quote',
    field: 'text',
    blurb: 'One line worth pulling out of the writing.',
    example: 'A Super should change what you can do, not just what you press.',
  },
  image: {
    label: 'An image',
    field: 'media',
    blurb: 'A render, a mockup or a screenshot, sitting in the flow of the writing.',
    example: '',
  },
};

/* What a concept's article may contain. The editor produces exactly this set,
   and the server strips anything else before storing — the allowlist is the
   security boundary, so it lives beside the model both ends read. */
export const ARTICLE_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 's', 'a',
  'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
  'figure', 'figcaption', 'img', 'hr',
];
export const ARTICLE_ATTRS = {
  a: ['href', 'title'],
  img: ['src', 'alt'],
};

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/* A handle is the only name this project has — no usernames, no display names,
   no real names. Claimed once per account and never released, so a handle on a
   two-year-old concept still means the person who wrote it. */
export const CREATOR_PATTERN = /^[A-Za-z0-9_-]{2,32}$/;
export const HANDLE_PATTERN = CREATOR_PATTERN;

/* Names that would let someone pass as the project or as a rights holder. */
export const RESERVED_HANDLES = new Set([
  'admin', 'admins', 'administrator', 'mod', 'mods', 'moderator', 'staff',
  'official', 'team', 'support', 'help', 'root', 'system', 'null', 'undefined',
  'bungie', 'destiny', 'destiny2', 'destiny3', 'wearedestiny3', 'guardian',
]);

/* Case is kept for display and folded for identity, so @kai and @Kai cannot
   become two people. */
export const foldHandle = handle => String(handle ?? '').trim().toLowerCase();

/** Why this handle cannot be claimed, or null if it can. */
export function handleProblem(handle) {
  const raw = String(handle ?? '').trim();
  if (!HANDLE_PATTERN.test(raw)) {
    return 'A handle is 2-32 characters: letters, numbers, hyphens or underscores.';
  }
  if (RESERVED_HANDLES.has(foldHandle(raw))) return 'That handle is reserved.';
  return null;
}

export const MAX = {
  article: 60000,
  title: 80,
  summary: 700,
  categories: 3,
  takeaways: 8,
  explorations: 24,
  connections: 24,
  body: 20,
};

/** Turns a title into a candidate folder name. */
export function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

/**
 * Validates a concept object's shape. Shared by the build and the publish
 * function; knows nothing about the filesystem or about which other concepts
 * exist, so callers layer those checks on top.
 *
 * Returns an array of human-readable problems — empty means valid.
 */
export function validateShape(concept, { requireSlug = true } = {}) {
  const problems = [];
  const fail = message => problems.push(message);

  if (!concept || typeof concept !== 'object' || Array.isArray(concept)) {
    return ['concept must be an object'];
  }

  if (requireSlug && (typeof concept.slug !== 'string' || !SLUG_PATTERN.test(concept.slug))) {
    fail('"slug" must be kebab-case (lowercase letters, digits, single hyphens)');
  }

  for (const key of ['title', 'creator', 'summary']) {
    if (typeof concept[key] !== 'string' || !concept[key].trim()) {
      fail(`"${key}" is required and must be a non-empty string`);
    }
  }
  if (typeof concept.title === 'string' && concept.title.length > MAX.title) {
    fail(`"title" is ${concept.title.length} characters — keep it under ${MAX.title}`);
  }
  if (typeof concept.summary === 'string' && concept.summary.length > MAX.summary) {
    fail(`"summary" is ${concept.summary.length} characters — it is meant to be 2-4 sentences`);
  }
  if (typeof concept.creator === 'string' && !CREATOR_PATTERN.test(concept.creator)) {
    fail('"creator" must be 2-32 characters: letters, numbers, hyphens or underscores');
  }

  if (!TYPES[concept.type]) {
    fail(`"type" must be one of: ${Object.keys(TYPES).join(', ')}`);
  }

  if (!Array.isArray(concept.categories) || concept.categories.length === 0) {
    fail('"categories" must be a non-empty array');
  } else {
    for (const category of concept.categories) {
      if (!CATEGORY_LABEL[category]) {
        fail(`unknown category "${category}" — use one of: ${Object.keys(CATEGORY_LABEL).join(', ')}`);
      }
    }
    if (concept.categories.length > MAX.categories) {
      fail(`at most ${MAX.categories} categories`);
    }
  }

  if (!STATUSES[concept.status]) {
    fail(`"status" must be one of: ${Object.keys(STATUSES).join(', ')}`);
  }

  const body = concept.body ?? [];
  if (!Array.isArray(body)) {
    fail('"body" must be an array of blocks');
  } else {
    if (body.length > MAX.body) fail(`at most ${MAX.body} body blocks`);
    body.forEach((block, index) => {
      const where = `body block #${index + 1}`;
      if (!block || typeof block !== 'object') return fail(`${where} must be an object`);
      const spec = BODY_BLOCKS[block.type];
      if (!spec) return fail(`${where}: "type" must be one of: ${Object.keys(BODY_BLOCKS).join(', ')}`);
      if ('heading' in block && typeof block.heading !== 'string') {
        fail(`${where}: "heading" must be a string`);
      }
      if (block.type === 'image') {
        if (typeof block.media !== 'string' || !/^https?:\/\//i.test(block.media)) {
          fail(`${where}: an image needs a "media" URL`);
        }
        if ('caption' in block && typeof block.caption !== 'string') {
          fail(`${where}: "caption" must be a string`);
        }
      } else if (spec.field === 'text') {
        if (typeof block.text !== 'string' || !block.text.trim()) {
          fail(`${where}: "${block.type}" needs a non-empty "text"`);
        }
      } else if (!Array.isArray(block[spec.field]) || block[spec.field].length === 0
                 || block[spec.field].some(v => typeof v !== 'string' || !v.trim())) {
        fail(`${where}: "${block.type}" needs a non-empty "${spec.field}" array of strings`);
      }
    });
  }
  if ('article' in concept) {
    if (typeof concept.article !== 'string') {
      fail('"article" must be a string of markup');
    } else if (concept.article.length > MAX.article) {
      fail(`"article" is ${concept.article.length} characters — keep it under ${MAX.article}`);
    }
  }

  /* Written types need an argument somewhere. Newer submissions carry it as
     one article; the concepts seeded before that carry it as blocks. */
  const hasProse = articleText(concept.article).length > 0 || body.length > 0;
  if (TEXT_FIRST.has(concept.type) && !hasProse) {
    fail(`a "${concept.type}" concept needs a written proposal — that is where the actual argument lives`);
  }

  const explorations = concept.explorations ?? [];
  const explorationIds = new Set();
  if (!Array.isArray(explorations)) {
    fail('"explorations" must be an array');
  } else {
    if (explorations.length > MAX.explorations) fail(`at most ${MAX.explorations} explorations`);
    explorations.forEach((exploration, index) => {
      const where = `exploration ${exploration?.id || `#${index + 1}`}`;
      if (!exploration || typeof exploration !== 'object') return fail(`${where} must be an object`);
      if (typeof exploration.id !== 'string' || !SLUG_PATTERN.test(exploration.id)) {
        fail(`${where}: "id" is required and must be kebab-case, e.g. "exploration-01"`);
      } else if (explorationIds.has(exploration.id)) {
        fail(`${where}: duplicate exploration id`);
      } else {
        explorationIds.add(exploration.id);
      }
      if (typeof exploration.focus !== 'string' || !exploration.focus.trim()) {
        fail(`${where}: "focus" is required — say what this exploration was testing`);
      }
      problems.push(...mediaProblems(exploration, where));
      for (const key of ['keep', 'drop', 'tools']) {
        if (key in exploration && (!Array.isArray(exploration[key]) || exploration[key].some(v => typeof v !== 'string'))) {
          fail(`${where}: "${key}" must be an array of strings`);
        }
      }
    });
  }

  const cover = concept.cover;
  if (typeof cover === 'string') {
    if (!explorationIds.has(cover)) {
      fail(`"cover" is "${cover}", which is not an exploration id in this concept`);
    }
  } else if (cover && typeof cover === 'object') {
    problems.push(...mediaProblems(cover, 'cover', { allowYoutube: true }));
  } else if (cover != null) {
    fail('"cover" must be an exploration id, or { type, media, thumbnail }, or omitted');
  }

  if ('takeaways' in concept) {
    if (!Array.isArray(concept.takeaways) || concept.takeaways.some(v => typeof v !== 'string' || !v.trim())) {
      fail('"takeaways" must be an array of non-empty strings');
    } else if (concept.takeaways.length > MAX.takeaways) {
      fail(`at most ${MAX.takeaways} takeaways`);
    }
  }

  if ('connections' in concept) {
    if (!Array.isArray(concept.connections)) {
      fail('"connections" must be an array');
    } else {
      if (concept.connections.length > MAX.connections) fail(`at most ${MAX.connections} connections`);
      concept.connections.forEach((connection, index) => {
        const where = `connection #${index + 1}`;
        if (!connection || typeof connection !== 'object') return fail(`${where} must be an object`);
        if (!RELATIONS[connection.rel]) {
          fail(`${where}: "rel" must be one of: ${Object.keys(RELATIONS).join(', ')}`);
        }
        if (typeof connection.concept !== 'string' || !SLUG_PATTERN.test(connection.concept)) {
          fail(`${where}: "concept" must be the slug of another concept`);
        }
        if (connection.concept === concept.slug) fail(`${where}: a concept cannot cite itself`);
        if ('note' in connection && typeof connection.note !== 'string') {
          fail(`${where}: "note" must be a string`);
        }
        problems.push(...timeProblems(connection.t, where));
        if (connection.t && !connection.exploration) {
          fail(`${where}: "t" needs an "exploration" to point into`);
        }
      });
    }
  }

  if ('moments' in concept) {
    if (!Array.isArray(concept.moments)) {
      fail('"moments" must be an array');
    } else {
      concept.moments.forEach((moment, index) => {
        const where = `moment #${index + 1}`;
        if (!moment || typeof moment !== 'object') return fail(`${where} must be an object`);
        if (typeof moment.label !== 'string' || !moment.label.trim()) {
          fail(`${where}: "label" is required`);
        }
        if (moment.from && !explorationIds.has(moment.from)) {
          fail(`${where}: "from" is "${moment.from}", which is not an exploration in this concept`);
        }
        if (!moment.from) problems.push(...mediaProblems(moment, where));
        problems.push(...timeProblems(moment.t, where));
      });
    }
  }

  if ('question' in concept && (typeof concept.question !== 'string' || !SLUG_PATTERN.test(concept.question))) {
    fail('"question" must be the slug of a question');
  }
  for (const key of ['discussion', 'source']) {
    if (key in concept && !/^https?:\/\/\S+$/.test(String(concept[key]))) {
      fail(`"${key}" must be an http(s) URL`);
    }
  }
  if ('date' in concept && !/^\d{4}-\d{2}-\d{2}$/.test(String(concept.date))) {
    fail('"date" must be YYYY-MM-DD');
  }
  if ('tools' in concept && (!Array.isArray(concept.tools) || concept.tools.some(v => typeof v !== 'string'))) {
    fail('"tools" must be an array of strings');
  }

  return problems;
}

/** The words in an article, with the markup taken out. */
export const articleText = article =>
  String(article ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

/** The eleven-character id out of any URL YouTube hands out, else null. */
export function youtubeId(url) {
  const match = String(url ?? '').match(
    /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([\w-]{11})/,
  );
  return match ? match[1] : null;
}

/** YouTube's own still for a video. Every upload has one. */
export const youtubePoster = id => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

/* A YouTube cover is a link, not an upload, so it costs the project nothing to
   store or serve. Only the cover takes one — explorations render as plain
   <img>/<video>, which an embed cannot stand in for. */
export function mediaProblems(item, where, { allowYoutube = false } = {}) {
  const problems = [];
  const kinds = allowYoutube ? ['image', 'video', 'youtube'] : ['image', 'video'];

  if (!kinds.includes(item.type)) {
    problems.push(`${where}: "type" must be ${kinds.map(k => `"${k}"`).join(' or ')}`);
  }
  if (typeof item.media !== 'string' || !item.media.trim()) {
    problems.push(`${where}: "media" is required`);
  } else if (item.type === 'youtube') {
    if (!youtubeId(item.media)) {
      problems.push(`${where}: "media" must be a YouTube video URL`);
    }
  } else if (!/^https?:\/\//i.test(item.media) && !item.media.startsWith('/')) {
    problems.push(`${where}: "media" must be a full URL or a site-root path starting with "/"`);
  }
  /* YouTube supplies its own still, so only an uploaded video has to carry one. */
  if (item.type === 'video' && !item.thumbnail) {
    problems.push(`${where}: video needs a "thumbnail" so the board has something to show`);
  }
  return problems;
}

export function timeProblems(t, where) {
  if (t == null) return [];
  if (!Array.isArray(t) || t.length !== 2 || t.some(n => typeof n !== 'number' || n < 0)) {
    return [`${where}: "t" must be [start, end] in seconds`];
  }
  if (t[1] <= t[0]) return [`${where}: "t" end must be greater than start`];
  return [];
}
