/* =============================================================
   Concept page — opens explorations and selected moments.

   A "moment" is usually a few seconds inside an exploration rather
   than a separate file, so playback is clamped to its time range:
   the media fragment sets the in-point, and a timeupdate handler
   enforces the out-point, which browsers honour inconsistently.
   ============================================================= */

const lb = document.getElementById('lightbox');
const stage = document.getElementById('lb-stage');
const close = document.getElementById('lb-close');
const title = document.getElementById('lb-title');
const sub = document.getElementById('lb-sub');

if (lb) {
  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-media]');
    if (trigger) open(trigger.dataset);
  });

  close.addEventListener('click', dismiss);
  lb.addEventListener('close', cleanup);
  lb.addEventListener('click', event => { if (event.target === lb) dismiss(); });
}

function open(data) {
  title.textContent = data.title || '';
  sub.textContent = data.sub || '';

  for (const node of [...stage.children]) {
    if (node !== close) node.remove();
  }

  const start = Number(data.start);
  const end = Number(data.end);
  const hasStart = Number.isFinite(start) && start > 0;
  const hasEnd = Number.isFinite(end) && end > 0;

  if (data.type === 'video') {
    const video = document.createElement('video');
    video.src = hasStart || hasEnd
      ? `${data.media}#t=${hasStart ? start : 0}${hasEnd ? `,${end}` : ''}`
      : data.media;
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    video.preload = 'metadata';
    if (data.poster) video.poster = data.poster;

    if (hasStart) {
      video.addEventListener('loadedmetadata', () => { video.currentTime = start; }, { once: true });
    }
    if (hasEnd) {
      video.addEventListener('timeupdate', () => {
        if (video.currentTime >= end) video.pause();
      });
    }
    stage.append(video);
  } else {
    const img = document.createElement('img');
    img.src = data.media;
    img.alt = data.title || '';
    stage.append(img);
  }

  if (!lb.open) lb.showModal();
}

function dismiss() {
  if (lb.open) lb.close();
  else cleanup();
}

function cleanup() {
  const video = stage.querySelector('video');
  if (video) {
    video.pause();
    video.removeAttribute('src');
    video.load();
  }
}

/* =============================================================
   Concept page chrome: tabs, follow, save, share, video.
   ============================================================= */

const tabs = [...document.querySelectorAll('.cd-tab')];
const panels = [...document.querySelectorAll('[data-panel]')];

for (const tab of tabs) {
  tab.addEventListener('click', () => {
    for (const t of tabs) t.setAttribute('aria-selected', String(t === tab));
    for (const panel of panels) panel.hidden = panel.dataset.panel !== tab.dataset.tab;
  });
}

document.querySelector('[data-goto]')?.addEventListener('click', event => {
  document.querySelector(`.cd-tab[data-tab="${event.currentTarget.dataset.goto}"]`)?.click();
});

/* Follow and save are per-device. The board has no account system, so these
   are private markers rather than shared counts. */
const slug = location.pathname.replace(/\/+$/, '').split('/').pop();

function localToggle(button, key, onLabel, offLabel) {
  if (!button) return;
  const set = new Set(JSON.parse(localStorage.getItem(key) ?? '[]'));
  const label = button.querySelector('[data-follow-label], [data-save-label]');

  const sync = () => {
    const on = set.has(slug);
    button.setAttribute('aria-pressed', String(on));
    if (label) label.textContent = on ? onLabel : offLabel;
  };
  sync();

  button.addEventListener('click', () => {
    set.has(slug) ? set.delete(slug) : set.add(slug);
    localStorage.setItem(key, JSON.stringify([...set]));
    sync();
  });
}

localToggle(document.querySelector('[data-follow]'), 'wad3:following', 'Following', 'Follow');
localToggle(document.querySelector('[data-save]'), 'wad3:saved', 'Bookmarked', 'Bookmark');

document.querySelector('[data-share]')?.addEventListener('click', async () => {
  const title = document.querySelector('.cd-title')?.textContent ?? document.title;
  if (navigator.share) {
    try { await navigator.share({ title, url: location.href }); return; } catch { /* dismissed */ }
  }
  await navigator.clipboard?.writeText(location.href);
});

/* Reveal on scroll. The class is added here rather than in the markup so
   that without JavaScript the page renders fully visible. */
const rising = document.querySelectorAll('.cd-head, .vp, .ov-split, .ov-xs, .cd-related, .sb');

if (rising.length && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const seen = new IntersectionObserver((entries, observer) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-in');
      observer.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -8% 0px' });

  for (const node of rising) {
    node.classList.add('rise');
    seen.observe(node);
  }
}

/* --- video ---------------------------------------------------------------- */

const player = document.querySelector('.vp');
const video = player?.querySelector('video');

if (player && video) {
  const bar = player.querySelector('[data-vp="track"]');
  const fill = player.querySelector('.vp-fill');
  const knob = player.querySelector('.vp-knob');
  const buffer = player.querySelector('.vp-buffer');
  const now = player.querySelector('[data-vp="now"]');
  const dur = player.querySelector('[data-vp="dur"]');

  const clock = seconds => {
    if (!Number.isFinite(seconds)) return '0:00';
    const total = Math.floor(seconds);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  };

  const toggle = () => (video.paused ? video.play() : video.pause());
  player.querySelector('.vp-play')?.addEventListener('click', toggle);
  player.querySelector('[data-vp="toggle"]')?.addEventListener('click', toggle);

  video.addEventListener('play', () => player.classList.add('is-playing'));
  video.addEventListener('pause', () => player.classList.remove('is-playing'));
  video.addEventListener('loadedmetadata', () => { dur.textContent = clock(video.duration); });

  video.addEventListener('timeupdate', () => {
    const pct = video.duration ? (video.currentTime / video.duration) * 100 : 0;
    fill.style.width = `${pct}%`;
    knob.style.left = `${pct}%`;
    now.textContent = clock(video.currentTime);
    if (video.buffered.length) {
      buffer.style.width = `${(video.buffered.end(video.buffered.length - 1) / video.duration) * 100}%`;
    }
  });

  bar?.addEventListener('click', event => {
    const box = bar.getBoundingClientRect();
    if (video.duration) video.currentTime = ((event.clientX - box.left) / box.width) * video.duration;
  });
}
