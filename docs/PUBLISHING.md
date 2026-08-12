# Setting up on-site publishing

`/contribute/` is how concepts get posted. Contributors never touch Git, GitHub, or JSON — they sign
in once and fill in a form.

Behind that, the repository stays the source of truth. The function opens a pull request; merging it
is what publishes the concept. That PR is **your review queue**, not a contribution route for anyone
else.

```
browser                        Cloud Function                  GitHub
───────                        ──────────────                  ──────
sign in (GitHub / Google)
upload media  ──────────────▶  Firebase Storage (staging)
submit  ────────────────────▶  verify ID token
                               rate limit
                               validate (shared/model.mjs)
                               move media  ──────────────────▶  Release asset
                               commit + PR  ─────────────────▶  concepts/<slug>/concept.json
        ◀──────────────────────  pull request URL
```

**Nothing is written to `main`.** The pull request runs the same validation the deploy does, and
goes live only when merged.

**Media stays GitHub-hosted.** Firebase Storage is a staging buffer the function empties after
moving files onto a GitHub Release. That keeps egress off Firebase and the media architecture
unchanged.

Until it's finished, `/contribute/` shows a "submissions open shortly" panel and the rest of the site
works normally. **This is the only submission route** — GitHub is not a contribution surface, it is
where the site is stored, reviewed and deployed from.

---

## Already done

| | |
|---|---|
| Firebase project | **`wearedestiny3`** — [console](https://console.firebase.google.com/project/wearedestiny3/overview) |
| Web app registered | `1:949595489888:web:88084526c527946d326505` |
| Web config committed | [`src/assets/firebase-config.js`](../src/assets/firebase-config.js) |
| Firestore database | created (`nam5`) |
| Firestore rules | deployed from [`firestore.rules`](../firestore.rules) |
| Project alias | [`.firebaserc`](../.firebaserc) |
| Function source + deps | [`functions/`](../functions/), lockfile committed |
| Deploy workflow | [`.github/workflows/functions.yml`](../.github/workflows/functions.yml) |

## Still to do

Four steps. They need you rather than me because they involve a payment method and credentials that
shouldn't pass through anyone else's hands.

### 1. Upgrade to Blaze

**This is the blocker for everything below.** Cloud Functions v2 and Cloud Storage both require it.

→ https://console.firebase.google.com/project/wearedestiny3/usage/details

Free-tier allowances still apply. Idle cost is effectively zero: staged media is deleted after each
publish, and published media lives on GitHub Releases, which have no bandwidth cap. Set a budget
alert while you're there.

### 2. Turn on Storage and the auth providers

**Storage** → https://console.firebase.google.com/project/wearedestiny3/storage → Get started.
Then push the rules:

```sh
firebase deploy --only storage
```

**Authentication** → https://console.firebase.google.com/project/wearedestiny3/authentication/providers

- Enable **Google**. This is the only one you actually need.
- **GitHub is optional.** It only saves a contributor typing their username, and the sign-in button
  hides itself if the provider is off. Skip it unless you want it — if you do, it needs an OAuth app
  (GitHub → Settings → Developer settings → OAuth Apps → New) with the callback URL Firebase shows
  you.
- **Settings → Authorized domains** → add `wearedestiny3.com`.

### 3. Create a GitHub token

The site needs permission to save concepts into this repository. One token, scoped to this one
repo. **No contributor ever sees or needs this** — it is how the site writes, not how people
contribute.

1. Go to **[Fine-grained personal access tokens](https://github.com/settings/personal-access-tokens/new)**
   (GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens).
2. **Token name**: `wearedestiny3-publish`
3. **Expiration**: pick a date and put a reminder in your calendar. When it lapses, publishing stops
   with a clear error and you regenerate it — nothing is lost.
4. **Repository access** → *Only select repositories* → **`WeAreDestiny3`**
5. **Permissions** → *Repository permissions*, set these three:

   | Permission | Access | Why |
   |---|---|---|
   | **Contents** | Read and write | Create the branch and commit `concept.json` |
   | **Pull requests** | Read and write | Open the PR you approve |
   | **Issues** | Read and write | Label the PR. *Optional* — the function shrugs this off if missing |

6. **Generate token**, copy it (GitHub shows it once).

```sh
firebase functions:secrets:set GITHUB_TOKEN
```

Paste it when prompted. It is stored in Google Secret Manager and never appears in the repository.

> A GitHub App would also work and avoids the expiry date, but it is three secrets and a lot more
> setup for no benefit on a repository with one owner. If this ever grows past you, switching is a
> small change to `client()` in `functions/index.mjs`.

### 4. Deploy, then paste the URL back

```sh
firebase deploy --only functions
```

Copy the printed function URL into `PUBLISH_ENDPOINT` in
[`src/assets/firebase-config.js`](../src/assets/firebase-config.js), commit, push. `/contribute/`
switches itself on.

`firebase functions:list` shows the URL again later if you lose it.

### Optional — deploy the function from CI

The workflow skips itself until `FIREBASE_SERVICE_ACCOUNT` exists, so this is safe to leave undone.

```sh
gcloud iam service-accounts create github-deployer --project wearedestiny3
gcloud projects add-iam-policy-binding wearedestiny3 \
  --member serviceAccount:github-deployer@wearedestiny3.iam.gserviceaccount.com \
  --role roles/firebase.admin
gcloud iam service-accounts keys create key.json \
  --iam-account github-deployer@wearedestiny3.iam.gserviceaccount.com
```

Paste `key.json` into the repo secret `FIREBASE_SERVICE_ACCOUNT`, then delete the local file.

---

## The web config is not a secret

`apiKey`, `projectId` and `appId` identify the project; they authorise nothing. Access is controlled
by Auth, the Storage rules, and the function's own token check. They're committed on purpose — the
browser needs them.

`GITHUB_TOKEN` **is** a secret, and lives only in Google Secret Manager.

## What's enforced

| Guard | Where |
|---|---|
| Signed-in user, verified ID token | function, before anything else |
| 1 submission/minute, 12/day, per account | function, Firestore-backed |
| Upload ≤ 100 MB, images and MP4/MOV/WEBM only | Storage rules **and** the form |
| Users can only write to `submissions/<their-uid>/` | Storage rules |
| Function refuses to move a file outside the submitter's folder | function |
| Concept shape — every rule the build enforces | `shared/model.mjs`, run in the browser *and* the function |
| Slug collisions, citations pointing at real concepts | function, against the live repo |
| No committed video, no broken media paths | the PR's own validation run |

`shared/model.mjs` is the single definition of a valid concept. The static build, the publish form,
and the function all import it. The function gets its copy via `npm run prepare` at deploy time —
Firebase packages only the `functions/` directory, so the parent folder isn't uploaded — and
`preflight.mjs` fails if that copy has drifted.

## Moderation

- Every submission is a pull request. Nothing appears on the board until you merge it.
- PRs are labelled `submission` and `from-site`.
- To block an account: set `blocked: true` on its `publishers/<uid>` document in Firestore.
- The submitter's Firebase UID is in the PR body, so a bad actor stays traceable across submissions
  even if they change their display name.

## Testing it locally

### The site

```sh
npm run dev          # builds, then serves _site on http://localhost:8000
```

Everything except publishing works with no Firebase setup at all — the board, concept pages,
questions, filters, citations, lightboxes.

### The publish flow, against the emulators

Nothing here touches the live project or your real repository.

```sh
echo "GITHUB_TOKEN=ghp_your_token" > functions/.secret.local   # gitignored
npm run emulators                                             # auth, functions, firestore, storage
npm run dev                                                   # in a second terminal
```

Then open **http://localhost:8000/publish/?emu**

The `?emu` flag is what switches auth and storage over to the emulators — without it, localhost
talks to the live project, so you can test either way. The emulated sign-in accepts any made-up
account, and the emulator UI at http://localhost:4000 shows what got written.

The function still opens a **real pull request** against the repository, since that is the part
being tested. Close it when you're done, or point `BASE_BRANCH` in `functions/index.mjs` at a
scratch branch first.

> The Firestore and Storage emulators need Java. `brew install openjdk` if `java -version` fails.

### The publish flow, against the real project

Deploy the function, put its URL in `PUBLISH_ENDPOINT`, then run `npm run dev` and use
http://localhost:8000/publish/ **without** the flag. `localhost:8000` is already in the function's
allowed origins.
