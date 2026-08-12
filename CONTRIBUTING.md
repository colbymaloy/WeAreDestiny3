# Contributing

**Posting a concept happens at [wearedestiny3.com/contribute](https://wearedestiny3.com/contribute/).**

That is the only submission route. You don't need a GitHub account, you don't need Git, and there
is no JSON to write — sign in once, fill in the form, attach whatever communicates the idea. A
person reviews it, and it appears on the board.

Everything below this line is for people working on the *site itself*. If you came here to post an
idea, [go here instead](https://wearedestiny3.com/contribute/).

---

## What this repository is

The site's source, and its database. Every concept is a plain text file at
`concepts/<slug>/concept.json`, and the site is rebuilt from those files whenever one lands.

That's deliberate. It means the board can't quietly rewrite anyone's work, the whole history is
auditable, and if this project stops being maintained the concepts are still sitting in the open
rather than trapped in a database nobody can reach.

It is not a place to submit ideas. Issues are closed for that; the form exists because most of the
people who should be in this project are artists, not developers.

## How a submission becomes a concept

```
wearedestiny3.com/contribute
        ↓  Cloud Function — verifies, rate-limits, validates, rehosts media
   pull request                     ← the review queue
        ↓  merge
  concepts/<slug>/concept.json
        ↓  GitHub Actions — preflight, validate, build
   wearedestiny3.com
```

Merging the pull request publishes the concept. Closing it declines the submission. Nothing is ever
written straight to `main`.

Setup and moderation: [`docs/PUBLISHING.md`](docs/PUBLISHING.md).

## The two rules the data model enforces

**A concept is an idea, not a medium.** A written design proposal, a lore entry, a diagram, a
render, a video and a playable prototype are all the same kind of object. Every concept has a
`type` — `vision`, `design`, `lore`, `world`, `visual`, `prototype`. The first three are written
concepts and the build *refuses to publish one without a `body`*.

**Cite, don't duplicate.** Concepts reference each other with structured `connections`, so the
reverse edge is derived: cite someone and their page gains "Referenced by 7 concepts" with nobody
maintaining it. You can cite a whole concept or a few seconds inside one of its explorations, and
attribution is generated rather than typed.

Full field reference: [`concepts/README.md`](concepts/README.md) and
[`questions/README.md`](questions/README.md). The vocabulary and validation live in one place,
[`shared/model.mjs`](shared/model.mjs), imported by the build, the publish form and the function so
they cannot drift.

## Working on the site

```sh
npm run dev       # build, then serve on http://localhost:8000
```

No dependencies — plain Node and any static server. Before pushing:

```sh
npm run check     # validate every concept, build, then preflight
```

`npm run emulators` runs the publish flow locally; see
[`docs/PUBLISHING.md`](docs/PUBLISHING.md#testing-it-locally).

Both run on every pull request, and the deploy runs them again.

### Layout

| | |
|---|---|
| `src/` | the site — pages, assets, and the templates the build fills |
| `concepts/` `questions/` | the database, one folder each |
| `shared/model.mjs` | types, categories, relationships, validation |
| `functions/` | the publish function |
| `.github/scripts/` | build, validate, preflight |
| `media/` | thumbnails, small images, branding |

### Editing a published concept

Concepts are text files, so a typo fix is a normal pull request against
`concepts/<slug>/concept.json`. Don't change someone's words or their `creator` field without
asking them — correcting a broken link or a category is fine.

## Media

Small images and thumbnails are committed to `media/`. Everything else is hosted on a GitHub
Release, which the publish function handles automatically.

**Never commit video files.** GitHub Pages caps the published site at 1 GB, rejects files over
100 MB, and cannot serve Git LFS at all — so LFS solves nothing here. The build fails if an `.mp4`,
`.mov` or `.webm` is committed.

## Credit

Every concept carries its creator's name, and creators keep the rights to their own work. Anyone
can ask for their concept to be removed. See [`LICENSE`](LICENSE).

## Behaviour

Critique the work, not the person. [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

---

WE ARE DESTINY 3 is an unofficial fan project and is not affiliated with, endorsed by, or associated with Bungie.
