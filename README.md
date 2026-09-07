# Petit Lapin 3D

A child-friendly 3D browser adventure. Guide the rabbit through an authored campaign, avoid marked traps, collect coins, and defeat each boss with water magic.

## What is included

- 24 named levels across six visual themes
- Progressive boss patterns, telegraphed attacks, optional risky crates, cosmetics, sound, pause, keyboard and touch controls
- Persistent local progress and coins, with migration from the original save format
- Local Babylon.js runtime and CC0 character models: play works without third-party game assets at runtime
- A Vite production build and a single maintained game entry point

## Development

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open the URL printed by Vite. Build the deployable site with:

```bash
npm run build
npm run preview
```

The built site is written to `dist/` and can be hosted as a static site.

## Project layout

- `src/main.js` — game runtime, scene, combat, UI and effects
- `src/levels.js` — authored campaign data
- `public/models/` — locally shipped CC0 character GLB files
- `index.html` and `style.css` — interface and responsive styling

## Credits and licensing

The rabbit and goblin models are from Quaternius CC0 asset packs. Confirm the project code licence before publishing publicly.
