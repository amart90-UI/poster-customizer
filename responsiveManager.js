/**
 * Responsive Layout Manager
 * Handles canvas scaling and layout adjustments based on viewport size.
 * Ensures the canvas fits within the available viewport area while maintaining aspect ratio.
 */
const ResponsiveManager = {
    /** Breakpoint in px for switching between side toolbar and top/bottom toolbar */
    breakpoint: 768,

    /** Current computed scale factor */
    _scale: 1.0,

    /** Reference to the Fabric.js canvas instance */
    _canvas: null,

    /** Reference to the #canvas-container element */
    _containerElement: null,

    /** ResizeObserver instance (if supported) */
    _resizeObserver: null,

    /** Pending requestAnimationFrame ID */
    _rafId: null,

    /**
     * Initialize the Responsive Manager.
     * Sets up a ResizeObserver (or fallback window resize listener) and performs initial layout.
     * @param {fabric.Canvas} canvas - The Fabric.js canvas instance
     * @param {HTMLElement} containerElement - The #canvas-container element
     */
    init(canvas, containerElement) {
        this._canvas = canvas;
        this._containerElement = containerElement;

        // Use ResizeObserver if available, otherwise fall back to window resize event
        if (typeof ResizeObserver !== 'undefined') {
            this._resizeObserver = new ResizeObserver(() => {
                this._scheduleRecalculate();
            });
            // Observe the container element for size changes
            this._resizeObserver.observe(this._containerElement);
        } else {
            // Fallback: listen to window resize
            this._onResize = () => this._scheduleRecalculate();
            window.addEventListener('resize', this._onResize);
        }

        // Also listen to window resize to catch viewport changes not captured by ResizeObserver
        this._onWindowResize = () => this._scheduleRecalculate();
        window.addEventListener('resize', this._onWindowResize);

        // Perform initial layout calculation
        this.recalculateLayout();
    },

    /**
     * Schedule a layout recalculation using requestAnimationFrame.
     * Ensures recalculation happens at most once per animation frame for performance.
     * @private
     */
    _scheduleRecalculate() {
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
        }
        this._rafId = requestAnimationFrame(() => {
            this._rafId = null;
            this.recalculateLayout();
        });
    },

    /**
     * Recalculate the canvas scale and apply it via Fabric.js native zoom.
     * Steps:
     * 1. Get available viewport area (viewport minus toolbar space)
     * 2. Get the canvas natural dimensions
     * 3. Calculate scale = min(availableWidth / canvasWidth, availableHeight / canvasHeight)
     * 4. Clamp to max 1.0 (never upscale)
     * 5. Apply via canvas.setZoom() and adjust CSS dimensions
     */
    recalculateLayout() {
        if (!this._canvas || !this._containerElement) return;

        // Get the canvas natural dimensions (the Fabric.js canvas logical size)
        const canvasWidth = this._canvas.getWidth();
        const canvasHeight = this._canvas.getHeight();

        if (canvasWidth === 0 || canvasHeight === 0) return;

        // Get available space from the container element
        // The container is a flex child that fills remaining space after the toolbar
        const containerRect = this._containerElement.getBoundingClientRect();
        const padding = this.isNarrowViewport() ? 16 : 32; // padding inside container (0.5rem vs 1rem * 2 sides)
        const availableWidth = containerRect.width - padding;
        const availableHeight = containerRect.height - padding;

        if (availableWidth <= 0 || availableHeight <= 0) return;

        // Calculate scale factor to fit canvas in available space
        const scaleX = availableWidth / canvasWidth;
        const scaleY = availableHeight / canvasHeight;
        let scale = Math.min(scaleX, scaleY);

        // Clamp to max 1.0 - never upscale beyond original dimensions
        scale = Math.min(scale, 1.0);

        // Ensure a minimum usable scale for very narrow viewports (320px support)
        // Don't clamp below a minimum - just let it scale down as needed
        this._scale = scale;

        // Use Fabric.js native zoom API to scale the canvas.
        // This updates the viewportTransform so getPointer() correctly maps
        // visual positions to logical coordinates at all scale factors.
        this._canvas.setZoom(scale);

        // Set the canvas element CSS dimensions to reflect the scaled size,
        // without altering logical dimensions used for object positioning and export.
        this._canvas.setDimensions(
            { width: canvasWidth * scale, height: canvasHeight * scale },
            { cssOnly: true }
        );
    },

    /**
     * Get the current canvas scale factor.
     * @returns {number} The current scale factor (0 < scale <= 1.0)
     */
    getCanvasScale() {
        return this._scale;
    },

    /**
     * Check whether the current viewport is below the narrow breakpoint.
     * @returns {boolean} True if viewport width < 768px
     */
    isNarrowViewport() {
        return window.innerWidth < this.breakpoint;
    },

    /**
     * Clean up event listeners and observers.
     */
    destroy() {
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }
        if (this._onResize) {
            window.removeEventListener('resize', this._onResize);
            this._onResize = null;
        }
        if (this._onWindowResize) {
            window.removeEventListener('resize', this._onWindowResize);
            this._onWindowResize = null;
        }
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
        this._canvas = null;
        this._containerElement = null;
    }
};
