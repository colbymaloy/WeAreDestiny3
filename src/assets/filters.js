/* =============================================================
   Card filtering, shared by the landing and the browse page.

   Both render their cards server-side, so filtering is a matter of
   hiding what does not match rather than fetching anything.
   ============================================================= */

/** Exactly one button in a group reads as pressed. */
export const pressGroup = (nodes, node) => {
  for (const other of nodes) other.setAttribute('aria-pressed', String(other === node));
};

/**
 * Hide every card the predicate rejects; returns how many are left.
 * `hidden` rather than a class, so the state is legible to assistive tech.
 */
export function showMatching(cards, keep) {
  let shown = 0;
  for (const card of cards) {
    const match = keep(card);
    card.hidden = !match;
    if (match) shown += 1;
  }
  return shown;
}

/** Read the facets a page understands out of the address bar. */
export const readQuery = (keys, url = window.location.href) => {
  const params = new URL(url).searchParams;
  return Object.fromEntries(keys.map(key => [key, params.get(key) ?? '']));
};

/**
 * Keep the address bar in step with the controls, so a filtered view can be
 * copied out of the URL bar and shared. Replaces rather than pushes: filtering
 * is not navigation, and it should not fill up the back button.
 */
export function writeQuery(values) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(values)) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  history.replaceState(null, '', url);
}
