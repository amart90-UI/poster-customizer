# Implementation Plan: Poster Customizer

## Overview

A static website using Fabric.js on an HTML5 canvas that allows users to customize event posters for the Hoss Hangmen band. The implementation is vanilla HTML/CSS/JavaScript with no build step, served directly as static assets on GitHub Pages. The plan follows an incremental approach: project structure and core modules first, then interactive features, and finally integration/wiring.

## Tasks

- [x] 1. Set up project structure and core files
  - [x] 1.1 Create directory structure, HTML entry point, and CSS
    - Create `index.html` with Fabric.js CDN link (v6.x), viewport meta tag, canvas element, toolbar container, and script tags for all modules
    - Create `styles.css` with responsive layout rules (768px breakpoint), toolbar styling, canvas container, toast notifications, and modal overlay styles
    - Create `templates/` directory structure with `index.json` listing available templates
    - Create `fonts/` directory with `fonts.json` configuration file
    - _Requirements: 6.1, 6.2, 6.4, 8.3, 8.4_

  - [x] 1.2 Create template JSON configuration and placeholder assets
    - Create `templates/hoss-dark/template.json` with full template config (dimensions 1100×1700px, 11×17in physical, placeholders for event-date, venue-name, event-details with positions, fonts, colors, alignment)
    - Create `templates/index.json` listing available templates with name and thumbnail path
    - Add placeholder background PNG (can be replaced later with actual exported artwork)
    - _Requirements: 7.1, 7.3, 7.4, 7.5, 12.4_

  - [x] 1.3 Set up font loading with @font-face declarations
    - Add `@font-face` rules in CSS for "The Serif Hand Black" and "The Serif Hand Extrablack" referencing WOFF2 files in `fonts/` directory
    - Create `fonts/fonts.json` listing available typefaces with family name, file path, and weight
    - Ensure fonts load from static files with no external dependencies
    - _Requirements: 10.3, 10.5, 10.6_

- [x] 2. Implement Template Manager and canvas initialization
  - [x] 2.1 Implement Template Manager module
    - Create `templateManager.js` with functions: `loadTemplateList()` (fetches `templates/index.json`), `loadTemplate(templateName, canvas)` (fetches template config, sets background image, creates Fabric.js Textbox objects for each placeholder with correct position/style/alignment), `getTemplateConfig()`, `renderTemplateThumbnails(container)`
    - Handle template load errors: display error overlay if background or JSON fails to load, do not render partial canvas
    - Store `currentTemplate` name for reference
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 7.4, 7.5, 12.1, 12.4_

  - [x] 2.2 Implement Editor module (main orchestrator)
    - Create `editor.js` that initializes Fabric.js canvas, Template Manager, and coordinates all sub-modules
    - Set up canvas event listeners: `object:modified`, `selection:created`, `selection:updated`, `selection:cleared`
    - On init: attempt to restore from localStorage (Persistence Manager), else load default/last-used template
    - Configure Fabric.js canvas options: selection color, corner style, border color for visual distinction of editable elements
    - _Requirements: 1.1, 1.3, 9.2_

  - [x] 2.3 Write property test for corrupted state handling (Property 2)
    - **Property 2: Corrupted State Graceful Handling**
    - Test that for any arbitrary string in localStorage (malformed JSON, truncated, empty, random bytes), the editor loads the default template without throwing uncaught exceptions
    - **Validates: Requirements 9.3**

- [x] 3. Implement text editing and element interaction
  - [x] 3.1 Implement text editing behavior
    - Configure Fabric.js Textbox objects to enable inline editing on double-click (Fabric.js built-in `enterEditing()`)
    - Implement 200-character limit enforcement: listen to `changed` event on text objects, truncate if exceeding limit
    - Implement Escape key handler: store pre-edit text on `editing:entered`, restore on Escape key press during editing
    - Implement click-outside to exit editing: use canvas `mouse:down` event to call `exitEditing()` on active object when clicking elsewhere
    - Implement "Add Text" functionality: create new Textbox at canvas center with "New Text", font family matching template placeholders, 16px font size
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 3.2 Implement element positioning with drag constraints
    - Enable Fabric.js object dragging (built-in with `selectable: true`)
    - Implement canvas boundary constraints: use `object:moving` event to clamp element position so bounding box stays within canvas (0, 0, canvasWidth, canvasHeight)
    - Fabric.js handles drag initiation thresholds natively
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 3.3 Implement element resizing with constraints
    - Configure Fabric.js corner controls for resize handles at four corners
    - Implement aspect ratio lock: set `lockUniRotation: true` and use `object:scaling` event to enforce uniform scaling
    - Implement minimum size constraint (10×10px): check scaled dimensions in `object:scaling`, revert if below minimum
    - Implement maximum size constraint: prevent resizing beyond canvas boundaries
    - _Requirements: 4.1, 4.2, 4.3, 4.5_

  - [x] 3.4 Write property test for element bounds constraint (Property 6)
    - **Property 6: Element Bounds Constraint**
    - Test that for any element with any width/height positioned at any coordinates, the bounding box is fully within canvas boundaries
    - **Validates: Requirements 3.4**

  - [x] 3.5 Write property test for resize dimension constraints (Property 7)
    - **Property 7: Resize Dimension Constraints**
    - Test that for any element and any resize delta, resulting dimensions satisfy: width ≥ 10px, height ≥ 10px, within canvas, aspect ratio preserved
    - **Validates: Requirements 4.2, 4.4, 4.5**

  - [x] 3.6 Write property test for text content length constraint (Property 12)
    - **Property 12: Text Content Length Constraint**
    - Test that for any string input, stored text never exceeds 200 characters
    - **Validates: Requirements 2.2**

  - [x] 3.7 Write property test for escape reverts text (Property 13)
    - **Property 13: Escape Reverts Text Content**
    - Test that for any initial text and any modifications, pressing Escape restores the original content
    - **Validates: Requirements 2.4**

- [x] 4. Checkpoint - Core editing functionality
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement History Manager (Undo/Redo)
  - [x] 5.1 Implement History Manager module
    - Create `historyManager.js` with undo/redo stack arrays, `maxHistory: 50`, and `isRestoring` flag
    - Implement `saveState(canvas)`: serialize canvas via `canvas.toJSON(['placeholderId'])`, push to undo stack, clear redo stack, trim undo stack to 50 entries
    - Implement `undo(canvas)`: pop from undo stack, push current state to redo, restore canvas via `canvas.loadFromJSON()`
    - Implement `redo(canvas)`: pop from redo stack, push current state to undo, restore canvas
    - Implement `canUndo()` and `canRedo()` boolean checks
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

  - [x] 5.2 Wire History Manager into Editor
    - Call `history.saveState()` on `object:modified`, `text:changed` (on exit editing), add-text, and style changes
    - Set `isRestoring` flag during undo/redo to prevent recursive state saves
    - Add keyboard shortcuts: Ctrl+Z / Cmd+Z for undo, Ctrl+Y / Cmd+Shift+Z for redo
    - _Requirements: 11.1, 11.2, 11.3_

  - [x] 5.3 Write property test for undo/redo round-trip (Property 3)
    - **Property 3: Undo/Redo Round-Trip**
    - Test that for any state S and edit action A, `redo(undo(apply(S, A))) ≡ apply(S, A)`
    - **Validates: Requirements 11.1, 11.2, 11.3**

  - [x] 5.4 Write property test for new edit clears redo (Property 4)
    - **Property 4: New Edit After Undo Clears Redo Stack**
    - Test that performing a new edit after undo operations results in empty redo stack
    - **Validates: Requirements 11.4**

  - [x] 5.5 Write property test for undo stack capacity (Property 5)
    - **Property 5: Undo Stack Capacity**
    - Test that for N > 50 actions, undo stack contains exactly 50 entries
    - **Validates: Requirements 11.5**

- [x] 6. Implement Persistence Manager
  - [x] 6.1 Implement Persistence Manager module
    - Create `persistenceManager.js` with debounced save (2-second delay after last modification)
    - Implement `save(canvas)`: serialize canvas state to localStorage under `poster-customizer-state` key
    - Implement `restore(canvas)`: parse stored JSON, validate structure, load via `canvas.loadFromJSON()`, return success boolean
    - Implement `hasSavedState()`: check if localStorage key exists and contains parseable JSON
    - Implement `clear()`: remove state and template keys from localStorage
    - Implement `getLastTemplate()` / `setLastTemplate()` for template name tracking
    - Handle corrupted state: wrap JSON.parse in try/catch, discard invalid state, show info toast
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 6.2 Wire Persistence Manager into Editor
    - Call `persistence.scheduleSave()` on every `object:modified`, text edit exit, style change, and element addition
    - On init: check `persistence.hasSavedState()`, if true call `persistence.restore()`, else load template
    - _Requirements: 9.1, 9.2_

  - [x] 6.3 Write property test for state persistence round-trip (Property 1)
    - **Property 1: State Persistence Round-Trip**
    - Test that serializing any valid canvas state and restoring produces equivalent object properties
    - **Validates: Requirements 9.2**

- [x] 7. Implement Toolbar and font customization
  - [x] 7.1 Implement Toolbar module
    - Create `toolbar.js` with initialization of all controls: font size input (8-200pt, 1pt increments), font family dropdown, color picker (hex input + native color input), undo/redo buttons, export button, add-text button, reset button, template selector
    - Implement `updateForSelection(activeObject)`: show/hide font controls based on whether selection is a text element
    - Implement `updateUndoRedoState(canUndo, canRedo)`: enable/disable undo/redo buttons with visual distinction
    - Wire toolbar controls to Editor: font size changes apply immediately to selected text, color changes apply to `fill` property, font family changes apply to `fontFamily` property
    - _Requirements: 4.4, 10.1, 10.2, 10.3, 10.4, 11.6, 11.7_

  - [x] 7.2 Implement font color and typeface application
    - On color picker change: apply chosen color to selected Textbox's `fill` property, re-render canvas
    - On font family change: apply chosen typeface to selected Textbox's `fontFamily` property, re-render canvas
    - Populate typeface selector from `fonts/fonts.json` dynamically (supports future additions without code changes)
    - Implement font load failure fallback: if a font file fails to load, use browser default serif and display warning toast
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.6, 10.7_

  - [x] 7.3 Write property test for text element styling application (Property 11)
    - **Property 11: Text Element Styling Application**
    - Test that for any valid hex color or font family, applying the style immediately updates the element's property
    - **Validates: Requirements 10.2, 10.4**

- [x] 8. Implement Export Manager
  - [x] 8.1 Implement Export Manager module
    - Create `exportManager.js` with `exportAsPNG(canvas, templateConfig)`: calculate DPI multiplier from physical dimensions, call `canvas.toDataURL({ format: 'png', multiplier })`, trigger download
    - Implement `calculateMultiplier(canvas, templateConfig)`: compute multiplier so that `canvasWidth * multiplier / physicalWidth >= 150` DPI
    - Implement `generateFilename()`: return `poster-YYYY-MM-DD.png` using current date
    - Implement `triggerDownload(dataURL, filename)`: create temporary anchor element with download attribute
    - Wrap export in try/catch: on failure, display error toast and do not trigger download
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 8.2 Write property test for export filename format (Property 9)
    - **Property 9: Export Filename Format**
    - Test that for any valid Date, the filename matches `^poster-\d{4}-\d{2}-\d{2}\.png$` with correct date components
    - **Validates: Requirements 5.2**

  - [x] 8.3 Write property test for DPI multiplier correctness (Property 10)
    - **Property 10: Export DPI Multiplier Correctness**
    - Test that for any template config with physical dimensions and canvas pixels, computed multiplier yields ≥ 150 DPI
    - **Validates: Requirements 5.3**

- [x] 9. Checkpoint - Feature modules complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement Responsive Layout Manager
  - [x] 10.1 Implement Responsive Layout Manager module
    - Create `responsiveManager.js` with resize observer/listener on window
    - Implement `recalculateLayout()`: compute scale factor so canvas fits viewport (minus toolbar space) while maintaining aspect ratio, never exceeding 1.0
    - Apply scale via CSS transform on canvas container (preserves Fabric.js coordinate system)
    - Implement toolbar repositioning: alongside canvas when viewport ≥ 768px, above/below canvas when < 768px
    - Ensure recalculation completes within 100ms of resize event (use requestAnimationFrame)
    - Support viewports as narrow as 320px
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 10.2 Add touch input support
    - Fabric.js provides built-in touch support; ensure canvas is configured with `allowTouchScrolling: false` for interaction
    - Test that selection, dragging, and resizing work with touch events
    - _Requirements: 8.5_

  - [x] 10.3 Write property test for canvas scale preserves aspect ratio (Property 8)
    - **Property 8: Canvas Scale Preserves Aspect Ratio**
    - Test that for any viewport ≥ 320px and any poster dimensions, displayed canvas maintains aspect ratio, fits viewport, and scale ≤ 1.0
    - **Validates: Requirements 8.1**

- [x] 11. Implement Multi-Template Support and Reset
  - [x] 11.1 Implement template selector UI and switching logic
    - Render template thumbnails from `templates/index.json` in the toolbar/template selector area
    - On template selection: check for unsaved edits, show confirmation dialog if edits exist, load new template on confirm
    - On load: check `persistence.getLastTemplate()` to load most recently used template, else load first in list
    - Handle template asset load failure: retain current template, show error toast
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [x] 11.2 Implement reset functionality
    - Wire reset button: show confirmation dialog ("Reset poster to default? This cannot be undone.")
    - On confirm: call `persistence.clear()`, reload current template with default placeholders, clear history stacks
    - _Requirements: 9.4, 9.5_

- [x] 12. Integration and wiring
  - [x] 12.1 Wire all modules together in Editor init sequence
    - Ensure init order: load fonts → check persistence → load template → init history → init toolbar → init responsive manager
    - Connect all event flows: canvas events → history saves → persistence saves → toolbar updates
    - Ensure no orphaned code: all modules connected through Editor orchestrator
    - _Requirements: 1.1, 6.1, 6.2, 6.3_

  - [x] 12.2 Implement error notification system
    - Create toast notification UI component (auto-dismiss after 5 seconds for warnings)
    - Create modal overlay component for blocking errors (template load failure on init)
    - Wire all error scenarios from Error Handling table in design to appropriate notification type
    - _Requirements: 1.4, 9.3, 10.7, 12.6_

  - [x] 12.3 Write integration tests
    - Test full page load with template rendering
    - Test localStorage save/restore across simulated page reloads
    - Test template switching flow with confirmation
    - Test export produces valid data URL
    - _Requirements: 1.1, 5.1, 9.2, 12.2_

- [x] 13. Final checkpoint - All features integrated
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The project uses no build step; all files are directly servable as static assets
- Fabric.js is loaded via CDN in the HTML file
- fast-check library (for property tests) can be loaded via CDN or run in Node.js with jsdom for CI
- Template extraction from PowerPoint (R `officer` script) is a one-time offline task not included in these coding tasks

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3"] },
    { "id": 3, "tasks": ["3.1", "3.2", "3.3"] },
    { "id": 4, "tasks": ["3.4", "3.5", "3.6", "3.7"] },
    { "id": 5, "tasks": ["5.1", "6.1", "7.1", "8.1"] },
    { "id": 6, "tasks": ["5.2", "6.2", "7.2", "8.2", "8.3"] },
    { "id": 7, "tasks": ["5.3", "5.4", "5.5", "6.3", "7.3"] },
    { "id": 8, "tasks": ["10.1", "10.2"] },
    { "id": 9, "tasks": ["10.3", "11.1", "11.2"] },
    { "id": 10, "tasks": ["12.1", "12.2"] },
    { "id": 11, "tasks": ["12.3"] }
  ]
}
```
