# Tag Team

```
    <div>   <span>   <a>   <img>   <ul>   <form>
       \      |       |      /       |      /
        \     |       |     /        |     /
         *................................*
         |   263 surfaces, one galaxy    |
         *................................*
        /     |       |     \        |     \
       <h1>  <button> <nav> <svg>  <table> <p>
```

Every `<tag>` in 263 hand-built HTML surfaces, tagging in — pulled from nine repositories over 31 days, dropped into a force-directed 3D constellation and photographed so you can recognize one before you open it.

**[Live](https://tag-team.vercel.app)**

## Two views, one toggle

- **3D** (`index.html`) — every surface is a thumbnail plaque in space, held in place by what it was for. Edges are real: a link one page makes to another, the taxonomy that classifies it, the repo it lives in, the week it was made, or a strong overlap in vocabulary. Drag to orbit, scroll to zoom, hover to light a neighborhood, click to pin and fly, search across every field.
- **Grid** (`grid.html`) — the same surfaces as a searchable, filterable card index grouped by purpose.

A segmented control in the top bar switches between them without losing your place.

## What this is not

This is a static export. The originals live in nine separate local repositories, some of them private working archives — there's nothing here that can reach them, so the cards are a showcase, not a live link-through. The interior project this was exported from (`tag-soup-kitchen`) still routes real click-through for local use.

## Regenerating

Built by `tag-soup-kitchen`'s atlas pipeline:

```sh
cd ../tag-soup-kitchen
node scripts/export-standalone.mjs --out ../tag-team --root ~/Projects --days 31
```

That rescans the source tree, rebuilds the 3D layout deterministically (same seed, same shape every time), and copies only the thumbnails the current surface set references. It needs `tag-soup-kitchen/atlas/thumbs` already populated — `npm run atlas` there captures them.

## Stack

Vanilla HTML/CSS/JS, three.js r169 vendored under `atlas/vendor/` (no CDN, no build step). Deploys as a static site.

```sh
npm run serve   # python3 -m http.server 4300
```

## Map of the repo

| Path | What's there |
| --- | --- |
| `index.html` | The 3D force-directed graph view |
| `grid.html` | The searchable, filterable card grid |
| `atlas/app.js` | Graph layout, camera controls, search, and view-toggle logic |
| `atlas/vendor/` | Vendored three.js and OrbitControls, no CDN dependency |
| `atlas/thumbs/` | The 263 surface thumbnails referenced by both views |
