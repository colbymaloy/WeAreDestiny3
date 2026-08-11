# media/

Small, committed assets only. This folder is not the media server.

| Folder | What goes in it | Keep it under |
|---|---|---|
| `thumbnails/` | Cover and exploration posters | ~400 KB each |
| `images/` | Images the site or a concept needs served from the repo | ~2 MB each |
| `branding/` | Project marks, the social share card, anything reused across the site | — |

## What does not go here

**No video. Ever.** Not MP4, not MOV, not WEBM. The build fails if one shows up.

Git LFS does not work with GitHub Pages, so it solves nothing. The published site is capped at 1 GB
with a 100 GB/month soft bandwidth limit, and GitHub rejects individual files over 100 MB regardless.

Use GitHub's own hosting instead — both options stay entirely inside GitHub:

**Attachments.** Drag the file into an Issue or pull request comment. GitHub uploads it and gives you
a permanent `https://github.com/user-attachments/assets/...` URL. Images and GIFs up to 10 MB, video
up to 10 MB on Free or 100 MB on paid plans, in MP4, MOV or WEBM.

**Releases.** For large or high-quality media and source archives. A single release asset can be up to
2 GB, a release can hold 1,000 assets, and there is no total size or bandwidth cap on them.

Then point the concept at the resulting URL, keeping only the poster in the repo:

```json
"media": "https://github.com/user-attachments/assets/00000000-0000-0000-0000-000000000000",
"thumbnail": "/media/thumbnails/super-activation-01.jpg"
```

## Naming

Match the concept slug and exploration number, so a file and its entry are obviously the same thing:

```
concepts/super-activation-redesign/  →  media/thumbnails/super-activation-redesign-01.jpg
                                        media/thumbnails/super-activation-redesign-02.jpg
```

## branding/social-card.png

The default Open Graph image — what appears when wearedestiny3.com is shared anywhere. 1200×630.
Concept pages override it with their own cover, so this one only covers the homepage, about and
contribute. Until it exists, those links preview as plain text.
