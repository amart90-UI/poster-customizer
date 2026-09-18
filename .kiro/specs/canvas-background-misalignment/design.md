# Canvas Background Misalignment Bugfix Design

## Overview

After migrating from CSS `transform: scale()` to Fabric.js `canvas.setZoom()` for responsive scaling, the canvas background image no longer participates in the viewport transform. Fabric.js 6 renders `backgroundImage` at its natural pixel dimensions regardless of zoom level, while all canvas objects (text boxes) are correctly transformed by the zoom. This produces a growing visual offset between background and objects as zoom decreases below 1.0.

The fix will make the background image participate in the same viewport transform as canvas objects by promoting it from the special `backgroundImage` slot to a regular (non-interactive) Fabric.js image object placed at z-index 0. This ensures the viewport transform applies uniformly to both background and objects, preserving pointer mapping, logical coordinates, and export behavior.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — when `canvas.setZoom(scale)` is applied with scale < 1.0, the background image renders at full logical size while objects render at scaled size, causing misalignment
- **Property (P)**: The desired behavior — background and objects render at the same effective scale, maintaining spatial alignment within 1 CSS pixel at all zoom levels
- **Preservation**: Existing behaviors that must remain unchanged — pointer coordinate mapping, logical coordinate storage, export at logical resolution, responsive scaling formula, template loading flow
- **backgroundImage**: Fabric.js 6's built-in background rendering mechanism that draws independently of the viewport transform (the source of the bug)
- **viewportTransform**: The 6-element affine matrix that Fabric.js applies to all canvas objects during rendering; `setZoom(s)` sets elements [0] and [3] to `s`
- **Logical coordinates**: The 1100×1700 coordinate space in which objects are positioned, independent of display scale

## Bug Details

### Bug Condition

The bug manifests when `canvas.setZoom(scale)` is called with a scale factor less than 1.0. The `backgroundImage` set via `canvas.set('backgroundImage', bgImage)` renders at its natural pixel dimensions (1100×1700) without the viewport transform, while text objects are rendered through the viewport transform at scaled positions and sizes. This causes a spatial offset of approximately `logicalPosition × (1 - scale)` pixels between each object and its intended background anchor point.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { scale: number, backgroundImage: FabricImage | null }
  OUTPUT: boolean
  
  RETURN input.scale < 1.0
         AND input.scale > 0.0
         AND input.backgroundImage IS NOT NULL
         AND backgroundImage IS SET via canvas.set('backgroundImage', ...)
         AND backgroundImage DOES NOT participate in viewportTransform
END FUNCTION
```

### Examples

- **Scale 0.5, object at (550, 850)**: Background renders at full 1100×1700 CSS px. Object renders at screen position (275, 425). The background pixel at logical (550, 850) appears at CSS (550, 850). Offset = 275px horizontal, 425px vertical. **Expected**: Both render at CSS (275, 425).
- **Scale 0.7, object at (100, 200)**: Background renders at full size. Object renders at screen position (70, 140). Background pixel at logical (100, 200) appears at CSS (100, 200). Offset = 30px horizontal, 60px vertical. **Expected**: Both render at CSS (70, 140).
- **Scale 1.0, object at (550, 850)**: Background renders at 1100×1700. Object renders at (550, 850). Zero offset. **Expected**: Zero offset — this case works correctly.
- **Scale 0.9, resize wider → scale 0.95**: As scale increases, offset decreases but remains visible until scale reaches exactly 1.0.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Pointer coordinate mapping (`canvas.getPointer()`) must continue to correctly map screen coordinates to logical coordinates at all scale factors
- The responsive scaling formula `scale = min(availableWidth / canvasWidth, availableHeight / canvasHeight)` clamped to max 1.0 must remain unchanged
- Object positions must remain stored in the 1100×1700 logical coordinate space regardless of display scale
- Export must produce images at the logical resolution (1100×1700 × multiplier) with correct object-to-background alignment
- Template loading must continue to set up background and text objects from template.json configuration

**Scope:**
All inputs that do NOT involve the rendering relationship between background and viewport transform should be completely unaffected by this fix. This includes:
- Mouse/touch interactions with text objects (selection, moving, resizing, editing)
- Keyboard shortcuts (undo/redo, Escape to cancel editing)
- Template switching and loading
- History/persistence save and restore operations
- Export functionality
- Add Text button behavior
- Object scaling constraints (min/max size, aspect ratio lock)

## Hypothesized Root Cause

Based on the bug description and code analysis, the root cause is:

1. **Fabric.js 6 backgroundImage rendering bypass**: In Fabric.js 6, `canvas.set('backgroundImage', bgImage)` places the image in a special rendering path that does NOT apply the canvas `viewportTransform`. The background is drawn directly at its natural dimensions before the viewport transform is applied to the object layer. This is by design in Fabric.js 6 — the `backgroundImage` property is intended for static backgrounds that don't participate in pan/zoom.

2. **setZoom only affects objects**: `canvas.setZoom(scale)` modifies the `viewportTransform` matrix (setting elements [0] and [3] to `scale`). This transform is applied during rendering of all objects in the `_objects` array, but NOT to `backgroundImage` or `backgroundColor`.

3. **Previous CSS approach masked the issue**: The earlier CSS `transform: scale()` approach scaled the entire `<canvas>` element uniformly in the browser's compositor, affecting all rendered pixels (background and objects alike). Switching to `setZoom()` exposed the split rendering paths.

4. **No built-in option to force backgroundImage through viewport transform**: Fabric.js 6 does not provide a configuration flag to make `backgroundImage` participate in the viewport transform. The fix requires either: (a) promoting the background to a regular canvas object, or (b) manually synchronizing the background image's scale properties with the zoom level.

## Correctness Properties

Property 1: Bug Condition - Background-Object Alignment Under Zoom

_For any_ zoom scale in (0.0, 1.0] and any object at logical coordinates (x, y), the rendered CSS pixel position of that object and the rendered CSS pixel position of the background pixel at logical (x, y) SHALL differ by no more than 1 CSS pixel on each axis.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Pointer Coordinate Mapping

_For any_ click/tap event at screen coordinates (sx, sy) that falls within a text object's bounding box in screen space, the fixed code SHALL produce the same logical coordinate mapping via `canvas.getPointer()` as the original code, preserving object selection and interaction behavior.

**Validates: Requirements 3.1, 3.3**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct, the recommended approach is to promote the background image from the special `backgroundImage` slot to a regular Fabric.js image object at z-index 0, configured as non-interactive.

**File**: `templateManager.js`

**Function**: `loadTemplate`

**Specific Changes**:
1. **Replace backgroundImage with a regular object**: Instead of `canvas.set('backgroundImage', bgImage)`, add `bgImage` as the first object in the canvas via `canvas.add(bgImage)` after configuring it as non-interactive.

2. **Configure background image as non-interactive**: Set properties on the image object to prevent selection, movement, or modification:
   - `selectable: false`
   - `evented: false`
   - `excludeFromExport: false` (ensure it appears in exports)
   - `left: 0, top: 0`
   - `scaleX: 1, scaleY: 1` (at logical dimensions)

3. **Ensure background stays at z-index 0**: After adding the background image, use `canvas.sendObjectToBack(bgImage)` or insert at index 0 to ensure it renders behind all text objects.

4. **Remove the `canvas.set('backgroundImage', bgImage)` call**: The image is no longer set as a special background property.

5. **Tag the background object for identification**: Add a custom property (e.g., `isBackgroundLayer: true`) so other modules (export, persistence, history) can identify and handle it appropriately.

**File**: `responsiveManager.js`

**Function**: `recalculateLayout`

**Specific Changes**:
- No changes needed. Since the background is now a regular canvas object, `canvas.setZoom(scale)` will automatically apply the viewport transform to it along with all other objects.

**File**: `exportManager.js`

**Function**: `exportAsPNG`

**Specific Changes**:
- Verify that `canvas.toDataURL()` includes the background object in the export. Since `excludeFromExport` is `false`, this should work without changes. However, confirm that the zoom is temporarily reset to 1.0 for export (or that the multiplier calculation accounts for it). If `toDataURL` respects the current viewport transform, we may need to temporarily set zoom to 1.0 before export and restore it after.

**File**: `editor.js`

**Specific Changes**:
- In the `object:moving` constraint handler, add a guard to skip the background layer object (check `isBackgroundLayer` property) so it cannot be inadvertently moved.
- In scaling constraints (`onObjectScaling`), add a similar guard.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that create a canvas with a background image set via `canvas.set('backgroundImage', bgImage)`, apply `setZoom(scale)` at various scales < 1.0, then measure the rendered positions of the background and objects. Run these tests on the UNFIXED code to observe misalignment.

**Test Cases**:
1. **Scale 0.5 alignment test**: Set zoom to 0.5, place an object at (550, 850), verify the background pixel at that logical position does NOT align with the object's rendered position (will fail on unfixed code — demonstrates the bug)
2. **Scale 0.7 alignment test**: Set zoom to 0.7, verify misalignment exists (will fail on unfixed code)
3. **Scale 0.3 extreme test**: Set zoom to 0.3, verify large misalignment (will fail on unfixed code)
4. **Scale 1.0 control test**: Set zoom to 1.0, verify alignment is correct (should pass on unfixed code)

**Expected Counterexamples**:
- Background renders at full logical size (1100×1700 CSS px) regardless of zoom
- Objects render at `logicalPosition × scale` CSS px
- Offset between background and object = `logicalPosition × (1 - scale)` px
- Possible root cause confirmed: `backgroundImage` does not participate in viewport transform

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  canvas := createCanvas(1100, 1700)
  loadBackgroundAsObject(canvas, bgImage)
  addTextObject(canvas, input.objectX, input.objectY)
  canvas.setZoom(input.scale)
  
  bgRenderedPos := getRenderedPosition(bgImage, input.objectX, input.objectY)
  objRenderedPos := getRenderedPosition(textObject)
  
  ASSERT abs(bgRenderedPos.x - objRenderedPos.x) <= 1
  ASSERT abs(bgRenderedPos.y - objRenderedPos.y) <= 1
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT getPointer_fixed(input.event) = getPointer_original(input.event)
  ASSERT objectLogicalCoords_fixed(input) = objectLogicalCoords_original(input)
  ASSERT exportOutput_fixed(input) = exportOutput_original(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain (random scale values, random object positions, random click positions)
- It catches edge cases that manual unit tests might miss (e.g., objects near canvas edges, very small scale values)
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for pointer mapping, object coordinates, and export output, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Pointer mapping preservation**: For random click positions within the canvas at various scales, verify `getPointer()` returns the correct logical coordinates (within tolerance of original behavior)
2. **Object coordinate preservation**: After moving/resizing objects at various scales, verify logical coordinates stored are scale-independent
3. **Export resolution preservation**: At various display scales, verify export produces consistent output at the logical resolution
4. **Template load preservation**: Verify template loading places objects at correct logical coordinates regardless of current zoom

### Unit Tests

- Test that the background image is added as a regular object (not via `canvas.set('backgroundImage', ...)`)
- Test that the background object has `selectable: false` and `evented: false`
- Test that the background object is at z-index 0 (behind all text objects)
- Test that the background object cannot be moved or selected via simulated clicks
- Test alignment at scale 0.5, 0.7, 0.9, and 1.0

### Property-Based Tests

- Generate random scale values in (0.01, 1.0] and random object positions within (0,0)-(1100,1700), verify alignment within 1px tolerance
- Generate random click coordinates and verify pointer mapping produces correct logical coordinates at all scales
- Generate random sequences of operations (zoom, move, resize, export) and verify no regression in object positioning

### Integration Tests

- Test full template load → zoom → verify alignment flow
- Test template load → zoom → export → verify export alignment
- Test template load → zoom → interact with objects → verify selection works
- Test template switching at non-1.0 zoom levels preserves alignment
