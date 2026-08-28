# Meatball

A tangled 3D map of 260 hand-built HTML surfaces — every exploration, widget
and one-off pulled from nine repositories over 31 days, dropped into a
force-directed constellation and photographed so you can recognise one
before you open it.

**[Live](https://meatball.vercel.app)** — a knowledge graph diagram like this
is sometimes called a "meatball diagram": one tangled ball where everything
touches everything. This one is made of tag soup, so the name stuck.

## Two views, one toggle

- **3D** (`index.html`) — every surface is a thumbnail plaque in space, held
  in place by what it was for. Edges are real: a link one page makes to
  another, the taxonomy that classifies it, the repo it lives in, the week
  it was made, or a strong overlap in vocabulary. Drag to orbit, scroll to
  zoom, hover to light a neighbourhood, click to pin and fly, search across
  every field.
- **Grid** (`grid.html`) — the same 260 surfaces as a searchable, filterable
  card index grouped by purpose.

The segmented control in the top bar switches between them without losing
your place.

## What this is not

This is a static export. The originals live in nine separate local
repositories, some of them private working archives — there is nothing here
that can reach them, so cards are a showcase, not a link. The interior
project this was exported from (`tag-soup-kitchen`) still routes real
click-through for local use.

## Regenerating

Built by `tag-soup-kitchen`'s atlas pipeline:

```
cd ../tag-soup-kitchen
node scripts/export-standalone.mjs --out ../meatball --root ~/Projects --days 31
```

That rescans the source tree, rebuilds the 3D layout (deterministic — same
seed, same shape every time), and copies only the thumbnails the current
surface set references. It needs `tag-soup-kitchen/atlas/thumbs` already
populated (`npm run atlas` there captures them).

## Stack

Vanilla HTML/CSS/JS, three.js r169 vendored (`atlas/vendor/`, no CDN, no
build step). Deploys as a static site.
