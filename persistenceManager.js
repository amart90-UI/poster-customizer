/**
 * Persistence Manager Module
 * Handles auto-saving and restoring canvas state from localStorage.
 * Provides debounced save (2-second delay) and corrupted state handling.
 */
const PersistenceManager = {
    storageKey: 'poster-customizer-state',
    templateKey: 'poster-customizer-template',
    saveTimeout: null,

    /**
     * Schedule a debounced save. Clears any existing timeout and sets a new
     * 2-second timeout to call save(canvas).
     * @param {fabric.Canvas} canvas - The Fabric.js canvas instance
     */
    scheduleSave(canvas) {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }
        this.saveTimeout = setTimeout(() => {
            this.save(canvas);
            this.saveTimeout = null;
        }, 2000);
    },

    /**
     * Immediately save the current canvas state to localStorage.
     * Serializes via canvas.toJSON() including custom 'placeholderId' property.
     * @param {fabric.Canvas} canvas - The Fabric.js canvas instance
     */
    save(canvas) {
        if (!canvas) return;
        try {
            const state = canvas.toJSON(['placeholderId']);
            const json = JSON.stringify(state);
            localStorage.setItem(this.storageKey, json);
        } catch (err) {
            console.warn('PersistenceManager: Failed to save state', err);
        }
    },

    /**
     * Restore saved state from localStorage onto the canvas.
     * Parses stored JSON, validates structure, and loads via canvas.loadFromJSON().
     * On parse error, discards invalid state and shows an info toast.
     * @param {fabric.Canvas} canvas - The Fabric.js canvas instance
     * @returns {Promise<boolean>} true if state was restored successfully, false otherwise
     */
    async restore(canvas) {
        if (!canvas) return false;

        const raw = localStorage.getItem(this.storageKey);
        if (!raw) return false;

        let state;
        try {
            state = JSON.parse(raw);
        } catch (err) {
            // Corrupted state: discard and notify user
            localStorage.removeItem(this.storageKey);
            this._showToast('Previous edits could not be restored. Starting fresh.', 'info');
            return false;
        }

        // Basic structure validation: must be an object with objects array
        if (!state || typeof state !== 'object' || !Array.isArray(state.objects)) {
            localStorage.removeItem(this.storageKey);
            this._showToast('Previous edits could not be restored. Starting fresh.', 'info');
            return false;
        }

        try {
            await canvas.loadFromJSON(state);
            canvas.renderAll();
            return true;
        } catch (err) {
            console.warn('PersistenceManager: Failed to load state onto canvas', err);
            localStorage.removeItem(this.storageKey);
            this._showToast('Previous edits could not be restored. Starting fresh.', 'info');
            return false;
        }
    },

    /**
     * Check if a valid saved state exists in localStorage.
     * Verifies the key exists and contains parseable JSON.
     * @returns {boolean} true if valid state exists
     */
    hasSavedState() {
        const raw = localStorage.getItem(this.storageKey);
        if (!raw) return false;

        try {
            JSON.parse(raw);
            return true;
        } catch (err) {
            return false;
        }
    },

    /**
     * Remove saved state and template keys from localStorage.
     */
    clear() {
        localStorage.removeItem(this.storageKey);
        localStorage.removeItem(this.templateKey);
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }
    },

    /**
     * Get the last used template name from localStorage.
     * @returns {string|null} The template name, or null if not set
     */
    getLastTemplate() {
        return localStorage.getItem(this.templateKey) || null;
    },

    /**
     * Store the last used template name in localStorage.
     * @param {string} templateName - The template directory name to store
     */
    setLastTemplate(templateName) {
        if (templateName) {
            localStorage.setItem(this.templateKey, templateName);
        }
    },

    /**
     * Show a toast notification to the user via the centralized Notifications module.
     * @param {string} message - The message to display
     * @param {string} type - The toast type ('info', 'warning', 'error')
     * @private
     */
    _showToast(message, type = 'info') {
        if (typeof Notifications !== 'undefined' && Notifications.showToast) {
            Notifications.showToast(message, type);
        }
    }
};
