# Bugfix Requirements Document

## Introduction

After replacing CSS `transform: scale()` with Fabric.js `canvas.setZoom()` in `responsiveManager.js` to fix pointer coordinate mapping, the canvas background image and text objects became misaligned. The text objects visually "slip off" the background as the window widens (scale approaches 1.0 from below). This occurs because Fabric.js 6's `backgroundImage` renders independently of the viewport transform — it draws at its natural size regardless of zoom level — while canvas objects are transformed by the zoom. The fix must anchor background and objects together at all zoom levels while preserving the correct pointer mapping that `setZoom()` provides.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `canvas.setZoom(scale)` is applied with a scale factor in the range (0.0, 1.0) THEN the system renders text objects at scaled positions (logical position multiplied by scale) and scaled sizes, but renders the background image set via `canvas.set('backgroundImage', bgImage)` at its full logical dimensions (1100×1700 CSS pixels) without applying the viewport transform, resulting in a visible spatial offset between each text object's rendered position and its intended position on the background of approximately `logicalPosition × (1 - scale)` pixels

1.2 WHEN the viewport is resized from a narrower width to a wider width (causing the computed scale to increase toward 1.0 from below) THEN the system increases the absolute pixel offset between the background image edges and the corresponding text object positions — objects shift further from their intended background anchor points as scale increases, because the background remains at fixed full size while objects scale up toward their logical positions

1.3 WHEN `canvas.setZoom(scale)` is applied with scale = 1.0 THEN the system renders both the background image and text objects at their full logical dimensions (1100×1700) with zero spatial offset between object rendered positions and their intended background positions (the defect manifests only at scale < 1.0)

### Expected Behavior (Correct)

2.1 WHEN `canvas.setZoom(scale)` is applied with scale < 1.0 THEN the system SHALL render the background image transformed by the same scale factor as text objects, such that for any text object at logical coordinates (x, y), the rendered CSS pixel position of that object and the rendered CSS pixel position of the background pixel at logical (x, y) differ by no more than 1 CSS pixel on each axis

2.2 WHEN the viewport is resized wider (increasing scale toward 1.0) THEN the system SHALL preserve the spatial relationship between background image and text objects — for any object positioned at logical coordinates (x, y), the distance in rendered CSS pixels between that object's rendered position and the corresponding background pixel at the same logical coordinates SHALL remain within 1 CSS pixel on each axis at every intermediate scale value

2.3 WHEN `canvas.setZoom(scale)` is applied with scale = 1.0 THEN the system SHALL render both background and objects at the canvas logical dimensions (1100×1700 pixels) with zero pixel offset between object rendered positions and their corresponding background pixels

2.4 WHEN `canvas.setZoom(scale)` is applied with any scale in (0, 1.0] THEN the system SHALL apply the viewport transform to the background image such that the background's rendered width equals 1100 × scale CSS pixels and rendered height equals 1700 × scale CSS pixels, matching the scaled canvas element dimensions

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the user clicks or taps on a text object at any scale factor, THEN the system SHALL CONTINUE TO select that object — the pointer position returned by `canvas.getPointer(event)` SHALL correspond to the object's logical coordinates (left, top, width, height) such that a click within an object's bounding box in screen space always resolves to that object in logical space

3.2 WHEN the viewport is narrower than the canvas natural dimensions (1100×1700), THEN the system SHALL CONTINUE TO scale the canvas using the formula `scale = min(availableWidth / canvasWidth, availableHeight / canvasHeight)` clamped to a maximum of 1.0, preserving the aspect ratio without upscaling

3.3 WHEN the user edits, moves, or resizes text objects at any display scale, THEN the system SHALL CONTINUE TO store object positions (left, top, width, height) in the logical canvas coordinate system (1100×1700) — the persisted and in-memory coordinate values SHALL remain identical regardless of whether the current display scale is 0.5 or 1.0

3.4 WHEN the user exports the poster at any display scale, THEN the system SHALL CONTINUE TO produce an image at the logical canvas resolution (1100×1700 multiplied by the export multiplier) with each object rendered at its logical coordinates relative to the background — object positions in the exported image SHALL NOT shift based on the display scale at time of export

3.5 WHEN a template is loaded, THEN the system SHALL CONTINUE TO set the background image via `canvas.set('backgroundImage', bgImage)` and place text objects at the x/y coordinates defined in template.json within the 1100×1700 logical coordinate space
