# Poster Customizer

A browser-based poster editor for the Hoss Hangmen. Load a template, customize the text (date, venue, details), and export a print-ready PNG.

Built with [Fabric.js](http://fabricjs.com/) — no server required. Everything runs client-side.

## Features

- Template-based editing with background images and pre-positioned text placeholders
- Add, move, resize, and style text boxes (font family, size, color)
- Undo/redo with keyboard shortcuts (Ctrl+Z / Ctrl+Y)
- Auto-save to localStorage so work persists across page reloads
- Export as high-resolution PNG (≥150 DPI at physical print size)
- Responsive canvas that adapts to the browser window
- Custom bundled fonts (The Serif Hand family)

## Usage

1. Open `index.html` in a browser (or serve the project with any static file server).
2. Select a template from the toolbar.
3. Click the placeholder text fields to edit event date, venue name, and additional details.
4. Use **+ Text** to add new text boxes anywhere on the poster.
5. Adjust font size, typeface, and color from the toolbar.
6. Click **Export** to download the poster as a PNG.

## Running Locally

### Prerequisites

- A modern web browser (Chrome, Firefox, Edge, Safari)
- [Node.js](https://nodejs.org/) (v18+) — only needed if you want to run tests

### Quick Start (no build step)

The app is plain HTML/JS with no bundler. You can open `index.html` directly, but most browsers block `fetch()` from `file://` URLs. Use any local static server instead:

```bash
# Option A: Python (built-in)
python -m http.server 8000

# Option B: Node one-liner
npx serve .

# Option C: VS Code Live Server extension
# Right-click index.html → "Open with Live Server"
```

Then visit `http://localhost:8000` (or whichever port your server reports).

### Running Tests

```bash
npm install
npm test
```

Tests use [Vitest](https://vitest.dev/) with jsdom for DOM simulation.

## Project Structure

```
├── index.html              # Entry point
├── styles.css              # App styles
├── editor.js               # Main orchestrator (canvas init, event wiring)
├── toolbar.js              # Toolbar UI and controls
├── templateManager.js      # Template loading and rendering
├── exportManager.js        # PNG export logic
├── historyManager.js       # Undo/redo state stack
├── persistenceManager.js   # localStorage auto-save/restore
├── responsiveManager.js    # Canvas responsive scaling
├── notifications.js        # Toast and modal notifications
├── fonts/                  # Bundled custom fonts
├── templates/              # Template assets and configs
│   ├── index.json          # Template registry
│   └── hoss-dark/          # "Hoss Hangmen - Dark" template
└── package.json            # Dev dependencies (test runner only)
```

## Adding a Template

1. Create a new folder under `templates/` (e.g. `templates/my-template/`).
2. Add a `template.json` with dimensions, background reference, placeholder definitions, and font declarations (see `templates/hoss-dark/template.json` for the schema).
3. Add the background image and a thumbnail image to the folder.
4. Register it in `templates/index.json`.

## License

Private project.
