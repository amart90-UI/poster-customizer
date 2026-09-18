# Bugfix Requirements Document

## Introduction

The poster customizer application offers two custom fonts — "The Serif Hand Black" and "The Serif Hand Extrablack" — for text elements. However, both fonts are incorrectly reported as "unavailable" in the font family dropdown, and a warning toast is shown saying the custom font could not be loaded. The fonts are correctly declared in `fonts.css` and the `.woff2` files exist in the fonts directory, so this is a font-loading verification logic issue rather than a missing-asset issue.

The root cause is in `toolbar.js` `_verifyFontLoading()`: it uses `document.fonts.check()` to verify font availability, but with `font-display: swap`, fonts are only loaded on-demand when rendered text actually uses them. Since no visible DOM text uses these fonts at verification time (only the canvas will use them later), `document.fonts.check()` returns `false` and the fonts are incorrectly marked as unavailable. The fix should actively trigger font loading (e.g., via `document.fonts.load()`) before checking availability.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the toolbar initializes and verifies font loading using `document.fonts.check()` THEN the system incorrectly reports both "The Serif Hand Black" and "The Serif Hand Extrablack" as failed to load because the fonts have not yet been rendered on the page

1.2 WHEN fonts are reported as failed THEN the system appends "(unavailable)" to the font names in the dropdown and shows a warning toast "Custom font could not be loaded. Using default font."

1.3 WHEN fonts are reported as failed THEN the system applies a fallback to "serif" for any existing canvas text elements using those fonts, overriding the intended custom font styling

1.4 WHEN the user selects a font marked as unavailable from the dropdown THEN the system applies "serif" instead of the selected custom font, even though the font file is present and valid

### Expected Behavior (Correct)

2.1 WHEN the toolbar initializes and verifies font loading THEN the system SHALL actively load fonts (e.g., via `document.fonts.load()`) before checking availability, ensuring fonts declared in `fonts.css` with valid `.woff2` files are recognized as loaded

2.2 WHEN fonts are successfully loaded THEN the system SHALL display the font names without any "(unavailable)" suffix in the dropdown and SHALL NOT show a warning toast about font loading failure

2.3 WHEN fonts are successfully loaded THEN the system SHALL NOT apply any fallback font to canvas text elements that use those custom fonts

2.4 WHEN the user selects a loaded custom font from the dropdown THEN the system SHALL apply that custom font to the active text element

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a font file is genuinely missing or corrupted (network error, 404) THEN the system SHALL CONTINUE TO mark that font as unavailable, show a warning toast, and apply the serif fallback

3.2 WHEN no text element is selected THEN the system SHALL CONTINUE TO disable font controls in the toolbar

3.3 WHEN the user changes font family on a selected text element THEN the system SHALL CONTINUE TO apply the change and fire object:modified for history/persistence tracking

3.4 WHEN fonts.json cannot be fetched THEN the system SHALL CONTINUE TO fall back to the hardcoded default font list
