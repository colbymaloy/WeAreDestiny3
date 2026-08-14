/* =============================================================
   Sharing a concept.

   Sign in, claim a handle, write the concept, attach media. Media
   uploads straight to Storage; the concept goes to Firestore as
   pending, and a person approves it onto the board.
   ============================================================= */

import {
  TYPES, CATEGORIES, CATEGORY_LABEL, STATUSES, RELATIONS, MAX, TEXT_FIRST,
  slugify, handleProblem, foldHandle, articleText, youtubeId, youtubePoster,
} from '/assets/model.mjs';
import { renderOverview } from '/assets/render.mjs';
import { iconSprite } from '/assets/icons.mjs';
import { createEditor } from '/assets/editor.js?v=13';
import { createConceptPicker } from '/assets/picker.js?v=13';
import { firebaseConfig, isConfigured } from '/assets/firebase-config.js';

const el = id => document.getElementById(id);
const show = (node, on = true) => { if (node) node.hidden = !on; };
const lines = value => String(value || '').split('\n').map(s => s.trim()).filter(Boolean);
const commas = value => String(value || '').split(',').map(s => s.trim()).filter(Boolean);

const useEmulators = () =>
  ['localhost', '127.0.0.1'].includes(location.hostname)
  && new URLSearchParams(location.search).has('emu');

/* Hosting rewrites /api/* onto the functions, so the browser never needs an
   endpoint URL and never makes a cross-origin request. */
const fn = (name, path) => (useEmulators()
  ? `http://localhost:5001/${firebaseConfig.projectId}/us-central1/${name}`
  : path);
const endpoint = () => fn('submitConcept', '/api/submit');
const claimEndpoint = () => fn('claimHandle', '/api/claim');

const state = {
  user: null,
  token: null,
  handle: null,
  concepts: [],
  questions: [],
  categories: [],
  cover: null,
  youtube: null,
  seq: 0,
};

/* --- boot ----------------------------------------------------------------- */

if (!isConfigured() && !useEmulators()) {
  show(el('auth-out'), false);
  show(el('auth-unconfigured'));
} else {
  start().catch(error => {
    console.error('[publish] sign-in unavailable', error);
    show(el('auth-out'), false);
    show(el('auth-unconfigured'));
  });
}

async function start() {
  const [{ initializeApp }, auth, storage, firestore] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js'),
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'),
  ]);

  const app = initializeApp(firebaseConfig);
  const authClient = auth.getAuth(app);
  const bucket = storage.getStorage(app);
  const db = firestore.getFirestore(app);

  if (useEmulators()) {
    auth.connectAuthEmulator(authClient, 'http://localhost:9099', { disableWarnings: true });
    storage.connectStorageEmulator(bucket, 'localhost', 9199);
    firestore.connectFirestoreEmulator(db, 'localhost', 8080);
    console.info('[publish] using Firebase emulators');
  }

  el('sign-in-google').addEventListener('click', () => {
    auth.signInWithPopup(authClient, new auth.GoogleAuthProvider()).catch(reportAuthError);
  });
  el('sign-out').addEventListener('click', () => auth.signOut(authClient));

  state.myHandle = async uid => {
    const snap = await firestore.getDoc(firestore.doc(db, 'publishers', uid));
    return snap.data()?.handle ?? null;
  };

  /* handles/{lowercased} holds no uid, so this answers "taken" and nothing
     about who holds it. */
  state.handleTaken = async handle => {
    const snap = await firestore.getDoc(firestore.doc(db, 'handles', foldHandle(handle)));
    return snap.exists();
  };

  auth.onAuthStateChanged(authClient, async user => {
    state.user = user;
    state.token = user ? await user.getIdToken() : null;
    show(el('auth-out'), !user);
    show(el('auth-in'), Boolean(user));
    if (user) await onSignedIn(user);
  });

  /* Storage is where media lives permanently — the upload is the publish. */
  state.upload = async (file, uid) => {
    const safe = file.name.replace(/[^A-Za-z0-9._-]/g, '-').slice(-80);
    const path = `media/${uid}/${Date.now()}-${state.seq++}-${safe}`;
    const ref = storage.ref(bucket, path);
    await storage.uploadBytes(ref, file, { contentType: file.type });
    return { url: await storage.getDownloadURL(ref), path, name: file.name, contentType: file.type };
  };
}

function reportAuthError(error) {
  if (['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(error?.code)) return;
  problems([`Sign-in failed — ${error?.message || error}`]);
}

/* --- handle ---------------------------------------------------------------
   The account's real name is never shown and never suggested. A handle is the
   only name this project has, and it is chosen, not derived. */

async function onSignedIn(user) {
  state.handle = await state.myHandle(user.uid);
  paintHandle();
}

function paintHandle() {
  const claimed = Boolean(state.handle);
  el('who-handle').textContent = claimed ? `@${state.handle}` : 'choose a handle';
  show(el('handle-claim'), !claimed);
  show(el('handle-set'), claimed);
  if (claimed) el('handle-current').textContent = `@${state.handle}`;
  el('form').classList.toggle('is-locked', !claimed);
}

const handleInput = el('f-handle');
const handleNote = el('handle-note');
let handleTimer;

function noteHandle(text, kind) {
  handleNote.textContent = text ?? '';
  handleNote.dataset.kind = kind ?? '';
}

handleInput?.addEventListener('input', () => {
  const wanted = handleInput.value.trim().replace(/^@/, '');
  el('claim-handle').disabled = true;
  clearTimeout(handleTimer);

  if (!wanted) return noteHandle('');
  const problem = handleProblem(wanted);
  if (problem) return noteHandle(problem, 'bad');

  noteHandle('Checking…');
  handleTimer = setTimeout(async () => {
    try {
      const taken = await state.handleTaken(wanted);
      if (handleInput.value.trim().replace(/^@/, '') !== wanted) return;
      noteHandle(taken ? 'Taken — pick another.' : 'Available.', taken ? 'bad' : 'ok');
      el('claim-handle').disabled = taken;
    } catch {
      noteHandle('Could not check that right now.', 'bad');
    }
  }, 350);
});

el('claim-handle')?.addEventListener('click', async () => {
  const wanted = handleInput.value.trim().replace(/^@/, '');
  const button = el('claim-handle');
  button.disabled = true;
  noteHandle('Claiming…');
  try {
    state.token = await state.user.getIdToken(true);
    const response = await fetch(claimEndpoint(), {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${state.token}` },
      body: JSON.stringify({ handle: wanted }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      noteHandle(payload.error || `Could not claim that handle (${response.status}).`, 'bad');
      button.disabled = false;
      return;
    }
    state.handle = payload.handle;
    noteHandle('');
    paintHandle();
  } catch (error) {
    noteHandle(`Something went wrong — ${error?.message || error}`, 'bad');
    button.disabled = false;
  }
});

/* --- static option lists --------------------------------------------------- */

function option(value, label) {
  const node = document.createElement('option');
  node.value = value;
  node.textContent = label;
  return node;
}

el('f-type').append(...Object.entries(TYPES).map(([id, meta]) => option(id, `${meta.label} — ${meta.blurb}`)));
el('f-status').append(...Object.entries(STATUSES).map(([id, label]) => option(id, label)));

const STATUS_NOTE = {
  exploring: 'Open question. Nothing settled yet.',
  direction: 'Has momentum and more than one exploration behind it.',
  refined: 'A polished representation others can build on.',
};
const paintStatusNote = () => { el('status-note').textContent = STATUS_NOTE[el('f-status').value] ?? ''; };
el('f-status').addEventListener('change', paintStatusNote);
paintStatusNote();

/* --- categories as chips ---------------------------------------------------
   Nine of them, so a menu of every one is friendlier than a search. */

function paintCategories() {
  const host = el('f-categories');
  host.replaceChildren(...CATEGORIES.map(category => {
    const on = state.categories.includes(category.id);
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'tag';
    chip.setAttribute('aria-pressed', String(on));
    chip.textContent = category.label;
    chip.disabled = !on && state.categories.length >= MAX.categories;
    chip.addEventListener('click', () => {
      state.categories = on
        ? state.categories.filter(id => id !== category.id)
        : [...state.categories, category.id];
      paintCategories();
      touched();
    });
    return chip;
  }));
}
paintCategories();

/* --- the concept itself ---------------------------------------------------- */

const editorHost = el('editor');
const editor = editorHost ? createEditor(editorHost, {
  /* Images land in Storage the moment they are added, under this account's
     own prefix — the same path explorations use, and the same one the server
     checks against on submit. */
  upload: async file => {
    if (!state.user) throw new Error('sign in first');
    return state.upload(file, state.user.uid);
  },
  onChange: () => touched(),
}) : null;

/* --- posters --------------------------------------------------------------- */

/* A video still needs a poster so the board has something to show before the
   file loads. Rather than asking for one, take it off the front of the video:
   decoded in the page from a local object URL, so the canvas is never tainted
   and nothing is uploaded that the reader did not already choose. */
function firstFrame(file, maxWidth = 1280) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    let settled = false;

    const finish = act => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      act();
    };
    const fail = why => finish(() => reject(new Error(why)));
    /* A codec the browser cannot decode may simply never fire an event. */
    const timer = setTimeout(() => fail('timeout'), 15000);

    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.addEventListener('error', () => fail('decode'));

    video.addEventListener('loadeddata', () => {
      /* A hair past zero: plenty of encodes open on a black frame. */
      video.currentTime = Math.min(0.1, (video.duration || 1) / 2);
    }, { once: true });

    video.addEventListener('seeked', () => {
      const scale = Math.min(1, maxWidth / (video.videoWidth || maxWidth));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      if (!canvas.width || !canvas.height) return fail('empty');

      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        if (!blob) return fail('encode');
        const name = `${file.name.replace(/\.[^.]+$/, '')}-poster.jpg`;
        finish(() => resolve(new File([blob], name, { type: 'image/jpeg' })));
      }, 'image/jpeg', 0.82);
    }, { once: true });

    video.src = url;
  });
}

/* Kicks the grab off as soon as a video is chosen and reports it in place, so
   the wait happens while the rest of the form is still being filled in. */
function watchForPoster(input, note) {
  const file = input.files?.[0];
  if (!file?.type.startsWith('video/')) {
    input._poster = null;
    show(note, false);
    return;
  }
  show(note, true);
  note.textContent = 'Taking a poster frame from the video…';
  input._poster = firstFrame(file).then(poster => {
    note.textContent = 'Poster taken from the first frame.';
    return poster;
  }, error => {
    note.textContent = 'Could not read a frame from this video. An MP4 (H.264) will work.';
    throw error;
  });
}

/* --- cover ----------------------------------------------------------------- */

/* Two ways in, one cover: an upload the project stores and serves, or a YouTube
   link it only points at. Whichever is filled in hides the other, so there is
   never a question of which one wins. */

const coverInput = el('f-cover');
const drop = el('cover-drop');
const youtubeInput = el('f-youtube');

function paintCover() {
  const set = Boolean(state.cover);
  const linked = Boolean(state.youtube);
  show(el('cover-set'), set);
  show(drop, !set && !linked);
  show(el('cover-yt'), !set);
  if (!set) return;
  el('cover-name').textContent = state.cover.file.name;
  el('cover-shot').style.backgroundImage = state.cover.preview ? `url(${state.cover.preview})` : '';
  el('cover-shot').classList.toggle('is-video', state.cover.file.type.startsWith('video/'));
}

function takeCover(file) {
  if (!file) return;
  if (state.cover?.preview) URL.revokeObjectURL(state.cover.preview);
  const isVideo = file.type.startsWith('video/');

  state.cover = {
    file,
    preview: isVideo ? '' : URL.createObjectURL(file),
    /* A video cover carries its own still, grabbed off the front of it. */
    poster: isVideo ? firstFrame(file) : null,
  };

  /* The same frame doubles as the thumbnail shown in the panel, so the video
     is not represented by an empty box while the form is filled in. */
  state.cover.poster?.then(poster => {
    if (state.cover?.file !== file) return;
    state.cover.preview = URL.createObjectURL(poster);
    paintCover();
  }, () => { /* named at submit, where it can be acted on */ });

  paintCover();
  touched();
}

/* Kept as typed, so an unreadable link reaches `check` and gets named there
   rather than vanishing as the reader types it. */
youtubeInput?.addEventListener('input', () => {
  state.youtube = youtubeInput.value.trim() || null;
  paintCover();
  touched();
});

drop?.addEventListener('click', () => coverInput.click());
drop?.addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); coverInput.click(); }
});
coverInput?.addEventListener('change', () => takeCover(coverInput.files[0]));

for (const type of ['dragenter', 'dragover']) {
  drop?.addEventListener(type, event => { event.preventDefault(); drop.classList.add('is-over'); });
}
for (const type of ['dragleave', 'drop']) {
  drop?.addEventListener(type, () => drop.classList.remove('is-over'));
}
drop?.addEventListener('drop', event => {
  event.preventDefault();
  takeCover([...(event.dataTransfer?.files ?? [])][0]);
});

el('cover-clear')?.addEventListener('click', () => {
  if (state.cover?.preview) URL.revokeObjectURL(state.cover.preview);
  state.cover = null;
  coverInput.value = '';
  paintCover();
  touched();
});

paintCover();

/* --- the board, for citations and questions -------------------------------- */

fetch('/concepts.json')
  .then(response => response.ok ? response.json() : { concepts: [], questions: [] })
  .then(data => {
    state.concepts = data.concepts ?? [];
    state.questions = data.questions ?? [];
    el('f-question').replaceChildren(
      option('', 'Not answering a specific question'),
      ...state.questions.map(q => option(q.slug, q.question)));
  })
  .catch(() => { /* an empty board is a valid starting state */ });

/* --- references ------------------------------------------------------------ */

const refs = el('connections');

createConceptPicker(el('ref-picker'), {
  concepts: () => state.concepts,
  onPick: concept => { if (concept) addReference(concept); },
  clearOnPick: true,
});

function addReference(concept) {
  if ([...refs.children].some(node => node.dataset.slug === concept.slug)) return;

  const node = document.createElement('div');
  node.className = 'ref';
  node.dataset.slug = concept.slug;
  node.innerHTML = `
    <div class="ref-top">
      <span class="ref-face"></span>
      <span class="ref-body">
        <span class="ref-title">${concept.title.replace(/[<>&]/g, '')}</span>
        <span class="ref-by">@${String(concept.creator).replace(/[<>&]/g, '')}</span>
      </span>
      <button type="button" class="ref-drop" aria-label="Remove this reference">✕</button>
    </div>
    <div class="ref-more">
      <label class="sr">How it relates</label>
      <div class="sel sel-sm"><select data-rel></select></div>
      <label class="sr">Cite one exploration</label>
      <div class="sel sel-sm"><select data-exploration></select></div>
      <input data-note placeholder="Referenced for…">
    </div>`;

  node.querySelector('[data-rel]').append(
    ...Object.entries(RELATIONS).map(([id, meta]) => option(id, meta.label)));

  const exploration = node.querySelector('[data-exploration]');
  exploration.append(option('', 'The whole concept'));
  for (const item of concept.explorations ?? []) {
    exploration.append(option(item.id, `${item.number} — ${item.focus}`));
  }

  node.querySelector('.ref-drop').addEventListener('click', () => { node.remove(); touched(); });
  refs.append(node);
  touched();
}

/* --- explorations ---------------------------------------------------------- */

function row(container, className, build) {
  const node = document.createElement('div');
  node.className = className;
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'row-remove';
  remove.setAttribute('aria-label', 'Remove');
  remove.textContent = '✕';
  remove.addEventListener('click', () => { node.remove(); touched(); });
  build(node);
  node.append(remove);
  container.append(node);
  return node;
}

function addExploration() {
  const index = el('explorations').children.length + 1;
  row(el('explorations'), 'row', node => {
    node.innerHTML = `
      <p class="row-kicker">Exploration ${String(index).padStart(2, '0')}</p>
      <div class="fld">
        <label class="fld-label">What was this testing?</label>
        <input data-focus placeholder="HUD transition">
      </div>
      <div class="fld">
        <label class="fld-label">Media</label>
        <input type="file" data-media accept="image/*,video/mp4,video/quicktime,video/webm">
      </div>
      <p class="fld-hint" data-poster-note hidden></p>
      <div class="fld-pair">
        <div class="fld">
          <label class="fld-label">Keep <span class="opt">one per line</span></label>
          <textarea data-keep rows="2"></textarea>
        </div>
        <div class="fld">
          <label class="fld-label">Drop <span class="opt">one per line</span></label>
          <textarea data-drop rows="2"></textarea>
        </div>
      </div>
      <div class="fld">
        <label class="fld-label">Tools <span class="opt">comma separated</span></label>
        <input data-tools placeholder="Blender">
      </div>`;

    const media = node.querySelector('[data-media]');
    media.addEventListener('change', () => {
      watchForPoster(media, node.querySelector('[data-poster-note]'));
      touched();
    });
  });
  touched();
}

document.querySelector('[data-add-exploration]')?.addEventListener('click', addExploration);

/* --- counters, checklist, draft -------------------------------------------- */

const counter = (field, out) => {
  const node = el(field);
  const paint = () => { el(out).textContent = node.value.length; };
  node.addEventListener('input', paint);
  paint();
};
counter('f-title', 'f-title-count');
counter('f-summary', 'f-summary-count');

/* The checklist reflects the form rather than decorating it, so ticking one
   off means something happened. */
function paintChecklist() {
  const done = {
    summary: el('f-summary').value.trim().length >= 40,
    article: articleText(editor?.html).length >= 120,
    references: refs.children.length > 0,
    media: Boolean(state.cover || state.youtube) || el('explorations').children.length > 0,
  };
  for (const item of el('checklist').children) {
    item.classList.toggle('is-done', Boolean(done[item.dataset.check]));
  }
}

/* Drafts live in this browser. There is no server-side draft, so saying
   "saved" has to mean saved somewhere real. */
const DRAFT = 'wad3:draft';
let draftTimer;

function saveDraft() {
  const draft = {
    title: el('f-title').value,
    summary: el('f-summary').value,
    type: el('f-type').value,
    status: el('f-status').value,
    categories: state.categories,
    article: editor?.html ?? '',
    takeaways: el('f-takeaways').value,
    tools: el('f-tools').value,
    credits: el('f-credits').value,
    question: el('f-question').value,
    at: Date.now(),
  };
  try {
    localStorage.setItem(DRAFT, JSON.stringify(draft));
    el('draft-state').textContent = 'Draft saved in this browser';
  } catch {
    el('draft-state').textContent = '';
  }
}

function restoreDraft() {
  let draft;
  try { draft = JSON.parse(localStorage.getItem(DRAFT) ?? 'null'); } catch { return; }
  if (!draft) return;

  el('f-title').value = draft.title ?? '';
  el('f-summary').value = draft.summary ?? '';
  if (draft.type) el('f-type').value = draft.type;
  if (draft.status) el('f-status').value = draft.status;
  state.categories = (draft.categories ?? []).filter(id => CATEGORY_LABEL[id]);
  el('f-takeaways').value = draft.takeaways ?? '';
  el('f-tools').value = draft.tools ?? '';
  el('f-credits').value = draft.credits ?? '';
  if (editor && draft.article) editor.html = draft.article;

  paintCategories();
  paintStatusNote();
  el('draft-state').textContent = 'Draft restored from this browser';
  for (const [field, out] of [['f-title', 'f-title-count'], ['f-summary', 'f-summary-count']]) {
    el(out).textContent = el(field).value.length;
  }
}

/** Anything changed: repaint what depends on the form, and save shortly. */
function touched() {
  paintChecklist();
  schedulePreview();
  clearTimeout(draftTimer);
  draftTimer = setTimeout(saveDraft, 1200);
}

el('form')?.addEventListener('input', touched);
el('form')?.addEventListener('change', touched);

/* --- preview ---------------------------------------------------------------
   Rendered by the same function the concept page uses, so what you see here
   cannot drift from what gets published. */

const preview = el('preview-body');
if (preview) preview.insertAdjacentHTML('beforebegin', iconSprite());

function paintPreview() {
  if (!preview || el('preview').hidden) return;
  preview.innerHTML = renderOverview({
    article: editor ? editor.html : '',
    body: [],
    takeaways: lines(el('f-takeaways').value),
    explorations: [],
    connections: [],
    citedBy: [],
  });
}

let previewTimer;
function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(paintPreview, 200);
}

el('preview-toggle')?.addEventListener('click', () => {
  const panel = el('preview');
  panel.hidden = !panel.hidden;
  el('preview-toggle').textContent = panel.hidden ? 'Preview' : 'Hide preview';
  paintPreview();
  if (!panel.hidden) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

/* --- collect and check ------------------------------------------------------ */

function collect() {
  const concept = {
    slug: slugify(el('f-title').value),
    title: el('f-title').value.trim(),
    /* No creator here on purpose. The server stamps the account's handle,
       which is what makes posting as someone else impossible. */
    type: el('f-type').value,
    categories: [...state.categories],
    status: el('f-status').value,
    summary: el('f-summary').value.trim(),
    article: editor ? editor.html : '',
    explorations: [...el('explorations').children].map((node, index) => {
      const input = node.querySelector('[data-media]');
      const media = input.files[0];
      return {
        id: `exploration-${String(index + 1).padStart(2, '0')}`,
        focus: node.querySelector('[data-focus]').value.trim(),
        type: media?.type.startsWith('video/') ? 'video' : 'image',
        keep: lines(node.querySelector('[data-keep]').value),
        drop: lines(node.querySelector('[data-drop]').value),
        tools: commas(node.querySelector('[data-tools]').value),
        _media: media,
        /* Still in flight if the video was only just chosen; settled before
           the form is checked. */
        _poster: input._poster ?? null,
      };
    }),
    connections: [...refs.children].map(node => {
      const exploration = node.querySelector('[data-exploration]').value;
      const note = node.querySelector('[data-note]').value.trim();
      const connection = {
        rel: node.querySelector('[data-rel]').value,
        concept: node.dataset.slug,
      };
      if (exploration) connection.exploration = exploration;
      if (note) connection.note = note;
      return connection;
    }),
    date: new Date().toISOString().slice(0, 10),
  };

  const takeaways = lines(el('f-takeaways').value);
  if (takeaways.length) concept.takeaways = takeaways;

  const tools = commas(el('f-tools').value);
  if (tools.length) concept.tools = tools;

  const credits = el('f-credits').value.trim();
  if (credits) concept.credits = credits;

  const question = el('f-question').value;
  if (question) concept.question = question;

  return concept;
}

function check(concept) {
  const found = [];

  if (!el('f-rights').checked) found.push('Confirm you have the right to share this work.');
  if (!concept.title) found.push('Give the concept a title.');
  if (!concept.slug) found.push('That title does not produce a usable web address.');
  if (!concept.summary) found.push('Write the short description.');
  if (!concept.categories.length) found.push('Pick at least one category.');
  if (concept.categories.length > MAX.categories) found.push(`At most ${MAX.categories} categories.`);

  if (TEXT_FIRST.has(concept.type) && !articleText(concept.article)) {
    found.push(`A ${TYPES[concept.type]?.label ?? concept.type} concept needs the idea written out.`);
  }
  if (concept.article.length > MAX.article) {
    found.push('The concept is longer than the form accepts — trim it down.');
  }

  if (state.youtube && !youtubeId(state.youtube)) {
    found.push('That does not look like a YouTube video link.');
  }

  concept.explorations.forEach((exploration, index) => {
    const where = `Exploration ${String(index + 1).padStart(2, '0')}`;
    if (!exploration.focus) found.push(`${where}: say what it was testing.`);
    if (!exploration._media) found.push(`${where}: attach the image or video.`);
    /* The poster is taken from the video itself, so this only fires when the
       browser could not decode it at all. */
    if (exploration.type === 'video' && !exploration._thumb) {
      found.push(`${where}: no frame could be read from that video. An MP4 (H.264) will work.`);
    }
  });

  return found;
}

function problems(list) {
  const node = el('problems');
  if (!list.length) return show(node, false);
  node.innerHTML = `<p class="problems-title">${list.length} thing${list.length === 1 ? '' : 's'} to fix</p>
    <ul>${list.map(p => `<li>${String(p).replace(/[<>&]/g, '')}</li>`).join('')}</ul>`;
  show(node);
  node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* --- submit ----------------------------------------------------------------- */

el('form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const button = el('submit');
  const concept = collect();

  /* Settle the frame grabs before checking, so a video chosen a second ago is
     judged on whether a poster could be read rather than on the timing. */
  const posters = [
    ...concept.explorations.map(e => e._poster),
    state.cover?.poster ?? null,
  ];
  if (posters.some(Boolean)) {
    button.disabled = true;
    button.textContent = 'Reading poster frames…';
    await Promise.allSettled(posters.filter(Boolean));
    button.disabled = false;
    button.textContent = 'Submit for review';
  }

  for (const exploration of concept.explorations) {
    exploration._thumb = exploration._poster ? await exploration._poster.catch(() => null) : null;
    delete exploration._poster;
  }

  const found = check(concept);
  if (found.length) return problems(found);
  problems([]);

  button.disabled = true;
  const setLabel = text => { button.textContent = text; };

  try {
    setLabel('Uploading media…');

    /* A linked video is already hosted, so there is nothing to upload and
       YouTube's own still doubles as the board thumbnail. */
    if (state.youtube) {
      concept.cover = {
        type: 'youtube',
        media: state.youtube,
        thumbnail: youtubePoster(youtubeId(state.youtube)),
      };
    } else if (state.cover) {
      const uploaded = await state.upload(state.cover.file, state.user.uid);
      concept.cover = {
        type: state.cover.file.type.startsWith('video/') ? 'video' : 'image',
        media: uploaded.url,
      };
      /* Its own first frame, the same as an exploration's. This used to borrow
         a poster from whichever exploration happened to have one. */
      if (concept.cover.type === 'video') {
        const poster = state.cover.poster ? await state.cover.poster.catch(() => null) : null;
        if (!poster) {
          setLabel('Submit for review');
          button.disabled = false;
          return problems(['No frame could be read from the cover video. An MP4 (H.264) will work, or use an image.']);
        }
        concept.cover.thumbnail = (await state.upload(poster, state.user.uid)).url;
      }
    }

    for (const exploration of concept.explorations) {
      exploration.media = (await state.upload(exploration._media, state.user.uid)).url;
      if (exploration._thumb) {
        exploration.thumbnail = (await state.upload(exploration._thumb, state.user.uid)).url;
      }
      delete exploration._media;
      delete exploration._thumb;
    }

    setLabel('Submitting…');
    state.token = await state.user.getIdToken(true);

    const response = await fetch(endpoint(), {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${state.token}` },
      body: JSON.stringify({ concept }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      problems(payload.problems ?? [payload.error || `Publishing failed (${response.status}).`]);
      return;
    }

    localStorage.removeItem(DRAFT);
    el('result').innerHTML = `
      <h2>Thanks — it's in the queue.</h2>
      <p>A person reads every submission before it goes on the board. Yours will appear at
         <strong>/concepts/${payload.slug}</strong> once it's approved.</p>
      <a class="hbtn hbtn-primary" href="/concepts/">Browse the board</a>`;
    show(el('result'));
    show(el('form').querySelector('.cw-actions'), false);
    el('result').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (error) {
    problems([`Something went wrong — ${error?.message || error}`]);
  } finally {
    button.disabled = false;
    setLabel('Submit for review');
  }
});

restoreDraft();
paintChecklist();
paintCover();
