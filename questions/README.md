# questions/

Open questions — somewhere for an idea to live before it's developed enough to be a concept.

```
questions/
└── what-should-supers-become/
    └── question.json
```

Each one gets a page at `wearedestiny3.com/questions/<slug>/` listing every concept that answers it.
Folders starting with `_` are skipped by the build.

## The lifecycle

```
QUESTION      "What should Supers become?"
     ↓
CONCEPTS      design proposals · lore · renders · prototypes
     ↓
DIRECTIONS    the ones other people start building on
```

A question with no answers is not a failure state — it's the invitation. The board shows unanswered
questions alongside answered ones for exactly that reason.

## Fields

```json
{
  "slug": "what-should-supers-become",
  "question": "What should Supers become?",
  "categories": ["abilities", "gameplay"],
  "context": "Supers have been a single oversized ability since 2014.\n\nWhat is the next shape?",
  "discussion": "https://github.com/colbymaloy/WeAreDestiny3/discussions/1"
}
```

| Field | Required | Notes |
|---|---|---|
| `slug` | yes | Must match the folder name. Kebab-case |
| `question` | yes | The question itself. Must end with a question mark |
| `categories` | yes | Array, from the same list concepts use |
| `context` | no | A few sentences on why it's worth asking. Blank line between paragraphs |
| `discussion` | no | A GitHub Discussion where people argue about it in prose |

## Answering one

A concept points at a question with a single field:

```json
"question": "what-should-supers-become"
```

That's it — the question page picks it up, and the concept page shows what it's answering. The build
fails if the slug doesn't exist, so a question can't be silently orphaned by a rename.

**Answers do not have to agree.** Two concepts can propose opposite things and both belong. Use
`alternative-to` or `challenges` connections to say so explicitly.
