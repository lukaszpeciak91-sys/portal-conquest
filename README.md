# Portal Conquest

Task 1 bootstrap for a GitHub Pages-ready Phaser prototype.

## Scripts

- `npm run dev` — local dev server.
- `npm run build` — production build into `dist/`.
- `npm run preview` — preview production build locally.

## GitHub Pages notes

This project uses Vite with a relative base path (`base: './'`) in `vite.config.js` so built asset links work under GitHub Pages project URLs.

Typical Pages setup:

1. Run `npm install`.
2. Run `npm run build`.
3. Publish the `dist/` folder (for example with GitHub Actions Pages deploy or `gh-pages`).

## Current scope

- Full-screen responsive Phaser canvas.
- Mobile-first orientation (1080 x 1920 target, `Phaser.Scale.FIT` + recenter on resize).
- Blank boot scene placeholder only (no gameplay yet).
