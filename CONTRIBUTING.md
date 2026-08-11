# Contributing

There are two ways in. Pick whichever one you'd actually do.

**[Submit a Concept](https://github.com/colbymaloy/WeAreDestiny3/issues/new?template=submit-concept.yml)** — fill out a form, drag your files in, done. No Git, no cloning, no JSON.

**[Open a pull request](#route-2--pull-request)** — if you're comfortable with GitHub and want your concept live the moment it's merged.

Neither route is more welcome than the other. The Issue form exists because most of the people who should be in this project are artists, not developers.

---

## One idea = one entry

This is the rule the whole project is built around.

**If you make five videos exploring the same combat scenario, that is one concept with five explorations — not five gallery cards.** The board shows ideas. The explorations live inside the concept as evidence.

That distinction matters most for generative work, where nothing comes out perfect. One generation has the best HUD, another has the best weapon effect, a third accidentally discovers something you weren't aiming for. As five separate posts that reads as noise. As one concept with the good seconds pulled out of each, it reads as design research — which is what it is.

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

### Explorations, not versions

`v1, v2, v3` implies each is better than the last. That isn't how this works — exploration 01 might hold the only usable HUD in the set while 04 holds the only usable lighting. Number them, but label each by **what it was testing**, and never treat the last one as the winner.

### Status, not quality

Every concept carries one of three states, so the board reads as things evolving rather than arriving finished:

| Status | Means |
|---|---|
| **Exploring** | Many directions open, nothing settled |
| **Direction** | A clear idea has emerged |
| **Refined** | A polished representation exists |

Starting at Exploring is normal. Most concepts never leave it.

---

## What belongs here

Anything that argues for what Destiny 3 should be.

Concept art. Gameplay concepts. UI and UX. Weapons. Armor. Guardians. Abilities and supers. Subclasses. Worlds and destinations. Enemies. Vehicles. Raids and activities. Social systems. Progression. Lore. Music and sound. Animation. 3D renders. Video. Interactive prototypes. Design documents. Sketches. Playable experiments.

Made in Photoshop, Blender, Unreal, Figma, a DAW, a text editor, a sketchbook, an AI model, or all of them at once.

**The standard is interesting direction, not how it was made.**

Two things that don't belong: work you don't have the right to share, and anything presented as real or leaked Destiny 3 material. This project is fiction, openly.

---

## Route 1 — the Issue form

1. Open **[Submit a Concept](https://github.com/colbymaloy/WeAreDestiny3/issues/new?template=submit-concept.yml)**.
2. Name the idea, pick categories, describe what you're proposing.
3. Drag your hero media in, then each exploration underneath it.
4. Note what to keep and what to drop per exploration. This is the most useful thing you can write.
5. Post it.

A maintainer turns the Issue into a concept folder and links it back to your submission, so the discussion stays attached to the work.

### What GitHub accepts as an attachment

| | Limit |
|---|---|
| Images and GIFs | 10 MB |
| Video — MP4, MOV, WEBM | 10 MB on Free, 100 MB on paid plans |

Larger than that? Post it anyway with a public link, or say so and it'll be uploaded to a [Release](https://github.com/colbymaloy/WeAreDestiny3/releases), where a single asset can be up to 2 GB.

---

## Route 2 — pull request

One folder per concept, so two people submitting on the same day never conflict:

```
concepts/your-concept-slug/
├── concept.json     the entry
└── notes.md         optional long-form writeup
```

1. Fork the repo.
2. Create `concepts/<your-slug>/concept.json`. Copy [`concepts/_example/concept.json`](concepts/_example/concept.json) — it's a complete annotated reference.
3. Commit thumbnails to `media/thumbnails/`. Keep them under about 400 KB.
4. Open a pull request.

Every field is documented in **[`concepts/README.md`](concepts/README.md)**.

Check it before you push:

```sh
node .github/scripts/validate.mjs     # field-by-field
node .github/scripts/build.mjs        # renders the whole site into _site/
```

Both run on your pull request, so a typo gets caught before it reaches the live site rather than after.

### Running the site locally

Static, no dependencies. Build it, then serve the output:

```sh
node .github/scripts/build.mjs
python3 -m http.server 8000 --directory _site
# http://localhost:8000
```

### Longer concept documents

Writing rather than making pictures? Put `notes.md` in your concept folder. The concept page links it automatically. A design document is a concept like any other.

---

## Media, and where it lives

The repository is the database. It is not the media server.

| What | Where it goes |
|---|---|
| Thumbnails, small images, site assets | Committed to `media/` |
| Normal submitted images and video | GitHub attachments, via your Issue or PR |
| Large or high-quality video, source files, project archives | GitHub Releases |

**Never commit video files.** GitHub Pages caps the published site at 1 GB with a 100 GB/month soft bandwidth limit, individual files over 100 MB are rejected outright, and Git LFS does not work with Pages at all — so LFS solves nothing here. Attachments and Releases do, and both are still fully GitHub-hosted. The build fails if an `.mp4`, `.mov` or `.webm` is committed.

Paths beginning with `/` resolve against the site root, so `/media/thumbnails/x.jpg` is the file at `media/thumbnails/x.jpg` in this repo.

---

## Credit

Credit is not optional here.

Every concept carries its creator's GitHub username, and every creator keeps the rights to their own work. If you build on someone else's concept — remix their HUD, animate their weapon, score their trailer — name them in `credits` and link them. Remixing is encouraged. Quietly absorbing someone's work is not.

Submitting means you're fine with the work being displayed publicly on wearedestiny3.com, with credit to you. It doesn't transfer anything else. See [`LICENSE`](LICENSE).

---

## Other things worth doing

Not everything has to be a concept:

- site and layout improvements
- accessibility fixes
- tooling — anything that shortens the path from Issue to published concept
- writing, editing, curation
- interactive experiments

Open a pull request or an [Issue](https://github.com/colbymaloy/WeAreDestiny3/issues/new/choose).

---

## Behaviour

Critique the work, not the person. Read [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

---

WE ARE DESTINY 3 is an unofficial fan project and is not affiliated with, endorsed by, or associated with Bungie.
