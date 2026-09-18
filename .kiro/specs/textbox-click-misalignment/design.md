# Textbox Click Misalignment Bugfix Design

## Overview

The poster editor's canvas elements cannot be interacted with at their visual positions because the `ResponsiveManager` applies a CSS `transform: scale()` to the Fabric.js canvas wrapper without updating Fabric.js's internal coordinate system. Fabric.js uses its own coordinate space for hit testing, which remains unscaled, creating an offset between where objects appear and where clicks register. The fix replaces the CSS transform approach with Fabric.js's native zoom API (`canvas.setZoom()` and dimension adjustments), ensuring coordinate consistency between rendering and interaction at all scale factors.

## Glossary

- **Bug_Condition (C)**: The canvas has a CSS `transform: scale(s)` applied with `s < 1.0`, causing Fabric.js hit-test coordinates to diverge from visual positions
- **Property (P)**: Mouse coordinates correctly map to visual object positions at all scale values, allowing click, drag, and resize interactions to work at the object's rendered location
- **Preservation**: Existing behaviors that must remain unchanged — canvas boundary constraints, toolbar layout switching, undo/redo, text placement, and the rule that scale never exceeds 1.0
- **ResponsiveManager**: The module in `responsiveManager.js` that calculates and applies canvas scaling based on available viewport space
- **Fabric.js viewportTransform**: The internal 6-element matrix Fabric.js uses to translate between screen coordinates and canvas logical coordinates
- **canvas.setZoom(scale)**: Fabric.js API that sets the zoom level and updates the viewportTransform, ensuring coordinate consistency between rendering and hit testing
- **Scale Factor**: The ratio of available viewport space to canvas natural dimensions, clamped to max 1.0

## Bug Details

### Bug Condition

The bug manifests when the `ResponsiveManager.recalculateLayout()` method applies a CSS `transform: scale(s)` to the Fabric.js canvas wrapper element (`.canvas-container`) where `s < 1.0`. The CSS transform visually scales the rendered canvas but Fabric.js internally still maps mouse events using the original unscaled coordinate space. This causes `canvas.getPointer()` to return coordinates that don't correspond to where objects visually appear.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { pointerEvent: MouseEvent, canvasScale: number }
  OUTPUT: boolean
  
  RETURN input.canvasScale < 1.0
         AND cssTransformApplied(fabricWrapper, input.canvasScale)
         AND NOT fabricViewportTransformUpdated(canvas, input.canvasScale)
END FUNCTION
```

### Examples

- **Scale 0.5, click at (200, 300) visual**: User clicks at visual position (200, 300) on a text box. Fabric.js interprets the pointer at approximately (400, 600) in logical space due to the CSS scale mismatch — the text box is not selected.
- **Scale 0.75, drag from (100, 100) visual**: User starts dragging from a text box at visual (100, 100). Fabric.js sees the pointer at approximately (133, 133) — the drag misses the object or targets a different one.
- **Scale 0.9, resize handle at (350, 50) visual**: User clicks a resize handle at visual (350, 50). Fabric.js maps this to approximately (389, 56) — the resize grip is not activated.
- **Scale 1.0 (no scaling)**: User clicks at (200, 300) — Fabric.js correctly maps to (200, 300) — no bug, interaction works as expected.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Mouse clicks, drags, and resize operations on canvas objects must continue to work correctly when scale = 1.0
- The toolbar must continue to switch between side layout (≥768px) and horizontal layout (<768px)
- Object boundary constraints must continue to prevent elements from being moved outside the canvas
- The "Add Text" button must continue to create centered, selectable text boxes
- Undo/redo operations must continue to restore canvas states correctly
- The scale factor must never exceed 1.0 (no upscaling beyond natural canvas dimensions)
- The canvas natural/logical dimensions (width, height) must remain at their template-defined values for export and object positioning purposes

**Scope:**
All inputs at scale = 1.0 should behave identically before and after the fix. The fix only changes how scaling is applied when scale < 1.0 — replacing CSS transform with Fabric.js native zoom. Non-pointer interactions (keyboard shortcuts, button clicks in the toolbar, template loading) are completely unaffected.

## Hypothesized Root Cause

Based on the code analysis, the root cause is confirmed in `responsiveManager.js` at lines 88-92 of the `recalculateLayout()` method:

1. **CSS Transform Without Fabric.js Awareness**: The method applies `fabricWrapper.style.transform = scale(${scale})` which scales the visual rendering via CSS. However, Fabric.js's internal `viewportTransform` matrix remains at identity (no zoom), so `canvas.getPointer(event)` calculates mouse positions in the unscaled coordinate space.

2. **Coordinate Space Divergence**: When CSS scales the wrapper down (e.g., 0.5x), visual positions are halved, but Fabric.js still expects pointer coordinates in the full unscaled space. A click at visual (200, 200) maps to raw screen coordinates that Fabric.js interprets as a different logical position.

3. **No Pointer Correction**: There is no compensating logic (such as overriding `getPointer` or adjusting the viewportTransform) to account for the CSS scale factor in mouse event coordinate translation.

4. **Compounding With transformOrigin**: The `transformOrigin: 'center center'` further complicates the offset calculation because the scaling pivot is at the center of the wrapper, not the top-left corner where Fabric.js measures from.

## Correctness Properties

Property 1: Bug Condition - Pointer-to-Object Alignment Under Zoom

_For any_ pointer event at a visual position where a canvas object is rendered, when the canvas is scaled via the ResponsiveManager (scale < 1.0), the system SHALL correctly resolve the pointer to that object, enabling selection, drag, and resize interactions at the visual position.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Behavior at Unit Scale and Non-Pointer Interactions

_For any_ interaction when the canvas scale is 1.0 (no scaling applied), or for any non-pointer interaction (toolbar buttons, keyboard shortcuts, undo/redo, template loading, text creation), the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing functionality.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `responsiveManager.js`

**Function**: `recalculateLayout()`

**Specific Changes**:

1. **Remove CSS Transform**: Remove the lines that apply `fabricWrapper.style.transform = scale(...)` and `fabricWrapper.style.transformOrigin = 'center center'`. CSS transforms must not be used on the Fabric.js canvas wrapper because they bypass Fabric.js's coordinate system.

2. **Use Fabric.js setZoom()**: Replace the CSS transform with `this._canvas.setZoom(scale)`. This updates the `viewportTransform` matrix so that both rendering and hit testing use the same coordinate space. Objects will render at scaled positions and pointer events will correctly map to those positions.

3. **Adjust Canvas Element Dimensions**: After setting zoom, update the canvas HTML element dimensions to reflect the scaled size:
   - `this._canvas.setWidth(canvasWidth * scale)`
   - `this._canvas.setHeight(canvasHeight * scale)`
   
   This ensures the canvas element in the DOM occupies the correct amount of space. Use the `cssOnly` option or the Fabric.js dimension API to set only the CSS/element dimensions without changing the logical canvas dimensions.

4. **Remove transformOrigin**: Since CSS transforms are no longer used, the `transformOrigin` style is unnecessary and should be removed.

5. **Ensure Canvas Logical Dimensions Preserved**: The canvas's logical width/height (used for object positioning, boundary constraints, and export) must remain at the template-defined values. Only the rendered/CSS dimensions should change. Fabric.js's `setDimensions()` with `{ cssOnly: true }` or setting element dimensions via `setWidth`/`setHeight` with appropriate options can achieve this.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate pointer events at known visual positions when a CSS scale transform is applied, and verify whether Fabric.js resolves those coordinates to the correct canvas objects. Run these tests on the UNFIXED code to observe failures.

**Test Cases**:
1. **Scale 0.5 Click Test**: Set scale to 0.5, place object at logical (200, 200), simulate click at visual (100, 100) — expect selection fails on unfixed code
2. **Scale 0.75 Click Test**: Set scale to 0.75, place object at logical (100, 100), simulate click at visual (75, 75) — expect selection fails on unfixed code
3. **Scale 0.9 Click Test**: Set scale to 0.9, place object at logical (300, 200), simulate click at visual (270, 180) — expect selection fails on unfixed code
4. **Multiple Objects Offset Test**: Set scale to 0.6, place two objects at known positions, verify clicking at their visual positions fails to select on unfixed code

**Expected Counterexamples**:
- `canvas.getPointer()` returns coordinates in the unscaled space rather than mapping correctly to the scaled visual positions
- Objects cannot be selected by clicking at their visual positions when scale < 1.0
- The offset magnitude correlates with `(1 - scale)` — smaller scale = larger offset

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := recalculateLayout_fixed(input.scale)
  pointer := canvas.getPointer(input.pointerEvent)
  ASSERT pointerMapsToCorrectObject(pointer, input.targetObject)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT recalculateLayout_original(input) = recalculateLayout_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for scale = 1.0 scenarios and non-pointer interactions, then write property-based tests capturing that behavior to ensure no regression.

**Test Cases**:
1. **Scale 1.0 Click Preservation**: Verify clicking objects at their positions works on unfixed code (scale=1.0), then confirm it continues to work after the fix
2. **Boundary Constraint Preservation**: Verify objects cannot be dragged outside canvas boundaries both before and after the fix
3. **Add Text Preservation**: Verify "Add Text" creates centered text boxes both before and after the fix
4. **Undo/Redo Preservation**: Verify undo/redo state restoration works both before and after the fix
5. **Max Scale Clamping**: Verify the scale never exceeds 1.0 both before and after the fix

### Unit Tests

- Test that `recalculateLayout()` no longer applies CSS transform to the fabric wrapper
- Test that `recalculateLayout()` calls `canvas.setZoom(scale)` with the correct scale value
- Test that canvas element dimensions are set to `logicalWidth * scale` × `logicalHeight * scale`
- Test that canvas logical dimensions remain unchanged after `recalculateLayout()`
- Test that `getCanvasScale()` returns the correct value after recalculation
- Test scale clamping: scale never exceeds 1.0 regardless of container size

### Property-Based Tests

- Generate random scale factors in (0, 1.0] and verify `canvas.setZoom()` is called with that value and no CSS transform is applied
- Generate random pointer positions within the scaled canvas and verify `getPointer()` maps them to correct logical coordinates
- Generate random container sizes and verify the computed scale respects the max 1.0 constraint and produces correct zoom values

### Integration Tests

- Test full flow: resize window → canvas rescales → click on text box → text box is selected
- Test drag-and-drop at various scale factors: object follows the pointer accurately
- Test resize handles at various scale factors: handles respond at their visual positions
- Test that after recalculation, newly added text boxes appear centered and are immediately clickable
