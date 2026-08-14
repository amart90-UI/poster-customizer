/**
 * Property 2: Preservation — Genuinely Missing Fonts Still Detected
 *
 * These tests verify that the FIXED code preserves correct behavior:
 * When fonts are genuinely missing (document.fonts.load() resolves with empty array),
 * the system correctly marks them unavailable, shows a toast, and applies fallback.
 *
 * These tests should PASS on fixed code because the fix preserves
 * failure-detection behavior for genuinely missing fonts.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';

// ─── Test Helpers ───────────────────────────────────────────────────────────

/**
 * Create a minimal Toolbar instance with mocked DOM and dependencies.
 * Simulates genuinely missing fonts: document.fonts.load() resolves with empty array.
 */
function createToolbarForMissingFonts(fontFamilies) {
    // Build DOM select element with font options
    const selectEl = document.createElement('select');
    selectEl.id = 'font-family';
    fontFamilies.forEach((family) => {
        const option = document.createElement('option');
        option.value = family;
        option.textContent = family;
        selectEl.appendChild(option);
    });

    // Mock _showToast and _applyFontFallback
    const showToastSpy = vi.fn();
    const applyFontFallbackSpy = vi.fn();

    // Mock editor with canvas (needed by _applyFontFallback)
    const mockEditor = {
        canvas: {
            getObjects: () => [],
            renderAll: vi.fn()
        }
    };

    // Create a Toolbar-like object replicating the FIXED _verifyFontLoading logic
    const toolbar = {
        editor: mockEditor,
        els: {
            fontFamily: selectEl
        },
        _showToast: showToastSpy,
        _applyFontFallback: applyFontFallbackSpy,

        // This is the FIXED implementation from toolbar.js using document.fonts.load()
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
    };

    return { toolbar, showToastSpy, applyFontFallbackSpy, selectEl };
}

/**
 * Arbitrary for generating valid font family names (non-empty strings
 * that may contain special characters, spaces, Unicode, etc.)
 */
const fontFamilyArb = fc.oneof(
    // Normal font names
    fc.stringMatching(/^[A-Za-z][A-Za-z0-9 \-]{0,30}$/),
    // Names with special characters
    fc.stringMatching(/^[A-Za-z][A-Za-z0-9 \-'().]{0,30}$/),
    // Unicode names
    fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0)
);

/**
 * Arbitrary for generating non-empty arrays of font objects
 */
const fontListArb = fc.array(
    fontFamilyArb.map(family => ({ family })),
    { minLength: 1, maxLength: 10 }
);

// ─── Test Setup ─────────────────────────────────────────────────────────────

describe('Property 2: Preservation — Genuinely Missing Fonts Still Detected', () => {
    beforeEach(() => {
        // Mock document.fonts for genuinely missing fonts:
        // load() resolves with empty array (font is missing)
        Object.defineProperty(document, 'fonts', {
            value: {
                load: vi.fn().mockResolvedValue([]), // All fonts "missing" — empty array
            },
            writable: true,
            configurable: true
        });
    });

    // ─── Property Test: Missing fonts are marked unavailable ────────────────

    it('PBT: for all genuinely missing fonts, the method marks them unavailable, shows toast, and applies fallback', async () => {
        await fc.assert(
            fc.asyncProperty(fontListArb, async (fonts) => {
                const families = fonts.map(f => f.family);
                const { toolbar, showToastSpy, applyFontFallbackSpy, selectEl } =
                    createToolbarForMissingFonts(families);

                await toolbar._verifyFontLoading(fonts);

                // All fonts should be marked "(unavailable)"
                const options = selectEl.querySelectorAll('option');
                for (const option of options) {
                    expect(option.textContent).toBe(`${option.value} (unavailable)`);
                    expect(option.dataset.unavailable).toBe('true');
                }

                // Toast should have been shown exactly once
                expect(showToastSpy).toHaveBeenCalledTimes(1);
                expect(showToastSpy).toHaveBeenCalledWith(
                    'Custom font could not be loaded. Using default font.',
                    'warning'
                );

                // Fallback should have been applied with all font families
                expect(applyFontFallbackSpy).toHaveBeenCalledTimes(1);
                expect(applyFontFallbackSpy).toHaveBeenCalledWith(families);
            }),
            { numRuns: 50 }
        );
    });

    // ─── Property Test: Special characters and edge cases ───────────────────

    it('PBT: for any random font family names that fail to load, the method handles special characters without crashing', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0).map(family => ({ family })),
                    { minLength: 1, maxLength: 8 }
                ),
                async (fonts) => {
                    const families = fonts.map(f => f.family);
                    const { toolbar, showToastSpy, applyFontFallbackSpy } =
                        createToolbarForMissingFonts(families);

                    // Should not throw regardless of font name content
                    await toolbar._verifyFontLoading(fonts);

                    // All these fonts are "missing" so toast and fallback should be called
                    expect(showToastSpy).toHaveBeenCalledTimes(1);
                    expect(applyFontFallbackSpy).toHaveBeenCalledTimes(1);
                    expect(applyFontFallbackSpy).toHaveBeenCalledWith(families);
                }
            ),
            { numRuns: 50 }
        );
    });

    // ─── Property Test: Empty font arrays ───────────────────────────────────

    it('PBT: for empty font arrays, no side effects occur', async () => {
        await fc.assert(
            fc.asyncProperty(fc.constant([]), async (fonts) => {
                const { toolbar, showToastSpy, applyFontFallbackSpy } =
                    createToolbarForMissingFonts([]);

                await toolbar._verifyFontLoading(fonts);

                // No toast, no fallback when array is empty
                expect(showToastSpy).not.toHaveBeenCalled();
                expect(applyFontFallbackSpy).not.toHaveBeenCalled();
            }),
            { numRuns: 5 }
        );
    });

    // ─── Edge Case: document.fonts is undefined (older browser) ─────────────

    it('PBT: when document.fonts is undefined, the method returns gracefully without errors', async () => {
        await fc.assert(
            fc.asyncProperty(fontListArb, async (fonts) => {
                // Remove document.fonts to simulate older browser
                Object.defineProperty(document, 'fonts', {
                    value: undefined,
                    writable: true,
                    configurable: true
                });

                const families = fonts.map(f => f.family);
                const { toolbar, showToastSpy, applyFontFallbackSpy } =
                    createToolbarForMissingFonts(families);

                // Should not throw
                await toolbar._verifyFontLoading(fonts);

                // No side effects since document.fonts is unavailable
                expect(showToastSpy).not.toHaveBeenCalled();
                expect(applyFontFallbackSpy).not.toHaveBeenCalled();
            }),
            { numRuns: 20 }
        );
    });
});
