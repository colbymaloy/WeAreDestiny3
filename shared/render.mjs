/**
 * Every piece of HTML the project produces.
 *
 * Pure: templates and partials are passed in as strings rather than read from
 * disk, so the static build and the server render byte-identical pages from
 * the same code. No filesystem, no Node built-ins.
 */

import {
  TYPES, CATEGORY_LABEL, STATUSES, RELATIONS, CATEGORIES, youtubeId, youtubePoster,
} from './model.mjs';
import { iconSprite, ph } from './icons.mjs';

export const SITE = 'https://wearedestiny3.com';
export const REPO = 'https://github.com/colbymaloy/WeAreDestiny3';
export const DEFAULT_IMAGE = `${SITE}/media/branding/social-card.jpg`;


/* The still that stands for a cover anywhere it is shown small: a card, a
   related strip, a social image. An uploaded video carries its own; a YouTube
   cover borrows YouTube's; an image is its own poster. Written concepts have
   none, and the callers fall back to an editorial face. */
function coverPoster(cover) {
  if (!cover) return '';
  if (cover.thumbnail) return cover.thumbnail;
  if (cover.type === 'youtube') {
    const id = youtubeId(cover.media);
    return id ? youtubePoster(id) : '';
  }
  return cover.type === 'image' ? cover.media : '';
}

/* Both kinds of moving picture read as "Video" on a card. */
const isMoving = cover => cover?.type === 'video' || cover?.type === 'youtube';

/* A mark per concept type. Text concepts have no cover image, so the glyph
   carries the visual weight instead of a missing thumbnail. */
const GLYPHS = {
  vision:    'M12 2 L22 12 L12 22 L2 12 Z M12 7 L17 12 L12 17 L7 12 Z',
  design:    'M12 2 L21 7 L21 17 L12 22 L3 17 L3 7 Z',
  world:     'M12 2 A10 10 0 1 1 12 22 A10 10 0 1 1 12 2 M2 12 L22 12 M12 2 A14 10 0 0 1 12 22 A14 10 0 0 1 12 2',
  lore:      'M12 1 L15 9 L23 12 L15 15 L12 23 L9 15 L1 12 L9 9 Z',
  visual:    'M12 3 L21 12 L12 21 L3 12 Z',
  prototype: 'M4 4 L20 4 L20 20 L4 20 Z M9 9 L15 9 L15 15 L9 15 Z',
  question:  'M12 2 L22 12 L12 22 L2 12 Z',
};

export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));
const esc = escapeHtml;

function fill(template, values) {
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, key) => (
    key in values ? String(values[key]) : match
  ));
}

/** Resolve <!--INCLUDE:file.html KEY=value ...--> against a partials map.
    `jsonLd` is a ready-made <script> block for the page's structured data;
    pages that have none get the site-level block in head.html and nothing more. */
export function resolveIncludes(html, partials, jsonLd = '') {
  return html.replace(/<!--INCLUDE:([\w.-]*?\.html)([\s\S]*?)-->/g, (match, file, body) => {
    const partial = partials[file] ?? '';
    const values = {};
    for (const line of body.split('\n')) {
      const param = line.match(/^\s*([A-Z0-9_]+)=(.*)$/);
      if (param) values[param[1]] = param[2].trim();
    }
    if (!values.IMAGE) values.IMAGE = DEFAULT_IMAGE;
    if (!values.OG_TITLE) values.OG_TITLE = values.TITLE ?? '';
    if (!values.OG_TYPE) values.OG_TYPE = 'website';
    for (const key of Object.keys(values)) values[key] = escapeHtml(values[key]);
    /* Structured data arrives already built and already escaped — running it
       through escapeHtml would turn the JSON into entities. */
    values.JSON_LD = jsonLd ?? '';
    return fill(partial, values).trim();
  });
}

const timecode = seconds => {
  const total = Math.max(0, Math.floor(seconds));
  const frac = seconds % 1 >= 0.05 ? `.${String(Math.round((seconds % 1) * 10))}` : '';
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}${frac}`;
};

const glyph = (type, className = 'glyph') =>
  `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${GLYPHS[type]}"/></svg>`;

/* Type first, then categories — minus any category that just repeats the
   type, so a lore concept filed under Lore doesn't read "LORE · LORE". */
const typeLine = concept => {
  const type = TYPES[concept.type].label;
  const categories = concept.categories
    .map(c => CATEGORY_LABEL[c])
    .filter(label => label.toLowerCase() !== type.toLowerCase());
  return [type.toUpperCase(), ...categories].map(escapeHtml)
    .join(' <span class="sep">&middot;</span> ');
};

/** Data attributes the lightbox reads. */
function mediaAttrs({ type, media, thumbnail, title, sub, t }) {
  const parts = [
    `data-type="${escapeHtml(type)}"`,
    `data-media="${escapeHtml(media)}"`,
    `data-title="${escapeHtml(title)}"`,
  ];
  if (sub) parts.push(`data-sub="${escapeHtml(sub)}"`);
  if (thumbnail) parts.push(`data-poster="${escapeHtml(thumbnail)}"`);
  if (t) parts.push(`data-start="${t[0]}"`, `data-end="${t[1]}"`);
  return parts.join(' ');
}

/* --- board ---------------------------------------------------------------- */

function renderCard(concept, { featured = false } = {}) {
  const poster = coverPoster(concept.cover);
  const count = concept.explorations.length;
  const cited = concept.citedBy.length;

  /* Written concepts get an editorial face rather than an empty image slot. */
  const face = poster
    ? `<div class="card-media">
         <img src="${escapeHtml(poster)}" alt="" loading="lazy" decoding="async">
         ${isMoving(concept.cover) ? '<span class="card-flag">Video</span>' : ''}
       </div>`
    : `<div class="editorial">
         ${glyph(concept.type, 'editorial-glyph')}
         <p class="editorial-kicker">${escapeHtml(TYPES[concept.type].label)}</p>
         <p class="editorial-title">${escapeHtml(concept.title)}</p>
         <p class="editorial-quote">${escapeHtml(concept.summary)}</p>
       </div>`;

  const meta = [
    count ? `${count} exploration${count === 1 ? '' : 's'}` : null,
    cited ? `cited by ${cited}` : null,
  ].filter(Boolean).join(' &middot; ');

  return `
  <a class="card${featured ? ' card-featured' : ''}${poster ? '' : ' card-text'}" href="${concept.url}"
     data-type="${escapeHtml(concept.type)}"
     data-categories="${escapeHtml(concept.categories.join(' '))}"
     data-status="${escapeHtml(concept.status)}">
    <div class="card-inner">${face}
      <div class="card-text-body">
        <p class="card-kicker">${typeLine(concept)}</p>
        <h3 class="card-title">${escapeHtml(concept.title)}</h3>
        ${poster ? `<p class="card-summary">${escapeHtml(concept.summary)}</p>` : ''}
        <div class="card-meta">
          <span class="card-by">
            <span>by @${escapeHtml(concept.creator)}</span>
            ${meta ? `<span class="card-count">${meta}</span>` : ''}
          </span>
          <span class="status status-${escapeHtml(concept.status)}">${escapeHtml(STATUSES[concept.status])}</span>
        </div>
      </div>
    </div>
  </a>`;
}

function renderFilters(concepts) {
  if (concepts.length === 0) return '';

  const tally = key => {
    const counts = new Map();
    for (const concept of concepts) for (const value of key(concept)) counts.set(value, (counts.get(value) || 0) + 1);
    return counts;
  };
  const byCategory = tally(c => c.categories);
  const byType = tally(c => [c.type]);

  const tabs = [{ id: 'all', label: 'All', count: concepts.length }];
  for (const category of CATEGORIES) {
    if (byCategory.get(category.id)) tabs.push({ id: category.id, label: category.label, count: byCategory.get(category.id) });
  }
  /* Types share names with categories (Lore is both), so the type run is
     labelled rather than left as a second identical-looking chip. */
  const types = Object.entries(TYPES).filter(([id]) => byType.get(id));
  const divider = types.length ? '<span class="chip-divider">Type</span>' : '';

  return tabs.map(tab => `
    <button type="button" class="chip" data-filter="${escapeHtml(tab.id)}" aria-pressed="${tab.id === 'all'}"
      >${escapeHtml(tab.label)}<span class="count">${tab.count}</span></button>`).join('')
    + divider
    + types.map(([id, meta]) => `
    <button type="button" class="chip chip-type" data-filter="${escapeHtml(id)}" aria-pressed="false"
      >${glyph(id, 'chip-glyph')}${escapeHtml(meta.label)}<span class="count">${byType.get(id)}</span></button>`).join('');
}

function renderStats(stats) {
  if (stats.concepts === 0) return '';
  const tiles = [
    ['vision', stats.concepts, `Concept${stats.concepts === 1 ? '' : 's'}`],
    ['world', stats.contributors, `Contributor${stats.contributors === 1 ? '' : 's'}`],
    ['design', stats.connections, `Connection${stats.connections === 1 ? '' : 's'}`],
    ['lore', '&infin;', 'Possibilities ahead'],
  ];
  return `<div class="stats">${tiles.map(([type, value, label]) => `
    <div class="stat">${glyph(type, 'stat-glyph')}
      <div><span class="stat-value">${value}</span><span class="stat-label">${label}</span></div>
    </div>`).join('')}</div>`;
}

function renderEmptyBoard() {
  return `
  <div class="state">
    <p class="eyebrow"><span class="mark"></span>The board is open</p>
    <h2>No one has answered yet. That is the whole opportunity.</h2>
    <p>The first concept sets the direction everyone else builds on, argues with, or cites.
       Bring a system, a world, a piece of lore, an interface, a sound — anything that answers
       what Destiny should become.</p>
    <a class="btn btn-primary" href="/contribute/">Post the first concept</a>
  </div>`;
}

function renderFeatured(concepts) {
  const featured = concepts.filter(c => c.featured);
  if (featured.length === 0) return '';
  return `
  <section class="section" aria-labelledby="featured-title">
    <div class="section-head">
      <h2 class="section-title" id="featured-title"><span class="mark"></span>Featured directions</h2>
      <p class="section-note">The concepts other people are building on.</p>
    </div>
    <div class="grid grid-featured">${featured.map(c => renderCard(c, { featured: true })).join('')}</div>
  </section>`;
}

function renderQuestionCard(question) {
  const count = question.concepts.length;
  return `
  <a class="question-card" href="${question.url}">
    <p class="eyebrow">${question.categories.map(c => escapeHtml(CATEGORY_LABEL[c])).join(' &middot; ')}</p>
    <q>${escapeHtml(question.question)}</q>
    <footer>${count ? `${count} concept${count === 1 ? '' : 's'}` : 'Unanswered'}</footer>
  </a>`;
}

function renderQuestionsSection(questions) {
  if (questions.length === 0) return '';
  return `
  <section class="section" id="questions" aria-labelledby="questions-title">
    <div class="section-head">
      <h2 class="section-title" id="questions-title"><span class="mark"></span>Open questions</h2>
      <p class="section-note">Somewhere for ideas that aren't developed enough to be concepts yet. Answer one and it becomes one.</p>
    </div>
    <div class="question-grid">${questions.map(renderQuestionCard).join('')}</div>
  </section>`;
}

/* --- concept body --------------------------------------------------------- */

const paragraphs = text => text.split(/\n{2,}/).map(p => `<p>${escapeHtml(p.trim())}</p>`).join('');

function renderBlock(block, index) {
  const id = `block-${index + 1}`;
  const head = block.heading
    ? `<div class="section-head"><h2 class="section-title" id="${id}"><span class="mark"></span>${escapeHtml(block.heading)}</h2></div>`
    : '';
  const labelled = block.heading ? ` aria-labelledby="${id}"` : '';

  switch (block.type) {
    case 'prose':
      return `<section class="section block-prose"${labelled}>${head}<div class="prose-body">${paragraphs(block.text)}</div></section>`;

    case 'list':
      return `<section class="section"${labelled}>${head}
        <ul class="claims">${block.items.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul></section>`;

    /* The step sits in a span so the li can carry the connector — a
       clip-path on the step itself would clip the arrow away. */
    case 'flow':
      return `<section class="section"${labelled}>${head}
        <ol class="flow">${block.steps.map(s => `<li><span>${escapeHtml(s)}</span></li>`).join('')}</ol></section>`;

    case 'timeline':
      return `<section class="section"${labelled}>${head}
        <ol class="timeline">${block.steps.map(s => `<li><span>${escapeHtml(s)}</span></li>`).join('')}</ol></section>`;

    case 'quote':
      return `<section class="section"${labelled}>${head}
        <blockquote class="pull">${escapeHtml(block.text)}${
          block.attribution ? `<cite>${escapeHtml(block.attribution)}</cite>` : ''}</blockquote></section>`;

    default:
      return '';
  }
}

/* --- connections ---------------------------------------------------------- */

/** A cited concept, shown as a compact card with the citer's reason. */
function renderRefCard(concept, note) {
  const poster = coverPoster(concept.cover);
  const face = poster
    ? `<img src="${escapeHtml(poster)}" alt="" loading="lazy" decoding="async">`
    : glyph(concept.type, 'ref-glyph');

  return `
    <article class="ref">
      <a class="ref-link" href="${concept.url}">
        <span class="ref-face">${face}</span>
        <span class="ref-body">
          <span class="ref-kicker">${typeLine(concept)}</span>
          <span class="ref-title">${escapeHtml(concept.title)}</span>
          <span class="ref-by">by @${escapeHtml(concept.creator)}</span>
        </span>
      </a>
      ${note ? `<p class="ref-note"><span class="ref-note-label">Referenced for</span>${escapeHtml(note)}</p>` : ''}
    </article>`;
}

/**
 * A citation that points at one exploration, optionally at a time range inside
 * it. Attribution is rendered from the graph, so the original creator is
 * always named without anyone having to remember to do it.
 */
function renderMediaRef(connection) {
  const target = connection.target;
  const exploration = connection.explorationRef;
  const poster = exploration.thumbnail || (exploration.type === 'image' ? exploration.media : '');
  const range = connection.t ? `${timecode(connection.t[0])} &rarr; ${timecode(connection.t[1])}` : '';

  return `
    <figure class="mediaref">
      <button type="button" class="mediaref-stage"
        ${mediaAttrs({
          type: exploration.type,
          media: exploration.media,
          thumbnail: exploration.thumbnail,
          title: connection.note || exploration.focus,
          sub: `${target.title} · Exploration ${exploration.number} · by @${target.creator}`,
          t: connection.t,
        })}>
        ${poster ? `<img src="${escapeHtml(poster)}" alt="" loading="lazy" decoding="async">` : ''}
        <span class="mediaref-play" aria-hidden="true"></span>
        ${range ? `<span class="mediaref-time">${range}</span>` : ''}
      </button>
      <figcaption>
        ${connection.note ? `<p class="mediaref-note">${escapeHtml(connection.note)}</p>` : ''}
        <p class="mediaref-attr">from
          <a href="${target.url}">${escapeHtml(target.title)}</a>
          by <span class="by">@${escapeHtml(target.creator)}</span>
          <span class="sep">&middot;</span> Exploration ${exploration.number}
        </p>
      </figcaption>
    </figure>`;
}

function renderConnections(concept) {
  if (concept.connections.length === 0) return '';

  const groups = Object.keys(RELATIONS)
    .map(rel => [rel, concept.connections.filter(c => c.rel === rel)])
    .filter(([, list]) => list.length > 0);

  const body = groups.map(([rel, list]) => {
    const media = list.filter(c => c.explorationRef);
    const whole = list.filter(c => !c.explorationRef);
    return `
    <div class="rel-group">
      <h3 class="rel-label">${escapeHtml(RELATIONS[rel].label)}</h3>
      ${whole.length ? `<div class="refs">${whole.map(c => renderRefCard(c.target, c.note)).join('')}</div>` : ''}
      ${media.length ? `<div class="mediarefs">${media.map(renderMediaRef).join('')}</div>` : ''}
    </div>`;
  }).join('');

  return `
  <section class="section" aria-labelledby="connections-title">
    <div class="section-head">
      <h2 class="section-title" id="connections-title"><span class="mark"></span>Connections</h2>
      <p class="section-note">What this concept builds on, argues with, or borrows from. Nothing here is duplicated — it is cited.</p>
    </div>
    ${body}
  </section>`;
}

/** The reverse edges, derived — nobody maintains this by hand. */
function renderCitedBy(concept) {
  if (concept.citedBy.length === 0) return '';

  const groups = Object.keys(RELATIONS)
    .map(rel => [rel, concept.citedBy.filter(c => c.rel === rel)])
    .filter(([, list]) => list.length > 0);

  const total = concept.citedBy.length;

  const body = groups.map(([rel, list]) => `
    <div class="rel-group">
      <h3 class="rel-label">${escapeHtml(RELATIONS[rel].reverse)} <span class="rel-count">${list.length}</span></h3>
      <ul class="backrefs">${list.map(entry => `
        <li>
          <a href="${entry.source.url}">${escapeHtml(entry.source.title)}</a>
          <span class="backref-by">by @${escapeHtml(entry.source.creator)}</span>
          ${entry.explorationRef ? `<span class="backref-detail">cited Exploration ${entry.explorationRef.number}${
            entry.t ? ` &middot; ${timecode(entry.t[0])}&ndash;${timecode(entry.t[1])}` : ''}</span>` : ''}
        </li>`).join('')}</ul>
    </div>`).join('');

  return `
  <section class="section" aria-labelledby="citedby-title">
    <div class="section-head">
      <h2 class="section-title" id="citedby-title"><span class="mark"></span>Cited by ${total} concept${total === 1 ? '' : 's'}</h2>
      <p class="section-note">Other people's work that points back here.</p>
    </div>
    ${body}
  </section>`;
}

/* --- concept page --------------------------------------------------------- */

function renderHero(concept) {
  if (!concept.cover) return '';
  const { cover } = concept;
  const inner = cover.type === 'video'
    ? `<video controls playsinline preload="metadata"${cover.thumbnail ? ` poster="${escapeHtml(cover.thumbnail)}"` : ''} src="${escapeHtml(cover.media)}"></video>`
    : `<img src="${escapeHtml(cover.media)}" alt="${escapeHtml(concept.title)} — ${escapeHtml(concept.summary)}">`;
  return `<div class="hero-media">${inner}</div>
  <p class="hero-caption">Selected direction</p>`;
}

function renderMetaRail(concept) {
  const blocks = [];

  if (concept.tools.length) {
    blocks.push(`<div class="rail-block">
      <h3>Tools</h3>
      <ul class="tools">${concept.tools.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
    </div>`);
  }

  const links = [];
  if (concept.discussion) links.push(['View discussion', concept.discussion]);
  if (concept.source) links.push(['View source files', concept.source]);
  if (concept.notesUrl) links.push(['Read the full notes', concept.notesUrl]);

  blocks.push(`<div class="rail-block">
    <h3>Links</h3>
    <div class="rail-links">${links.map(([label, href]) =>
      `<a href="${escapeHtml(href)}" rel="noopener">${escapeHtml(label)}</a>`).join('')}</div>
  </div>`);

  if (concept.credits) {
    blocks.push(`<div class="rail-block">
      <h3>Builds on</h3>
      <p class="rail-note">${escapeHtml(concept.credits)}</p>
    </div>`);
  }

  return `<div class="rail">${blocks.join('')}</div>`;
}

function renderTakeaways(concept) {
  if (!concept.takeaways.length) return '';
  return `
  <section class="section" aria-labelledby="takeaways-title">
    <div class="section-head">
      <h2 class="section-title" id="takeaways-title"><span class="mark"></span>Key takeaways</h2>
      <p class="section-note">What this concept argues for, independent of how it was made.</p>
    </div>
    <ul class="takeaways">${concept.takeaways.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
  </section>`;
}

function renderMoments(concept) {
  if (!concept.moments.length) return '';

  const items = concept.moments.map(moment => {
    const from = moment.sourceNumber ? `From exploration ${moment.sourceNumber}` : 'Standalone clip';
    const poster = moment.thumbnail || (moment.type === 'image' ? moment.media : '');
    const range = moment.t ? `${timecode(moment.t[0])} &ndash; ${timecode(moment.t[1])}` : '';

    return `
      <button type="button" class="moment" ${mediaAttrs({ ...moment, title: moment.label, sub: from })}>
        <span class="moment-inner">
          <span class="moment-media">
            ${poster ? `<img src="${escapeHtml(poster)}" alt="" loading="lazy" decoding="async">` : ''}
            ${range ? `<span class="moment-time">${range}</span>` : ''}
          </span>
          <span class="moment-text">
            <span class="moment-label">${escapeHtml(moment.label)}</span>
            <span class="moment-from">${escapeHtml(from)}</span>
          </span>
        </span>
      </button>`;
  }).join('');

  return `
  <section class="section" aria-labelledby="moments-title">
    <div class="section-head">
      <h2 class="section-title" id="moments-title"><span class="mark"></span>Selected moments</h2>
      <p class="section-note">The seconds worth keeping. No single exploration carries the whole idea — together these do.</p>
    </div>
    <div class="moments">${items}</div>
  </section>`;
}

function renderExploration(exploration) {
  const poster = exploration.thumbnail || (exploration.type === 'image' ? exploration.media : '');
  const verdict = [
    ...exploration.keep.map(v => `<li class="keep">${escapeHtml(v)}</li>`),
    ...exploration.drop.map(v => `<li class="drop">${escapeHtml(v)}</li>`),
  ].join('');

  return `
      <article class="exp">
        <div class="exp-inner">
          <button type="button" class="exp-media"
            ${mediaAttrs({ ...exploration, title: `Exploration ${exploration.number} — ${exploration.focus}`, sub: exploration.tools.join(' · ') })}>
            ${poster ? `<img src="${escapeHtml(poster)}" alt="" loading="lazy" decoding="async">` : ''}
            <span class="exp-index">${exploration.number}</span>
          </button>
          <div class="exp-text">
            <h4 class="exp-focus">${escapeHtml(exploration.focus)}</h4>
            ${verdict ? `<ul class="verdict">${verdict}</ul>` : ''}
            ${exploration.tools.length ? `<div class="exp-foot">${exploration.tools.map(t => `<span>${escapeHtml(t)}</span>`).join('')}</div>` : ''}
          </div>
        </div>
      </article>`;
}

function renderExplorations(concept) {
  const { explorations, directions } = concept;
  if (!explorations.length) return '';

  const count = explorations.length;
  let body;

  if (directions.length) {
    const grouped = directions.map(direction => {
      const members = explorations.filter(e => e.direction === direction.id);
      if (!members.length) return '';
      return `
    <div class="direction">
      <div class="direction-head">
        <h3 class="direction-name">${escapeHtml(direction.title)}</h3>
        ${direction.note ? `<p class="direction-note">${escapeHtml(direction.note)}</p>` : ''}
      </div>
      <div class="explorations">${members.map(renderExploration).join('')}</div>
    </div>`;
    });

    const ungrouped = explorations.filter(e => !e.direction);
    if (ungrouped.length) {
      grouped.push(`
    <div class="direction">
      <div class="direction-head"><h3 class="direction-name">Unsorted</h3></div>
      <div class="explorations">${ungrouped.map(renderExploration).join('')}</div>
    </div>`);
    }
    body = grouped.join('');
  } else {
    body = `<div class="explorations">${explorations.map(renderExploration).join('')}</div>`;
  }

  return `
  <section class="section" aria-labelledby="explorations-title">
    <div class="section-head">
      <h2 class="section-title" id="explorations-title"><span class="mark"></span>Visual explorations</h2>
      <p class="section-note">${count} attempt${count === 1 ? '' : 's'} at the idea — supporting evidence, not the proposal itself. Marked for what to keep and what to leave behind.</p>
    </div>
    ${body}
  </section>`;
}

/* =============================================================
   Concept page
   ============================================================= */

/* Line marks for the proposal flow, one per step position. */
const STEP_ICONS = ['stepIdle', 'stepBurst', 'stepBlade', 'stepTarget'];

const STEP_PATHS = {
  stepIdle:   '<path d="M12 3.5 19 8v8l-7 4.5L5 16V8z"/><path d="M12 8.5 15.5 11v3.4L12 16.5 8.5 14.4V11z"/>',
  stepBurst:  '<circle cx="12" cy="12" r="3.2"/><path d="M12 2v3.6M12 18.4V22M2 12h3.6M18.4 12H22M5.2 5.2l2.6 2.6M16.2 16.2l2.6 2.6M18.8 5.2l-2.6 2.6M7.8 16.2l-2.6 2.6"/>',
  stepBlade:  '<path d="M4 20 20 4M20 20 4 4"/><circle cx="12" cy="12" r="2.4"/>',
  stepTarget: '<circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="3.4"/><path d="M12 1.6v3.2M12 19.2v3.2M1.6 12h3.2M19.2 12h3.2"/>',
};

const stepIcon = name =>
  `<svg class="pf-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${STEP_PATHS[name]}</svg>`;

/** Flow steps may be written "Name — description". */
function splitStep(step) {
  const [name, ...rest] = String(step).split(/\s+[—-]\s+/);
  return { name, detail: rest.join(' — ') };
}

const prettyDate = value => {
  if (!value) return '';
  const [y, m, d] = String(value).split('-').map(Number);
  if (!y || !m || !d) return escapeHtml(value);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[m - 1]} ${d}, ${y}`;
};

const compact = n => (n >= 1000 ? `${(n / 1000).toFixed(n % 1000 >= 100 ? 1 : 0)}k` : String(n));

/* --- header and player ----------------------------------------------------- */

function cxHeader(concept) {
  const typeLabel = TYPES[concept.type].label;
  /* "Worlds" and "World" are one word to a reader, so the badge does not
     print both. */
  const same = (a, b) => a.toLowerCase().replace(/s$/, '') === b.toLowerCase().replace(/s$/, '');
  const tags = concept.categories.map(c => CATEGORY_LABEL[c]).filter(Boolean);
  const lead = tags.find(t => !same(t, typeLabel));
  const primary = lead ? `${lead} ${typeLabel}` : typeLabel;
  const rest = tags.filter(t => t !== lead && !same(t, typeLabel));

  return `
  <header class="cd-head">
    <div class="cd-tags">
      <span class="chip-cat">${escapeHtml(primary)}</span>
      ${rest.map(t => `<span class="chip-tag">${escapeHtml(t)}</span>`).join('')}
    </div>

    <h1 class="cd-title">${escapeHtml(concept.title)}</h1>
    <p class="cd-summary">${escapeHtml(concept.summary)}</p>

    <div class="cd-actions">
      <div class="follow">
        <!-- Names its object: the button sits under the title, where "Follow"
             alone reads as though it might mean the person who posted. -->
        <button type="button" class="follow-b" data-follow aria-pressed="false">
          ${ph('user-plus')}<span data-follow-label>Follow concept</span>
        </button>
        <span class="follow-count" data-follow-count>${compact(concept.followers ?? 0)}</span>
      </div>
      <button type="button" class="sq" data-save aria-pressed="false">
        ${ph('bookmark-simple')}${ph('bookmark-simple', 'fill')}<span data-save-label>Bookmark</span>
      </button>
      <button type="button" class="sq" data-share>${ph('share-network')}Share</button>
    </div>
  </header>`;
}

function cxPlayer(concept) {
  const cover = concept.cover;
  if (!cover) return '';
  const poster = coverPoster(cover) || cover.media;
  const isVideo = cover.type === 'video';
  const ytId = cover.type === 'youtube' ? youtubeId(cover.media) : null;

  /* A YouTube cover renders as its own still until it is clicked, and only then
     loads the embed. That keeps the page free of YouTube's script and cookies
     for every reader who never presses play, and the embed brings its own
     controls, so the bar below is left off. */
  if (ytId) {
    return `
  <div class="vp vp-yt" data-youtube="${escapeHtml(ytId)}">
    <img src="${escapeHtml(poster)}" alt="${escapeHtml(concept.title)}">
    <button type="button" class="vp-play" aria-label="Play on YouTube">${ph('play', 'fill')}</button>
  </div>`;
  }

  return `
  <div class="vp" data-video="${isVideo ? escapeHtml(cover.media) : ''}">
    ${isVideo
      ? `<video preload="metadata" playsinline poster="${escapeHtml(poster)}" src="${escapeHtml(cover.media)}"></video>`
      : `<img src="${escapeHtml(poster)}" alt="${escapeHtml(concept.title)}">`}

    <button type="button" class="vp-play" aria-label="Play">${ph('play', 'fill')}</button>

    <div class="vp-bar">
      <span class="vp-track" data-vp="track"><span class="vp-buffer"></span><span class="vp-fill"></span><span class="vp-knob"></span></span>
      <div class="vp-row">
        <div class="vp-left">
          <button type="button" class="vp-b" data-vp="toggle" aria-label="Play">${ph('play', 'fill')}</button>
          <span class="vp-time"><span data-vp="now">0:00</span> / <span data-vp="dur">${escapeHtml(concept.duration ?? '1:08')}</span></span>
        </div>
        <div class="vp-right">
          <button type="button" class="vp-b" aria-label="Volume">${ph('speaker-high')}</button>
          <button type="button" class="vp-b" aria-label="Settings">${ph('gear')}</button>
          <button type="button" class="vp-b" aria-label="Fullscreen">${ph('corners-out')}</button>
        </div>
      </div>
    </div>
  </div>`;
}

/* --- overview panel -------------------------------------------------------- */

/* One mark per step position: aim, charge, build, release. */
const FLOW_GLYPHS = ['crosshair', 'lightning', 'target', 'arrows-merge', 'star-four'];

function cxProposal(block) {
  const steps = block.steps.map(splitStep);
  return `
  <section class="ov-sec">
    <h2 class="ov-h">${escapeHtml(block.heading ?? 'The proposal')}</h2>
    <ol class="pflow">${steps.map((step, i) => `
      <li${i === steps.length - 1 ? ' class="pf-end"' : ''}>
        <span class="pf-mark">${ph(FLOW_GLYPHS[i % FLOW_GLYPHS.length])}</span>
        <span class="pf-name">${i + 1}. ${escapeHtml(step.name)}</span>
        ${step.detail ? `<span class="pf-detail">${escapeHtml(step.detail)}</span>` : ''}
      </li>`).join('')}</ol>
  </section>`;
}

function cxOverviewBlock(block) {
  if (block.type === 'flow') return cxProposal(block);
  const head = block.heading ? `<h2 class="ov-h">${escapeHtml(block.heading)}</h2>` : '';

  switch (block.type) {
    case 'prose':
      return `<section class="ov-sec">${head}<div class="ov-body">${paragraphs(block.text)}</div></section>`;
    case 'list':
      return `<section class="ov-sec">${head}
        <ul class="ov-bullets">${block.items.map(i => `<li>${ph('check-circle')}<span>${escapeHtml(i)}</span></li>`).join('')}</ul></section>`;
    case 'timeline':
      return `<section class="ov-sec">${head}
        <ol class="timeline">${block.steps.map(s => `<li><span>${escapeHtml(s)}</span></li>`).join('')}</ol></section>`;
    case 'quote':
      return `<section class="ov-sec"><blockquote class="pull">${escapeHtml(block.text)}</blockquote></section>`;
    case 'image':
      return `<figure class="ov-fig">${head}
        <img src="${escapeHtml(block.media)}" alt="${escapeHtml(block.caption ?? '')}" loading="lazy" decoding="async">
        ${block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : ''}</figure>`;
    default:
      return '';
  }
}

const KT_GLYPHS = ['users-three', 'stack', 'medal'];

function cxTakeaways(concept) {
  if (!concept.takeaways.length) return '';
  return `
  <aside class="kt-card">
    <h2 class="kt-h">Key takeaways</h2>
    <ul class="kt">${concept.takeaways.map((t, i) => `
      <li>${ph(KT_GLYPHS[i % KT_GLYPHS.length])}<span>${escapeHtml(t)}</span></li>`).join('')}</ul>
  </aside>`;
}

function cxExplorationCard(e) {
  const poster = e.thumbnail || (e.type === 'image' ? e.media : '');
  const tag = e.duration || (e.type === 'video' ? 'Video' : 'Still');
  return `
  <article class="xc">
    <button type="button" class="xc-media"
      ${mediaAttrs({ ...e, title: `Exploration ${e.number} — ${e.focus}`, sub: e.tools.join(' · ') })}>
      ${poster ? `<img src="${escapeHtml(poster)}" alt="" loading="lazy" decoding="async">` : ''}
      <span class="xc-scrim"></span>
      <span class="xc-tag">${escapeHtml(tag)}</span>
      <span class="xc-hover">${ph('play', 'fill')}</span>
    </button>
    <div class="xc-text">
      <h3 class="xc-title">${escapeHtml(e.focus)}</h3>
      <div class="xc-foot">
        <span class="xc-by">${avatar(e.avatar)}${escapeHtml(e.author ?? '')}</span>
        <span class="xc-stats">
          <span>${ph('heart')}${e.likes ?? 0}</span>
          <span>${ph('chat-circle')}${e.comments ?? 0}</span>
        </span>
      </div>
    </div>
  </article>`;
}

function cxExplorations(concept) {
  const list = concept.explorations;
  if (!list.length) return '';
  const shown = list.slice(0, 4);

  return `
  <section class="ov-xs">
    <div class="ov-xs-head">
      <h2 class="ov-h">Explorations</h2>
      <button type="button" class="ov-more" data-goto="explorations">View all explorations ${ph('arrow-right')}</button>
    </div>
    <div class="xgrid">${shown.map(cxExplorationCard).join('')}</div>
  </section>`;
}

/* --- related work ---------------------------------------------------------- */

function cxReferences(concept) {
  const list = concept.connections.filter(c => c.target);
  if (!list.length) return '';
  const shown = list.slice(0, 4);

  return `
  <section class="rel">
    <div class="rel-head">
      <h2 class="rel-h">References</h2>
      ${list.length > shown.length ? `<span class="rel-count">${shown.length} of ${list.length}</span>` : ''}
    </div>
    <ul class="rel-list">${shown.map(c => {
      const t = c.target;
      const e = c.explorationRef;
      const poster = (e && (e.thumbnail || (e.type === 'image' ? e.media : '')))
        || coverPoster(t.cover);
      return `
      <li>
        <a class="rel-row" href="${t.url}">
          <span class="rel-thumb">${poster
            ? `<img src="${escapeHtml(poster)}" alt="" loading="lazy">`
            : glyph(t.type, 'i')}</span>
          <span class="rel-body">
            <span class="rel-title">${escapeHtml(t.title)}</span>
            <span class="rel-by">${escapeHtml(t.creator)}</span>
          </span>
          ${c.note ? `<span class="rel-note">${escapeHtml(c.note)}</span>` : ''}
          <span class="rel-go">${ph('arrow-right')}</span>
        </a>
      </li>`;
    }).join('')}</ul>
  </section>`;
}

function cxInspired(concept) {
  const list = concept.citedBy;
  if (!list.length) return '';
  const shown = list.slice(0, 4);

  return `
  <section class="rel">
    <div class="rel-head">
      <h2 class="rel-h">Inspired by this</h2>
      ${list.length > shown.length ? `<span class="rel-count">${shown.length} of ${list.length}</span>` : ''}
    </div>
    <ul class="rel-list">${shown.map(entry => {
      const c = entry.source;
      const poster = coverPoster(c.cover);
      return `
      <li>
        <a class="rel-row" href="${c.url}">
          <span class="rel-thumb">${poster
            ? `<img src="${escapeHtml(poster)}" alt="" loading="lazy">`
            : glyph(c.type, 'i')}</span>
          <span class="rel-body">
            <span class="rel-title">${escapeHtml(c.title)}</span>
            <span class="rel-by">${escapeHtml(c.creator)}</span>
          </span>
          <span class="rel-stats">
            <span>${ph('stack')}${c.explorations.length}</span>
            <span>${ph('users')}${c.citedBy.length}</span>
          </span>
        </a>
      </li>`;
    }).join('')}</ul>
  </section>`;
}

/* --- sidebar --------------------------------------------------------------- */

function sbStatus(concept) {
  const rows = [
    concept.date ? ['Created', prettyDate(concept.date)] : null,
    concept.updated ? ['Last updated', prettyDate(concept.updated)] : null,
    ['Explorations', String(concept.explorations.length)],
  ].filter(Boolean);

  return `
  <section class="sb">
    <h2 class="sb-h">Status</h2>
    <span class="pill pill-${escapeHtml(concept.status)}">${escapeHtml(STATUSES[concept.status])}</span>
    <dl class="sb-rows">${rows.map(([term, value]) => `
      <div><dt>${escapeHtml(term)}</dt><dd>${value}</dd></div>`).join('')}</dl>
  </section>`;
}

function sbCreator(concept, stats) {
  return `
  <section class="sb">
    <h2 class="sb-h">Creator</h2>
    <div class="cr">
      ${avatar(concept.creatorAvatar)}
      <div class="cr-id">
        <p class="cr-name">${escapeHtml(concept.creator)}${
          concept.creatorVerified ? ph('check-circle', 'fill') : ''}</p>
        <p class="cr-handle">@${escapeHtml(String(concept.creator).toLowerCase())}</p>
      </div>
    </div>
    <div class="cr-stats">
      <div><span>Concepts</span><b>${compact(stats.concepts)}</b></div>
      <div><span>Followers</span><b>${compact(concept.creatorFollowers ?? 0)}</b></div>
      <div><span>Reputation</span><b>${compact(concept.creatorKarma ?? 0)}</b></div>
    </div>
  </section>`;
}

/* The mark matches the verb, so the column scans without reading. */
const ACT_GLYPHS = [
  [/comment|repl/i, 'chat-circle'],
  [/follow/i, 'user-plus'],
  [/bookmark|save/i, 'bookmark-simple'],
  [/upvote|like/i, 'arrow-up'],
  [/explor|add|post/i, 'plus'],
];
const actGlyph = action => (ACT_GLYPHS.find(([test]) => test.test(action)) ?? [null, 'circle'])[1];

function sbActivity(concept) {
  const list = concept.activity ?? [];
  if (!list.length) return '';
  return `
  <section class="sb">
    <h2 class="sb-h">Recent activity</h2>
    <ul class="act">${list.map(a => `
      <li>
        <span class="act-mark">${ph(actGlyph(a.action))}</span>
        <span class="act-line"><b>${escapeHtml(a.actor)}</b> ${escapeHtml(a.action)}</span>
        <span class="act-time">${escapeHtml(a.at)}</span>
      </li>`).join('')}</ul>
  </section>`;
}

/* --- overview ---------------------------------------------------------------
   Exported because the contribute form previews through it. A preview that
   drifts from the page is worse than no preview, so both call one function. */

export function renderOverview(concept, { question = null } = {}) {
  const answering = question
    ? `<p class="answering">Answering <a href="${question.url}">${escapeHtml(question.question)}</a></p>`
    : '';

  /* Newer concepts arrive as one article, written in the editor and cleaned
     by the server before it was stored. Older ones are still the structured
     blocks below, which is why both paths exist. */
  if (concept.article) {
    return `
      <div class="ov" data-panel="overview">
        <div class="ov-article">
          <article class="prose">${concept.article}</article>
          ${answering}
        </div>
        ${cxTakeaways(concept)}
        ${cxExplorations(concept)}
        <div class="cd-related">
          ${cxReferences(concept)}
          ${cxInspired(concept)}
        </div>
      </div>`;
  }

  /* Two rows: the idea beside the flow that carries it, then the argument
     beside the takeaways. A concept without a flow block simply leaves the
     right half of the first row empty. */
  const body = concept.body ?? [];
  const flow = body.find(b => b.type === 'flow');
  const lead = body.find(b => b.type === 'prose');
  const rest = body.filter(b => b !== flow && b !== lead);

  return `
      <div class="ov" data-panel="overview">
        <div class="ov-split">
          <div class="ov-col">
            ${lead ? cxOverviewBlock(lead) : ''}
            ${answering}
          </div>
          <div class="ov-col">${flow ? cxOverviewBlock(flow) : ''}</div>
        </div>

        <div class="ov-split">
          <div class="ov-col">${rest.map(cxOverviewBlock).join('')}</div>
          <div class="ov-col">${cxTakeaways(concept)}</div>
        </div>

        ${cxExplorations(concept)}

        <div class="cd-related">
          ${cxReferences(concept)}
          ${cxInspired(concept)}
        </div>
      </div>`;
}

/* --- page ------------------------------------------------------------------ */

export function renderConceptPage(concept, {
  template, partials, questionsBySlug = {}, allConcepts = [],
} = {}) {
  const image = concept.cover ? (concept.cover.thumbnail || concept.cover.media) : '';
  const question = concept.question ? questionsBySlug[concept.question] : null;
  const byCreator = allConcepts.filter(c => c.creator === concept.creator).length || 1;

  const tabs = [
    ['overview', 'Overview', null],
    ['explorations', 'Explorations', concept.explorations.length],
    ['discussion', 'Discussion', concept.discussionCount ?? 0],
    ['changelog', 'Changelog', concept.changelogCount ?? 0],
  ];


  const body = `
<main class="cd" id="main">
  ${iconSprite()}
  <a class="cd-back" href="/">${ph('caret-left')}Back to all concepts</a>

  <div class="cd-top">
    ${cxHeader(concept)}
    ${cxPlayer(concept)}
  </div>

  <div class="cd-tabs" role="tablist">${tabs.map(([id, label, count], i) => `
    <button type="button" class="cd-tab" role="tab" data-tab="${id}" aria-selected="${i === 0}"
      >${escapeHtml(label)}${count ? ` <span class="cnt">${count}</span>` : ''}</button>`).join('')}
  </div>

  <div class="cd-grid">
    <div class="cd-main">
      ${renderOverview(concept, { question })}

      <div class="ov" data-panel="explorations" hidden>
        <h2 class="ov-h">All explorations <span class="cnt">${concept.explorations.length}</span></h2>
        <div class="xgrid">${concept.explorations.map(cxExplorationCard).join('')}</div>
        ${concept.moments.length ? renderMoments(concept) : ''}
      </div>

      <div class="ov ov-empty" data-panel="discussion" hidden>
        <h2 class="ov-h">Discussion</h2>
        <p>Comments are not open on the board yet.</p>
      </div>

      <div class="ov ov-empty" data-panel="changelog" hidden>
        <h2 class="ov-h">Changelog</h2>
        <p>Revision history is not recorded yet.</p>
      </div>
    </div>

    <aside class="cd-side">
      ${sbStatus(concept)}
      ${sbCreator(concept, { concepts: byCreator })}
      ${sbActivity(concept)}
    </aside>
  </div>
</main>`;

  const cover = image ? (image.startsWith('/') ? SITE + image : image) : DEFAULT_IMAGE;

  const html = fill(template, {
    TITLE: escapeHtml(concept.title),
    DESCRIPTION: escapeHtml(concept.summary),
    PATH: concept.url,
    IMAGE: escapeHtml(cover),
    CONCEPT: body,
  });

  return resolveIncludes(html, partials, jsonLdBlock({
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: concept.title,
    headline: concept.title,
    description: concept.summary,
    url: SITE + concept.url,
    image: cover,
    ...(concept.date ? { datePublished: String(concept.date).slice(0, 10) } : {}),
    author: { '@type': 'Person', name: concept.creator },
    creator: { '@type': 'Person', name: concept.creator },
    genre: concept.categories.map(c => CATEGORY_LABEL[c]).filter(Boolean),
    isPartOf: { '@type': 'WebSite', name: 'WE ARE DESTINY 3', url: `${SITE}/` },
    /* Fan work about someone else's property — saying so in the data as well
       as in the footer. */
    isAccessibleForFree: true,
    about: { '@type': 'VideoGame', name: 'Destiny' },
  }));
}

/* A <script> block, with the one sequence that could close it early neutered.
   JSON has no way to express `</script>`, so escaping the slash is safe. */
function jsonLdBlock(data) {
  const json = JSON.stringify(data).replace(/<\//g, '<\\/');
  return `<script type="application/ld+json">\n${json}\n</script>`;
}

/* --- question page -------------------------------------------------------- */

export function renderQuestionPage(question, { template, partials }) {
  const count = question.concepts.length;

  const answers = count
    ? `<div class="grid">${question.concepts.map(c => renderCard(c)).join('')}</div>`
    : `<div class="state">
         <p class="eyebrow"><span class="mark"></span>Unanswered</p>
         <h2>Nobody has taken this one yet.</h2>
         <p>Answer it however you want — a design proposal, a piece of lore, a render, a prototype,
            a single diagram. The first answer sets the terms everyone else argues with.</p>
         <a class="btn btn-primary" href="/contribute/">Answer this question</a>
       </div>`;

  const html = fill(template, {
    TITLE: escapeHtml(question.question),
    DESCRIPTION: escapeHtml(question.context || `An open question for Destiny 3. ${count} concept${count === 1 ? '' : 's'} so far.`),
    PATH: question.url,
    QUESTION: escapeHtml(question.question),
    CATEGORIES: question.categories.map(c => escapeHtml(CATEGORY_LABEL[c])).join(' <span class="sep">&middot;</span> '),
    COUNT: count ? `${count} concept${count === 1 ? '' : 's'}` : 'Unanswered',
    CONTEXT: question.context ? `<div class="prose-body">${paragraphs(question.context)}</div>` : '',
    DISCUSSION: question.discussion
      ? `<a class="btn btn-ghost" href="${escapeHtml(question.discussion)}" rel="noopener">Join the discussion</a>`
      : '',
    ANSWERS: answers,
  });

  return resolveIncludes(html, partials);
}


/* --- iconography ---------------------------------------------------------
   Small geometric marks, one path set, stroked with currentColor. */

const PATHS = {
  grid:     '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  list:     '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  gamepad:  '<path d="M6 12h4M8 10v4M15.5 11h.01M18 13.5h.01"/><rect x="2" y="6" width="20" height="12" rx="5"/>',
  globe:    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18"/>',
  book:     '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v16H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 17.5h16"/>',
  layers:   '<path d="M12 2 2 7l10 5 10-5z"/><path d="M2 12l10 5 10-5"/><path d="M2 17l10 5 10-5"/>',
  monitor:  '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M9 21h6M12 17v4"/>',
  weapon:   '<path d="M3 16 16 3l5 5L8 21H3z"/><path d="M11 8l5 5"/>',
  ability:  '<path d="M12 2v5M12 17v5M2 12h5M17 12h5M5.6 5.6l3.5 3.5M14.9 14.9l3.5 3.5M18.4 5.6l-3.5 3.5M9.1 14.9l-3.5 3.5"/><circle cx="12" cy="12" r="2.6"/>',
  users:    '<circle cx="9" cy="8" r="3.4"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 5.2a3.4 3.4 0 0 1 0 5.6M17.5 14.4A6.5 6.5 0 0 1 21.5 20"/>',
  audio:    '<path d="M3 12h2l2-6 3 14 3-11 2 5h6"/>',
  eye:      '<path d="M1.8 12S5.6 5.5 12 5.5 22.2 12 22.2 12 18.4 18.5 12 18.5 1.8 12 1.8 12z"/><circle cx="12" cy="12" r="3"/>',
  bookmark: '<path d="M6 3h12v18l-6-4.6L6 21z"/>',
  arrow:    '<path d="M4 12h15M13 6l6 6-6 6"/>',
  chevron:  '<path d="M6 9l6 6 6-6"/>',
  chevronR: '<path d="M9 6l6 6-6 6"/>',
  github:   '<path d="M9 19c-4.6 1.4-4.6-2.3-6.4-2.8m12.8 6v-3.6a3.1 3.1 0 0 0-.9-2.4c2.9-.3 6-1.4 6-6.4a5 5 0 0 0-1.4-3.5 4.6 4.6 0 0 0-.1-3.5s-1.1-.3-3.7 1.4a12.6 12.6 0 0 0-6.6 0C6.1 2.5 5 2.8 5 2.8a4.6 4.6 0 0 0-.1 3.5A5 5 0 0 0 3.5 9.9c0 5 3 6.1 5.9 6.4a3.1 3.1 0 0 0-.9 2.4V22"/>',
  spark:    '<path d="M12 2v6M12 16v6M2 12h6M16 12h6"/><path d="M12 8.5 15.5 12 12 15.5 8.5 12z"/>',
  compass:  '<circle cx="12" cy="12" r="9.2"/><path d="M12 2.8v3.4M12 17.8v3.4M2.8 12h3.4M17.8 12h3.4"/><path d="M12 8.4 15.6 12 12 15.6 8.4 12z"/>',
  heart:    '<path d="M12 20.5 4.2 13a4.6 4.6 0 0 1 6.5-6.5l1.3 1.3 1.3-1.3A4.6 4.6 0 1 1 19.8 13z"/>',
  comment:  '<path d="M20.5 12a8.5 8.5 0 0 1-12.3 7.6L3.5 21l1.4-4.7A8.5 8.5 0 1 1 20.5 12z"/>',
  shield:   '<path d="M12 2.6 20 6v6c0 4.6-3.4 7.6-8 9.4-4.6-1.8-8-4.8-8-9.4V6z"/><path d="M9 12l2.2 2.2L15.4 10"/>',
  question: '<path d="M9.2 9a2.9 2.9 0 1 1 3.9 2.7c-.7.3-1.1 1-1.1 1.8v.5"/><path d="M12 17.6h.01"/>',
  community:'<circle cx="12" cy="12" r="9.2"/><circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v5.6M12 15.6v5.6M2.8 12h5.6M15.6 12h5.6"/>',
};

export const icon = (name, cls = 'i') =>
  `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${PATHS[name] ?? ''}</svg>`;

/* Category identity — semantic hue per kind of contribution. */
const ACCENT = {
  world: 'var(--t-world)', worlds: 'var(--t-world)',
  design: 'var(--t-design)', gameplay: 'var(--t-design)',
  lore: 'var(--t-lore)',
  systems: 'var(--t-systems)',
  visual: 'var(--t-visual)', ui: 'var(--t-visual)',
  prototype: 'var(--t-prototype)',
  vision: 'var(--t-vision)',
};

export const avatar = ([a, b] = ['#3C2A6E', '#1B1230']) =>
  `<span class="avatar" style="--a1:${esc(a)};--a2:${esc(b)}"></span>`;

/* --- adapters ------------------------------------------------------------
   Real concepts and the seed both collapse to the same card shape, so the
   renderer below never needs to know which it is looking at. */

function fromConcept(concept) {
  const thumb = coverPoster(concept.cover);
  const categories = concept.categories.map(c => CATEGORY_LABEL[c]).filter(Boolean);

  return {
    id: concept.slug,
    href: concept.url,
    title: concept.title,
    description: concept.summary,
    author: concept.creator,
    avatar: undefined,
    category: concept.type,
    categoryLabel: (() => {
      const type = TYPES[concept.type].label;
      /* "World" and "Worlds" are the same word to a reader. */
      const same = (a, b) => a.toLowerCase().replace(/s$/, '') === b.toLowerCase().replace(/s$/, '');
      const other = categories.find(c => !same(c, type));
      return other ? `${type} / ${other}` : type;
    })(),
    visualType: thumb ? 'image' : 'text',
    thumbnail: thumb,
    filter: concept.categories[0] ?? '',
    typeId: concept.type,
    statusId: concept.status,
    explorationCount: concept.explorations.length,
    /* Derived, not invented: how much work sits under the idea, and how
       many other concepts point at it. */
    metrics: [
      { icon: 'layers', value: concept.explorations.length, label: 'explorations' },
      { icon: 'users', value: concept.citedBy.length, label: 'citations' },
    ],
    status: STATUSES[concept.status],
  };
}

function fromSeed(entry) {
  return {
    id: entry.id,
    href: '/contribute/',
    title: entry.title,
    description: entry.description,
    author: entry.author,
    avatar: entry.avatar,
    category: entry.category,
    categoryLabel: entry.categoryLabel,
    visualType: entry.visualType,
    thumbnail: entry.thumbnail,
    filter: entry.filter ?? '',
    typeId: entry.category ?? '',
    statusId: '',
    explorationCount: 0,
    metrics: [
      { icon: 'eye', value: entry.views, label: 'views' },
      { icon: 'users', value: entry.contributors, label: 'contributors' },
    ],
    bookmarked: entry.bookmarked,
  };
}

/* --- components ----------------------------------------------------------- */

/* Metrics are named for what they count, so the icon font never leaks
   into the adapters above. */
const METRIC_GLYPH = { eye: 'eye', users: 'users', layers: 'stack' };

function conceptCard(card, index = 0, { lead: allowLead = true } = {}) {
  const accent = ACCENT[card.category] ?? 'var(--light)';
  const lead = allowLead && index === 0;
  const hasImage = (card.visualType === 'image' || card.visualType === 'visual') && card.thumbnail;

  const metrics = card.metrics.map(m =>
    `<span class="metric">${ph(METRIC_GLYPH[m.icon] ?? m.icon)}<span class="sr">${esc(m.label)}</span>${esc(m.value)}</span>`).join('');

  return `
      <article class="ccard ${lead ? 'ccard-lead' : 'ccard-small'} ${hasImage ? 'ccard-image' : 'ccard-text'}"
         style="--accent:${accent}"
         data-id="${esc(card.id)}" data-title="${esc(card.title)}" data-category="${esc(card.filter ?? '')}"
         data-type="${esc(card.typeId ?? '')}" data-status="${esc(card.statusId ?? '')}"
         data-explorations="${esc(card.explorationCount ?? 0)}">
        <span class="ccard-media" aria-hidden="true">${hasImage
          ? `<span class="ccard-img" style="--img:url('${esc(card.thumbnail)}')"></span>`
          : `<span class="ccard-wash"></span>`}</span>
        <span class="ccard-scrim" aria-hidden="true"></span>
        <span class="badge">${esc(card.categoryLabel)}</span>
        <button type="button" class="bookmark" aria-pressed="false"
                aria-label="Save ${esc(card.title)}">${ph('bookmark')}${ph('bookmark', 'fill')}</button>
        <div class="ccard-body">
          <h3 class="ccard-title"><a href="${esc(card.href)}">${esc(card.title)}</a></h3>
          <p class="ccard-desc">${esc(card.description)}</p>
          <div class="ccard-foot">
            <span class="ccard-author">${avatar(card.avatar)}<span>${esc(card.author)}</span>${ph('check-circle', 'fill')}</span>
            <span class="metrics">${metrics}</span>
          </div>
        </div>
      </article>`;
}

/* Each open question gets its own glyph and hue so the three cards read as
   three different lines of enquiry rather than one repeated tile. */
const QUESTION_TONES = [
  { glyph: 'chart-polar', tone: '#3B82F6' },
  { glyph: 'planet',      tone: '#2DD4BF' },
  { glyph: 'users-three', tone: '#FB923C' },
];

function questionCard(q, index = 0) {
  const { glyph, tone } = QUESTION_TONES[index % QUESTION_TONES.length];
  const faces = (q.participants ?? []).slice(0, 3);
  const more = Math.max(0, (q.participantCount ?? faces.length) - faces.length);

  return `
      <article class="qcard" style="--tone:${tone}" data-id="${esc(q.id ?? '')}">
        <span class="qblob" aria-hidden="true"></span>
        <div class="qtop">
          <span class="qglyph">${ph(glyph)}</span>
          <button type="button" class="qsave" aria-pressed="false"
                  aria-label="Save this question">${ph('bookmark')}${ph('bookmark', 'fill')}</button>
        </div>
        <h3 class="qtext"><a href="${esc(q.href ?? '/contribute/')}">${esc(q.question)}</a></h3>
        <p class="qmeta">${esc(q.meta)}</p>
        <div class="stack">${faces.map(avatar).join('')}${
          more ? `<span class="stack-more">+${esc(more)}</span>` : ''}</div>
      </article>`;
}

/* --- browse ----------------------------------------------------------------
   Every published concept, rendered server-side so the page is complete and
   crawlable without JavaScript. The controls above it filter what is already
   on the page rather than fetching anything. */

export function renderBrowsePage(board, { template, partials, query = {} }) {
  return resolveIncludes(fill(template, {
    TITLE: 'Every concept — WE ARE DESTINY 3',
    OG_TITLE: 'Every concept',
    DESCRIPTION: `Every community concept on the board — ${board.concepts.length} and counting.`,
    PATH: '/concepts/',
    IMAGE: DEFAULT_IMAGE,
    BROWSE: renderBrowse({ ...board, query }),
  }), partials);
}

function renderBrowse({ concepts, stats, query = {} }) {
  const cards = concepts.map(fromConcept);
  const flat = (card, i) => conceptCard(card, i, { lead: false });

  const tally = pick => {
    const counts = new Map();
    for (const concept of concepts) for (const value of pick(concept)) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return counts;
  };
  const byCategory = tally(c => c.categories);
  const byType = tally(c => [c.type]);

  const chip = (facet, value, label, count) => `
        <button type="button" class="fbtn" data-facet="${facet}" data-value="${esc(value)}"
          aria-pressed="${String(query[facet] === value || (facet === 'filter' && value === 'all' && !query.filter))}"
          >${esc(label)}${count == null ? '' : ` <span class="fbtn-n">${count}</span>`}</button>`;

  const categoryChips = [chip('filter', 'all', 'All', concepts.length)]
    .concat(CATEGORIES
      .filter(c => byCategory.get(c.id))
      .map(c => chip('filter', c.id, c.label, byCategory.get(c.id))))
    .join('');

  const typeChips = Object.entries(TYPES)
    .filter(([id]) => byType.get(id))
    .map(([id, meta]) => chip('type', id, meta.label, byType.get(id)))
    .join('');

  return `
<div class="home browse">
  ${iconSprite()}

  <header class="browse-head">
    <h1 class="browse-title">Every concept</h1>
    <p class="browse-sub">${esc(concepts.length)} on the board, from ${esc(stats.contributors)} ${
      stats.contributors === 1 ? 'contributor' : 'contributors'}.</p>
  </header>

  <div class="browse-bar">
    <div class="browse-search">
      ${ph('magnifying-glass')}
      <label class="sr" for="browse-q">Search concepts</label>
      <input id="browse-q" type="search" placeholder="Search concepts"
             value="${esc(query.q ?? '')}" autocomplete="off">
    </div>
    <div class="browse-sort">
      <label class="sr" for="browse-sort">Sort</label>
      <select id="browse-sort">
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
        <option value="title">A – Z</option>
        <option value="explorations">Most explorations</option>
      </select>
    </div>
  </div>

  <nav class="browse-facets" aria-label="Filter concepts">
    <div class="facet-row" id="filters">${categoryChips}</div>
    <div class="facet-row facet-row-type">${typeChips}</div>
  </nav>

  <p class="browse-count" id="browse-count" role="status" aria-live="polite"></p>

  <div class="cards cards-flat" id="browse-grid">${cards.map(flat).join('')}</div>

  <p class="browse-empty" id="browse-empty" hidden>Nothing matches that. <button type="button" class="linkish" id="browse-clear">Clear the filters</button>.</p>
</div>`;
}

/* --- page ----------------------------------------------------------------- */

export function renderLanding({ concepts, questions, stats, seed }) {
  const num = n => Number(n).toLocaleString('en-US');
  const plural = (n, word) => `${num(n)} ${word}${Number(n) === 1 ? '' : 's'}`;

  /* Real content wins the moment any of it exists. Five cards fill the
     feature grid exactly: one lead card over two columns and two rows,
     then four beside it. */
  const cards = concepts.length
    ? concepts.slice(0, 5).map(fromConcept)
    : seed.concepts.slice(0, 5).map(fromSeed);

  const qs = questions.length
    ? questions.slice(0, 3).map(q => {
        /* Nothing counts replies yet, so the card shows what is real: how
           many concepts answer it, and how many people wrote them. */
        const contributors = [...new Set(q.concepts.map(c => c.creator))];
        return {
          id: q.slug ?? q.id,
          href: q.url,
          question: q.question,
          meta: `${plural(q.concepts.length, 'concept')} • ${plural(contributors.length, 'contributor')}`,
          participants: contributors.slice(0, 3).map(() => undefined),
          participantCount: contributors.length,
        };
      })
    : seed.questions.slice(0, 3).map(q => ({
        id: q.id,
        href: '/contribute/',
        question: q.question,
        meta: `${num(q.responses)} responses • ${num(q.conceptsInspired)} inspired concepts`,
        participants: q.participants,
        participantCount: q.responses,
      }));

  const live = concepts.length > 0;
  const contributors = live ? stats.contributors : seed.summary.contributors;
  const total = live ? stats.concepts : seed.summary.concepts;
  /* A direction is a vision concept — the broad calls the board rallies around. */
  const directions = live
    ? concepts.filter(c => c.type === 'vision').length
    : seed.summary.directions;

  const stat = (glyph, value, label) => `
        <div class="hstat">
          <div class="hstat-value">${ph(glyph)}${esc(value)}</div>
          <div class="hstat-label">${esc(label)}</div>
        </div>`;

  const filters = seed.categories.map((c, i) => `
        <button type="button" class="fbtn" data-filter="${esc(c.id)}" aria-pressed="${i === 0}"
          >${esc(c.label)}</button>`).join('');

  return `
${iconSprite()}

<!-- Hero — full bleed, so it sits outside the page container -->
<section class="hhero">
    <img class="hhero-art" src="/media/hero/skyline.jpg?v=13" alt="" width="1916" height="821" fetchpriority="high" decoding="async">
    <span class="hhero-veil" aria-hidden="true"></span>

    <div class="hhero-inner">
      <h1 class="hhero-title">What should <br>Destiny become?</h1>
      <p class="hhero-desc">An open community concept board for sharing, challenging, and building on ideas for Destiny 3.</p>

      <div class="hhero-actions">
        <a class="hbtn hbtn-primary" href="#board">Explore concepts ${ph('arrow-right')}</a>
        <a class="hbtn hbtn-ghost" href="/contribute/">Contribute</a>
      </div>

      <div class="hhero-stats">
        ${stat('users', num(contributors), 'Contributors')}
        ${stat('target', num(total), 'Concepts')}
        ${stat('compass', num(directions), 'Active directions')}
      </div>
    </div>
</section>

<div class="home">

  <!-- Category toolbar -->
  <nav class="toolbar" aria-label="Filter concepts">
    <div class="filters-row" id="filters">${filters}</div>
    <div class="toolbar-right">
      <button type="button" class="sortbtn">Trending ${ph('caret-down')}</button>
      <div class="viewtoggle" role="group" aria-label="View">
        <button type="button" aria-label="Grid view" aria-pressed="true">${ph('squares-four', 'fill')}</button>
        <button type="button" aria-label="List view" aria-pressed="false">${ph('list')}</button>
      </div>
    </div>
  </nav>

  <!-- Featured concepts -->
  <section class="sec" id="board" aria-labelledby="featured-title">
    <div class="sec-head">
      <h2 class="sec-title" id="featured-title">${ph('star', 'fill')}Featured concepts</h2>
      <a class="sec-link" href="/concepts/">View all concepts ${ph('arrow-right')}</a>
    </div>
    <div class="cards">${cards.map(conceptCard).join('')}</div>
  </section>

  <!-- Open questions -->
  <section class="sec" id="questions" aria-labelledby="questions-title">
    <div class="sec-head">
      <h2 class="sec-title" id="questions-title">${ph('question')}Open questions</h2>
      <span class="sec-note">${esc(qs.length)} open</span>
    </div>
    <div class="qgrid">${qs.map(questionCard).join('')}</div>
  </section>

  <!-- Contribution banner -->
  <section class="cta">
    <span class="cta-wash" aria-hidden="true"></span>
    <div class="cta-copy">
      <span class="cta-art" aria-hidden="true"></span>
      <div>
        <h2 class="cta-title">Bring the next idea to life</h2>
        <p class="cta-desc">Share your vision, challenge assumptions, build on other concepts, and help shape the future of Destiny.</p>
      </div>
    </div>
    <a class="hbtn hbtn-primary hbtn-lg" href="/contribute/">Start contributing ${ph('arrow-right')}</a>
  </section>
</div>`;
}
