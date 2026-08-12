# concepts/

One folder per concept. One concept per idea.

```
concepts/
└── supers-as-combat-states/
    ├── concept.json     the entry — this is all the site needs
    └── notes.md         optional long-form writeup
```

The build reads every `concepts/*/concept.json` and renders a card on the board plus a page at
`wearedestiny3.com/concepts/<slug>/`. Folders starting with `_` are skipped —
[`_example/concept.json`](_example/concept.json) is a complete, annotated reference to copy.

**Why folders instead of one big JSON file:** so two people submitting on the same day never
conflict with each other.

---

## The two rules everything else follows

**A concept is an idea, not a medium.** A written design proposal, a piece of lore, a render, a
video, a diagram and a playable prototype are all the same kind of object here. Media is one way to
communicate an idea — never the idea itself. Written concepts get an editorial card, not a
placeholder thumbnail.

**Don't duplicate an idea to include it in yours — cite it.** Five videos exploring one scenario is
*one* concept with five explorations. Someone else's HUD that inspired yours is a `connection`, not
a copy. This is what keeps the board from becoming a feed.

---

## Fields

### Required

| Field | Notes |
|---|---|
| `slug` | Must match the folder name. Kebab-case |
| `title` | Name the idea, not the file. Under 80 characters |
| `creator` | GitHub username, no `@` |
| `type` | `vision` `design` `world` `lore` `visual` `prototype` — see below |
| `categories` | Array, 1–3 of: `gameplay` `worlds` `lore` `systems` `ui` `weapons` `abilities` `armor` `enemies` `social` `activities` `audio` `misc` |
| `status` | `exploring`, `direction`, or `refined` |
| `summary` | Two to four sentences. This is the card and the share preview |

### Optional

| Field | Notes |
|---|---|
| `body` | The actual argument. **Required for `vision`, `design` and `lore`** |
| `takeaways` | Up to 8 claims the concept makes |
| `connections` | Structured citations of other concepts |
| `question` | Slug of an open question this answers |
| `cover` | An exploration `id`, or `{ type, media, thumbnail }`. Omit for written concepts |
| `explorations` | Every attempt, including the ones that failed |
| `moments` | The seconds worth keeping, pulled from any exploration |
| `directions` | Groups explorations under competing approaches |
| `tools` `discussion` `source` `date` `credits` `featured` | |

### Type

Not a silo — a label, so a design proposal and an art exploration of the same subject don't pretend
to be the same kind of contribution.

| Type | For | Needs a body |
|---|---|---|
| `vision` | Broad high-level direction | yes |
| `design` | A mechanic, system or gameplay idea | yes |
| `lore` | Narrative and worldbuilding | yes |
| `world` | A destination or environment | no |
| `visual` | Art, UI or animation exploration | no |
| `prototype` | An interactive or playable experiment | no |

### Status

How settled the idea is — not how good it is.

| Status | Means |
|---|---|
| `exploring` | Many directions open, nothing settled |
| `direction` | A clear idea has emerged |
| `refined` | A polished representation exists |

Starting at `exploring` is normal. Most concepts never leave it, and that's fine.

---

## Body — the argument itself

An array of blocks, rendered in order. This is what makes a written concept read as design rather
than a caption.

```json
"body": [
  { "type": "prose", "heading": "The idea", "text": "First paragraph.\n\nSecond paragraph." },
  { "type": "flow", "heading": "The proposal", "steps": ["Normal state", "Super activation", "..."] },
  { "type": "list", "heading": "Why", "items": ["Creates more player expression", "..."] },
  { "type": "timeline", "heading": "Timeline", "steps": ["Destiny 2", "The Final Shape", "..."] },
  { "type": "quote", "text": "A Super should change what you can do, not just what you press." }
]
```

| Block | Field | Renders as |
|---|---|---|
| `prose` | `text` | Paragraphs. Blank line between them |
| `list` | `items` | A grid of claims |
| `flow` | `steps` | A sequence with arrows between steps |
| `timeline` | `steps` | A vertical rail, last entry highlighted |
| `quote` | `text` | One line, set very large |

`heading` is optional on every block.

---

## Connections — citing other concepts

Structured, not pasted URLs. Because it's structured, the **reverse** relationship is derived
automatically: cite someone and their page gains "Referenced by 7 concepts" without them doing
anything.

```json
"connections": [
  { "rel": "builds-on", "concept": "super-activation-exploration",
    "note": "The weapon transformation here is close to how I imagine entering the state." },
  { "rel": "pairs-with", "concept": "radial-ability-hud" },
  { "rel": "alternative-to", "concept": "one-shot-supers",
    "note": "Same problem, opposite answer." }
]
```

| `rel` | Means | Their page shows |
|---|---|---|
| `builds-on` | Extending the original idea | Built on by |
| `inspired-by` | Broad creative influence | Inspired |
| `references` | Using it as supporting material | Referenced by |
| `pairs-with` | Designed to work alongside it | Pairs with |
| `alternative-to` | Proposing another approach | Alternative proposed by |
| `challenges` | Intentionally arguing against it | Challenged by |

**Different concepts are allowed to disagree.** `alternative-to` and `challenges` exist so the board
doesn't have to pretend everything is one coherent game design.

### Citing seconds, not whole concepts

Point at one exploration, and optionally a time range inside it:

```json
{ "rel": "references", "concept": "super-activation-exploration",
  "exploration": "exploration-03", "t": [4, 8],
  "note": "Reference — Super entry transition" }
```

That renders an embedded clip playing only 0:04–0:08, captioned *from Super Activation Exploration
by @colbymaloy · Exploration 03*. **Attribution is generated, never typed** — you cannot cite
someone without crediting them.

No permission is needed to cite a published concept. Citing is not co-ownership.

---

## Explorations

Numbered but not ranked. `01` isn't worse than `04` — they were testing different things.

```json
{
  "id": "exploration-01",
  "focus": "HUD transition",
  "type": "video",
  "media": "https://github.com/user-attachments/assets/...",
  "thumbnail": "/media/thumbnails/supers-01.jpg",
  "keep": ["HUD collapse", "Initial flash"],
  "drop": ["The Super itself"],
  "tools": ["Veo"]
}
```

`id` and `focus` are required — `focus` says what the attempt was *testing*, which is what makes the
set readable as research. **`keep` and `drop` are the most valuable thing you can write.** They turn
four imperfect generations into design findings. The page renders them as ✓ and ✕.

## Directions

Optional. Use when a concept splits into competing approaches rather than one line of attempts. Give
each a kebab-case `id` and `title`, then set `"direction": "<id>"` on each exploration. Explorations
without one are grouped under "Unsorted".

## Selected moments

The seconds worth keeping, wherever they came from:

```json
"moments": [{ "label": "HUD collapse", "from": "exploration-01", "t": [2, 4] }]
```

`t` is `[start, end]` in seconds. Playback is clamped to that range, so nothing needs re-exporting.

---

## Media

Paths beginning with `/` resolve against the site root, so `/media/thumbnails/x.jpg` is a file at
`media/thumbnails/x.jpg` in this repository. Anything else must be a full URL.

**Never commit video files.** Use a GitHub attachment URL or a
[Release](https://github.com/colbymaloy/WeAreDestiny3/releases) asset. The build fails if an `.mp4`,
`.mov` or `.webm` is committed — Git LFS cannot serve GitHub Pages, so it solves nothing here.

Every video needs a `thumbnail`. Commit those to `media/thumbnails/`, under about 400 KB each.

---

## Check your work

```sh
node .github/scripts/validate.mjs     # field by field, with the exact problem
node .github/scripts/build.mjs        # renders the whole site into _site/
```

Both run automatically on every pull request. The rules live in
[`shared/model.mjs`](../shared/model.mjs), shared with the publish form so the two can't disagree.
