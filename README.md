# WE ARE DESTINY 3

**What should Destiny 3 be?**

WE ARE DESTINY 3 is an open community concept project exploring what the next generation of Destiny could look, feel, and play like.

This is not a leak.
This is not an attempt to predict what Bungie is building.

It's a blank canvas.

**Worlds. Weapons. UI. Systems. Guardians. Enemies. Abilities. Music. Lore. Gameplay.**

If you have an idea for Destiny 3, make it.

→ **[Explore wearedestiny3.com](https://wearedestiny3.com)**
→ **[Submit a Concept](../../issues/new?template=submit-concept.yml)**

**GitHub is where we build it together. [wearedestiny3.com](https://wearedestiny3.com) is where you experience it.**

---

## The Idea

Destiny has one of the most recognizable visual and gameplay identities in games.

But what does the next major evolution look like?

Not just higher-resolution environments or another subclass.

What does a Destiny built as a truly next-generation game look like?

How should the HUD evolve?

What could a new destination feel like?

What happens to supers?

Weapons?

Fireteams?

Raids?

Social spaces?

Character customization?

Exploration?

The goal of this project is to explore those questions **visually and collaboratively**.

There is no single WE ARE DESTINY 3 vision.

The board is the vision.

---

## One Idea = One Entry

This is the rule the whole project is built around, and it's what keeps the board from becoming a dump of disconnected images.

**If you make five videos exploring the same combat scenario, that is one concept with five explorations — not five cards.**

```
Super Activation Redesign          ← the board shows this
├── Selected direction             ← your strongest piece
├── Key takeaways                  ← what the concept argues for
├── Selected moments               ← the seconds worth keeping
└── Explorations                   ← every attempt, annotated
    ├── 01  HUD transition         ✓ HUD collapse    ✕ the Super itself
    ├── 02  Weapon transformation  ✓ weapon dissolve ✕ pacing
    └── 03  Activation and camera  ✓ camera movement
```

That distinction matters most for generative work, where nothing comes out perfect. One generation has the best HUD, another has the best weapon effect, a third accidentally discovers something you weren't aiming for. As five separate posts, that reads as noise. As one concept with the good seconds pulled out of each, it reads as design research — which is what it actually is.

**Explorations, not versions.** `v1, v2, v3` implies each is better than the last. Exploration 01 might hold the only usable HUD in the set while 04 holds the only usable lighting. Each is labelled by what it was *testing*.

**Status, not quality.** Every concept is `Exploring`, `Direction`, or `Refined` — how settled the idea is, not how good it is. Starting at Exploring is normal; most concepts never leave it.

---

## Create Anything

Use whatever medium you want.

* Concept art
* Gameplay concepts
* UI / UX
* Weapons
* Armor
* Guardians
* Abilities and supers
* Subclasses
* Worlds and destinations
* Enemies
* Vehicles
* Raids and activities
* Social systems
* Progression systems
* Lore
* Music and sound
* Animation
* 3D renders
* Videos
* Interactive prototypes
* Game design documents
* Sketches
* Mods and playable experiments

Use Photoshop.

Use Blender.

Use Unreal.

Use Figma.

Draw it by hand.

Write it.

Code it.

Generate it with AI.

Combine all of them.

**The tool doesn't matter. The idea does.**

---

## Contributing

You don't need to be a developer.

### Easiest way

**[Submit a Concept](../../issues/new?template=submit-concept.yml)** and attach your work.

The form asks for the idea, your strongest piece as a cover, and then every exploration underneath it — including the ones that didn't work, marked for what to keep and what to drop.

### Pull Requests

One folder per concept, so submissions never conflict:

```
concepts/your-concept-slug/
├── concept.json     the entry
└── notes.md         optional long-form writeup
```

Copy [`concepts/_example/concept.json`](./concepts/_example/concept.json) — it's a complete annotated reference. Every field is documented in [`concepts/README.md`](./concepts/README.md).

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for both routes end to end.

---

## Some Starting Questions

Don't know what to make?

Try answering one question.

**What should firing a weapon feel like in Destiny 3?**

**What should replacing the current ability HUD look like?**

**What does the next evolution of a Super look like?**

**What destination couldn't have existed in Destiny 2?**

**How should a fireteam interact outside combat?**

**What would make exploration meaningful?**

**What does a next-generation raid encounter look like?**

**How should armor customization evolve?**

**What should the Tower become?**

Then show us your answer.

---

## Principles

### Evolve, don't just reskin

Destiny already has incredible art direction.

The interesting question is where it goes next.

### Ideas over tools

Traditional artist, designer, developer, filmmaker, musician, AI creator — everyone is welcome.

### Show, don't just tell

Whenever possible, visualize the idea.

### Explain the thinking

A good concept isn't only beautiful.

Tell us what problem you're solving or what experience you're trying to create.

### Keep the failures

The generation that only got one thing right still got one thing right. Annotate it and keep it.

### Remix ideas

One person's HUD concept might inspire another person's gameplay video.

Someone else's destination could inspire a raid concept.

Build on each other.

That's the point.

---

## How This Is Built

Everything runs on GitHub. No server, no database, no third-party hosting anywhere in the stack.

| Layer | What does it |
|---|---|
| **Submission inbox** | GitHub Issues — the [concept form](../../issues/new?template=submit-concept.yml) |
| **Database** | One folder per concept: `concepts/<slug>/concept.json` |
| **Media CDN** | GitHub user-attachments and [Releases](../../releases) |
| **Frontend** | Static HTML/CSS/JS in [`src/`](./src/), rendered to `_site/` at deploy |
| **Deploys** | GitHub Actions → GitHub Pages → [wearedestiny3.com](https://wearedestiny3.com) |

### Repository

```
WeAreDestiny3/
├── concepts/                one folder per concept — the database
│   ├── _example/            annotated reference (skipped by the build)
│   └── <slug>/concept.json
├── src/                     the site
│   ├── index.html           the board
│   ├── about/  contribute/  404.html
│   ├── assets/              site.css, board.js, concept.js
│   └── _templates/          head, topbar, footer, concept page
├── media/                   thumbnails, small images, branding
├── CNAME                    wearedestiny3.com
└── .github/
    ├── ISSUE_TEMPLATE/      the submission form
    ├── scripts/             build.mjs, validate.mjs, concepts.mjs
    └── workflows/           validate on PR, build and deploy on merge
```

Concept pages are rendered to real static HTML at deploy time, so every concept has its own URL, its own share preview, and works before any JavaScript runs. Contributors still only write JSON.

### Where media lives

Committed to the repo: thumbnails, small images, and site assets, under [`media/`](./media/).

Hosted by GitHub, referenced by URL: everything else. Drag a file into an Issue or pull request and GitHub gives it a permanent `user-attachments` link — images and GIFs up to 10 MB, video up to 10 MB on Free plans or 100 MB on paid, in MP4, MOV or WEBM. Anything larger goes on a [Release](../../releases), where a single asset can be 2 GB with no total size or bandwidth cap.

**No video files are ever committed.** Git LFS doesn't work with GitHub Pages, so it solves nothing here, and the published site is capped at 1 GB with a 100 GB/month soft bandwidth limit. The build rejects committed video outright.

### Running it locally

```sh
node .github/scripts/build.mjs
python3 -m http.server 8000 --directory _site
# http://localhost:8000
```

No dependencies — plain Node and any static server.

---

## Attribution

Creators should always be credited for their work.

If you build directly on another community concept, credit and link to the original creator.

Do not submit work you don't have the right to share.

By contributing media to this repository, you acknowledge that it may be displayed publicly as part of the WE ARE DESTINY 3 project.

You keep the rights to your own work. Full terms in [`LICENSE`](./LICENSE); how people treat each other here in [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).

---

## This Is a Fan Project

WE ARE DESTINY 3 is an unofficial community fan project.

It is not affiliated with, endorsed by, sponsored by, or associated with Bungie.

Destiny and related names, characters, imagery, and trademarks belong to their respective owners.

Community submissions represent concepts created by their individual contributors.

---

## One Question

**If the community got to design Destiny 3, what would we make?**

Let's find out.
