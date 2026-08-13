/**
 * History Manager (Undo/Redo)
 * Manages undo/redo state using JSON snapshots of the canvas.
 * Each entry is a full Fabric.js canvas JSON string (from canvas.toJSON()).
 */
const HistoryManager = {
    undoStack: [],      // Array of JSON state strings
    redoStack: [],      // Array of JSON state strings
    maxHistory: 50,     // Maximum undo depth
    isRestoring: false, // Flag to prevent recording during restore

    /**
     * Save the current canvas state to the undo stack.
     * Clears the redo stack and trims undo stack to maxHistory entries.
     * Skips if isRestoring is true (prevents recursive saves during undo/redo).
     * @param {fabric.Canvas} canvas - The Fabric.js canvas instance
     */
    saveState(canvas) {
        if (this.isRestoring) return;
        if (!canvas) return;

        const state = JSON.stringify(canvas.toJSON(['placeholderId']));
        this.undoStack.push(state);
        this.redoStack = [];

        // Trim undo stack to maxHistory (remove oldest entries)
        if (this.undoStack.length > this.maxHistory) {
            this.undoStack = this.undoStack.slice(this.undoStack.length - this.maxHistory);
        }
    },

    /**
     * Undo the last action: pop from undo stack, push current state to redo, restore canvas.
     * Returns a Promise since loadFromJSON is async in Fabric.js v6.
     * @param {fabric.Canvas} canvas - The Fabric.js canvas instance
     * @returns {Promise<boolean>} - Resolves true if undo was performed, false otherwise
     */
    async undo(canvas) {
        if (!this.canUndo() || !canvas) return false;

        // Save current state to redo stack before restoring
        const currentState = JSON.stringify(canvas.toJSON(['placeholderId']));
        this.redoStack.push(currentState);

        // Pop the last state from undo stack
        const previousState = this.undoStack.pop();

        this.isRestoring = true;
        try {
            await canvas.loadFromJSON(previousState);
            canvas.renderAll();
        } finally {
            this.isRestoring = false;
        }

        return true;
    },

    /**
     * Redo the last undone action: pop from redo stack, push current state to undo, restore canvas.
     * Returns a Promise since loadFromJSON is async in Fabric.js v6.
     * @param {fabric.Canvas} canvas - The Fabric.js canvas instance
     * @returns {Promise<boolean>} - Resolves true if redo was performed, false otherwise
     */
    async redo(canvas) {
        if (!this.canRedo() || !canvas) return false;

        // Save current state to undo stack before restoring
        const currentState = JSON.stringify(canvas.toJSON(['placeholderId']));
        this.undoStack.push(currentState);

        // Pop the last state from redo stack
        const nextState = this.redoStack.pop();

        this.isRestoring = true;
        try {
            await canvas.loadFromJSON(nextState);
            canvas.renderAll();
        } finally {
            this.isRestoring = false;
        }

        return true;
    },

    /**
     * Check if undo is possible.
     * @returns {boolean} - True if there are states to undo
     */
    canUndo() {
        return this.undoStack.length > 0;
    },

    /**
     * Check if redo is possible.
     * @returns {boolean} - True if there are states to redo
     */
    canRedo() {
        return this.redoStack.length > 0;
    },

    /**
     * Reset both stacks to empty arrays.
     */
    clear() {
        this.undoStack = [];
        this.redoStack = [];
    }
};
