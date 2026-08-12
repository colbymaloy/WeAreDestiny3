/* =============================================================
   On-site publishing.

   Sign in, describe the concept, attach media. Media uploads straight
   to Storage; the concept goes to Firestore as pending, and an admin
   approves it onto the board.
   ============================================================= */

import {
  TYPES, CATEGORIES, STATUSES, RELATIONS, BODY_BLOCKS, MAX,
  slugify, validateShape, handleProblem, foldHandle,
} from '/assets/model.mjs';
import { renderOverview } from '/assets/render.mjs';
import { iconSprite } from '/assets/icons.mjs';
import { firebaseConfig, isConfigured } from '/assets/firebase-config.js';

const el = id => document.getElementById(id);
const show = (node, on = true) => { node.hidden = !on; };

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
  concepts: [],
  questions: [],
  blocks: [],
  explorations: [],
  connections: [],
  seq: 0,
};

/* --- boot ----------------------------------------------------------------- */

if (!isConfigured() && !useEmulators()) {
  show(el('auth-out'), false);
  show(el('auth-unconfigured'));
} else {
  /* A blocked or failed SDK should say so, not leave a dead button. */
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

  /* Local testing: serve the site and open /publish/?emu to point auth and
     storage at the Firebase emulators instead of the live project. Without
     the flag, localhost still talks to production — so you can test either. */
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

  /* The handle this account already claimed, if any. Reading our own
     publisher record is all the rules allow, which is all we need. */
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
  /* A popup the person closed themselves is not worth an error panel. */
  if (['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(error?.code)) return;
  problems([`Sign-in failed — ${error?.message || error}`]);
}

/* The account's real name is never shown and never suggested. A handle is the
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
  /* Nothing can be submitted anonymously, so the form waits. */
  el('form').classList.toggle('is-locked', !claimed);
}

const handleInput = el('f-handle');
const handleNote = el('handle-note');
let handleTimer;

function noteHandle(text, kind) {
  handleNote.textContent = text;
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

/* --- static option lists -------------------------------------------------- */

function option(value, label) {
  const node = document.createElement('option');
  node.value = value;
  node.textContent = label;
  return node;
}

el('f-type').append(...Object.entries(TYPES).map(([id, meta]) => option(id, `${meta.label} — ${meta.blurb}`)));
el('f-status').append(...Object.entries(STATUSES).map(([id, label]) => option(id, label)));

el('f-categories').append(...CATEGORIES.map(category => {
  const wrap = document.createElement('label');
  wrap.className = 'check';
  wrap.innerHTML = `<input type="checkbox" value="${category.id}"><span>${category.label}</span>`;
  return wrap;
}));

el('body-add').append(...Object.entries(BODY_BLOCKS).map(([type, spec]) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn-ghost';
  button.textContent = `Add ${spec.label.toLowerCase()}`;
  button.addEventListener('click', () => addBlock(type));
  return button;
}));

/* The board's own data, so citations can only point at concepts that exist. */
fetch('/concepts.json')
  .then(response => response.ok ? response.json() : { concepts: [], questions: [] })
  .then(data => {
    state.concepts = data.concepts ?? [];
    state.questions = data.questions ?? [];
    el('f-question').append(
      option('', 'Not answering a specific question'),
      ...state.questions.map(q => option(q.slug, q.question)),
    );
  })
  .catch(() => { /* an empty board is a valid starting state */ });

/* --- live preview ---------------------------------------------------------
   Rendered by the same function the concept page uses, so what you see here
   cannot drift from what gets published. Media that has not been uploaded yet
   previews from a local blob URL. */

const preview = el('preview-body');
let previewUrls = [];

/* The rendered markup references icons by id, so the sheet has to be on the
   page too. */
if (preview) preview.insertAdjacentHTML('beforebegin', iconSprite());

function paintPreview() {
  if (!preview) return;

  for (const url of previewUrls) URL.revokeObjectURL(url);
  previewUrls = [];

  const draft = collect();
  const body = draft.body.map(block => {
    if (block.type !== 'image') return block;
    if (!block._media) return { ...block, media: '' };
    const url = URL.createObjectURL(block._media);
    previewUrls.push(url);
    return { ...block, media: url };
  }).filter(block => block.type !== 'image' || block.media);

  preview.innerHTML = renderOverview({
    body,
    takeaways: lines(el('f-takeaways').value),
    explorations: [],
    connections: [],
    citedBy: [],
  });
}

let previewTimer;
const schedulePreview = () => {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(paintPreview, 200);
};

el('form')?.addEventListener('input', schedulePreview);
el('form')?.addEventListener('change', schedulePreview);

/* --- repeatable rows ------------------------------------------------------ */

function row(container, className, build) {
  const node = document.createElement('div');
  node.className = className;
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'row-remove';
  remove.setAttribute('aria-label', 'Remove');
  remove.textContent = '✕';
  remove.addEventListener('click', () => { node.remove(); refreshCovers(); });
  build(node);
  node.append(remove);
  container.append(node);
  return node;
}

function addBlock(type) {
  const spec = BODY_BLOCKS[type];
  row(el('body-blocks'), 'row', node => {
    node.dataset.blockType = type;

    if (type === 'image') {
      node.innerHTML = `
        <p class="row-kicker">${spec.label}</p>
        <div class="field">
          <label>Heading <span class="opt">optional</span></label>
          <input data-heading placeholder="What this shows">
        </div>
        <div class="field">
          <label>Image</label>
          <p class="hint">${spec.blurb}</p>
          <input type="file" data-image accept="image/*">
        </div>
        <div class="field">
          <label>Caption <span class="opt">optional</span></label>
          <input data-caption placeholder="A line about what you are looking at">
        </div>`;
      return;
    }

    node.innerHTML = `
      <p class="row-kicker">${spec.label}</p>
      <div class="field">
        <label>Heading <span class="opt">optional</span></label>
        <input data-heading placeholder="${type === 'timeline' ? 'Timeline' : 'The idea'}">
      </div>
      <div class="field">
        <label>${spec.field === 'text' ? 'Text' : 'One per line'}</label>
        <p class="hint">${spec.blurb}${spec.example ? ` For example: ${spec.example}` : ''}</p>
        <textarea data-value rows="${spec.field === 'text' ? 5 : 4}"></textarea>
      </div>`;
  });
}

function addExploration() {
  const index = el('explorations').children.length + 1;
  row(el('explorations'), 'row', node => {
    node.innerHTML = `
      <p class="row-kicker">Exploration ${String(index).padStart(2, '0')}</p>
      <div class="field">
        <label>What was this testing?</label>
        <input data-focus placeholder="HUD transition" required>
      </div>
      <div class="field">
        <label>Media</label>
        <p class="hint">Image or video. Video needs a poster frame as well.</p>
        <input type="file" data-media accept="image/*,video/mp4,video/quicktime,video/webm">
      </div>
      <div class="field" data-poster-field hidden>
        <label>Poster frame</label>
        <p class="hint">A still from the video, for the board.</p>
        <input type="file" data-thumb accept="image/*">
      </div>
      <div class="field-pair">
        <div class="field">
          <label>Keep <span class="opt">one per line</span></label>
          <textarea data-keep rows="3" placeholder="HUD collapse"></textarea>
        </div>
        <div class="field">
          <label>Drop <span class="opt">one per line</span></label>
          <textarea data-drop rows="3" placeholder="The Super itself"></textarea>
        </div>
      </div>
      <div class="field">
        <label>Tools <span class="opt">optional, comma separated</span></label>
        <input data-tools placeholder="Veo">
      </div>`;

    const media = node.querySelector('[data-media]');
    media.addEventListener('change', () => {
      const isVideo = media.files[0]?.type.startsWith('video/');
      show(node.querySelector('[data-poster-field]'), Boolean(isVideo));
      refreshCovers();
    });
  });
  refreshCovers();
}

function addConnection() {
  row(el('connections'), 'row', node => {
    node.innerHTML = `
      <p class="row-kicker">Citation</p>
      <div class="field-pair">
        <div class="field">
          <label>Relationship</label>
          <select data-rel></select>
        </div>
        <div class="field">
          <label>Concept</label>
          <select data-concept></select>
        </div>
      </div>
      <div class="field">
        <label>Cite one exploration <span class="opt">optional</span></label>
        <p class="hint">Point at a specific piece rather than the whole concept.</p>
        <select data-exploration></select>
      </div>
      <div class="field-pair" data-range hidden>
        <div class="field">
          <label>From <span class="opt">seconds</span></label>
          <input type="number" data-start min="0" step="0.1" placeholder="4">
        </div>
        <div class="field">
          <label>To <span class="opt">seconds</span></label>
          <input type="number" data-end min="0" step="0.1" placeholder="8">
        </div>
      </div>
      <div class="field">
        <label>Referenced for <span class="opt">optional but worth writing</span></label>
        <textarea data-note rows="2" placeholder="The weapon transformation here is close to how I imagine entering the state."></textarea>
      </div>`;

    node.querySelector('[data-rel]').append(
      ...Object.entries(RELATIONS).map(([id, meta]) => option(id, meta.label)));

    const concept = node.querySelector('[data-concept]');
    concept.append(
      option('', state.concepts.length ? 'Choose a concept' : 'No concepts on the board yet'),
      ...state.concepts.map(c => option(c.slug, `${c.title} — @${c.creator}`)));

    const exploration = node.querySelector('[data-exploration]');
    const range = node.querySelector('[data-range]');

    concept.addEventListener('change', () => {
      const target = state.concepts.find(c => c.slug === concept.value);
      exploration.replaceChildren(option('', 'The whole concept'));
      for (const item of target?.explorations ?? []) {
        exploration.append(option(item.id, `${item.number} — ${item.focus}`));
      }
      show(range, false);
    });
    exploration.addEventListener('change', () => show(range, Boolean(exploration.value)));
    concept.dispatchEvent(new Event('change'));
  });
}

el('explorations').closest('fieldset').querySelector('[data-add-exploration]')
  .addEventListener('click', addExploration);
el('connections').closest('fieldset').querySelector('[data-add-connection]')
  .addEventListener('click', addConnection);

function refreshCovers() {
  const select = el('f-cover');
  const current = select.value;
  select.replaceChildren(option('', 'No cover — written concept'));
  [...el('explorations').children].forEach((node, index) => {
    const focus = node.querySelector('[data-focus]').value || `Exploration ${index + 1}`;
    select.append(option(`exploration-${String(index + 1).padStart(2, '0')}`, focus));
  });
  select.value = current;
}

/* --- assembling the payload ----------------------------------------------- */

const lines = value => String(value || '').split('\n').map(s => s.trim()).filter(Boolean);
const commas = value => String(value || '').split(',').map(s => s.trim()).filter(Boolean);

function collect() {
  const concept = {
    slug: slugify(el('f-title').value),
    title: el('f-title').value.trim(),
    /* No creator here on purpose. The server stamps the account's handle,
       which is what makes posting as someone else impossible. */
    type: el('f-type').value,
    categories: [...el('f-categories').querySelectorAll('input:checked')].map(i => i.value),
    status: el('f-status').value,
    summary: el('f-summary').value.trim(),
    body: [...el('body-blocks').children].map(node => {
      const type = node.dataset.blockType;
      const spec = BODY_BLOCKS[type];
      const heading = node.querySelector('[data-heading]').value.trim();
      const block = { type };
      if (heading) block.heading = heading;

      if (type === 'image') {
        const caption = node.querySelector('[data-caption]').value.trim();
        if (caption) block.caption = caption;
        block._media = node.querySelector('[data-image]').files[0];
        return block;
      }

      const raw = node.querySelector('[data-value]').value;
      if (spec.field === 'text') block.text = raw.trim();
      else block[spec.field] = lines(raw);
      return block;
    }),
    explorations: [...el('explorations').children].map((node, index) => {
      const media = node.querySelector('[data-media]').files[0];
      const thumb = node.querySelector('[data-thumb]')?.files[0];
      return {
        id: `exploration-${String(index + 1).padStart(2, '0')}`,
        focus: node.querySelector('[data-focus]').value.trim(),
        type: media?.type.startsWith('video/') ? 'video' : 'image',
        keep: lines(node.querySelector('[data-keep]').value),
        drop: lines(node.querySelector('[data-drop]').value),
        tools: commas(node.querySelector('[data-tools]').value),
        _media: media,
        _thumb: thumb,
      };
    }),
    connections: [...el('connections').children].map(node => {
      const start = Number(node.querySelector('[data-start]').value);
      const end = Number(node.querySelector('[data-end]').value);
      const exploration = node.querySelector('[data-exploration]').value;
      const note = node.querySelector('[data-note]').value.trim();
      const connection = {
        rel: node.querySelector('[data-rel]').value,
        concept: node.querySelector('[data-concept]').value,
      };
      if (exploration) connection.exploration = exploration;
      if (exploration && Number.isFinite(start) && Number.isFinite(end) && end > start) {
        connection.t = [start, end];
      }
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

  const cover = el('f-cover').value;
  if (cover) concept.cover = cover;

  return concept;
}

/**
 * Validates against the same rules the build enforces, so nothing gets as far
 * as a pull request that the deploy would reject. Media is still a File here,
 * so it is checked separately.
 */
function check(concept) {
  const problems = [];

  if (!el('f-rights').checked) problems.push('Confirm you have the right to share this work.');
  if (!concept.slug) problems.push('Give the concept a title.');
  if (!concept.categories.length) problems.push('Pick at least one category.');
  if (concept.categories.length > MAX.categories) problems.push(`At most ${MAX.categories} categories.`);

  concept.body.forEach((block, index) => {
    if (block.type === 'image' && !block._media) {
      problems.push(`Section ${index + 1}: choose an image, or remove the section.`);
    }
  });

  concept.explorations.forEach((exploration, index) => {
    const where = `Exploration ${String(index + 1).padStart(2, '0')}`;
    if (!exploration._media) problems.push(`${where}: attach the image or video.`);
    if (exploration.type === 'video' && !exploration._thumb) {
      problems.push(`${where}: a video needs a poster frame.`);
    }
    if (exploration._media && exploration._media.size > 100 * 1024 * 1024) {
      problems.push(`${where}: ${(exploration._media.size / 1048576).toFixed(0)} MB is over the 100 MB limit.`);
    }
  });

  concept.connections.forEach((connection, index) => {
    if (!connection.concept) problems.push(`Citation #${index + 1}: choose a concept to cite.`);
  });

  if (state.concepts.some(c => c.slug === concept.slug)) {
    problems.push(`A concept called "${concept.slug}" already exists. Change the title.`);
  }

  /* Shape rules run against a copy with media stubbed, since the real URLs
     only exist after upload. */
  const stub = structuredClone({
    ...concept,
    explorations: concept.explorations.map(e => ({
      ...e, _media: undefined, _thumb: undefined,
      media: 'https://example.invalid/pending',
      thumbnail: e.type === 'video' ? 'https://example.invalid/pending' : undefined,
    })),
  });
  problems.push(...validateShape(stub));

  return problems;
}

function problems(list) {
  const node = el('problems');
  if (!list.length) return show(node, false);
  node.innerHTML = `<p class="problems-title">${list.length} thing${list.length === 1 ? '' : 's'} to fix</p>
    <ul>${list.map(p => `<li>${p.replace(/[<>&]/g, '')}</li>`).join('')}</ul>`;
  show(node);
  node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* --- submit --------------------------------------------------------------- */

el('f-summary').addEventListener('input', () => {
  el('f-summary-count').textContent = el('f-summary').value.length;
});
el('explorations').addEventListener('input', event => {
  if (event.target.matches('[data-focus]')) refreshCovers();
});

el('preview-toggle').addEventListener('click', () => {
  const concept = collect();
  const clean = structuredClone({
    ...concept,
    explorations: concept.explorations.map(({ _media, _thumb, ...rest }) => ({
      ...rest,
      media: _media ? `(upload: ${_media.name})` : '(none)',
      ...(_thumb ? { thumbnail: `(upload: ${_thumb.name})` } : {}),
    })),
  });
  el('preview').textContent = JSON.stringify(clean, null, 2);
  show(el('preview'), el('preview').hidden);
});

el('form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = el('submit');
  const concept = collect();

  const found = check(concept);
  if (found.length) return problems(found);
  problems([]);

  button.disabled = true;
  const setLabel = text => { button.textContent = text; };

  try {
    setLabel('Uploading media…');
    for (const block of concept.body) {
      if (block.type !== 'image') continue;
      block.media = (await state.upload(block._media, state.user.uid)).url;
      delete block._media;
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

    el('result').innerHTML = `
      <p class="eyebrow"><span class="mark"></span>Submitted</p>
      <h2>Thanks — it's in the queue.</h2>
      <p>A person reads every submission before it goes on the board. Yours will appear at
         <strong>/concepts/${payload.slug}</strong> once it's approved.</p>
      <a class="btn btn-primary" href="/">Browse the board</a>`;
    show(el('result'));
    show(el('form').querySelector('.submit-row'), false);
    el('result').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (error) {
    problems([`Something went wrong — ${error?.message || error}`]);
  } finally {
    button.disabled = false;
    setLabel('Submit concept');
  }
});
