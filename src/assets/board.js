/* =============================================================
   Board — filtering over cards the build step already rendered.
   The markup is static HTML, so the concepts are visible with
   JavaScript disabled and to anything that crawls the page.
   ============================================================= */

const filters = document.getElementById('filters');
const grid = document.getElementById('grid');

/* Page-load sequence. */
requestAnimationFrame(() => {
  for (const node of document.querySelectorAll('.reveal')) node.classList.add('is-in');
});

if (filters && grid) {
  const cards = [...grid.querySelectorAll('.card')];

  function apply(value) {
    for (const chip of filters.querySelectorAll('.chip')) {
      chip.setAttribute('aria-pressed', String(chip.dataset.filter === value));
    }
    for (const card of cards) {
      const categories = (card.dataset.categories || '').split(' ').filter(Boolean);
      const status = card.dataset.status || '';
      card.hidden = value !== 'all' && !categories.includes(value) && status !== value;
    }
    const url = new URL(window.location.href);
    if (value === 'all') url.searchParams.delete('filter');
    else url.searchParams.set('filter', value);
    history.replaceState(null, '', url);
  }

  filters.addEventListener('click', event => {
    const chip = event.target.closest('.chip');
    if (chip) apply(chip.dataset.filter);
  });

  /* Deep links like /?filter=ui land pre-filtered. */
  const initial = new URL(window.location.href).searchParams.get('filter');
  if (initial && filters.querySelector(`.chip[data-filter="${CSS.escape(initial)}"]`)) apply(initial);
}
