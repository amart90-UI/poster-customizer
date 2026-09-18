# Implementation Plan

## Overview

Fix the canvas background misalignment bug where Fabric.js 6's `backgroundImage` renders independently of the viewport transform when `canvas.setZoom()` is used. The fix promotes the background from the special `backgroundImage` slot to a regular non-interactive canvas object at z-index 0, ensuring the viewport transform applies uniformly to background and objects.

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Background-Object Misalignment Under Zoom
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the background image does not participate in the viewport transform at scale < 1.0
  - **Scoped PBT Approach**: Generate random scale values in (0.01, 1.0) and random object positions within (0,0)-(1100,1700); for each, verify that the rendered position of the background pixel at the object's logical coordinates and the object's rendered position differ by no more than 1 CSS pixel on each axis
  - **Bug Condition from design**: `isBugCondition(input)` returns true when `input.scale < 1.0 AND input.scale > 0.0 AND input.backgroundImage IS NOT NULL AND backgroundImage IS SET via canvas.set('backgroundImage', ...) AND backgroundImage DOES NOT participate in viewportTransform`
  - **Expected Behavior Assertion**: For any object at logical (x, y) with zoom `scale`, rendered positions of background pixel at (x,y) and object position must differ by ≤ 1 CSS pixel on each axis (i.e., both should render at approximately `logicalPosition × scale`)
  - Create test file `responsiveManager.bugcondition.test.js` (or update existing)
  - Set up canvas with `canvas.set('backgroundImage', bgImage)` and `canvas.setZoom(scale)` for scale < 1.0
  - Place text object at known logical coordinates
  - Assert that background rendered width equals `1100 × scale` and height equals `1700 × scale`
  - Assert rendered offset between background pixel at logical (x,y) and object rendered position ≤ 1px
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists because backgroundImage renders at full size while objects scale)
  - Document counterexamples found: e.g., "At scale 0.5, background renders at 1100×1700 but object at (550,850) renders at (275,425) — offset of 275px horizontal, 425px vertical"
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 2.1, 2.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Pointer Mapping and Object Coordinate Preservation
  - **IMPORTANT**: Follow observation-first methodology
  - **Step 1 - Observe**: Run UNFIXED code and verify that `canvas.getPointer(event)` correctly maps screen coordinates to logical coordinates at various scales (this should work correctly even with the bug)
  - **Step 2 - Observe**: Verify that object logical coordinates (left, top, width, height) remain in the 1100×1700 space regardless of display scale
  - **Step 3 - Observe**: Verify that export produces output at logical resolution independent of display scale
  - **Step 4 - Write PBT**: Write property-based tests that generate random scale values in (0.01, 1.0] and random click positions, asserting:
    - `getPointer()` returns logical coordinates = screen coordinates / scale (within tolerance)
    - Object positions stored after interaction remain in logical coordinate space
    - Export dimensions equal logical dimensions × multiplier regardless of current zoom
  - **Preservation Requirements from design**: Pointer coordinate mapping, logical coordinate storage, export at logical resolution, responsive scaling formula
  - Create/update test file `responsiveManager.preservation.test.js`
  - Verify tests PASS on UNFIXED code (these behaviors work correctly before the fix)
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for canvas background misalignment under zoom

  - [x] 3.1 Modify `templateManager.js` to promote background to regular object
    - Replace `canvas.set('backgroundImage', bgImage)` with adding bgImage as a regular canvas object
    - Configure background image as non-interactive: `selectable: false`, `evented: false`, `excludeFromExport: false`
    - Set position: `left: 0`, `top: 0`, `scaleX: 1`, `scaleY: 1`
    - Tag with custom property `isBackgroundLayer: true` for identification by other modules
    - Insert at z-index 0 using `canvas.insertAt(bgImage, 0)` or `canvas.sendObjectToBack(bgImage)` to ensure it renders behind all text objects
    - Remove the `canvas.set('backgroundImage', bgImage)` call
    - _Bug_Condition: isBugCondition(input) where backgroundImage is set via canvas.set('backgroundImage', ...) and does not participate in viewportTransform_
    - _Expected_Behavior: Background renders at same effective scale as objects; rendered width = 1100 × scale, height = 1700 × scale_
    - _Preservation: Template loading must still set up background and text objects from template.json; object logical coordinates unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.5_

  - [x] 3.2 Update `editor.js` to guard background layer from interaction
    - In the `object:moving` constraint handler, add early return if `obj.isBackgroundLayer === true`
    - In the `onObjectScaling` handler, add early return if `obj.isBackgroundLayer === true`
    - This prevents the background layer from being inadvertently moved or scaled by user interactions
    - _Preservation: Background must remain fixed at (0,0) with scale 1×1 in logical space_
    - _Requirements: 3.1, 3.3_

  - [x] 3.3 Verify `exportManager.js` handles promoted background correctly
    - Confirm that `canvas.toDataURL()` includes the background object in export (since `excludeFromExport: false`)
    - Verify that export produces correct output at logical resolution: if zoom is not 1.0 at export time, consider temporarily resetting zoom to 1.0 before `toDataURL()` and restoring after, or verify Fabric.js handles this correctly with the multiplier parameter
    - Test that exported image dimensions equal 1100×1700 × multiplier with background and objects aligned
    - _Preservation: Export must produce images at logical resolution with correct alignment regardless of display scale_
    - _Requirements: 3.4_

  - [x] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Background-Object Alignment Under Zoom
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior: background and objects align within 1px at all scales
    - When this test passes, it confirms the viewport transform now applies uniformly to both background and objects
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed - background now participates in viewport transform)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Pointer Mapping and Object Coordinate Preservation
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions in pointer mapping, logical coordinates, or export)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full test suite with `npx vitest --run`
  - Ensure bug condition test (Property 1) passes — background aligns with objects at all scales
  - Ensure preservation tests (Property 2) pass — pointer mapping, coordinates, and export unchanged
  - Ensure no other test regressions across the project
  - Ask the user if questions arise


## Task Dependency Graph

```json
{
  "waves": [
    {"tasks": ["1", "2"]},
    {"tasks": ["3.1"]},
    {"tasks": ["3.2", "3.3", "3.4", "3.5"]},
    {"tasks": ["4"]}
  ]
}
```

## Notes

- The `responsiveManager.js` requires NO code changes — since the background becomes a regular canvas object, `canvas.setZoom(scale)` automatically applies the viewport transform to it.
- The background object is tagged with `isBackgroundLayer: true` so other modules (export, persistence, history) can identify it.
- Export may need a temporary zoom reset to 1.0 before `toDataURL()` if Fabric.js applies the current viewport transform to the export output — verify during task 3.3.
- Test files: `responsiveManager.bugcondition.test.js` (Property 1) and `responsiveManager.preservation.test.js` (Property 2).
