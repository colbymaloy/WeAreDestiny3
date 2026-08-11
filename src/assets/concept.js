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
