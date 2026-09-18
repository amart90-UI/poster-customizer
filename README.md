# Poster

A focused, static web app for turning an image into a finished poster with
precisely controlled typography. Choose an image, add text, style it, position
it, and export a high-quality file suitable for printing. No backend, no
account, no server-side processing.

## Live use

The app runs entirely in the browser. Your projects autosave to the browser's
IndexedDB storage and never leave your device.

The intended workflow:

**Choose image → add text → style text → position text → export.**

## Features

- Built-in poster templates: a shared background plus swappable figure and
  logo layers, composited under your text (and rendered at full resolution on
  export). Figures and logos are linked by default but can be mixed or turned
  off independently.
- Upload a background image that automatically fits the poster (fill or fit).
- Adjust the background directly on the poster: toggle "Adjust background on
  poster", then drag to reposition and scroll to zoom toward the cursor. The
  image always stays clamped so it fully covers the frame.
- Add, edit, drag, resize, rotate, and delete text objects.
- Snapping with alignment guides for center and margins; hold **Shift** to
  disable snapping for free positioning.
- Keyboard nudging with arrow keys (**Shift** for larger steps).
- Reliable undo/redo (**Ctrl/Cmd+Z**, **Ctrl/Cmd+Shift+Z**).
- Typography controls: font (Google Fonts), weight, size, line height, letter
  spacing, alignment, color, italic, uppercase.
- Optional effects: drop shadow, outline, and text background panel.
- Explicit layout commands (Center H/V, Fit width) — nothing moves on its own.
- Poster size presets (8×10, 11×14, 12×18, 18×24), original image size, and
  custom dimensions.
- High-quality PNG/JPEG export rendered from the **original** image at full
  resolution, with a warning when the source image is too low-resolution for
  the chosen print size.
- Projects: create, open, duplicate, import, and export. Project files preserve
  editable text and layout (not just a flattened image).

## Keyboard shortcuts

| Action | Shortcut |
| --- | --- |
| Undo | Ctrl/Cmd + Z |
| Redo | Ctrl/Cmd + Shift + Z, or Ctrl + Y |
| Duplicate selection | Ctrl/Cmd + D |
| Delete selection | Delete / Backspace |
| Nudge | Arrow keys (Shift = 20px) |
| Deselect | Escape |
| Free-move (no snap) | Hold Shift while dragging |

## Tech stack

- **React + TypeScript + Vite** — static build, deployable to GitHub Pages.
- **Zustand** — editor state with a snapshot-based undo/redo history.
- No backend or external services beyond Google Fonts stylesheets.

## Architecture

Everything geometric is stored in **document pixels**: the poster's pixel size
at its export DPI (`widthInches * dpi` by `heightInches * dpi`). Text positions,
sizes, and the background transform all live in this space, so they are
independent of the on-screen zoom. The editor renders the document scaled to
fit the viewport; export renders at 1:1 document pixels, so the preview and the
exported file match.

Key modules:

- `src/types.ts` — the data model (`Project`, `TextObject`, `PosterImage`).
- `src/model/poster.ts` — size presets, image-fit transforms, factory defaults.
- `src/store/store.ts` — Zustand store with undo/redo (gesture coalescing).
- `src/store/idb.ts` — tiny promise-based IndexedDB wrapper.
- `src/store/persistence.ts` — IndexedDB autosave + project import/export.
- `src/render/textLayout.ts` — shared text wrapping/measurement (used by both
  the preview and the exporter, so they agree on layout).
- `src/render/drawPoster.ts` — canvas renderer used for export.
- `src/render/snapping.ts` — snapping + alignment guides.
- `src/render/export.ts` — full-resolution render + resolution check.
- `src/fonts/registry.ts` — the font list and on-demand Google Fonts loading.
- `src/templates/registry.ts` — poster templates and their layer assets.
- `src/components/*` — the UI (stage, panels, dialogs).

## Adding or changing fonts

Fonts are defined in one place. Edit the `FONTS` array in
`src/fonts/registry.ts`:

```ts
export const FONTS: FontDef[] = [
  { family: "Inter", weights: [400, 500, 700, 900], italic: true, category: "sans" },
  // Add a Google Font here:
  { family: "Rubik", weights: [400, 500, 700], italic: true, category: "sans" },
];
```

Use the exact Google Fonts family name. The app requests only the weights you
list, loads each font on demand, and waits for fonts to finish loading before
exporting.

## Adding or changing templates

Templates live in `src/templates/registry.ts`. A template references a shared
background plus layer options (figures, logo). To add a template:

1. Drop the layer SVGs (or PNGs) into `src/assets/templates/<your-template>/`.
   Author every layer on the **same artboard** (same width/height) so the
   layers line up when stacked; layers are drawn aspect-preserved and centered.
2. Import the assets with Vite's `?url` suffix and add a `PosterTemplate` entry
   to `TEMPLATES`, describing the background, the figure/logo options, and the
   `figureToLogo` / `logoToFigure` link maps used for the "linked by default"
   behavior.

The renderer and UI pick up new templates automatically.

## Development

```bash
npm install
npm run dev      # start the dev server
npm run build    # type-check and produce the static build in dist/
npm run preview  # preview the production build locally
```

## Deployment (GitHub Pages)

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the site
and publishes it to GitHub Pages. The workflow sets Vite's `base` to
`/<repo-name>/` automatically so asset paths resolve correctly under the Pages
subpath.

To enable it once: in the repository settings, set **Pages → Build and
deployment → Source** to **GitHub Actions**.
