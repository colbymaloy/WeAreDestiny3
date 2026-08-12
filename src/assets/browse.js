/* =============================================================
   Browse — search, facets and sorting over the whole board.

   Every card is already in the page, so nothing here fetches. The
   page is complete without JavaScript and gains controls with it.
   ============================================================= */

import { showMatching, readQuery, writeQuery } from '/assets/filters.js?v=5';

const grid = document.getElementById('browse-grid');
if (grid) {
  const cards = [...grid.querySelectorAll('.ccard')];
  const search = document.getElementById('browse-q');
  const sort = document.getElementById('browse-sort');
  const count = document.getElementById('browse-count');
  const empty = document.getElementById('browse-empty');
  const facetButtons = [...document.querySelectorAll('.fbtn')];

  /* Searching a card means searching what the reader can see on it. */
  const haystack = card => [
    card.dataset.title,
    card.querySelector('.ccard-desc')?.textContent,
    card.querySelector('.ccard-author > span')?.textContent,
    card.querySelector('.badge')?.textContent,
  ].filter(Boolean).join(' ').toLowerCase();

  for (const card of cards) card.dataset.haystack = haystack(card);

  const state = {
    ...readQuery(['q', 'filter', 'type', 'status']),
    sort: 'newest',
  };
  if (search && state.q) search.value = state.q;

  /* The server rendered newest-first, so the original order is the default
     and every other sort is measured against it. */
  cards.forEach((card, index) => { card.dataset.order = String(index); });

  const number = card => Number(card.dataset.order);

  const SORTS = {
    newest: (a, b) => number(a) - number(b),
    oldest: (a, b) => number(b) - number(a),
    title: (a, b) => (a.dataset.title || '').localeCompare(b.dataset.title || ''),
    explorations: (a, b) => Number(b.dataset.explorations ?? 0) - Number(a.dataset.explorations ?? 0),
  };

  function apply() {
    const needle = state.q.trim().toLowerCase();

    const shown = showMatching(cards, card =>
      (!state.filter || state.filter === 'all' || (card.dataset.category ?? '') === state.filter)
      && (!state.type || (card.dataset.type ?? '') === state.type)
      && (!state.status || (card.dataset.status ?? '') === state.status)
      && (!needle || card.dataset.haystack.includes(needle)));

    for (const button of facetButtons) {
      const facet = button.dataset.facet;
      const value = button.dataset.value;
      const on = facet === 'filter'
        ? (state.filter || 'all') === value
        : state[facet] === value;
      button.setAttribute('aria-pressed', String(on));
    }

    const order = SORTS[state.sort] ?? SORTS.newest;
    for (const card of [...cards].sort(order)) grid.append(card);

    count.textContent = shown === cards.length
      ? `${cards.length} concept${cards.length === 1 ? '' : 's'}`
      : `${shown} of ${cards.length} concepts`;
    empty.hidden = shown > 0;

    writeQuery({ q: state.q, filter: state.filter === 'all' ? '' : state.filter, type: state.type, status: state.status });
  }

  document.querySelector('.browse-facets')?.addEventListener('click', event => {
    const button = event.target.closest('.fbtn');
    if (!button) return;
    const facet = button.dataset.facet;
    const value = button.dataset.value;
    /* A pressed facet toggles off, so a filter can be undone where it was set. */
    state[facet] = state[facet] === value ? '' : value;
    if (facet === 'filter' && value === 'all') state.filter = '';
    apply();
  });

  let typing;
  search?.addEventListener('input', () => {
    clearTimeout(typing);
    typing = setTimeout(() => { state.q = search.value; apply(); }, 150);
  });

  sort?.addEventListener('change', () => { state.sort = sort.value; apply(); });

  document.getElementById('browse-clear')?.addEventListener('click', () => {
    Object.assign(state, { q: '', filter: '', type: '', status: '' });
    if (search) search.value = '';
    apply();
  });

  apply();
}

/* The header search belongs to this page. */
const headerSearch = document.querySelector('.gsearch');
headerSearch?.addEventListener('submit', event => {
  const input = headerSearch.querySelector('input');
  const field = document.getElementById('browse-q');
  if (!field || !input) return;
  event.preventDefault();
  field.value = input.value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.scrollIntoView({ block: 'center', behavior: 'smooth' });
});
