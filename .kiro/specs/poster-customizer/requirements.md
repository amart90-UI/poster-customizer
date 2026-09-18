# Requirements Document

## Introduction

A static website hosted on GitHub Pages that allows users to customize event posters for the Hoss Hangmen band. The site loads a pre-designed poster template (extracted from an existing PowerPoint presentation) and provides an interactive editor where users can modify text fields (dates, venues, additional details), reposition elements, and resize text. The finished poster can be exported as an image for printing or sharing.

## Glossary

- **Editor**: The browser-based interactive poster customization interface
- **Template**: A pre-defined poster layout containing fixed background artwork and configurable text placeholders. Multiple templates may be available for selection.
- **Element**: A discrete visual component on the poster canvas that can be selected and manipulated (text box, image, or shape)
- **Canvas**: The main editing area where the poster is displayed and manipulated
- **Export**: The process of converting the current poster state into a downloadable image file
- **Placeholder**: A pre-positioned text element in the template that is intended to be edited by the user (e.g., date, venue name)
- **Typeface**: A specific font family available for text rendering (e.g., "The Serif Hand Black", "The Serif Hand Extrablack")

## Requirements

### Requirement 1: Template Loading

**User Story:** As a user, I want the poster editor to load the existing band poster design as a template, so that I can customize it without recreating the design from scratch.

#### Acceptance Criteria

1. WHEN the website is loaded, THE Editor SHALL display the poster template with the background artwork and all pre-defined placeholder elements visible on the Canvas within 3 seconds of page load completion.
2. THE Template SHALL contain pre-positioned placeholder elements for event date, venue name, and at least one additional event details field.
3. WHEN the Template is loaded, THE Editor SHALL auto-populate placeholder elements with default text values indicating their purpose (e.g., "Enter Date Here", "Enter Venue Name") and SHALL visually distinguish placeholder elements from the fixed background artwork to indicate they are editable.
4. IF the Template data or background artwork fails to load, THEN THE Editor SHALL display an error message indicating the template could not be loaded and SHALL not render a partially loaded Canvas.

### Requirement 2: Text Editing

**User Story:** As a user, I want to edit the text on the poster (dates, venues, and additional information), so that I can create posters for different events.

#### Acceptance Criteria

1. WHEN a user double-clicks a text Element, THE Editor SHALL activate an inline text editing mode for that Element, indicated by a visible border around the Element and a blinking text cursor at the click position.
2. WHILE a text Element is in editing mode, THE Editor SHALL display a text cursor and accept keyboard input to modify the text content, up to a maximum of 200 characters per text Element.
3. WHEN a user clicks outside an active text Element, THE Editor SHALL deactivate editing mode and display the updated text on the Canvas.
4. IF a user presses the Escape key while a text Element is in editing mode, THEN THE Editor SHALL deactivate editing mode and revert the text content to the value it had before editing mode was activated.
5. WHEN a user activates the add-text control in the toolbar, THE Editor SHALL place a new text Element at the center of the visible Canvas area with default placeholder text "New Text" and styling matching the existing placeholder font family and a font size of 16px.
6. IF a user clears all text from a text Element and exits editing mode, THEN THE Editor SHALL retain the empty Element on the Canvas as a selectable, repositionable Element displaying its bounding box when selected.

### Requirement 3: Element Positioning

**User Story:** As a user, I want to drag elements around the poster, so that I can arrange the layout for different events.

#### Acceptance Criteria

1. WHEN a user clicks and holds the pointer on an Element for at least 150ms or moves the pointer more than 5px from the initial click position, THE Editor SHALL initiate a drag operation and move the Element to follow the pointer position on the Canvas.
2. WHILE an Element is being dragged, THE Editor SHALL update the Element's position on each animation frame to reflect the current pointer position.
3. WHEN a user releases the pointer after dragging, THE Editor SHALL place the Element at the final pointer position and retain that position.
4. THE Editor SHALL constrain Element positioning so that no part of the Element extends beyond the Canvas boundaries.

### Requirement 4: Element Resizing

**User Story:** As a user, I want to resize text and other elements, so that I can adjust the visual hierarchy and fit content on the poster.

#### Acceptance Criteria

1. WHEN a user selects an Element, THE Editor SHALL display resize handles at the four corners of the Element's bounding box.
2. WHEN a user drags a resize handle, THE Editor SHALL scale the Element in real time while maintaining the Element's aspect ratio, and SHALL not allow the Element to be resized below 10×10 pixels or beyond the Canvas boundaries.
3. WHEN a user releases a resize handle after dragging, THE Editor SHALL commit the new Element dimensions and retain them on the Canvas.
4. WHEN a user selects a text Element, THE Editor SHALL provide font size controls that allow adjusting the font size in 1-point increments within a range of 8pt to 200pt.
5. IF a user attempts to resize an Element beyond the minimum or maximum allowed dimensions, THEN THE Editor SHALL stop the resize at the nearest allowed boundary.

### Requirement 5: Poster Export

**User Story:** As a user, I want to export the customized poster as an image, so that I can print it or share it digitally.

#### Acceptance Criteria

1. WHEN a user activates the export action, THE Editor SHALL generate a PNG image of the current Canvas state that visually matches the Canvas display including all Element positions, sizes, and text content.
2. THE Editor SHALL offer the exported image as a browser download with the filename format "poster-YYYY-MM-DD.png" where YYYY-MM-DD is the current date.
3. THE Editor SHALL export the image at a resolution suitable for printing (minimum 150 DPI at the poster's physical dimensions as defined in the Template JSON configuration).
4. IF the export process fails, THEN THE Editor SHALL display an error message and SHALL not trigger a file download.

### Requirement 6: Static Hosting Compatibility

**User Story:** As a user, I want the website to work as a GitHub Pages site, so that I can host and share it without a server.

#### Acceptance Criteria

1. THE Editor SHALL operate entirely within the browser using static HTML, CSS, and JavaScript files with no server-side processing required at runtime.
2. THE Editor SHALL load all template assets (background images, fonts, layout data) from static files included in the repository using relative URL paths.
3. WHEN deployed to GitHub Pages, THE Editor SHALL be fully functional without any additional backend services or API calls.
4. THE Editor SHALL not require any build step or compilation to be served; all runtime files SHALL be directly servable as static assets.

### Requirement 7: Template Extraction from PowerPoint

**User Story:** As a user, I want the poster design from my existing PowerPoint file to be converted into a web-compatible template, so that the website uses my existing artwork.

#### Acceptance Criteria

1. THE Template SHALL include the background artwork from the source PowerPoint file exported as a PNG or SVG image at a minimum resolution of 150 DPI at the poster's physical dimensions.
2. IF the source PowerPoint file contains multiple slides, THEN THE Template SHALL use only the first slide as the source for background artwork and placeholder extraction.
3. THE Template SHALL preserve the relative positioning of text placeholders such that each placeholder's x, y, width, and height values correspond to the same proportional position (as a percentage of slide dimensions) defined in the source PowerPoint file, within a tolerance of 1% of the canvas dimension.
4. THE Template SHALL define placeholder positions and default styles in a JSON data file that the Editor reads at load time, including for each placeholder: x position, y position, width, height, font family, font size, font color, and text alignment.
5. WHEN the Editor loads the JSON data file, THE Editor SHALL render each placeholder Element at the position and with the styles specified in that file.

> **Implementation Note:** The R `officer` package can parse .pptx files to extract text positions and styles programmatically. However, background artwork (complex layered graphics, gradients, or custom artwork) may need to be exported manually from PowerPoint as a high-resolution PNG if programmatic extraction does not capture all visual elements faithfully.

### Requirement 8: Responsive Editing Experience

**User Story:** As a user, I want the editor to be usable on different screen sizes, so that I can make quick edits from various devices.

#### Acceptance Criteria

1. THE Editor SHALL scale the Canvas to fit within the available viewport area (viewport minus toolbar/panel space) while maintaining the poster's aspect ratio, never exceeding 100% of the poster's original dimensions, and supporting viewports as narrow as 320px wide.
2. WHEN the browser window is resized, THE Editor SHALL re-scale the Canvas to fit the new viewport dimensions within 100ms of the resize event completing.
3. IF the viewport width is 768px or wider, THEN THE Editor SHALL display the toolbar as a fixed panel alongside the Canvas without overlapping it.
4. IF the viewport width is less than 768px, THEN THE Editor SHALL reposition the toolbar above or below the Canvas so that the full Canvas remains visible when not interacting with controls.
5. THE Editor SHALL support touch input for element selection, dragging, and resizing on touch-capable devices.

### Requirement 9: State Persistence

**User Story:** As a user, I want my edits to be preserved if I accidentally close the browser, so that I don't lose my work.

#### Acceptance Criteria

1. WHEN a user modifies any Element on the Canvas, THE Editor SHALL save the current poster state to browser local storage within 2 seconds of the modification completing.
2. WHEN the website is loaded and a valid saved state exists in local storage, THE Editor SHALL restore the poster to the previously saved state, including all Element positions, sizes, and text content.
3. IF the saved state in local storage is corrupted or cannot be parsed, THEN THE Editor SHALL discard the invalid state, load the default Template, and display a notification informing the user that previous edits could not be restored.
4. THE Editor SHALL provide a visible reset button that, when activated, clears saved state from local storage and restores the Template to its default configuration.
5. WHEN the reset button is activated, THE Editor SHALL prompt the user for confirmation before clearing the saved state.

### Requirement 10: Font Customization

**User Story:** As a user, I want to change the font color and typeface of text elements, so that I can match the poster's visual style to different events or themes.

#### Acceptance Criteria

1. WHEN a user selects a text Element, THE Editor SHALL display a font color picker control in the toolbar that allows the user to choose any color using a standard color input or by entering a hex color code.
2. WHEN a user selects a new font color, THE Editor SHALL apply the chosen color to the selected text Element immediately and display the updated color on the Canvas.
3. THE Editor SHALL provide a typeface selector control that includes at minimum the typefaces "The Serif Hand Black" and "The Serif Hand Extrablack" as available options.
4. WHEN a user selects a typeface from the typeface selector, THE Editor SHALL apply the chosen typeface to the selected text Element immediately and re-render the text on the Canvas using the new typeface.
5. THE Editor SHALL load all available typefaces as web fonts from static files included in the repository so that they render correctly without external font service dependencies.
6. THE Editor SHALL support adding additional typefaces in the future by including new font files in the repository and adding entries to a fonts configuration list without requiring code changes to the typeface selector logic.
7. IF a selected typeface file fails to load, THEN THE Editor SHALL fall back to the browser's default serif font and display a warning indicating the typeface could not be loaded.

### Requirement 11: Undo/Redo

**User Story:** As a user, I want to undo and redo my edits, so that I can experiment with changes without fear of losing previous work.

#### Acceptance Criteria

1. WHEN a user performs an edit action (text change, element move, element resize, font change, or element addition), THE Editor SHALL push the previous state onto an undo stack.
2. WHEN a user activates the undo control or presses Ctrl+Z (Cmd+Z on macOS), THE Editor SHALL revert the Canvas to the state before the most recent edit action and push the reverted-from state onto a redo stack.
3. WHEN a user activates the redo control or presses Ctrl+Y (Cmd+Shift+Z on macOS), THE Editor SHALL re-apply the most recently undone edit action and move that state from the redo stack back to the undo stack.
4. WHEN a user performs a new edit action after undoing, THE Editor SHALL clear the redo stack so that the new edit becomes the latest state.
5. THE Editor SHALL support an undo history of at least 50 actions.
6. IF the undo stack is empty and the user activates undo, THEN THE Editor SHALL take no action and the undo control SHALL appear visually disabled.
7. IF the redo stack is empty and the user activates redo, THEN THE Editor SHALL take no action and the redo control SHALL appear visually disabled.

### Requirement 12: Multi-Template Support

**User Story:** As a user, I want to choose from multiple poster templates, so that I can create different styles of posters for various events.

#### Acceptance Criteria

1. THE Editor SHALL display a template selector control that lists all available Templates by name and thumbnail preview.
2. WHEN a user selects a Template from the template selector, THE Editor SHALL load that Template's background artwork, placeholder elements, and default styles onto the Canvas, replacing the previously displayed Template.
3. WHEN a new Template is selected while unsaved edits exist on the current Canvas, THE Editor SHALL prompt the user for confirmation before discarding the current edits and loading the new Template.
4. THE Editor SHALL support adding new Templates by placing a background image file and a JSON configuration file in the templates directory without requiring code changes to the template selector logic.
5. WHEN the website is loaded and multiple Templates are available, THE Editor SHALL load the most recently used Template (as recorded in local storage) or the first Template in the list if no previous selection exists.
6. IF a selected Template's assets fail to load, THEN THE Editor SHALL display an error message and retain the currently loaded Template on the Canvas.
