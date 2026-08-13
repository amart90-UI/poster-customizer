/**
 * Export Manager Module
 * Generates high-resolution PNG from the canvas and triggers browser download.
 */
const ExportManager = {
    /**
     * Export the canvas as a high-resolution PNG and trigger download.
     * Deselects all objects before export for a clean output.
     * @param {fabric.Canvas} canvas - The Fabric.js canvas instance
     * @param {object} templateConfig - Template configuration with dimensions
     */
    exportAsPNG(canvas, templateConfig) {
        try {
            // Deselect all objects for a clean export
            canvas.discardActiveObject().renderAll();

            // Calculate export multiplier for print-quality DPI
            const multiplier = this.calculateMultiplier(canvas, templateConfig);

            // Generate PNG data URL
            const dataURL = canvas.toDataURL({
                format: 'png',
                multiplier: multiplier
            });

            // Generate filename and trigger download
            const filename = this.generateFilename();
            this.triggerDownload(dataURL, filename);
        } catch (err) {
            console.error('ExportManager: Export failed', err);
            this._showToast('Export failed. Please try again.');
        }
    },

    /**
     * Calculate the export multiplier to ensure >= 150 DPI at the poster's physical dimensions.
     * Formula: multiplier = Math.ceil((150 * physicalWidth) / canvasWidth)
     * @param {fabric.Canvas} canvas - The Fabric.js canvas instance
     * @param {object} templateConfig - Template configuration with dimensions
     * @returns {number} The multiplier value (minimum 1)
     */
    calculateMultiplier(canvas, templateConfig) {
        const canvasWidth = canvas.getWidth();
        const physicalWidth = templateConfig && templateConfig.dimensions
            ? templateConfig.dimensions.physicalWidth
            : null;

        if (!physicalWidth || !canvasWidth) {
            return 1;
        }

        const multiplier = Math.ceil((150 * physicalWidth) / canvasWidth);
        return Math.max(multiplier, 1);
    },

    /**
     * Generate a filename in the format "poster-YYYY-MM-DD.png" using the current date.
     * @returns {string} The formatted filename
     */
    generateFilename() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `poster-${year}-${month}-${day}.png`;
    },

    /**
     * Trigger a browser download by creating a temporary anchor element.
     * @param {string} dataURL - The data URL of the image to download
     * @param {string} filename - The filename for the download
     */
    triggerDownload(dataURL, filename) {
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    /**
     * Display a toast notification via the centralized Notifications module.
     * @param {string} message - The message to display
     * @param {string} type - Toast type ('error' or 'info')
     * @private
     */
    _showToast(message, type = 'error') {
        if (typeof Notifications !== 'undefined' && Notifications.showToast) {
            Notifications.showToast(message, type);
        }
    }
};
