# concepts/

One folder per concept. One concept per idea.

```
concepts/
└── super-activation-redesign/
    ├── concept.json     the entry — this is all the site needs
    └── notes.md         optional long-form writeup
```

The build reads every `concepts/*/concept.json` and renders a card on the board plus a page at
`wearedestiny3.com/concepts/<slug>/`. Folders starting with `_` are skipped —
[`_example/concept.json`](_example/concept.json) is a complete, annotated reference you can copy.

**Why folders instead of one big JSON file:** so two people submitting on the same day never
conflict with each other.

---

## The rule this is all built around

**One idea = one entry. Generations are evidence underneath the idea.**

Five videos exploring the same combat scenario is *one* concept with five explorations — not five
cards. The board shows ideas. The explorations live inside the concept page, annotated for what
worked and what didn't.

---

## Fields

### Required

| Field | Notes |
|---|---|
| `slug` | Must match the folder name. Kebab-case |
| `title` | Name the idea, not the file. Under 80 characters |
| `creator` | GitHub username, no `@` |
| `categories` | Array, 1–3 of: `worlds` `ui` `gameplay` `weapons` `armor` `abilities` `subclasses` `enemies` `social` `misc` |
| `status` | `exploring`, `direction`, or `refined` — see below |
| `summary` | Two to four sentences. What you're proposing and why |
| `cover` | An exploration `id` to reuse, or `{ "type", "media", "thumbnail" }` |

### Optional

| Field | Notes |
|---|---|
| `takeaways` | Array of claims the concept is making. Up to 8. This is what makes it read as design |
| `moments` | The seconds worth keeping, pulled from any exploration |
| `directions` | Groups explorations under competing approaches |
| `explorations` | Every attempt, including the ones that failed |
| `tools` | Array of strings |
| `discussion` | The submission Issue or Discussion URL |
| `source` | Source files, a Release asset, or a repo folder |
| `date` | `YYYY-MM-DD`. Controls board ordering — newest first |
| `credits` | Anyone whose work this builds on |

### Status

How settled the idea is — not how good it is.

| Status | Means |
|---|---|
| `exploring` | Many directions open, nothing settled |
| `direction` | A clear idea has emerged |
| `refined` | A polished representation exists |

Starting at `exploring` is normal. Most concepts never leave it, and that's fine.

---

## Explorations

Numbered but not ranked. `01` isn't worse than `04` — they were testing different things.

```json
{
  "id": "exploration-01",
  "focus": "HUD transition",
  "direction": "energy-manifestation",
  "type": "video",
  "media": "https://github.com/user-attachments/assets/...",
  "thumbnail": "/media/thumbnails/super-activation-01.jpg",
  "keep": ["HUD collapse", "Initial flash"],
  "drop": ["The Super itself"],
  "tools": ["Veo"],
  "process": "Prompted for a first-person activation with the HUD reacting before the effect fires."
}
```

`id` and `focus` are required. `focus` says what the attempt was *testing*, which is what makes the
set readable as research.

**`keep` and `drop` are the most valuable thing you can write.** They turn four imperfect generations
into design findings instead of clutter. The page renders them as ✓ and ✕.

## Directions

Optional. Use when a concept splits into competing approaches rather than one line of attempts.

```json
"directions": [
  { "id": "energy-manifestation", "title": "Direction A — Energy Manifestation",
    "note": "The Light arrives from outside the Guardian." },
  { "id": "weapon-overcharge", "title": "Direction B — Weapon Overcharge",
    "note": "The Super grows out of the equipped weapon." }
]
```

Then set `"direction": "energy-manifestation"` on each exploration. Explorations without one are
grouped under "Unsorted".

## Selected moments

The best part of the format, and the reason imperfect work is worth posting.

Instead of "here are five mediocre generations", clip out the two seconds from each that matter.
A moment usually points at an exploration and a time range rather than being a separate upload:

```json
"moments": [
  { "label": "HUD collapse",  "from": "exploration-01", "t": [2, 4] },
  { "label": "Weapon dissolve", "from": "exploration-02", "t": [1.5, 4.5] }
]
```

`t` is `[start, end]` in seconds. Playback is clamped to that range, so nothing needs re-exporting.

A moment can also stand alone with its own `type`, `media` and `thumbnail`.

---

## Media

Paths beginning with `/` resolve against the site root, so `/media/thumbnails/x.jpg` is a file at
`media/thumbnails/x.jpg` in this repository. Anything else must be a full URL.

**Never commit video files.** Drag them into your submission Issue and use the resulting
`https://github.com/user-attachments/assets/...` URL, or attach large files to a
[Release](https://github.com/colbymaloy/WeAreDestiny3/releases). The build fails if an `.mp4`,
`.mov` or `.webm` is committed — Git LFS cannot serve GitHub Pages, so it solves nothing here.

Every video needs a `thumbnail`. Commit those to `media/thumbnails/`, under about 400 KB each.

---

## Check your work

```sh
node .github/scripts/validate.mjs     # field-by-field, with line-level messages
node .github/scripts/build.mjs        # renders the whole site into _site/
```

Both run automatically on every pull request.
