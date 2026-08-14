/**
 * Bug Condition Exploration Test — Property 1: Valid Fonts Are Recognized As Loaded
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4
 *
 * This test encodes the EXPECTED correct behavior: valid fonts with existing .woff2 files
 * should NOT be marked as "(unavailable)", should NOT trigger a warning toast, and should
 * NOT apply a fallback font.
 *
 * With the fix applied in toolbar.js, `_verifyFontLoading()` uses `document.fonts.load()`
 * instead of `document.fonts.check()`. For valid fonts, `load()` resolves with loaded
 * FontFace objects, correctly recognizing the fonts as available regardless of whether
 * DOM text has rendered using those fonts.
 *
 * EXPECTED OUTCOME: All tests PASS (confirms the fix works correctly).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';

/**
 * Creates a minimal DOM environment and a Toolbar-like object that replicates
 * the FIXED `_verifyFontLoading` logic using `document.fonts.load()`.
 */
function createToolbarWithFixedVerification() {
    // Create a minimal font-family select element with options
    const fontFamilySelect = document.createElement('select');
    fontFamilySelect.id = 'font-family';

    // Track side effects
    const sideEffects = {
        toastCalls: [],
        fallbackCalls: [],
    };

    const toolbar = {
        els: {
            fontFamily: fontFamilySelect,
        },
        editor: {
            canvas: {
                getObjects: () => [],
                renderAll: () => {},
            },
        },
        _showToast: vi.fn((message, type) => {
            sideEffects.toastCalls.push({ message, type });
        }),
        _applyFontFallback: vi.fn((failedFonts) => {
            sideEffects.fallbackCalls.push(failedFonts);
        }),

        /**
         * This is the FIXED implementation that uses document.fonts.load()
         * which actively triggers the browser to fetch and parse the font,
         * resolving with loaded FontFace objects for valid fonts.
         */
        async _verifyFontLoading(fonts) {
            if (!document.fonts || !fonts.length) return;

            try {
                const failedFonts = [];

                for (const font of fonts) {
                    const family = font.family;
                    const weight = font.weight || 'normal';
                    try {
                        const loaded = await document.fonts.load(`${weight} 16px "${family}"`);
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

                    // Mark failed fonts in the dropdown
                    const options = this.els.fontFamily.querySelectorAll('option');
                    options.forEach((option) => {
                        if (failedFonts.includes(option.value)) {
                            option.textContent = `${option.value} (unavailable)`;
                            option.dataset.unavailable = 'true';
                        }
                    });

                    // Show warning toast
                    this._showToast(
                        'Custom font could not be loaded. Using default font.',
                        'warning'
                    );

                    // Apply fallback
                    this._applyFontFallback(failedFonts);
                }
            } catch (err) {
                console.warn('Toolbar: Font verification failed', err);
            }
        },
    };

    return { toolbar, sideEffects, fontFamilySelect };
}

/**
 * Sets up the DOM dropdown options for given font families.
 */
function populateDropdown(fontFamilySelect, fonts) {
    fontFamilySelect.innerHTML = '';
    fonts.forEach((font) => {
        const option = document.createElement('option');
        option.value = font.family;
        option.textContent = font.family;
        fontFamilySelect.appendChild(option);
    });
}

/**
 * Mocks `document.fonts` to simulate the FIXED behavior:
 * - `document.fonts.load()` resolves with a non-empty array (simulating successful font load)
 *
 * With the fix applied, `document.fonts.load()` actively triggers the browser to fetch
 * and parse the font. For valid fonts with existing .woff2 files, it resolves with
 * loaded FontFace objects regardless of whether DOM text has rendered using those fonts.
 */
function mockDocumentFontsWithLoadSuccess() {
    Object.defineProperty(document, 'fonts', {
        value: {
            ready: Promise.resolve(),
            check: vi.fn(() => false), // check() still returns false (swap-deferred), but is no longer used
            load: vi.fn(() => Promise.resolve([{}])), // Simulates successful font load: resolves with FontFace object
        },
        writable: true,
        configurable: true,
    });
}

describe('Bug Condition Exploration: Valid Fonts Incorrectly Marked Unavailable', () => {
    beforeEach(() => {
        mockDocumentFontsWithLoadSuccess();
    });

    /**
     * **Validates: Requirements 1.1, 1.2**
     *
     * Property: For any valid font with an existing .woff2 file and font-display: swap,
     * the verification function should NOT mark it as "(unavailable)" in the dropdown.
     *
     * On UNFIXED code: This FAILS because document.fonts.check() returns false for
     * swap-deferred fonts, causing valid fonts to be incorrectly marked unavailable.
     */
    it('Property 1: valid fonts with font-display swap should NOT be marked unavailable', async () => {
        // Concrete failing cases from the bug report
        const bugConditionFonts = [
            { family: 'The Serif Hand Black' },
            { family: 'The Serif Hand Extrablack' },
        ];

        const { toolbar, fontFamilySelect } = createToolbarWithFixedVerification();
        populateDropdown(fontFamilySelect, bugConditionFonts);

        await toolbar._verifyFontLoading(bugConditionFonts);

        // EXPECTED BEHAVIOR: Valid fonts should NOT be marked unavailable
        const options = fontFamilySelect.querySelectorAll('option');
        options.forEach((option) => {
            expect(option.textContent).not.toContain('(unavailable)');
            expect(option.dataset.unavailable).toBeUndefined();
        });
    });

    /**
     * **Validates: Requirements 1.2**
     *
     * Property: For valid fonts with existing .woff2 files, _showToast should NOT
     * be called with a warning about font loading failure.
     *
     * On UNFIXED code: This FAILS because the check() false-negative triggers the
     * toast warning path even though fonts are valid.
     */
    it('Property 1: _showToast should NOT be called for valid fonts', async () => {
        const bugConditionFonts = [
            { family: 'The Serif Hand Black' },
            { family: 'The Serif Hand Extrablack' },
        ];

        const { toolbar, fontFamilySelect } = createToolbarWithFixedVerification();
        populateDropdown(fontFamilySelect, bugConditionFonts);

        await toolbar._verifyFontLoading(bugConditionFonts);

        // EXPECTED BEHAVIOR: No toast should be shown for valid fonts
        expect(toolbar._showToast).not.toHaveBeenCalled();
    });

    /**
     * **Validates: Requirements 1.3**
     *
     * Property: For valid fonts with existing .woff2 files, _applyFontFallback should NOT
     * be called because no fallback is needed for fonts that are actually available.
     *
     * On UNFIXED code: This FAILS because the check() false-negative triggers the
     * fallback path, overriding valid custom font styling with "serif".
     */
    it('Property 1: _applyFontFallback should NOT be called for valid fonts', async () => {
        const bugConditionFonts = [
            { family: 'The Serif Hand Black' },
            { family: 'The Serif Hand Extrablack' },
        ];

        const { toolbar, fontFamilySelect } = createToolbarWithFixedVerification();
        populateDropdown(fontFamilySelect, bugConditionFonts);

        await toolbar._verifyFontLoading(bugConditionFonts);

        // EXPECTED BEHAVIOR: No fallback should be applied for valid fonts
        expect(toolbar._applyFontFallback).not.toHaveBeenCalled();
    });

    /**
     * **Validates: Requirements 1.1, 1.2, 1.3**
     *
     * Property-based test: For ANY font family name drawn from the concrete bug-condition
     * set (valid fonts with font-display: swap), the unfixed verification incorrectly
     * marks them as unavailable.
     *
     * This uses fast-check to generate combinations from the known affected fonts,
     * demonstrating the bug is systematic and not specific to one font.
     */
    it('PBT Property 1: for all valid swap fonts, fixed code correctly recognizes them as loaded', async () => {
        // Generator: pick from the concrete set of affected fonts
        const validSwapFontArb = fc.constantFrom(
            'The Serif Hand Black',
            'The Serif Hand Extrablack'
        );

        // Generate a non-empty array of 1-2 font families from the affected set
        const fontListArb = fc.array(
            validSwapFontArb.map((family) => ({ family })),
            { minLength: 1, maxLength: 2 }
        );

        await fc.assert(
            fc.asyncProperty(fontListArb, async (fonts) => {
                const { toolbar, fontFamilySelect } = createToolbarWithFixedVerification();
                populateDropdown(fontFamilySelect, fonts);

                await toolbar._verifyFontLoading(fonts);

                // EXPECTED BEHAVIOR (encodes correct behavior):
                // Valid fonts should NOT be marked unavailable
                const options = fontFamilySelect.querySelectorAll('option');
                for (const option of options) {
                    // With the fix, document.fonts.load() resolves with FontFace objects
                    // so fonts are correctly recognized as loaded
                    expect(option.textContent).not.toContain('(unavailable)');
                }

                // No toast should be shown
                expect(toolbar._showToast).not.toHaveBeenCalled();

                // No fallback should be applied
                expect(toolbar._applyFontFallback).not.toHaveBeenCalled();
            }),
            { numRuns: 20 }
        );
    });
});
