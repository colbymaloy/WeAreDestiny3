# How it runs

Everything is Firebase. There is no GitHub credential anywhere in the system,
and no build step between someone submitting and the board showing it.

```
                    Firebase Hosting
                   /        |        \
      static shell    /api/*      / and /concepts/** and /questions/**
      (this repo)        |                    |
                   submitConcept              ssr
                   moderate                   |
                         \                    |
                          \                   |
                           Firestore ─────────┘
                                │
                           Storage (media)
```

| Piece | Where |
|---|---|
| Site | Firebase Hosting, served from `_site/` |
| Concepts and questions | Firestore — `concepts/{slug}`, `questions/{slug}` |
| Media | Cloud Storage — `media/{uid}/{file}`, publicly readable |
| Submission | `POST /api/submit` → `submitConcept` |
| Moderation | `/admin/` → `/api/moderate` → `moderate` |
| Page rendering | `ssr`, reached through Hosting rewrites |

## Why the server renders pages

Concepts change whenever one is approved, so the pages cannot be pre-built.
They are rendered on request instead of in the browser, which keeps three
things a client-side board would lose:

- every concept has a real URL that returns real HTML
- link previews carry the concept's own title, summary and cover image
- the page works before any JavaScript runs

Responses are held at the CDN for five minutes (`s-maxage=300`), so traffic
spikes do not become Firestore reads. If Firestore is unreachable the server
falls back to the seeded board rather than returning an error.

## One renderer, two callers

`shared/` holds the entire vocabulary and every line of HTML generation, with
no filesystem or Node dependencies:

| File | Holds |
|---|---|
| `model.mjs` | types, categories, statuses, relationships, validation |
| `graph.mjs` | normalisation, the citation graph, derived stats |
| `render.mjs` | every page and component |

Both the static build (`.github/scripts/build.mjs`) and the server
(`functions/index.mjs`) import them, so a page built locally and a page served
live come out byte-identical. Firebase only uploads `functions/`, so
`npm --prefix functions run bundle` copies `shared/` and the templates in
before each deploy — `firebase.json` runs it as a predeploy hook, and
`preflight.mjs` fails if the copies have drifted.

## The lifecycle of a submission

1. Someone signs in at `/contribute/` (Google or GitHub).
2. Media uploads straight to Storage under their own uid. Storage rules cap it
   at 100 MB and allow images and MP4/MOV/WEBM only.
3. The form validates against `shared/model.mjs` — the same rules the server
   applies — and posts to `/api/submit`.
4. `submitConcept` verifies the ID token, rate-limits, validates again, checks
   the media really belongs to that user, and writes the concept to Firestore
   with `status: 'pending'`.
5. Nothing is public yet. Firestore rules only expose `status == 'published'`.
6. An admin opens `/admin/`, reads it, and approves or declines.
7. Approving flips the status. The next request renders it onto the board.

## Admin access

Moderators are an explicit allowlist: a document in the `admins` collection
whose ID is the person's Firebase uid. Nothing client-side can write to that
collection.

To add yourself: open `/admin/`, sign in, and the page prints your uid. Create
`admins/{that-uid}` in the Firestore console with any contents.

## Questions

`questions/{slug}` documents, created in the Firestore console:

```json
{
  "slug": "what-should-supers-become",
  "question": "What should Supers become?",
  "categories": ["abilities", "gameplay"],
  "context": "Optional. A few sentences on why it is worth asking."
}
```

A concept links to one with `"question": "<slug>"`. The question page then
collects every concept answering it.

## Costs

Firestore reads are the CDN-cached path, so they scale with cache misses
rather than with traffic. Storage is the part that grows: 5 GB stored and
1 GB/day of downloads are free, then roughly $0.12/GB egress. Video is what
moves that number — worth watching once the board fills up, and worth a
budget alert in the console.

## Local development

```sh
npm run dev          # static shell on http://localhost:8000
npm run emulators    # auth, functions, firestore, storage + UI on :4000
```

Add `?emu` to a URL on localhost to point the page at the emulators instead of
the live project.
