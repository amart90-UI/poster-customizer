# Implementation Plan

## Overview

Fix the font verification logic in `toolbar.js` where `_verifyFontLoading()` incorrectly marks valid custom fonts as "(unavailable)" due to using passive `document.fonts.check()` instead of active `document.fonts.load()`. The fix follows the bug condition methodology: explore the bug, preserve existing behavior, implement the fix, and validate.

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Valid Fonts Incorrectly Marked Unavailable
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate `document.fonts.check()` returns false for valid fonts with `font-display: swap` when no DOM text has rendered in those fonts
  - **Scoped PBT Approach**: Scope the property to concrete failing cases: font families "The Serif Hand Black" and "The Serif Hand Extrablack" with valid `.woff2` files present
  - Create a test file (e.g., `toolbar.font-verification.test.js`) that tests `_verifyFontLoading()`
  - Mock `document.fonts.check()` to return `false` (simulating the swap-deferred-load behavior) while font files exist
  - Test that `_verifyFontLoading([{family: "The Serif Hand Black"}])` on UNFIXED code marks the font "(unavailable)" in the dropdown
  - Test that `_showToast` is called with warning message even though font file exists
  - Test that `_applyFontFallback` is called even though fonts are valid
  - The test assertions encode expected behavior: valid fonts should NOT be marked unavailable, NO toast shown, NO fallback applied
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists because `check()` returns false for valid swap fonts)
  - Document counterexamples found: `document.fonts.check('16px "The Serif Hand Black"')` returns `false` despite valid `.woff2` file due to `font-display: swap` deferring load
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Genuinely Missing Fonts Still Detected
  - **IMPORTANT**: Follow observation-first methodology
  - **IMPORTANT**: Write these tests BEFORE implementing the fix
  - Observe behavior on UNFIXED code for genuinely missing/corrupted fonts (non-bug-condition cases where `isBugCondition` returns false)
  - Observe: When `document.fonts.check()` returns `false` for a genuinely missing font (file does not exist), the font IS correctly marked "(unavailable)"
  - Observe: When font loading fails, `_showToast` IS called with "Custom font could not be loaded. Using default font." warning
  - Observe: When font loading fails, `_applyFontFallback` IS called with the list of failed fonts
  - Observe: When an empty font list is passed, no errors are thrown and no toasts are shown
  - Observe: When `document.fonts` is undefined (older browser), the method returns gracefully
  - Write property-based tests: for all genuinely missing/invalid fonts (where load would fail), the method marks them unavailable, shows toast, and applies fallback
  - Write property-based tests: for any random font family names that fail to load, the method handles special characters and edge cases without crashing
  - Write property-based tests: for empty font arrays, no side effects occur
  - Verify tests PASS on UNFIXED code (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for font verification using active loading instead of passive check

  - [x] 3.1 Implement the fix in `toolbar.js` `_verifyFontLoading()` method
    - Replace `document.fonts.check()` with `document.fonts.load()` for each font family
    - Use `await document.fonts.load('16px "fontFamily"')` to actively trigger font fetching
    - Determine availability by checking if resolved array is non-empty (loaded successfully) or empty/rejected (genuinely unavailable)
    - Wrap each `document.fonts.load()` call in try/catch to handle rejections gracefully
    - Preserve all downstream logic: `failedFonts` array, dropdown marking with "(unavailable)", toast notification via `_showToast`, and `_applyFontFallback()` call
    - Remove or retain `await document.fonts.ready` (harmless but no longer necessary)
    - _Bug_Condition: isBugCondition(input) where input.fontFileExists == true AND input.domTextRendered == false AND fontDeclarationUsesFontDisplaySwap(input.fontFamily) AND verificationUsesCheckOnly(input.fontFamily)_
    - _Expected_Behavior: For valid fonts, document.fonts.load() resolves with non-empty array; font NOT marked unavailable, NO toast, NO fallback_
    - _Preservation: Genuinely missing/corrupted fonts still detected via empty load() result or rejection; marked unavailable with toast and fallback applied_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Valid Fonts Are Recognized As Loaded
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior: valid fonts should NOT be marked unavailable
    - With the fix applied, `document.fonts.load()` will resolve with loaded FontFace objects for valid fonts
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed - valid fonts with `font-display: swap` are now correctly recognized)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Genuinely Missing Fonts Still Detected
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions - genuinely missing fonts are still correctly detected)
    - Confirm all preservation tests still pass after fix (failure detection unchanged)

- [x] 4. Checkpoint - Ensure all tests pass
  - Run the full test suite to confirm both exploration and preservation tests pass
  - Verify no other tests were broken by the change
  - Confirm the fix is contained to `_verifyFontLoading()` method only
  - Ensure all tests pass, ask the user if questions arise

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

- Tasks 1 and 2 are independent and can be worked on in parallel (both run on unfixed code)
- Task 3.1 (the actual fix) depends on understanding gained from tasks 1 and 2
- Tasks 3.2 and 3.3 verify the fix against the tests written in tasks 1 and 2
- The fix is a single-method change in `toolbar.js` — no other files should be modified
- Property-based tests use random font configurations to strengthen preservation guarantees
