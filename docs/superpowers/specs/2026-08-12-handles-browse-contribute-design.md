# Handles, browse, and a form people can actually fill in

2026-08-12

Four pieces, each shippable on its own, built in this order: handles, the
contribute form, the browse page, the donate slot. Handles come first because
the form sits on top of them, and because comments will need them later.

## Why

Three things are wrong today.

**Anyone can post as anyone.** `creator` is a free-text field on the submission
form, prefilled from the signed-in account's Google display name, remembered in
`localStorage` rather than bound to the account. Two people can use the same
name, and nothing stops someone submitting as an existing contributor.

**Most of the board is unreachable.** The landing shows five concepts and three
questions. There is no index page. "View all concepts" points at `/contribute/`.
Past five concepts, the rest exist only at their direct URLs.

**The form asks for the data model.** The body section says "Add prose, a list
of claims, a flow, a timeline or a pull quote", which is the shape of
`concept.body` restated at the person filling it in. There is no preview, so the
only way to learn what a "flow" produces is to submit one.

## Handles

A handle is the only name this project has. There are no usernames, no display
names, and no real names anywhere in the product.

### Model

Two documents, both written only by the server:

```
handles/{lowercased}     { claimedAt }
publishers/{uid}.handle  "GuardianDesign"
```

`handles/*` deliberately holds no uid. It is publicly readable so the claim form
can check availability, and with no uid inside, a public read answers exactly
one question — is this taken — and nothing about who holds it.

Case is preserved for display and folded for uniqueness, so `@kai` and `@Kai`
cannot become two people.

Format is unchanged from the current field: `[A-Za-z0-9_-]{2,32}`.

Reserved, unclaimable: `admin`, `admins`, `mod`, `moderator`, `staff`,
`official`, `bungie`, `destiny`, `wearedestiny3`, `support`, `help`, `root`.

### Claiming

`POST /api/claim` with `{ handle }`, authenticated. In one transaction:

1. reject if `publishers/{uid}.handle` already exists — handles are permanent
2. reject if the lowercased form is reserved
3. reject if `handles/{lowercased}` exists
4. write both documents

Permanent is the whole point of the transaction being simple. There is no
release path, no reuse of a freed handle, and therefore no window where a
handle on an old concept points at a different person than it did last week.

A typo is permanent too. That is the accepted cost; an admin can fix one by
hand in the console, which is rare enough not to need a UI.

### Enforcement

`submitConcept` stops trusting the form:

- `creator` is deleted from the incoming payload before validation
- the server reads `publishers/{uid}.handle` and stamps it
- a submission from an account with no handle is rejected

This is the part that matters. Renaming the field or hiding it would leave
`creator` a client-supplied string; removing it from the payload is what makes
impersonation impossible rather than merely inconvenient.

### Seed handles

The six seeded creators are not owned by anyone. Without reservation, someone
could claim `@QuietSignal` and appear to have authored a concept already on the
board. The seeder writes `handles/*` for each seeded creator with no owning
uid, which reserves them without granting them to anybody.

### Form

The `Credit this to` input becomes a claim step, shown only when the signed-in
account has no handle, with availability checked live against
`handles/{lowercased}`. Once claimed it is replaced by a static
`Posting as @kai`. The `displayName` prefill and the `wad3:handle` localStorage
carry-over are both deleted.

## Contribute form

### Centered

`.field` is capped at 620px but left-aligned in a full-width page, which is why
the form reads as hanging off the left edge. The form column centers; the page
heading stays where it is.

### Sections, named for what they produce

The chooser stops naming blocks after the data model. Each option says what it
makes and shows an example:

| was | becomes |
| --- | --- |
| prose | **A section of writing** — a heading and some text |
| list | **Key points** — one per line, rendered as a checked list |
| flow | **How it works, in order** — rendered as the numbered step diagram |
| timeline | **A timeline** — dated or ordered events |
| quote | **A pull quote** — one line worth pulling out |
| — | **An image** — new, see below |

The block types stay. They are not formatting choices: `flow` is what becomes
the step diagram on the concept page, and `list` is what becomes the checked
column beside the takeaways card. The two-column concept layout only works
because submissions are structured. The confusion was the naming and the
absence of a preview, not the structure.

### Image sections

New body block:

```json
{ "type": "image", "media": "https://firebasestorage.../media/{uid}/...",
  "caption": "optional" }
```

Uploaded through the same Storage path the explorations use. `mediaBelongsTo`
is extended to walk body image blocks, so a body image gets the same ownership
check an exploration already gets. Without that extension, the block would be
the one place a submission could reference someone else's file.

### Live preview

The preview imports the real renderer from `shared/` rather than
reimplementing it. `render.mjs` is already pure — no filesystem, no Node
built-ins — because the static build and the server both render through it, so
the browser is a third caller rather than a special case.

`renderOverview(concept)` is extracted from `renderConceptPage` and exported.
The preview panel calls it on every change and drops the result into a
container styled by the same `home.css` the real page uses. A preview that
drifts from the page is worse than no preview, and sharing the renderer is what
stops that.

## Browse page

`/concepts/`, server-rendered from the same board data as the landing.

Every published concept in the landing's card grid with the lead-card variant
switched off, so both pages render through one `conceptCard` and cannot drift.

Above the grid: category chips, type chips, a sort control, and a search field.
All four operate client-side over the already-rendered set, so the page is
complete and crawlable without JavaScript and gains controls with it.

Deep links apply on load: `?q=`, `?filter=`, `?type=`, `?status=`.

Render-all is correct up to a few hundred concepts. Past that it needs paging,
which is worth designing against a real number rather than guessing at now.

The filter behaviour currently exists twice, in `home.js` and `board.js`, in
two different shapes. Both are replaced by one module the landing, the browse
page, and the question pages share.

## Donate

A footer slot linking to `https://paypal.me/colbymaloy2`.

The copy states what the money is for — hosting and media storage, not profit —
and sits directly above the existing disclaimer, so the unaffiliated-fan-project
framing and the ask are read together rather than in separate corners.

This is a fan project built on someone else's intellectual property. Asking for
money is a different posture than hosting one for free, and the copy should not
blur that. It says costs, it does not say support the creator, and it makes no
claim of endorsement.

## Bugs folded in

Four from the audit, all of which this work touches:

- `publish.js` fetches `/concepts/index.json`, which 404s. The citation picker
  and the "answering a question" dropdown fail silently into empty lists. The
  route is `/concepts.json`.
- `ssr` never passes `allConcepts` to `renderConceptPage`, so a creator's
  concept count is always 1.
- Nav `Demos` and `Directions` link to `/?filter=prototype` and
  `/?filter=direction`. Nothing reads `?filter` on the landing, and neither
  value is a category. They point at the browse page instead.
- The header search submits `?q=` to `/`, which ignores it. It points at the
  browse page.

## Routes and rules

New hosting rewrites: `/concepts` and `/api/claim`.

New Firestore rule: `handles/{handle}` public read, no client write.

## Not doing

- A questions index. Three questions do not need one; `View all questions`
  stays plain text until they do.
- Releasing or changing handles.
- Comments. Noted only because they are the reason handles are account-bound
  rather than a per-submission string.
- Paging the browse page.
