/* =============================================================
   Review queue.

   Every submission lands as pending and shows here. Approving
   publishes it to the board; declining records a reason the
   submitter can be told.
   ============================================================= */

import { CATEGORY_LABEL, TYPES, STATUSES } from '/assets/model.mjs';
import { firebaseConfig, isConfigured } from '/assets/firebase-config.js';

const el = id => document.getElementById(id);
const show = (node, on = true) => { node.hidden = !on; };
const esc = v => String(v ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const useEmulators = () =>
  ['localhost', '127.0.0.1'].includes(location.hostname)
  && new URLSearchParams(location.search).has('emu');

const endpoint = () => (useEmulators()
  ? `http://localhost:5001/${firebaseConfig.projectId}/us-central1/moderate`
  : '/api/moderate');

const state = { user: null };

if (!isConfigured()) {
  el('lede').textContent = 'Firebase is not configured for this site yet.';
} else {
  start();
}

async function start() {
  const [{ initializeApp }, auth] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'),
  ]);

  const app = initializeApp(firebaseConfig);
  const client = auth.getAuth(app);
  if (useEmulators()) auth.connectAuthEmulator(client, 'http://localhost:9099', { disableWarnings: true });

  el('sign-in').addEventListener('click', () =>
    auth.signInWithPopup(client, new auth.GoogleAuthProvider()).catch(reportError));
  el('sign-out').addEventListener('click', () => auth.signOut(client));

  auth.onAuthStateChanged(client, async user => {
    state.user = user;
    show(el('signin'), !user);
    show(el('denied'), false);
    show(el('queue'), false);
    if (user) {
      el('uid').textContent = user.uid;
      await load();
    } else {
      el('lede').textContent = 'Sign in to review submissions.';
    }
  });
}

const token = () => state.user.getIdToken();

async function api(method, body) {
  const response = await fetch(endpoint(), {
    method,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${await token()}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { ok: response.ok, status: response.status, data: await response.json().catch(() => ({})) };
}

async function load() {
  const { ok, status, data } = await api('GET');

  if (status === 403) {
    el('lede').textContent = 'This account cannot review submissions.';
    return show(el('denied'));
  }
  if (!ok) return reportError(new Error(data.error ?? `Request failed (${status})`));

  const pending = data.pending ?? [];
  el('lede').textContent = pending.length
    ? `${pending.length} submission${pending.length === 1 ? '' : 's'} waiting.`
    : 'Nothing waiting. The queue is clear.';

  el('pending').replaceChildren(...pending.map(card));
  show(el('queue'));
}

function card(concept) {
  const node = document.createElement('div');
  node.className = 'row';

  const categories = (concept.categories ?? []).map(c => CATEGORY_LABEL[c] ?? c).join(' · ');
  const explorations = concept.explorations ?? [];

  node.innerHTML = `
    <p class="row-kicker">${esc(TYPES[concept.type]?.label ?? concept.type)} · ${esc(categories)} · ${esc(STATUSES[concept.status] ?? '')}</p>
    <h2 class="ccard-title" style="font-size:1.3rem;margin:10px 0 6px">${esc(concept.title)}</h2>
    <p class="hint" style="margin:0 0 12px">by @${esc(concept.creator)}</p>
    <p style="color:var(--bone-dim);font-size:.95rem;margin:0 0 14px">${esc(concept.summary)}</p>
    ${explorations.length ? `<p class="hint">${explorations.length} exploration${explorations.length === 1 ? '' : 's'}</p>
      <div class="moments" style="margin-bottom:14px">${explorations.map(e => `
        <figure class="mediaref"><div class="mediaref-stage">
          ${e.thumbnail || e.type === 'image'
            ? `<img src="${esc(e.thumbnail || e.media)}" alt="" loading="lazy">` : ''}
        </div><figcaption><p class="mediaref-note">${esc(e.focus)}</p></figcaption></figure>`).join('')}</div>` : ''}
    <div class="submit-row">
      <button type="button" class="btn btn-primary" data-approve>Approve</button>
      <button type="button" class="btn btn-ghost" data-decline>Decline</button>
      <a class="btn btn-ghost" href="/concepts/${esc(concept.slug)}/" target="_blank" rel="noopener">Preview</a>
    </div>`;

  node.querySelector('[data-approve]').addEventListener('click', () => act(concept.slug, 'approve', node));
  node.querySelector('[data-decline]').addEventListener('click', () => {
    const reason = prompt(`Why is "${concept.title}" being declined?`) ?? '';
    if (reason.trim()) act(concept.slug, 'decline', node, reason.trim());
  });
  return node;
}

async function act(slug, action, node, reason) {
  const buttons = node.querySelectorAll('button');
  for (const b of buttons) b.disabled = true;

  const { ok, data } = await api('POST', { slug, action, reason });
  if (!ok) {
    for (const b of buttons) b.disabled = false;
    return reportError(new Error(data.error ?? 'Request failed'));
  }
  node.remove();
  const left = el('pending').children.length;
  el('lede').textContent = left
    ? `${left} submission${left === 1 ? '' : 's'} waiting.`
    : 'Nothing waiting. The queue is clear.';
}

function reportError(error) {
  const node = el('problems');
  node.innerHTML = `<p class="problems-title">Something went wrong</p><ul><li>${esc(error.message)}</li></ul>`;
  show(node);
}
