#!/usr/bin/env node
/**
 * Builds the site into _site/.
 *
 *   node .github/scripts/build.mjs
 *
 * Concept pages are rendered to real static HTML rather than fetched at
 * runtime, so every concept has its own URL, its own share preview, and
 * works before any JavaScript runs. Contributors still only write JSON.
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, CATEGORIES, CATEGORY_LABEL, STATUSES, loadConcepts } from './concepts.mjs';

const SRC = join(ROOT, 'src');
const TEMPLATES = join(SRC, '_templates');
const OUT = join(ROOT, '_site');
const SITE = 'https://wearedestiny3.com';
const DEFAULT_IMAGE = `${SITE}/media/branding/social-card.png`;

/* --- tiny template layer -------------------------------------------------- */

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

/** Fill {{NAME}} placeholders. Missing keys are left alone so a partial can
    resolve them in a later pass. */
function fill(template, values) {
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, key) => (
    key in values ? String(values[key]) : match
  ));
}

/**
 * Resolve <!--INCLUDE:file.html KEY=value ...--> against src/_templates.
 * Parameters are one per line; the value runs to the end of the line.
 */
function resolveIncludes(html) {
  return html.replace(/<!--INCLUDE:([\w.-]*?\.html)([\s\S]*?)-->/g, (match, file, body) => {
    const partial = readFileSync(join(TEMPLATES, file), 'utf8');
    const values = {};
    for (const line of body.split('\n')) {
      const param = line.match(/^\s*([A-Z0-9_]+)=(.*)$/);
      if (param) values[param[1]] = param[2].trim();
    }
    if (!values.IMAGE) values.IMAGE = DEFAULT_IMAGE;
    if (!values.OG_TITLE) values.OG_TITLE = values.TITLE ?? '';
    /* Values arriving from page front-matter are plain text. */
    for (const key of Object.keys(values)) values[key] = escapeHtml(values[key]);
    return fill(partial, values).trim();
  });
}

/* --- board ---------------------------------------------------------------- */

function renderCard(concept) {
  const { cover } = concept;
  const poster = cover.thumbnail || (cover.type === 'image' ? cover.media : '');
  const count = concept.explorations.length;

  const media = poster ? `
      <div class="card-media">
        <img src="${escapeHtml(poster)}" alt="" loading="lazy" decoding="async">
        ${cover.type === 'video' ? '<span class="card-flag">Video</span>' : ''}
      </div>` : '';

  return `
  <a class="card" href="${concept.url}"
     data-categories="${escapeHtml(concept.categories.join(' '))}"
     data-status="${escapeHtml(concept.status)}">
    <div class="card-inner">${media}
      <div class="card-text">
        <p class="card-cats">${concept.categories.map(c => escapeHtml(CATEGORY_LABEL[c])).join(' &middot; ')}</p>
        <h3 class="card-title">${escapeHtml(concept.title)}</h3>
        <div class="card-meta">
          <span class="card-by">
            <span>by @${escapeHtml(concept.creator)}</span>
            ${count ? `<span class="card-count">${count} exploration${count === 1 ? '' : 's'}</span>` : ''}
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
    for (const concept of concepts) {
      for (const value of key(concept)) counts.set(value, (counts.get(value) || 0) + 1);
    }
    return counts;
  };
  const byCategory = tally(c => c.categories);
  const byStatus = tally(c => [c.status]);

  const tabs = [{ id: 'all', label: 'All', count: concepts.length }];
  for (const category of CATEGORIES) {
    if (byCategory.get(category.id)) {
      tabs.push({ id: category.id, label: category.label, count: byCategory.get(category.id) });
    }
  }
  for (const [id, label] of Object.entries(STATUSES)) {
    if (byStatus.get(id)) tabs.push({ id, label, count: byStatus.get(id) });
  }

  return tabs.map(tab => `
    <button type="button" class="chip" data-filter="${escapeHtml(tab.id)}" aria-pressed="${tab.id === 'all'}"
      >${escapeHtml(tab.label)}<span class="count">${tab.count}</span></button>`).join('');
}

function renderEmptyBoard() {
  return `
  <div class="state">
    <p class="eyebrow"><span class="mark"></span>The board is open</p>
    <h2>No one has posted yet. That is the whole opportunity.</h2>
    <p>The first concept sets the direction everyone else answers. Bring a world, an interface,
       a weapon, a sound, a sentence — anything that argues for what Destiny 3 should be.</p>
    <a class="btn btn-primary" href="/contribute/">Post the first concept</a>
  </div>`;
}

/* --- concept page --------------------------------------------------------- */

const timecode = seconds => {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
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

function renderHero(concept) {
  const { cover } = concept;
  const inner = cover.type === 'video'
    ? `<video controls playsinline preload="metadata"${cover.thumbnail ? ` poster="${escapeHtml(cover.thumbnail)}"` : ''} src="${escapeHtml(cover.media)}"></video>`
    : `<img src="${escapeHtml(cover.media)}" alt="${escapeHtml(concept.title)} — ${escapeHtml(concept.summary)}">`;

  return `<div class="hero-media">${inner}</div>
  <p class="hero-caption">Selected direction</p>`;
}

function renderSidebar(concept) {
  const blocks = [];

  if (concept.tools.length) {
    blocks.push(`<div class="side-block">
        <h3>Tools</h3>
        <ul class="tools">${concept.tools.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
      </div>`);
  }

  const links = [];
  if (concept.discussion) links.push(['View discussion', concept.discussion]);
  if (concept.source) links.push(['View source files', concept.source]);
  if (existsSync(join(ROOT, 'concepts', concept.slug, 'notes.md'))) {
    links.push(['Read the full notes', `https://github.com/colbymaloy/WeAreDestiny3/blob/main/concepts/${concept.slug}/notes.md`]);
  }
  links.push(['Suggest a change', `https://github.com/colbymaloy/WeAreDestiny3/blob/main/concepts/${concept.slug}/concept.json`]);

  blocks.push(`<div class="side-block">
      <h3>Links</h3>
      <div class="side-links">${links.map(([label, href]) =>
        `<a href="${escapeHtml(href)}" rel="noopener">${escapeHtml(label)}</a>`).join('')}</div>
    </div>`);

  if (concept.credits) {
    blocks.push(`<div class="side-block">
        <h3>Builds on</h3>
        <p class="section-note">${escapeHtml(concept.credits)}</p>
      </div>`);
  }

  return blocks.join('\n');
}

function renderTakeaways(concept) {
  if (!concept.takeaways.length) return '';
  return `
  <section class="section" aria-labelledby="takeaways-title">
    <div class="section-head">
      <h2 class="section-title" id="takeaways-title"><span class="mark"></span>Key takeaways</h2>
      <p class="section-note">What this concept is arguing for, independent of how it was made.</p>
    </div>
    <ul class="takeaways">${concept.takeaways.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
  </section>`;
}

function renderMoments(concept) {
  if (!concept.moments.length) return '';

  const items = concept.moments.map(moment => {
    const from = moment.sourceNumber ? `From exploration ${moment.sourceNumber}` : 'Standalone clip';
    const poster = moment.thumbnail || (moment.type === 'image' ? moment.media : '');
    const range = moment.t ? `${timecode(moment.t[0])} – ${timecode(moment.t[1])}` : '';

    return `
      <button type="button" class="moment" ${mediaAttrs({ ...moment, title: moment.label, sub: from })}>
        <span class="moment-inner">
          <span class="moment-media">
            ${poster ? `<img src="${escapeHtml(poster)}" alt="" loading="lazy" decoding="async">` : ''}
            ${range ? `<span class="moment-time">${escapeHtml(range)}</span>` : ''}
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
      <h2 class="section-title" id="explorations-title"><span class="mark"></span>Explorations</h2>
      <p class="section-note">${count} attempt${count === 1 ? '' : 's'} at the idea. Marked for what to keep and what to leave behind.</p>
    </div>
    ${body}
  </section>`;
}

function renderConceptPage(concept, template) {
  const count = concept.explorations.length;
  const cover = concept.cover;
  const image = cover.thumbnail || cover.media;

  const byline = [
    `by <a href="https://github.com/${encodeURIComponent(concept.creator)}" rel="noopener">@${escapeHtml(concept.creator)}</a>`,
    count ? `${count} exploration${count === 1 ? '' : 's'}` : null,
    concept.date ? escapeHtml(concept.date) : null,
  ].filter(Boolean).join(' &middot; ');

  const html = fill(template, {
    TITLE: escapeHtml(concept.title),
    DESCRIPTION: escapeHtml(concept.summary),
    PATH: concept.url,
    IMAGE: escapeHtml(image.startsWith('/') ? SITE + image : image),
    CATEGORIES: concept.categories.map(c => escapeHtml(CATEGORY_LABEL[c])).join(' &middot; '),
    STATUS: escapeHtml(concept.status),
    STATUS_LABEL: escapeHtml(STATUSES[concept.status]),
    BYLINE: byline,
    SUMMARY: escapeHtml(concept.summary),
    HERO: renderHero(concept),
    SIDEBAR: renderSidebar(concept),
    TAKEAWAYS: renderTakeaways(concept),
    MOMENTS: renderMoments(concept),
    EXPLORATIONS: renderExplorations(concept),
  });

  /* The include's own placeholders were filled above, so what reaches
     resolveIncludes here is literal text. */
  return resolveIncludes(html);
}

/* --- build ---------------------------------------------------------------- */

const { concepts, errors, warnings } = loadConcepts();

for (const message of warnings) console.warn(`warning  ${message}`);
if (errors.length) {
  for (const message of errors) console.error(`error    ${message}`);
  console.error(`\n${errors.length} problem${errors.length === 1 ? '' : 's'} found. Nothing was built.`);
  process.exit(1);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

/* Static source, minus the templates, which are inputs rather than output. */
cpSync(SRC, OUT, { recursive: true, filter: src => !src.startsWith(TEMPLATES) });
if (existsSync(join(ROOT, 'media'))) cpSync(join(ROOT, 'media'), join(OUT, 'media'), { recursive: true });
for (const file of ['CNAME', '.nojekyll']) {
  if (existsSync(join(ROOT, file))) cpSync(join(ROOT, file), join(OUT, file));
}

/* Board */
const board = readFileSync(join(SRC, 'index.html'), 'utf8')
  .replace('<!--SLOT:FILTERS-->', renderFilters(concepts))
  .replace('<!--SLOT:CARDS-->', concepts.length ? concepts.map(renderCard).join('') : renderEmptyBoard());
writeFileSync(join(OUT, 'index.html'), resolveIncludes(board));
if (concepts.length === 0) {
  const html = readFileSync(join(OUT, 'index.html'), 'utf8').replace('class="grid"', 'class="grid is-empty"');
  writeFileSync(join(OUT, 'index.html'), html);
}

/* Standalone pages */
for (const page of ['about/index.html', 'contribute/index.html', '404.html']) {
  const file = join(OUT, page);
  if (existsSync(file)) writeFileSync(file, resolveIncludes(readFileSync(file, 'utf8')));
}

/* Concept pages */
const template = readFileSync(join(TEMPLATES, 'concept.html'), 'utf8');
for (const concept of concepts) {
  const dir = join(OUT, 'concepts', concept.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), renderConceptPage(concept, template));
}

/* A machine-readable index, for anyone who wants to build on the data. */
mkdirSync(join(OUT, 'concepts'), { recursive: true });
writeFileSync(join(OUT, 'concepts', 'index.json'), JSON.stringify({ concepts }, null, 2));

/* Sitemap */
const urls = ['/', '/about/', '/contribute/', ...concepts.map(c => c.url)];
writeFileSync(join(OUT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
    urls.map(u => `  <url><loc>${SITE}${u}</loc></url>`).join('\n')}\n</urlset>\n`);
writeFileSync(join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);

console.log(`Built ${concepts.length} concept page${concepts.length === 1 ? '' : 's'} into _site/ (${warnings.length} warning${warnings.length === 1 ? '' : 's'}).`);
