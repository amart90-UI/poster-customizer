# Font Unavailable Fix — Bugfix Design

## Overview

The poster customizer's font dropdown incorrectly marks both custom fonts ("The Serif Hand Black" and "The Serif Hand Extrablack") as "(unavailable)" because `_verifyFontLoading()` in `toolbar.js` relies on `document.fonts.check()` after `document.fonts.ready`. With `font-display: swap`, fonts are only fetched on-demand when text actually renders with them. Since no DOM text uses these fonts at verification time, `check()` returns false.

The fix replaces the passive check with an active `document.fonts.load()` call that forces the browser to fetch and parse the font before verifying availability. This is a targeted, single-method change that preserves all existing failure-detection and fallback behavior for genuinely missing fonts.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — `document.fonts.check()` is called for a font declared with `font-display: swap` before any DOM element renders text in that font, causing a false-negative "not loaded" result
- **Property (P)**: The desired behavior — fonts with valid `@font-face` declarations and existing `.woff2` files are recognized as loaded and shown without "(unavailable)" in the dropdown
- **Preservation**: Existing fallback behavior for genuinely missing/corrupted fonts, toolbar enable/disable logic, font selection application, and history/persistence integration must remain unchanged
- **`_verifyFontLoading(fonts)`**: The method in `toolbar.js` that checks whether each font in the provided array loaded successfully and marks failures in the dropdown
- **`document.fonts.load()`**: A Font Loading API method that actively triggers the browser to load a specified font, returning a Promise that resolves when loading completes (or rejects/resolves empty on failure)
- **`document.fonts.check()`**: A Font Loading API method that synchronously returns whether a font matching a given specification is available — only returns true if the font data is already loaded into memory
- **`font-display: swap`**: A CSS descriptor that tells the browser to use a fallback font immediately and swap to the custom font once loaded — critically, the font is only fetched when text using it is rendered

## Bug Details

### Bug Condition

The bug manifests when the toolbar initializes and calls `_verifyFontLoading()` to validate custom fonts. The method awaits `document.fonts.ready` and then calls `document.fonts.check()` for each font family. Because the fonts use `font-display: swap` and no visible DOM text has yet rendered in these fonts, the browser has not fetched the font data. `check()` returns `false`, causing valid fonts to be incorrectly marked as unavailable.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { fontFamily: string, fontFileExists: boolean, domTextRendered: boolean }
  OUTPUT: boolean
  
  RETURN input.fontFileExists == true
         AND input.domTextRendered == false
         AND fontDeclarationUsesFontDisplaySwap(input.fontFamily)
         AND verificationUsesCheckOnly(input.fontFamily)
END FUNCTION
```

### Examples

- **"The Serif Hand Black" at startup**: Font file exists at `fonts/TheSerifHand-Black.woff2`, declared in `fonts.css` with `font-display: swap`. No DOM text renders in this font before verification. `document.fonts.check('16px "The Serif Hand Black"')` returns `false`. **Expected**: font recognized as loaded. **Actual**: marked "(unavailable)".
- **"The Serif Hand Extrablack" at startup**: Same scenario — font file exists, `font-display: swap`, no pre-rendered text. `check()` returns `false`. **Expected**: font recognized as loaded. **Actual**: marked "(unavailable)".
- **A genuinely missing font**: If `TheSerifHand-Black.woff2` were deleted, both `document.fonts.load()` and `document.fonts.check()` would correctly fail. The font should still be marked unavailable. **Expected and actual**: marked "(unavailable)".
- **A font already rendered in DOM**: If a hidden element rendered text in "The Serif Hand Black" before verification, `check()` would return `true`. The bug would not manifest. This confirms the issue is timing/on-demand loading.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- When a font file is genuinely missing or corrupted (404, network error), the font must still be marked "(unavailable)" with a warning toast and serif fallback applied
- Font controls must remain disabled when no text element is selected
- Selecting a font from the dropdown must apply it to the active textbox and fire `object:modified`
- If `fonts.json` cannot be fetched, the hardcoded fallback font list must still be used
- The dropdown must still be populated from `fonts.json` before verification runs
- Toast notifications must still display via the Notifications module (or native fallback)

**Scope:**
All inputs where fonts are genuinely unavailable (network failure, deleted files, corrupted data) should trigger the existing failure path exactly as before. The fix only changes how the browser is asked to load fonts — it does not change the response to actual loading failures.

## Hypothesized Root Cause

Based on the bug description, the root cause is:

1. **Passive check with on-demand loading**: `document.fonts.check()` only reports `true` if font data is already in memory. With `font-display: swap`, the browser defers fetching until text is rendered. Since no DOM text uses the custom fonts at verification time, the font data is never fetched, and `check()` always returns `false`.

2. **`document.fonts.ready` is insufficient**: The `ready` promise resolves when all *currently queued* font loads complete. Since no loads are queued (no text rendered in the font), it resolves immediately — before the fonts are actually loaded.

3. **No active loading trigger**: The code does not call `document.fonts.load()`, which would explicitly tell the browser to fetch and parse the font regardless of whether any DOM text uses it.

The fix is to replace the passive `document.fonts.check()` with an active `document.fonts.load()` call. If `load()` resolves with a non-empty array, the font is available. If it resolves with an empty array or rejects, the font is genuinely unavailable.

## Correctness Properties

Property 1: Bug Condition — Valid Fonts Are Recognized As Loaded

_For any_ font where the font family is declared in `fonts.css` with a valid `@font-face` rule and the corresponding `.woff2` file exists and is fetchable, the fixed `_verifyFontLoading` function SHALL successfully load the font and NOT mark it as unavailable in the dropdown, NOT show a warning toast, and NOT apply a serif fallback.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation — Genuinely Missing Fonts Still Detected

_For any_ font where the font file is genuinely missing, corrupted, or unfetchable (404, network error), the fixed `_verifyFontLoading` function SHALL produce the same result as the original function — marking the font as "(unavailable)", showing a warning toast, and applying the serif fallback — preserving the existing failure-detection behavior.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `toolbar.js`

**Function**: `_verifyFontLoading(fonts)`

**Specific Changes**:
1. **Replace passive check with active load**: Instead of calling `document.fonts.check()` after `document.fonts.ready`, use `document.fonts.load()` for each font to actively trigger the browser to fetch the font data.

2. **Use load result to determine availability**: `document.fonts.load(fontSpec)` returns a Promise that resolves to an array of loaded FontFace objects. If the array is non-empty, the font loaded successfully. If empty or if the promise rejects, the font is unavailable.

3. **Remove reliance on `document.fonts.ready`**: Since `document.fonts.load()` handles the loading and waiting internally, the initial `await document.fonts.ready` is no longer needed (though keeping it is harmless).

4. **Preserve all downstream logic**: The `failedFonts` array, dropdown marking, toast notification, and `_applyFontFallback()` call must remain unchanged — only the determination of *which* fonts failed changes.

5. **Handle load rejection gracefully**: Wrap each `document.fonts.load()` call in a try/catch so that a rejected promise (e.g., for an invalid font specification) is treated as a loading failure rather than crashing the verification loop.

**Proposed implementation:**
```javascript
async _verifyFontLoading(fonts) {
    if (!document.fonts || !fonts.length) return;

    try {
        const failedFonts = [];

        for (const font of fonts) {
            const family = font.family;
            try {
                const loaded = await document.fonts.load(`16px "${family}"`);
                if (!loaded || loaded.length === 0) {
                    failedFonts.push(family);
                }
            } catch (err) {
                // Font load rejected — treat as unavailable
                failedFonts.push(family);
            }
        }

        if (failedFonts.length > 0) {
            console.warn('Toolbar: The following fonts failed to load:', failedFonts);

            const options = this.els.fontFamily.querySelectorAll('option');
            options.forEach((option) => {
                if (failedFonts.includes(option.value)) {
                    option.textContent = `${option.value} (unavailable)`;
                    option.dataset.unavailable = 'true';
                }
            });

            this._showToast(
                'Custom font could not be loaded. Using default font.',
                'warning'
            );

            this._applyFontFallback(failedFonts);
        }
    } catch (err) {
        console.warn('Toolbar: Font verification failed', err);
    }
}
```

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate calling `_verifyFontLoading()` with valid fonts and observe whether `document.fonts.check()` returns false despite the font files being present. Run these tests on the UNFIXED code to confirm that the passive check approach is the root cause.

**Test Cases**:
1. **Valid Font Check Returns False**: Call `_verifyFontLoading([{family: "The Serif Hand Black"}])` on unfixed code and assert that the dropdown option gets "(unavailable)" appended (will fail = demonstrates bug)
2. **Both Fonts Marked Unavailable**: Call `_verifyFontLoading()` with both fonts on unfixed code and verify both are added to `failedFonts` (demonstrates bug for all custom fonts)
3. **Toast Shown Incorrectly**: Verify that `_showToast` is called with warning message on unfixed code even though font files exist (demonstrates user-visible impact)
4. **Fallback Applied Incorrectly**: Verify that `_applyFontFallback` is called on unfixed code even though fonts are valid (demonstrates canvas corruption)

**Expected Counterexamples**:
- `document.fonts.check('16px "The Serif Hand Black"')` returns `false` despite valid `.woff2` file
- Cause: `font-display: swap` defers loading; no DOM text triggers the fetch before `check()` is called

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds (valid fonts with `font-display: swap` not yet rendered), the fixed function produces the expected behavior (fonts recognized as loaded).

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := _verifyFontLoading_fixed(input.fonts)
  ASSERT dropdown options do NOT contain "(unavailable)"
  ASSERT _showToast was NOT called
  ASSERT _applyFontFallback was NOT called
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (genuinely missing fonts), the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT _verifyFontLoading_fixed(input.fonts) marks missing fonts as "(unavailable)"
  ASSERT _showToast IS called with warning
  ASSERT _applyFontFallback IS called with the missing fonts
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It can generate many font configurations (various combinations of valid/invalid fonts) automatically
- It catches edge cases such as empty font arrays, fonts with special characters in names, or mixed valid/invalid font lists
- It provides strong guarantees that the failure-detection path is unchanged for all genuinely missing fonts

**Test Plan**: Observe behavior on UNFIXED code first for genuinely missing fonts (404 scenarios), then write property-based tests capturing that behavior to ensure the fix preserves it.

**Test Cases**:
1. **Missing Font Still Detected**: Mock `document.fonts.load()` to resolve with empty array for a missing font, verify "(unavailable)" is applied
2. **Network Error Still Detected**: Mock `document.fonts.load()` to reject for a network error, verify "(unavailable)" is applied
3. **Mixed Valid/Invalid Fonts**: Provide a list with one valid and one invalid font, verify only the invalid one is marked unavailable
4. **Empty Font List**: Call `_verifyFontLoading([])` and verify no errors thrown and no toasts shown

### Unit Tests

- Test `_verifyFontLoading` with mocked `document.fonts.load()` resolving with FontFace objects (valid fonts)
- Test `_verifyFontLoading` with mocked `document.fonts.load()` resolving with empty array (missing font)
- Test `_verifyFontLoading` with mocked `document.fonts.load()` rejecting (network error)
- Test edge case: empty fonts array passed to `_verifyFontLoading`
- Test edge case: `document.fonts` undefined (older browser)

### Property-Based Tests

- Generate random font lists (mix of valid/invalid families) and verify that only fonts where `load()` resolves empty are marked unavailable
- Generate random font family names and verify the method handles special characters, long names, and empty strings without crashing
- Test that for any input where `load()` succeeds (resolves non-empty), the dropdown option text equals exactly the font family name (no suffix)

### Integration Tests

- Load the full toolbar with real font files and verify the dropdown shows font names without "(unavailable)"
- Load the toolbar with a deliberately corrupted/missing font file and verify it IS marked "(unavailable)"
- Select a custom font from the dropdown after successful verification and confirm it is applied to a canvas textbox
- Verify that the warning toast is NOT shown when all fonts load successfully
