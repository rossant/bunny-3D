# bunny-3D

Prototype browser game **Petit Lapin 3D** built with Babylon.js.

## Current gameplay

- 10x10 logical grid in a stylized 3D forest
- animated rabbit and boss models
- water attacks, boss fireballs, traps, mystery crates, coins and cosmetic shop
- 100 levels with progressive difficulty
- mobile and desktop controls
- local persistent save

## Persistence

Progress is stored in `localStorage` under `petit-lapin-3d-save-v3`, with migration from earlier v1/v2 save keys. Coins are credited to the permanent bank immediately when collected, so dying no longer removes them.

Browser storage is scoped to the site origin. To preserve the same save across future releases, deploy future versions to the **same stable URL/domain** rather than a new temporary hostname each time.

## Run locally

Serve the repository over HTTP, for example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

Babylon.js and the model loader are currently loaded from the Babylon CDN; the character GLB assets are loaded from a public CC0 source.

## License / assets

Game code: project repository license policy TBD.

Character models used by the prototype come from Quaternius CC0 asset packs.
