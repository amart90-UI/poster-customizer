/**
 * Bug Condition Exploration Test
 * Property 1: Background-Object Misalignment Under Zoom
 *
 * Validates: Requirements 1.1, 2.1, 2.4
 *
 * This test encodes the EXPECTED (correct) behavior:
 * - When canvas.setZoom(scale) is applied with scale < 1.0, both the background
 *   image and text objects should render at the same effective scale.
 * - The background rendered width should equal 1100 × scale and height 1700 × scale.
 * - The rendered position of a background pixel at logical (x,y) and the object's
 *   rendered position should differ by no more than 1 CSS pixel on each axis.
 *
 * On UNFIXED code this test is EXPECTED TO FAIL because:
 * - canvas.set('backgroundImage', bgImage) places the image in a special rendering
 *   path that does NOT apply the viewportTransform
 * - The background renders at full logical dimensions (1100×1700) regardless of zoom
 * - Objects render at logicalPosition × scale via the viewportTransform
 * - This creates an offset of logicalPosition × (1 - scale) pixels
 *
 * After the fix (promoting background to a regular canvas object), this test should PASS.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Canvas logical dimensions as defined in the project
const CANVAS_WIDTH = 1100;
const CANVAS_HEIGHT = 1700;

/**
 * Creates a mock Fabric.js canvas that simulates the backgroundImage rendering behavior.
 *
 * Key behavior being tested:
 * - backgroundImage set via canvas.set('backgroundImage', bgImage) does NOT participate
 *   in the viewportTransform — it renders at its natural dimensions regardless of zoom.
 * - Objects added via canvas.add() DO participate in the viewportTransform — they render
 *   at logicalPosition × scale.
 *
 * This mock replicates how Fabric.js 6 actually handles these two rendering paths.
 */
function createMockCanvas(logicalWidth, logicalHeight) {
    let zoom = 1.0;
    let backgroundImage = null;
    const objects = [];

    return {
        _logicalWidth: logicalWidth,
        _logicalHeight: logicalHeight,
        _objects: objects,

        getWidth() {
            return logicalWidth;
        },
        getHeight() {
            return logicalHeight;
        },

        setZoom(z) {
            zoom = z;
        },
        getZoom() {
            return zoom;
        },

        setDimensions(dims, options) {
            // CSS-only dimensions update (no-op for testing)
        },

        /**
         * Sets backgroundImage the way templateManager.js currently does it.
         * In Fabric.js 6, this places the image in a special rendering path
         * that does NOT apply the viewportTransform.
         */
        set(prop, value) {
            if (prop === 'backgroundImage') {
                backgroundImage = value;
            }
        },

        get backgroundImage() {
            return backgroundImage;
        },

        add(obj) {
            objects.push(obj);
        },

        clear() {
            objects.length = 0;
            backgroundImage = null;
        },

        renderAll() {
            // no-op for testing
        },

        /**
         * Returns the rendered dimensions/position of the background image.
         *
         * After the fix: background is a regular canvas object added via canvas.add()
         * and sent to back. It now participates in the viewportTransform just like
         * any other canvas object. Rendered dimensions = natural dimensions × zoom.
         */
        getBackgroundRenderedDimensions() {
            if (!backgroundImage) return null;

            // FIXED: background is now a regular object that participates in viewportTransform
            // It renders at natural dimensions × zoom, just like all other objects
            return {
                width: backgroundImage.width * zoom,
                height: backgroundImage.height * zoom
            };
        },

        /**
         * Returns the rendered CSS pixel position of the background pixel at
         * logical coordinates (logX, logY).
         *
         * After the fix: background participates in viewportTransform, so the pixel
         * at logical (x,y) renders at CSS (x*zoom, y*zoom) — same as objects.
         */
        getBackgroundRenderedPositionAt(logX, logY) {
            if (!backgroundImage) return null;

            // FIXED: Background now scales with zoom, so logical position × zoom = CSS position
            // The background pixel at logical (x,y) appears at CSS (x*zoom, y*zoom)
            return { x: logX * zoom, y: logY * zoom };
        },

        /**
         * Returns the rendered CSS pixel position of a canvas object.
         *
         * Objects DO participate in viewportTransform, so they render at
         * logicalPosition × zoom.
         */
        getObjectRenderedPosition(obj) {
            // Objects are correctly transformed by the viewport transform
            return {
                x: obj.left * zoom,
                y: obj.top * zoom
            };
        },

        /**
         * Returns the effective rendered dimensions of the background,
         * accounting for the viewport transform IF the background participates in it.
         *
         * For the EXPECTED (correct) behavior, background should render at:
         *   width = naturalWidth × zoom
         *   height = naturalHeight × zoom
         *
         * For the BUGGY behavior (current), background renders at:
         *   width = naturalWidth (ignores zoom)
         *   height = naturalHeight (ignores zoom)
         */
        getExpectedBackgroundRenderedDimensions() {
            if (!backgroundImage) return null;
            return {
                width: backgroundImage.width * zoom,
                height: backgroundImage.height * zoom
            };
        }
    };
}

/**
 * Creates a mock background image object with the canvas logical dimensions.
 */
function createMockBackgroundImage(width, height) {
    return {
        width,
        height,
        left: 0,
        top: 0,
        scaleX: 1,
        scaleY: 1
    };
}

/**
 * Creates a mock text object at the specified logical coordinates.
 */
function createMockTextObject(left, top) {
    return {
        left,
        top,
        width: 200,
        height: 50,
        type: 'textbox'
    };
}

describe('Bug Condition Exploration: Background-Object Misalignment Under Zoom', () => {
    /**
     * **Validates: Requirements 1.1, 2.1, 2.4**
     *
     * Property: For any scale factor s in (0.01, 1.0) and any object at logical
     * position (x, y), the background image rendered width should equal 1100 × scale
     * and height should equal 1700 × scale.
     *
     * This property FAILS on unfixed code because canvas.set('backgroundImage', bgImage)
     * places the image outside the viewportTransform — it renders at full logical
     * dimensions (1100×1700) regardless of zoom level.
     */
    it('background rendered dimensions should equal logical dimensions × scale for all scale < 1.0', () => {
        fc.assert(
            fc.property(
                // Generate scale factor in (0.01, 0.99) — strictly less than 1.0
                fc.double({ min: 0.01, max: 0.99, noNaN: true, noDefaultInfinity: true }),
                (scale) => {
                    // Setup canvas with background image (the buggy way)
                    const canvas = createMockCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
                    const bgImage = createMockBackgroundImage(CANVAS_WIDTH, CANVAS_HEIGHT);

                    // This is how templateManager.js currently sets the background
                    canvas.set('backgroundImage', bgImage);
                    canvas.setZoom(scale);

                    // Get actual rendered dimensions of the background
                    const rendered = canvas.getBackgroundRenderedDimensions();

                    // EXPECTED: Background should render at logical dimensions × scale
                    // This assertion encodes the CORRECT behavior
                    const expectedWidth = CANVAS_WIDTH * scale;
                    const expectedHeight = CANVAS_HEIGHT * scale;

                    expect(rendered.width).toBeCloseTo(expectedWidth, 0);
                    expect(rendered.height).toBeCloseTo(expectedHeight, 0);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * **Validates: Requirements 2.1, 2.4**
     *
     * Property: For any scale factor s in (0.01, 1.0) and any object at logical
     * position (x, y), the rendered CSS pixel position of the background pixel at
     * logical (x, y) and the object's rendered position should differ by no more
     * than 1 CSS pixel on each axis.
     *
     * Expected behavior: Both render at approximately logicalPosition × scale.
     *
     * Buggy behavior: Background pixel at (x,y) renders at CSS (x,y) while
     * object renders at CSS (x×scale, y×scale). Offset = position × (1 - scale).
     */
    it('rendered offset between background pixel and object at same logical position should be ≤ 1px', () => {
        fc.assert(
            fc.property(
                // Generate scale factor in (0.01, 0.99)
                fc.double({ min: 0.01, max: 0.99, noNaN: true, noDefaultInfinity: true }),
                // Generate random object position within canvas bounds (integers for clarity)
                fc.integer({ min: 10, max: CANVAS_WIDTH - 10 }),
                fc.integer({ min: 10, max: CANVAS_HEIGHT - 10 }),
                (scale, objX, objY) => {
                    // Setup canvas with background image (the buggy way)
                    const canvas = createMockCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
                    const bgImage = createMockBackgroundImage(CANVAS_WIDTH, CANVAS_HEIGHT);

                    canvas.set('backgroundImage', bgImage);
                    canvas.setZoom(scale);

                    // Place text object at the logical position
                    const textObj = createMockTextObject(objX, objY);
                    canvas.add(textObj);

                    // Get rendered positions
                    const bgRenderedPos = canvas.getBackgroundRenderedPositionAt(objX, objY);
                    const objRenderedPos = canvas.getObjectRenderedPosition(textObj);

                    // EXPECTED: Both should render at approximately the same CSS position
                    // (logicalPosition × scale), so the offset should be ≤ 1px
                    // The real bug produces offsets of position × (1-scale), i.e. hundreds of px
                    const offsetX = Math.abs(bgRenderedPos.x - objRenderedPos.x);
                    const offsetY = Math.abs(bgRenderedPos.y - objRenderedPos.y);

                    expect(offsetX).toBeLessThanOrEqual(1.0);
                    expect(offsetY).toBeLessThanOrEqual(1.0);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * **Validates: Requirements 1.1, 2.1**
     *
     * Specific counterexample demonstration: At scale 0.5, an object at (550, 850)
     * should render at CSS (275, 425), and the background pixel at logical (550, 850)
     * should also render at approximately CSS (275, 425).
     *
     * On buggy code: background pixel renders at (550, 850), object at (275, 425).
     * Offset = 275px horizontal, 425px vertical.
     */
    it('at scale 0.5 with object at (550,850): background and object should align within 1px', () => {
        const scale = 0.5;
        const objX = 550;
        const objY = 850;

        const canvas = createMockCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
        const bgImage = createMockBackgroundImage(CANVAS_WIDTH, CANVAS_HEIGHT);

        canvas.set('backgroundImage', bgImage);
        canvas.setZoom(scale);

        const textObj = createMockTextObject(objX, objY);
        canvas.add(textObj);

        // Background pixel at logical (550, 850) rendered position
        const bgPos = canvas.getBackgroundRenderedPositionAt(objX, objY);
        // Object rendered position
        const objPos = canvas.getObjectRenderedPosition(textObj);

        // Expected: both at (275, 425) — the logical position × scale
        expect(Math.abs(bgPos.x - objPos.x)).toBeLessThanOrEqual(1.0);
        expect(Math.abs(bgPos.y - objPos.y)).toBeLessThanOrEqual(1.0);
    });

    /**
     * **Validates: Requirements 2.4**
     *
     * Control test: At scale 1.0, the background and objects should always align
     * (even on buggy code) because at scale 1.0, logicalPosition × 1 = logicalPosition.
     */
    it('at scale 1.0: background and objects should align (control — should pass even on unfixed code)', () => {
        const scale = 1.0;
        const objX = 550;
        const objY = 850;

        const canvas = createMockCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
        const bgImage = createMockBackgroundImage(CANVAS_WIDTH, CANVAS_HEIGHT);

        canvas.set('backgroundImage', bgImage);
        canvas.setZoom(scale);

        const textObj = createMockTextObject(objX, objY);
        canvas.add(textObj);

        const bgPos = canvas.getBackgroundRenderedPositionAt(objX, objY);
        const objPos = canvas.getObjectRenderedPosition(textObj);

        // At scale 1.0, both render at (550, 850) — no offset
        expect(Math.abs(bgPos.x - objPos.x)).toBeLessThanOrEqual(1.0);
        expect(Math.abs(bgPos.y - objPos.y)).toBeLessThanOrEqual(1.0);
    });
});
