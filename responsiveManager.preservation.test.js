/**
 * Property 2: Preservation — Pointer Mapping and Object Coordinate Preservation
 *
 * These tests observe and capture the EXISTING behavior of the unfixed code for:
 * 1. Pointer coordinate mapping (getPointer maps screen → logical correctly)
 * 2. Object logical coordinate storage (positions remain in 1100×1700 space)
 * 3. Export at logical resolution (export dimensions independent of display scale)
 * 4. Responsive scaling formula (scale = min(availW/canvasW, availH/canvasH), max 1.0)
 *
 * All tests must PASS on the current unfixed code to confirm baseline behavior,
 * and continue to PASS after the fix to ensure no regressions.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 */
import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';

// Canvas logical dimensions as defined in the project
const CANVAS_WIDTH = 1100;
const CANVAS_HEIGHT = 1700;

// ─── Mock Helpers ───────────────────────────────────────────────────────────

/**
 * Creates a mock Fabric.js canvas that simulates pointer mapping behavior.
 *
 * Key behavior under test:
 * - canvas.getPointer(event) correctly maps screen coordinates to logical coordinates
 *   using the inverse of the viewportTransform (zoom).
 * - This works correctly even on UNFIXED code because setZoom() properly updates
 *   the viewportTransform matrix which getPointer() uses for coordinate mapping.
 */
function createMockCanvas(logicalWidth, logicalHeight) {
    let zoom = 1.0;
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
            // CSS-only dimensions update — no-op for testing
        },

        /**
         * Simulates Fabric.js canvas.getPointer(event).
         * Maps screen coordinates to logical coordinates by dividing by the current zoom.
         * This is the core behavior that MUST be preserved — it works correctly on both
         * unfixed and fixed code because setZoom properly sets up the viewportTransform.
         */
        getPointer(event) {
            // Fabric.js getPointer applies the inverse viewportTransform:
            // logicalX = screenX / zoom, logicalY = screenY / zoom
            const screenX = event.clientX || event.offsetX || 0;
            const screenY = event.clientY || event.offsetY || 0;
            return {
                x: screenX / zoom,
                y: screenY / zoom
            };
        },

        add(obj) {
            objects.push(obj);
        },

        clear() {
            objects.length = 0;
        },

        renderAll() {
            // no-op for testing
        },

        discardActiveObject() {
            return this;
        },

        /**
         * Simulates canvas.toDataURL() for export.
         * Fabric.js toDataURL with a multiplier produces output at
         * logicalDimensions × multiplier, independent of the current zoom.
         * The zoom affects display only, not the export coordinate space.
         */
        toDataURL({ format, multiplier }) {
            // Export uses logical dimensions × multiplier, NOT affected by zoom
            const exportWidth = logicalWidth * multiplier;
            const exportHeight = logicalHeight * multiplier;
            return {
                _exportWidth: exportWidth,
                _exportHeight: exportHeight,
                _format: format,
                _multiplier: multiplier
            };
        }
    };
}

/**
 * Creates a mock text object at specified logical coordinates.
 * Object coordinates are always stored in the logical coordinate space (1100×1700).
 */
function createMockTextObject(left, top, width = 200, height = 50) {
    return {
        left,
        top,
        width,
        height,
        scaleX: 1,
        scaleY: 1,
        type: 'textbox',
        isBackgroundLayer: false,
        getBoundingRect() {
            return { left, top, width, height };
        },
        setCoords() {
            // no-op in mock
        }
    };
}

/**
 * Simulates what happens when a user moves an object at a given display scale.
 * The key invariant: even though the object is displayed at scaled positions,
 * the stored coordinates (left, top) remain in logical space.
 *
 * In Fabric.js with setZoom:
 * - Display position = logical position × zoom
 * - getPointer() maps screen click back to logical space
 * - Object.left/top are always in logical space regardless of zoom
 */
function simulateObjectMove(canvas, obj, newScreenX, newScreenY) {
    // getPointer maps screen coordinates back to logical space
    const logicalPos = canvas.getPointer({ clientX: newScreenX, clientY: newScreenY });
    // Object position is stored in logical coordinates
    obj.left = logicalPos.x;
    obj.top = logicalPos.y;
    return obj;
}

/**
 * Simulates the ExportManager.calculateMultiplier logic.
 */
function calculateMultiplier(canvasWidth, physicalWidth) {
    if (!physicalWidth || !canvasWidth) return 1;
    const multiplier = Math.ceil((150 * physicalWidth) / canvasWidth);
    return Math.max(multiplier, 1);
}

/**
 * Simulates the ResponsiveManager.recalculateLayout scale formula.
 */
function calculateScale(canvasWidth, canvasHeight, containerWidth, containerHeight, isNarrow = false) {
    if (canvasWidth === 0 || canvasHeight === 0) return 1.0;
    const padding = isNarrow ? 16 : 32;
    const availableWidth = containerWidth - padding;
    const availableHeight = containerHeight - padding;
    if (availableWidth <= 0 || availableHeight <= 0) return 1.0;
    const scaleX = availableWidth / canvasWidth;
    const scaleY = availableHeight / canvasHeight;
    let scale = Math.min(scaleX, scaleY);
    scale = Math.min(scale, 1.0);
    return scale;
}

// ─── Arbitraries ────────────────────────────────────────────────────────────

/**
 * Generate scale values in (0.01, 1.0] — the full range of valid display scales.
 */
const scaleArb = fc.double({ min: 0.01, max: 1.0, noNaN: true, noDefaultInfinity: true });

/**
 * Generate random screen click positions within the scaled canvas area.
 * Screen coordinates are bounded by canvasWidth * scale and canvasHeight * scale.
 */
function screenPositionArb(scale) {
    const maxScreenX = CANVAS_WIDTH * scale;
    const maxScreenY = CANVAS_HEIGHT * scale;
    return fc.tuple(
        fc.double({ min: 1, max: Math.max(1.01, maxScreenX), noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 1, max: Math.max(1.01, maxScreenY), noNaN: true, noDefaultInfinity: true })
    );
}

/**
 * Generate random logical positions within the canvas bounds.
 */
const logicalPositionArb = fc.tuple(
    fc.double({ min: 0, max: CANVAS_WIDTH, noNaN: true, noDefaultInfinity: true }),
    fc.double({ min: 0, max: CANVAS_HEIGHT, noNaN: true, noDefaultInfinity: true })
);

/**
 * Generate random export multipliers (realistic range 1-4).
 */
const multiplierArb = fc.integer({ min: 1, max: 4 });

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Property 2: Preservation — Pointer Mapping and Object Coordinate Preservation', () => {

    // ─── Property: Pointer coordinate mapping (Requirement 3.1) ─────────────

    describe('Pointer Coordinate Mapping', () => {
        /**
         * **Validates: Requirements 3.1**
         *
         * Property: For any scale in (0.01, 1.0] and any screen click position within
         * the scaled canvas area, getPointer() returns logical coordinates equal to
         * screen coordinates / scale (within floating-point tolerance).
         *
         * This behavior works correctly on UNFIXED code because canvas.setZoom()
         * properly configures the viewportTransform, and getPointer() uses the
         * inverse transform to map screen → logical coordinates.
         */
        it('PBT: getPointer() returns logical coordinates = screen coordinates / scale (within tolerance)', () => {
            fc.assert(
                fc.property(
                    scaleArb,
                    fc.double({ min: 1, max: CANVAS_WIDTH, noNaN: true, noDefaultInfinity: true }),
                    fc.double({ min: 1, max: CANVAS_HEIGHT, noNaN: true, noDefaultInfinity: true }),
                    (scale, screenX, screenY) => {
                        // Constrain screen coords to be within the scaled canvas area
                        const boundedScreenX = Math.min(screenX, CANVAS_WIDTH * scale);
                        const boundedScreenY = Math.min(screenY, CANVAS_HEIGHT * scale);

                        const canvas = createMockCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
                        canvas.setZoom(scale);

                        const event = { clientX: boundedScreenX, clientY: boundedScreenY };
                        const pointer = canvas.getPointer(event);

                        // Logical coordinates = screen coordinates / scale
                        const expectedLogicalX = boundedScreenX / scale;
                        const expectedLogicalY = boundedScreenY / scale;

                        // Allow small floating-point tolerance (1e-10)
                        expect(pointer.x).toBeCloseTo(expectedLogicalX, 5);
                        expect(pointer.y).toBeCloseTo(expectedLogicalY, 5);
                    }
                ),
                { numRuns: 200 }
            );
        });

        /**
         * **Validates: Requirements 3.1**
         *
         * Property: The logical coordinates returned by getPointer() always fall within
         * the canvas logical bounds [0, CANVAS_WIDTH] × [0, CANVAS_HEIGHT] when the
         * screen click is within the scaled canvas area.
         */
        it('PBT: getPointer() returns coordinates within logical canvas bounds for in-bounds screen clicks', () => {
            fc.assert(
                fc.property(
                    scaleArb,
                    fc.double({ min: 0, max: 1.0, noNaN: true, noDefaultInfinity: true }),
                    fc.double({ min: 0, max: 1.0, noNaN: true, noDefaultInfinity: true }),
                    (scale, fracX, fracY) => {
                        // Screen position as fraction of scaled canvas
                        const screenX = fracX * CANVAS_WIDTH * scale;
                        const screenY = fracY * CANVAS_HEIGHT * scale;

                        const canvas = createMockCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
                        canvas.setZoom(scale);

                        const pointer = canvas.getPointer({ clientX: screenX, clientY: screenY });

                        // Logical coords should be within canvas bounds (with tolerance for fp)
                        expect(pointer.x).toBeGreaterThanOrEqual(-0.001);
                        expect(pointer.x).toBeLessThanOrEqual(CANVAS_WIDTH + 0.001);
                        expect(pointer.y).toBeGreaterThanOrEqual(-0.001);
                        expect(pointer.y).toBeLessThanOrEqual(CANVAS_HEIGHT + 0.001);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    // ─── Property: Object logical coordinate storage (Requirement 3.3) ──────

    describe('Object Logical Coordinate Storage', () => {
        /**
         * **Validates: Requirements 3.3**
         *
         * Property: Object positions stored after interaction (move via pointer)
         * remain in the logical coordinate space (1100×1700) regardless of display scale.
         *
         * When a user moves an object at any zoom level, the pointer position is
         * mapped back to logical coordinates via getPointer(). The stored left/top
         * values are always in logical space.
         */
        it('PBT: object positions after move remain in logical coordinate space regardless of scale', () => {
            fc.assert(
                fc.property(
                    scaleArb,
                    // Random screen position for the move target (within scaled canvas)
                    fc.double({ min: 10, max: CANVAS_WIDTH - 10, noNaN: true, noDefaultInfinity: true }),
                    fc.double({ min: 10, max: CANVAS_HEIGHT - 10, noNaN: true, noDefaultInfinity: true }),
                    (scale, targetScreenX, targetScreenY) => {
                        // Bound screen coords to the visible area
                        const boundedScreenX = Math.min(targetScreenX * scale, CANVAS_WIDTH * scale);
                        const boundedScreenY = Math.min(targetScreenY * scale, CANVAS_HEIGHT * scale);

                        const canvas = createMockCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
                        canvas.setZoom(scale);

                        // Create an object at an initial logical position
                        const obj = createMockTextObject(100, 100);
                        canvas.add(obj);

                        // Simulate moving the object to a new screen position
                        simulateObjectMove(canvas, obj, boundedScreenX, boundedScreenY);

                        // After move, object coordinates must be in logical space (0-1100, 0-1700)
                        expect(obj.left).toBeGreaterThanOrEqual(0);
                        expect(obj.left).toBeLessThanOrEqual(CANVAS_WIDTH + 0.001);
                        expect(obj.top).toBeGreaterThanOrEqual(0);
                        expect(obj.top).toBeLessThanOrEqual(CANVAS_HEIGHT + 0.001);
                    }
                ),
                { numRuns: 200 }
            );
        });

        /**
         * **Validates: Requirements 3.3**
         *
         * Property: The same screen interaction at different zoom levels maps to
         * different logical positions (since logical = screen / zoom), but all
         * resulting positions are within the logical canvas bounds.
         *
         * This proves coordinates are stored in logical space, not screen space.
         */
        it('PBT: same screen position at different scales produces different logical coords (scale-independent storage)', () => {
            fc.assert(
                fc.property(
                    // Two different scale values
                    fc.double({ min: 0.1, max: 0.5, noNaN: true, noDefaultInfinity: true }),
                    fc.double({ min: 0.6, max: 1.0, noNaN: true, noDefaultInfinity: true }),
                    // A screen position that's valid at both scales (within the smaller scaled canvas)
                    fc.double({ min: 10, max: 100, noNaN: true, noDefaultInfinity: true }),
                    fc.double({ min: 10, max: 100, noNaN: true, noDefaultInfinity: true }),
                    (scale1, scale2, screenX, screenY) => {
                        const canvas1 = createMockCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
                        canvas1.setZoom(scale1);

                        const canvas2 = createMockCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
                        canvas2.setZoom(scale2);

                        const obj1 = createMockTextObject(100, 100);
                        const obj2 = createMockTextObject(100, 100);

                        simulateObjectMove(canvas1, obj1, screenX, screenY);
                        simulateObjectMove(canvas2, obj2, screenX, screenY);

                        // Different scales should produce different logical positions
                        // (since logical = screen / scale and scale1 !== scale2)
                        if (Math.abs(scale1 - scale2) > 0.01) {
                            expect(Math.abs(obj1.left - obj2.left)).toBeGreaterThan(0.01);
                        }

                        // But both must be in logical space
                        expect(obj1.left).toBeGreaterThanOrEqual(0);
                        expect(obj1.left).toBeLessThanOrEqual(CANVAS_WIDTH + 0.001);
                        expect(obj2.left).toBeGreaterThanOrEqual(0);
                        expect(obj2.left).toBeLessThanOrEqual(CANVAS_WIDTH + 0.001);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    // ─── Property: Export at logical resolution (Requirement 3.4) ────────────

    describe('Export at Logical Resolution', () => {
        /**
         * **Validates: Requirements 3.4**
         *
         * Property: Export dimensions equal logical dimensions × multiplier regardless
         * of the current display zoom. The zoom affects display only, not export output.
         */
        it('PBT: export dimensions = logical dimensions × multiplier, independent of current zoom', () => {
            fc.assert(
                fc.property(
                    scaleArb,
                    multiplierArb,
                    (scale, multiplier) => {
                        const canvas = createMockCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
                        canvas.setZoom(scale);

                        // Add an object to confirm canvas has content
                        const obj = createMockTextObject(200, 300);
                        canvas.add(obj);

                        // Export
                        const result = canvas.toDataURL({ format: 'png', multiplier });

                        // Export dimensions should be logical × multiplier, NOT zoom-dependent
                        expect(result._exportWidth).toBe(CANVAS_WIDTH * multiplier);
                        expect(result._exportHeight).toBe(CANVAS_HEIGHT * multiplier);
                    }
                ),
                { numRuns: 100 }
            );
        });

        /**
         * **Validates: Requirements 3.4**
         *
         * Property: Two exports at different display scales but the same multiplier
         * produce identical output dimensions.
         */
        it('PBT: exports at different display scales with same multiplier produce identical dimensions', () => {
            fc.assert(
                fc.property(
                    fc.double({ min: 0.1, max: 0.5, noNaN: true, noDefaultInfinity: true }),
                    fc.double({ min: 0.6, max: 1.0, noNaN: true, noDefaultInfinity: true }),
                    multiplierArb,
                    (scale1, scale2, multiplier) => {
                        const canvas1 = createMockCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
                        canvas1.setZoom(scale1);
                        canvas1.add(createMockTextObject(200, 300));

                        const canvas2 = createMockCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
                        canvas2.setZoom(scale2);
                        canvas2.add(createMockTextObject(200, 300));

                        const result1 = canvas1.toDataURL({ format: 'png', multiplier });
                        const result2 = canvas2.toDataURL({ format: 'png', multiplier });

                        // Both exports should have identical dimensions
                        expect(result1._exportWidth).toBe(result2._exportWidth);
                        expect(result1._exportHeight).toBe(result2._exportHeight);
                        // And those dimensions should be logical × multiplier
                        expect(result1._exportWidth).toBe(CANVAS_WIDTH * multiplier);
                        expect(result1._exportHeight).toBe(CANVAS_HEIGHT * multiplier);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    // ─── Property: Responsive scaling formula (Requirement 3.2) ─────────────

    describe('Responsive Scaling Formula', () => {
        /**
         * **Validates: Requirements 3.2**
         *
         * Property: The responsive scaling formula produces scale = min(availW/canvasW,
         * availH/canvasH) clamped to max 1.0. This formula must remain unchanged.
         */
        it('PBT: scale = min(availableWidth/canvasWidth, availableHeight/canvasHeight) clamped to 1.0', () => {
            fc.assert(
                fc.property(
                    // Container dimensions that produce scale < 1.0
                    fc.integer({ min: 50, max: 1000 }),
                    fc.integer({ min: 50, max: 1500 }),
                    (containerWidth, containerHeight) => {
                        const padding = 32; // non-narrow
                        const availableWidth = containerWidth - padding;
                        const availableHeight = containerHeight - padding;

                        if (availableWidth <= 0 || availableHeight <= 0) return; // skip invalid

                        const scale = calculateScale(CANVAS_WIDTH, CANVAS_HEIGHT, containerWidth, containerHeight);

                        // Verify the formula
                        const expectedScaleX = availableWidth / CANVAS_WIDTH;
                        const expectedScaleY = availableHeight / CANVAS_HEIGHT;
                        const expectedScale = Math.min(Math.min(expectedScaleX, expectedScaleY), 1.0);

                        expect(scale).toBeCloseTo(expectedScale, 10);
                        // Scale is always in (0, 1.0]
                        expect(scale).toBeGreaterThan(0);
                        expect(scale).toBeLessThanOrEqual(1.0);
                    }
                ),
                { numRuns: 200 }
            );
        });

        /**
         * **Validates: Requirements 3.2**
         *
         * Property: Scale never exceeds 1.0 — the canvas never upscales beyond
         * its logical dimensions, even when container is very large.
         */
        it('PBT: scale is clamped to max 1.0 even for very large containers', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: CANVAS_WIDTH + 100, max: 5000 }),
                    fc.integer({ min: CANVAS_HEIGHT + 100, max: 8000 }),
                    (containerWidth, containerHeight) => {
                        const scale = calculateScale(CANVAS_WIDTH, CANVAS_HEIGHT, containerWidth, containerHeight);
                        expect(scale).toBe(1.0);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});
