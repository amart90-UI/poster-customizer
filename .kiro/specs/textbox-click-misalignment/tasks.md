# Implementation Plan

## Overview

Fix the textbox click misalignment bug caused by CSS `transform: scale()` being applied to the Fabric.js canvas wrapper without updating Fabric.js's internal coordinate system. Replace the CSS transform approach with Fabric.js's native zoom API (`canvas.setZoom()`) to ensure pointer coordinates correctly map to visual object positions at all scale factors.

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Pointer-to-Object Misalignment Under CSS Scale
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate pointer coordinates diverge from visual object positions when CSS transform scale is applied
  - **Scoped PBT Approach**: Generate scale factors in (0, 1.0) and verify that `canvas.getPointer()` correctly maps visual positions to logical object coordinates after `recalculateLayout()` applies scaling
  - Test that when `recalculateLayout()` applies `scale < 1.0`, a pointer event at the visual position of an object (logical position × scale) resolves to that object's logical coordinates (from Bug Condition: `isBugCondition(input)` where `canvasScale < 1.0 AND cssTransformApplied AND NOT fabricViewportTransformUpdated`)
  - Use `fast-check` to generate arbitrary scale values in (0, 1.0) and object positions, then assert pointer mapping matches visual positions
  - Create test file: `responsiveManager.bugcondition.test.js`
  - Mock Fabric.js canvas with `getWidth()`, `getHeight()`, `setZoom()`, `setDimensions()`, and track whether CSS transform or native zoom is used
  - Run test on UNFIXED code - expect FAILURE (this confirms the bug exists because CSS transform is applied without updating Fabric.js viewportTransform)
  - Document counterexamples found (e.g., "At scale 0.5, clicking visual position (100, 100) maps to logical (200, 200) instead of (100, 100) in Fabric.js coordinate space")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Scale Clamping and Non-Pointer Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (scale = 1.0 cases and scale clamping behavior)
  - Observe: When container is large enough that computed scale ≥ 1.0, scale is clamped to exactly 1.0
  - Observe: `getCanvasScale()` returns the computed and clamped scale value
  - Observe: When canvasWidth or canvasHeight is 0, `recalculateLayout()` returns early without modifying state
  - Observe: When availableWidth or availableHeight ≤ 0, `recalculateLayout()` returns early without modifying state
  - Write property-based tests with `fast-check`:
    - For all container dimensions where `min(availableWidth/canvasWidth, availableHeight/canvasHeight) >= 1.0`, the resulting scale is exactly 1.0 (max clamping preserved)
    - For all valid inputs, `getCanvasScale()` returns a value in (0, 1.0] (never exceeds 1.0, never zero or negative)
    - For all canvas dimensions of 0, no scaling is applied (early return)
  - Create test file: `responsiveManager.preservation.test.js`
  - Verify tests pass on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.6_

- [x] 3. Fix for textbox click misalignment

  - [x] 3.1 Implement the fix in `responsiveManager.js`
    - Remove CSS `transform: scale(${scale})` application on the Fabric.js wrapper element
    - Remove `transformOrigin: 'center center'` style assignment
    - Replace with `this._canvas.setZoom(scale)` to update Fabric.js viewportTransform
    - After setZoom, set canvas element dimensions to reflect scaled size: use `this._canvas.setDimensions({ width: canvasWidth * scale, height: canvasHeight * scale }, { cssOnly: true })` to change only rendered size without altering logical dimensions
    - Ensure canvas logical dimensions (`getWidth()`, `getHeight()`) remain at template-defined values for object positioning and export
    - _Bug_Condition: isBugCondition(input) where canvasScale < 1.0 AND cssTransformApplied AND NOT fabricViewportTransformUpdated_
    - _Expected_Behavior: canvas.setZoom(scale) updates viewportTransform so getPointer() correctly maps visual positions to logical coordinates_
    - _Preservation: Scale clamping to max 1.0, early returns for invalid dimensions, canvas logical dimensions unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.3, 3.4, 3.5, 3.6_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Pointer-to-Object Alignment Under Zoom
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior: for any scale < 1.0, pointer events at visual positions correctly resolve to objects at those logical coordinates
    - Run bug condition exploration test from step 1 (`responsiveManager.bugcondition.test.js`)
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed - setZoom ensures coordinate consistency)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Scale Clamping and Non-Pointer Behavior
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2 (`responsiveManager.preservation.test.js`)
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions in scale clamping, early returns, and non-pointer behavior)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full test suite with `npx vitest run`
  - Ensure all property-based tests pass (both bug condition and preservation)
  - Ensure no regressions in existing tests (`toolbar.font-preservation.test.js`, `toolbar.font-verification.test.js`)
  - Ask the user if questions arise


## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2"] },
    { "id": 1, "tasks": ["3.1"] },
    { "id": 2, "tasks": ["3.2", "3.3"] },
    { "id": 3, "tasks": ["4"] }
  ]
}
```

## Notes

- Test framework: vitest with jsdom environment
- Property-based testing library: fast-check (already in devDependencies)
- Main file to modify: `responsiveManager.js`
- Bug condition test file: `responsiveManager.bugcondition.test.js`
- Preservation test file: `responsiveManager.preservation.test.js`
- The exploration test (task 1) is expected to FAIL on unfixed code — this confirms the bug exists
- The preservation test (task 2) is expected to PASS on unfixed code — this confirms baseline behavior
- After the fix (task 3.1), both tests should PASS
