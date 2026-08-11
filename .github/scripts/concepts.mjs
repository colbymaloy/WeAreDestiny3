/**
 * Shared loading and validation for concepts/<slug>/concept.json.
 *
 * One concept is one idea. Explorations are evidence underneath it,
 * never entries of their own — the validator enforces that shape so a
 * folder of five generations cannot become five cards on the board.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const CONCEPTS_DIR = join(ROOT, 'concepts');

export const CATEGORIES = [
  { id: 'worlds',     label: 'Worlds' },
  { id: 'ui',         label: 'UI' },
  { id: 'gameplay',   label: 'Gameplay' },
  { id: 'weapons',    label: 'Weapons' },
  { id: 'armor',      label: 'Armor' },
  { id: 'abilities',  label: 'Abilities' },
  { id: 'subclasses', label: 'Subclasses' },
  { id: 'enemies',    label: 'Enemies' },
  { id: 'social',     label: 'Social' },
  { id: 'misc',       label: 'Misc' },
];
export const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map(c => [c.id, c.label]));

/* How settled the concept is. Reads as a progression, not a quality grade. */
export const STATUSES = {
  exploring: 'Exploring',
  direction: 'Direction',
  refined:   'Refined',
};

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const URL_OR_PATH = value => /^https?:\/\//i.test(value) || value.startsWith('/');

const BANNED_MEDIA_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.mkv', '.avi', '.m4v']);
const MAX_COMMITTED_MEDIA_BYTES = 5 * 1024 * 1024;

/* --- loading ------------------------------------------------------------- */

export function conceptSlugs() {
  if (!existsSync(CONCEPTS_DIR)) return [];
  return readdirSync(CONCEPTS_DIR)
    .filter(name => !name.startsWith('_') && !name.startsWith('.'))
    .filter(name => statSync(join(CONCEPTS_DIR, name)).isDirectory())
    .filter(name => existsSync(join(CONCEPTS_DIR, name, 'concept.json')))
    .sort();
}

export function loadConcepts() {
  const concepts = [];
  const errors = [];
  const warnings = [];

  for (const slug of conceptSlugs()) {
    const file = join(CONCEPTS_DIR, slug, 'concept.json');
    let raw;
    try {
      raw = JSON.parse(readFileSync(file, 'utf8'));
    } catch (err) {
      errors.push(`concepts/${slug}/concept.json is not valid JSON — ${err.message}`);
      continue;
    }
    const result = validateConcept(raw, slug);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
    if (result.errors.length === 0) concepts.push(normalize(raw, slug));
  }

  const media = checkCommittedMedia();
  errors.push(...media.errors);
  warnings.push(...media.warnings);

  /* Newest first when dates are present. */
  concepts.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || a.slug.localeCompare(b.slug));

  return { concepts, errors, warnings };
}

/* --- validation ---------------------------------------------------------- */

export function validateConcept(concept, slug) {
  const errors = [];
  const warnings = [];
  const at = `concepts/${slug}`;
  const fail = message => errors.push(`${at}: ${message}`);
  const warn = message => warnings.push(`${at}: ${message}`);

  if (!concept || typeof concept !== 'object' || Array.isArray(concept)) {
    fail('concept.json must be an object');
    return { errors, warnings };
  }

  if (concept.slug !== slug) {
    fail(`"slug" is "${concept.slug}" but the folder is "${slug}" — they must match`);
  }
  if (!SLUG.test(slug)) {
    fail('folder name must be kebab-case (lowercase letters, digits, single hyphens)');
  }

  for (const key of ['title', 'creator', 'summary']) {
    if (typeof concept[key] !== 'string' || !concept[key].trim()) {
      fail(`"${key}" is required and must be a non-empty string`);
    }
  }
  if (typeof concept.title === 'string' && concept.title.length > 80) {
    fail(`"title" is ${concept.title.length} characters — keep it under 80`);
  }
  if (typeof concept.summary === 'string' && concept.summary.length > 700) {
    fail(`"summary" is ${concept.summary.length} characters — it is meant to be 2-4 sentences`);
  }
  if (typeof concept.creator === 'string' && !/^[A-Za-z0-9-]+$/.test(concept.creator)) {
    fail('"creator" must be a bare GitHub username, with no "@"');
  }

  const categories = concept.categories;
  if (!Array.isArray(categories) || categories.length === 0) {
    fail('"categories" must be a non-empty array');
  } else {
    for (const category of categories) {
      if (!CATEGORY_LABEL[category]) {
        fail(`unknown category "${category}" — use one of: ${Object.keys(CATEGORY_LABEL).join(', ')}`);
      }
    }
    if (categories.length > 3) warn('more than three categories makes the card hard to read');
  }

  if (!STATUSES[concept.status]) {
    fail(`"status" must be one of: ${Object.keys(STATUSES).join(', ')}`);
  }

  const explorations = concept.explorations ?? [];
  if (!Array.isArray(explorations)) {
    fail('"explorations" must be an array');
  }

  const explorationIds = new Set();
  if (Array.isArray(explorations)) {
    explorations.forEach((exploration, index) => {
      const where = `exploration ${exploration?.id || `#${index + 1}`}`;
      if (!exploration || typeof exploration !== 'object') {
        fail(`${where} must be an object`);
        return;
      }
      if (typeof exploration.id !== 'string' || !SLUG.test(exploration.id)) {
        fail(`${where}: "id" is required and must be kebab-case, e.g. "exploration-01"`);
      } else if (explorationIds.has(exploration.id)) {
        fail(`${where}: duplicate exploration id`);
      } else {
        explorationIds.add(exploration.id);
      }
      if (typeof exploration.focus !== 'string' || !exploration.focus.trim()) {
        fail(`${where}: "focus" is required — say what this exploration was testing`);
      }
      checkMedia(exploration, where, fail, warn);
      for (const key of ['keep', 'drop', 'tools']) {
        if (key in exploration && (!Array.isArray(exploration[key]) || exploration[key].some(v => typeof v !== 'string'))) {
          fail(`${where}: "${key}" must be an array of strings`);
        }
      }
      if (!exploration.keep?.length && !exploration.drop?.length) {
        warn(`${where}: no "keep" or "drop" — those annotations are what turn a generation into research`);
      }
    });
  }

  /* Cover: an object, or the id of an exploration to reuse. */
  const cover = concept.cover;
  if (typeof cover === 'string') {
    if (!explorationIds.has(cover)) {
      fail(`"cover" is "${cover}", which is not an exploration id in this concept`);
    }
  } else if (cover && typeof cover === 'object') {
    checkMedia(cover, 'cover', fail, warn);
  } else {
    fail('"cover" is required — either an exploration id, or { type, media, thumbnail }');
  }

  const directionIds = new Set();
  if ('directions' in concept) {
    if (!Array.isArray(concept.directions)) {
      fail('"directions" must be an array');
    } else {
      for (const direction of concept.directions) {
        if (!direction || typeof direction.id !== 'string' || !SLUG.test(direction.id)) {
          fail('each direction needs a kebab-case "id"');
          continue;
        }
        if (typeof direction.title !== 'string' || !direction.title.trim()) {
          fail(`direction "${direction.id}": "title" is required`);
        }
        directionIds.add(direction.id);
      }
      for (const exploration of explorations) {
        if (exploration?.direction && !directionIds.has(exploration.direction)) {
          fail(`exploration ${exploration.id}: unknown direction "${exploration.direction}"`);
        }
      }
    }
  }

  if ('takeaways' in concept) {
    if (!Array.isArray(concept.takeaways) || concept.takeaways.some(v => typeof v !== 'string' || !v.trim())) {
      fail('"takeaways" must be an array of non-empty strings');
    } else if (concept.takeaways.length > 8) {
      warn('more than eight takeaways stops reading as a summary');
    }
  }

  if ('moments' in concept) {
    if (!Array.isArray(concept.moments)) {
      fail('"moments" must be an array');
    } else {
      concept.moments.forEach((moment, index) => {
        const where = `moment #${index + 1}`;
        if (!moment || typeof moment !== 'object') {
          fail(`${where} must be an object`);
          return;
        }
        if (typeof moment.label !== 'string' || !moment.label.trim()) {
          fail(`${where}: "label" is required — name the thing worth keeping`);
        }
        if (moment.from) {
          if (!explorationIds.has(moment.from)) {
            fail(`${where}: "from" is "${moment.from}", which is not an exploration id in this concept`);
          }
        } else {
          checkMedia(moment, where, fail, warn);
        }
        if ('t' in moment) {
          const t = moment.t;
          if (!Array.isArray(t) || t.length !== 2 || t.some(n => typeof n !== 'number' || n < 0)) {
            fail(`${where}: "t" must be [start, end] in seconds`);
          } else if (t[1] <= t[0]) {
            fail(`${where}: "t" end must be greater than start`);
          }
          if (!moment.from) {
            warn(`${where}: "t" only makes sense with "from" pointing at an exploration`);
          }
        }
      });
    }
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

  return { errors, warnings };
}

function checkMedia(item, where, fail, warn) {
  if (item.type !== 'image' && item.type !== 'video') {
    fail(`${where}: "type" must be "image" or "video"`);
  }
  if (typeof item.media !== 'string' || !item.media.trim()) {
    fail(`${where}: "media" is required`);
  } else if (!URL_OR_PATH(item.media)) {
    fail(`${where}: "media" must be a full URL or a site-root path starting with "/"`);
  } else if (item.media.startsWith('/') && !existsSync(join(ROOT, item.media.slice(1)))) {
    fail(`${where}: "media" points at ${item.media}, which is not in the repository`);
  }

  if (item.type === 'video' && !item.thumbnail) {
    fail(`${where}: video needs a "thumbnail" so the grid has something to show`);
  }
  if (item.thumbnail) {
    if (!URL_OR_PATH(item.thumbnail)) {
      fail(`${where}: "thumbnail" must be a full URL or a site-root path starting with "/"`);
    } else if (item.thumbnail.startsWith('/') && !existsSync(join(ROOT, item.thumbnail.slice(1)))) {
      fail(`${where}: "thumbnail" points at ${item.thumbnail}, which is not in the repository`);
    }
  } else if (item.type === 'image') {
    warn(`${where}: no "thumbnail" — the grid will load the full-size media instead`);
  }
}

/* Videos live on GitHub attachments or Releases, never in Git. Pages cannot
   serve Git LFS, and the published site is capped at 1 GB. */
function checkCommittedMedia() {
  const errors = [];
  const warnings = [];

  const walk = dir => {
    if (!existsSync(dir)) return [];
    return readdirSync(dir).flatMap(name => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? walk(path) : [path];
    });
  };

  for (const path of [...walk(join(ROOT, 'media')), ...walk(CONCEPTS_DIR)]) {
    const rel = path.slice(ROOT.length + 1);
    const ext = extname(path).toLowerCase();
    if (BANNED_MEDIA_EXTENSIONS.has(ext)) {
      errors.push(`${rel}: video files must not be committed — host them on a GitHub attachment or Release instead`);
      continue;
    }
    const { size } = statSync(path);
    if (size > MAX_COMMITTED_MEDIA_BYTES) {
      warnings.push(`${rel}: ${(size / 1024 / 1024).toFixed(1)} MB — large for a committed asset; consider a Release`);
    }
  }
  return { errors, warnings };
}

/* --- normalisation ------------------------------------------------------- */

function normalize(concept, slug) {
  const explorations = (concept.explorations ?? []).map((exploration, index) => ({
    ...exploration,
    number: String(index + 1).padStart(2, '0'),
    keep: exploration.keep ?? [],
    drop: exploration.drop ?? [],
    tools: exploration.tools ?? [],
  }));

  const byId = Object.fromEntries(explorations.map(e => [e.id, e]));

  const cover = typeof concept.cover === 'string'
    ? { type: byId[concept.cover].type, media: byId[concept.cover].media, thumbnail: byId[concept.cover].thumbnail }
    : concept.cover;

  const moments = (concept.moments ?? []).map(moment => {
    const source = moment.from ? byId[moment.from] : null;
    return {
      ...moment,
      type: moment.type ?? source?.type,
      media: moment.media ?? source?.media,
      thumbnail: moment.thumbnail ?? source?.thumbnail,
      sourceNumber: source?.number ?? null,
      sourceFocus: source?.focus ?? null,
    };
  });

  return {
    ...concept,
    slug,
    cover,
    explorations,
    moments,
    directions: concept.directions ?? [],
    takeaways: concept.takeaways ?? [],
    tools: concept.tools ?? [],
    categories: concept.categories,
    url: `/concepts/${slug}/`,
  };
}
