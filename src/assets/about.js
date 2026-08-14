/* Reveal on scroll.

   The hidden state is applied here rather than in the markup, so a reader
   without JavaScript gets the whole page rather than a blank one. */

const rising = document.querySelectorAll('.about .ab-rise');

if (rising.length && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const seen = new IntersectionObserver((entries, observer) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-in');
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.15 });

  for (const node of rising) {
    node.classList.add('is-armed');
    seen.observe(node);
  }
}
