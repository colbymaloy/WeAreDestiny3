/* =============================================================
   Landing screen interactions.

   The markup is rendered statically at build time, so this only
   adds behaviour on top of a page that already works without it.
   ============================================================= */

import { pressGroup, showMatching } from '/assets/filters.js?v=13';

/* Category filters */
const filters = document.getElementById('filters');
if (filters) {
  const buttons = [...filters.querySelectorAll('.fbtn')];
  const cards = [...document.querySelectorAll('.ccard')];

  filters.addEventListener('click', event => {
    const button = event.target.closest('.fbtn');
    if (!button) return;
    pressGroup(buttons, button);

    const value = button.dataset.filter;
    showMatching(cards, card => value === 'all' || (card.dataset.category ?? '') === value);
    button.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  });
}

/* View toggle — presentation only until a list layout exists */
const toggle = document.querySelector('.viewtoggle');
if (toggle) {
  const buttons = [...toggle.querySelectorAll('button')];
  toggle.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (button) pressGroup(buttons, button);
  });
}

/* Bookmarks, remembered locally. The board has no account system, so this
   is deliberately a private, per-device marker rather than a public count. */
const SAVED = 'wad3:saved';
const saved = new Set(JSON.parse(localStorage.getItem(SAVED) ?? '[]'));

for (const [card, button] of [
  ...[...document.querySelectorAll('.ccard')].map(c => [c, c.querySelector('.bookmark')]),
  ...[...document.querySelectorAll('.qcard')].map(c => [c, c.querySelector('.qsave')]),
]) {
  const id = card.dataset.id;
  if (!id || !button) continue;

  button.setAttribute('aria-pressed', String(saved.has(id)));

  button.addEventListener('click', event => {
    /* The whole card is a link; saving must not navigate. */
    event.preventDefault();
    event.stopPropagation();
    saved.has(id) ? saved.delete(id) : saved.add(id);
    button.setAttribute('aria-pressed', String(saved.has(id)));
    localStorage.setItem(SAVED, JSON.stringify([...saved]));
  });
}

/* Reveal on scroll. The class is added here rather than in the markup so
   that without JavaScript the page renders fully visible. */
const rising = document.querySelectorAll('.hero, .toolbar, .sec-head, .ccard, .qcard, .cta');

if (rising.length && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const seen = new IntersectionObserver((entries, observer) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-in');
      observer.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -10% 0px' });

  rising.forEach((node, index) => {
    node.classList.add('rise');
    /* Cards in a row arrive in sequence rather than all at once. */
    node.style.transitionDelay = `${Math.min(index % 5, 4) * 50}ms`;
    seen.observe(node);
  });
}
