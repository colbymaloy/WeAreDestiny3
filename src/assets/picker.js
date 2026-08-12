/* =============================================================
   Concept picker.

   A dropdown of every concept stops being usable somewhere around
   the fiftieth one, so this searches instead — over titles,
   handles, summaries and categories — and shows enough of each
   result to tell two similar concepts apart.

   It also takes a link. Finding a concept on the board and pasting
   its address is how people will actually do this, and parsing the
   slug out is less work than making them search for something they
   are already looking at.
   ============================================================= */

import { TYPES, STATUSES, CATEGORY_LABEL } from '/assets/model.mjs';

const MAX_RESULTS = 8;

/** The slug in a board address, or null. Accepts a full URL, a path or a bare slug. */
export function slugFromInput(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const inPath = raw.match(/\/concepts\/([a-z0-9][a-z0-9-]*)/i);
  if (inPath) return inPath[1].toLowerCase();

  /* A bare slug, but only if it could not be a search phrase. */
  if (/^[a-z0-9]+(-[a-z0-9]+)+$/i.test(raw)) return raw.toLowerCase();
  return null;
}

const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

/** What a result says about itself, beyond its title. */
function metaLine(concept) {
  const bits = [`@${concept.creator}`];
  const type = TYPES[concept.type]?.label;
  if (type) bits.push(type);
  const status = STATUSES[concept.status];
  if (status) bits.push(status);
  const count = concept.explorations?.length ?? 0;
  if (count) bits.push(`${count} exploration${count === 1 ? '' : 's'}`);
  const categories = (concept.categories ?? []).map(c => CATEGORY_LABEL[c]).filter(Boolean);
  if (categories.length) bits.push(categories.join(', '));
  return bits.join(' · ');
}

const haystack = concept => [
  concept.title,
  concept.creator,
  concept.summary,
  concept.slug,
  ...(concept.categories ?? []).map(c => CATEGORY_LABEL[c] ?? c),
  TYPES[concept.type]?.label,
].filter(Boolean).join(' ').toLowerCase();

/**
 * @param {HTMLElement} host
 * @param {object}   options
 * @param {function} options.concepts  returns the board; read lazily, because
 *                                     it arrives from /concepts.json and a row
 *                                     can be added before that lands
 * @param {function} options.onPick    called with the chosen concept, or null
 * @param {boolean}  options.clearOnPick  reset after choosing, for a field that
 *                                        adds to a list rather than holding one
 */
export function createConceptPicker(host, { concepts = () => [], onPick, clearOnPick = false } = {}) {
  const board = typeof concepts === 'function' ? concepts : () => concepts;

  let indexed = [];
  let bySlug = new Map();
  let indexedFrom = null;

  /* Rebuilt only when the underlying array changes identity, so typing does
     not re-index the whole board on every keystroke. */
  function index() {
    const list = board() ?? [];
    if (list === indexedFrom) return;
    indexedFrom = list;
    indexed = list.map(concept => ({ concept, text: haystack(concept) }));
    bySlug = new Map(list.map(c => [c.slug, c]));
  }
  index();

  const id = `pick-${Math.round(performance.now() * 1000)}-${host.children.length}`;
  let chosen = null;
  let active = -1;
  let results = [];

  host.classList.add('picker');
  host.innerHTML = `
    <input class="picker-input" type="search" autocomplete="off" spellcheck="false"
           role="combobox" aria-expanded="false" aria-controls="${id}" aria-autocomplete="list"
           placeholder="Search by title or handle, or paste a link">
    <div class="picker-list" id="${id}" role="listbox" hidden></div>
    <div class="picker-chosen" hidden></div>
    <input type="hidden" data-concept value="">`;

  const input = host.querySelector('.picker-input');
  const list = host.querySelector('.picker-list');
  const chip = host.querySelector('.picker-chosen');
  const value = host.querySelector('[data-concept]');

  function close() {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    active = -1;
  }

  function paint() {
    if (!results.length) {
      list.innerHTML = '<p class="picker-none">Nothing matches that.</p>';
    } else {
      list.innerHTML = results.map((concept, index) => `
        <button type="button" class="picker-hit" role="option" id="${id}-${index}"
                aria-selected="${index === active}" data-slug="${escape(concept.slug)}">
          <span class="picker-hit-title">${escape(concept.title)}</span>
          <span class="picker-hit-meta">${escape(metaLine(concept))}</span>
        </button>`).join('');
    }
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    input.setAttribute('aria-activedescendant', active >= 0 ? `${id}-${active}` : '');
  }

  function search(term) {
    index();
    const needle = term.trim().toLowerCase();
    if (!needle) { results = []; close(); return; }

    if (!indexed.length) {
      results = [];
      list.innerHTML = '<p class="picker-none">No concepts on the board yet.</p>';
      list.hidden = false;
      return;
    }

    /* Whole-phrase matches first, then everything containing every word. */
    const words = needle.split(/\s+/);
    const scored = [];
    for (const { concept, text } of indexed) {
      if (!words.every(word => text.includes(word))) continue;
      const title = concept.title.toLowerCase();
      const rank = title.startsWith(needle) ? 0 : title.includes(needle) ? 1 : 2;
      scored.push({ concept, rank });
    }
    scored.sort((a, b) => a.rank - b.rank);
    results = scored.slice(0, MAX_RESULTS).map(s => s.concept);
    active = results.length ? 0 : -1;
    paint();
  }

  function choose(concept) {
    chosen = concept;
    value.value = concept?.slug ?? '';
    close();

    if (!concept) {
      chip.hidden = true;
      input.hidden = false;
      input.value = '';
      onPick?.(null);
      return;
    }

    if (clearOnPick) {
      input.value = '';
      chosen = null;
      value.value = '';
      onPick?.(concept);
      return;
    }

    chip.hidden = false;
    input.hidden = true;
    chip.innerHTML = `
      <span class="picker-chosen-body">
        <a class="picker-chosen-title" href="${escape(concept.url ?? `/concepts/${concept.slug}/`)}"
           target="_blank" rel="noopener">${escape(concept.title)}</a>
        <span class="picker-hit-meta">${escape(metaLine(concept))}</span>
      </span>
      <button type="button" class="picker-clear">Change</button>`;
    chip.querySelector('.picker-clear').addEventListener('click', () => {
      choose(null);
      input.focus();
    });
    onPick?.(concept);
  }

  input.addEventListener('input', () => {
    index();
    /* A pasted link resolves straight to its concept — no reason to make
       someone search for the thing they just copied. */
    const slug = slugFromInput(input.value);
    if (slug && bySlug.has(slug)) return choose(bySlug.get(slug));
    if (slug && input.value.includes('/concepts/')) {
      results = [];
      list.innerHTML = '<p class="picker-none">That link is not a concept on this board.</p>';
      list.hidden = false;
      return;
    }
    search(input.value);
  });

  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') return close();
    if (!results.length) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      active = (active + step + results.length) % results.length;
      paint();
      list.querySelector(`#${CSS.escape(`${id}-${active}`)}`)?.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (event.key === 'Enter' && active >= 0) {
      event.preventDefault();
      choose(results[active]);
    }
  });

  list.addEventListener('mousedown', event => {
    const hit = event.target.closest('.picker-hit');
    if (!hit) return;
    event.preventDefault();
    choose(bySlug.get(hit.dataset.slug));
  });

  input.addEventListener('blur', () => setTimeout(close, 120));

  return {
    get value() { return chosen?.slug ?? ''; },
    get concept() { return chosen; },
    clear: () => choose(null),
  };
}
