/**
 * Editor Module (Main Orchestrator)
 * Initializes Fabric.js canvas, Template Manager, and coordinates all sub-modules.
 */
const Editor = {
    canvas: null,
    history: null,
    persistence: null,
    templateManager: null,

    /**
     * Initialize the editor: create canvas, configure options, load template or restore state.
     * @param {string} canvasElementId - The ID of the canvas HTML element
     */
    async init(canvasElementId) {
        // Create Fabric.js canvas with visual options for editable elements
        this.canvas = new fabric.Canvas(canvasElementId, {
            selectionColor: 'rgba(66, 133, 244, 0.15)',
            selectionBorderColor: '#4285F4',
            selectionLineWidth: 1,
            preserveObjectStacking: true,
            allowTouchScrolling: false
        });

        // Configure default control appearance and resize behavior for all objects
        fabric.FabricObject.prototype.set({
            cornerColor: '#4285F4',
            cornerStyle: 'circle',
            cornerSize: 10,
            borderColor: '#4285F4',
            transparentCorners: false,
            borderScaleFactor: 1.5,
            lockRotation: true,
            lockScalingFlip: true
        });

        // Show only corner resize handles (hide middle handles and rotation control)
        fabric.FabricObject.prototype.setControlsVisibility({
            mt: false, // middle top
            mb: false, // middle bottom
            ml: false, // middle left
            mr: false, // middle right
            mtr: false // rotation control
        });

        // Set up Template Manager reference
        this.templateManager = TemplateManager;

        // Load template list
        try {
            await this.templateManager.loadTemplateList();
        } catch (err) {
            console.warn('Editor: Could not load template list', err);
        }

        // Attempt to restore from persistence, otherwise load default template
        let restored = false;

        if (typeof PersistenceManager !== 'undefined' && PersistenceManager.hasSavedState()) {
            try {
                restored = await PersistenceManager.restore(this.canvas);
            } catch (err) {
                console.warn('Editor: Could not restore saved state', err);
                restored = false;
            }
        }

        if (!restored) {
            // Load last-used template or first available
            let templateToLoad = null;

            if (typeof PersistenceManager !== 'undefined' && PersistenceManager.getLastTemplate) {
                templateToLoad = PersistenceManager.getLastTemplate();
            }

            if (!templateToLoad && this.templateManager.templates.length > 0) {
                templateToLoad = this.templateManager.templates[0].directory;
            }

            if (templateToLoad) {
                try {
                    await this.templateManager.loadTemplate(templateToLoad, this.canvas);
                    // Record last-used template for future page loads
                    if (typeof PersistenceManager !== 'undefined' && PersistenceManager.setLastTemplate) {
                        PersistenceManager.setLastTemplate(templateToLoad);
                    }
                } catch (err) {
                    console.error('Editor: Failed to load template', err);
                }
            }
        }

        // Save initial canvas state to history so there's a baseline to undo back to
        if (typeof HistoryManager !== 'undefined' && HistoryManager.saveState) {
            HistoryManager.saveState(this.canvas);
        }

        // Initialize Toolbar if available (after history init so undo/redo state is accurate)
        if (typeof Toolbar !== 'undefined' && Toolbar.init) {
            await Toolbar.init(this);
        }

        // Set up canvas event listeners
        this.canvas.on('object:modified', (event) => this.onObjectModified(event));
        this.canvas.on('selection:created', (event) => this.onSelectionChanged(event));
        this.canvas.on('selection:updated', (event) => this.onSelectionChanged(event));
        this.canvas.on('selection:cleared', (event) => this.onSelectionChanged(event));

        // Text editing behavior
        this._setupTextEditing();

        // Save state on text editing exit (covers text-only changes that may not fire object:modified)
        this.canvas.on('text:editing:exited', () => {
            if (typeof HistoryManager !== 'undefined' && HistoryManager.saveState) {
                HistoryManager.saveState(this.canvas);
            }
            if (typeof PersistenceManager !== 'undefined' && PersistenceManager.scheduleSave) {
                PersistenceManager.scheduleSave(this.canvas);
            }
            this._updateUndoRedoState();
        });

        // Keyboard shortcuts for undo/redo (Ctrl+Z / Cmd+Z, Ctrl+Y / Cmd+Shift+Z)
        this._setupUndoRedoKeyboardShortcuts();

        // Add Text button
        this._setupAddTextButton();

        // Initialize Responsive Layout Manager if available
        if (typeof ResponsiveManager !== 'undefined' && ResponsiveManager.init) {
            const containerEl = document.getElementById('canvas-container');
            if (containerEl) {
                ResponsiveManager.init(this.canvas, containerEl);
            }
        }

        // Resize constraints: aspect ratio lock, min size, max size (canvas bounds)
        this.canvas.on('object:scaling', (event) => this.onObjectScaling(event));

        // Constrain element positioning to canvas boundaries
        this.canvas.on('object:moving', (event) => {
            const obj = event.target;
            const boundingRect = obj.getBoundingRect();
            const canvasWidth = this.canvas.width;
            const canvasHeight = this.canvas.height;

            // Clamp left edge
            if (boundingRect.left < 0) {
                obj.left = obj.left - boundingRect.left;
            }
            // Clamp top edge
            if (boundingRect.top < 0) {
                obj.top = obj.top - boundingRect.top;
            }
            // Clamp right edge
            if (boundingRect.left + boundingRect.width > canvasWidth) {
                obj.left = obj.left - (boundingRect.left + boundingRect.width - canvasWidth);
            }
            // Clamp bottom edge
            if (boundingRect.top + boundingRect.height > canvasHeight) {
                obj.top = obj.top - (boundingRect.top + boundingRect.height - canvasHeight);
            }

            obj.setCoords();
        });
    },

    /**
     * Handle canvas object modifications (move, resize, text edit, etc.)
     * Will later trigger history save and persistence save.
     * @param {object} event - Fabric.js event object
     */
    onObjectModified(event) {
        // Save state to history if History Manager is available
        if (typeof HistoryManager !== 'undefined' && HistoryManager.saveState) {
            HistoryManager.saveState(this.canvas);
        }

        // Schedule persistence save if Persistence Manager is available
        if (typeof PersistenceManager !== 'undefined' && PersistenceManager.scheduleSave) {
            PersistenceManager.scheduleSave(this.canvas);
        }

        // Update undo/redo button states
        if (typeof Toolbar !== 'undefined' && Toolbar.updateUndoRedoState) {
            const canUndo = (typeof HistoryManager !== 'undefined' && HistoryManager.canUndo) ? HistoryManager.canUndo() : false;
            const canRedo = (typeof HistoryManager !== 'undefined' && HistoryManager.canRedo) ? HistoryManager.canRedo() : false;
            Toolbar.updateUndoRedoState(canUndo, canRedo);
        }
    },

    /**
     * Handle object scaling to enforce constraints:
     * - Uniform scaling (aspect ratio lock)
     * - Minimum size (10×10px)
     * - Maximum size (within canvas boundaries)
     * @param {object} event - Fabric.js scaling event
     */
    onObjectScaling(event) {
        const obj = event.target;
        if (!obj || !this.canvas) return;

        const canvasWidth = this.canvas.getWidth();
        const canvasHeight = this.canvas.getHeight();

        let scaleX = obj.scaleX;
        let scaleY = obj.scaleY;

        // Enforce uniform scaling (aspect ratio lock)
        // Use the larger scale to maintain aspect ratio from corner drag
        const uniformScale = Math.max(scaleX, scaleY);
        scaleX = uniformScale;
        scaleY = uniformScale;

        // Enforce minimum size constraint (10×10px)
        const minWidth = 10;
        const minHeight = 10;
        const minScaleX = minWidth / obj.width;
        const minScaleY = minHeight / obj.height;

        if (scaleX < minScaleX) scaleX = minScaleX;
        if (scaleY < minScaleY) scaleY = minScaleY;

        // After applying min constraints, re-enforce uniform scaling
        const clampedUniform = Math.max(scaleX, scaleY);
        scaleX = clampedUniform;
        scaleY = clampedUniform;

        // Enforce maximum size constraint (canvas boundaries)
        const objLeft = obj.left;
        const objTop = obj.top;
        const scaledWidth = obj.width * scaleX;
        const scaledHeight = obj.height * scaleY;

        // Check if object exceeds canvas right edge
        if (objLeft + scaledWidth > canvasWidth) {
            const maxScaleX = (canvasWidth - objLeft) / obj.width;
            scaleX = Math.min(scaleX, maxScaleX);
        }

        // Check if object exceeds canvas bottom edge
        if (objTop + scaledHeight > canvasHeight) {
            const maxScaleY = (canvasHeight - objTop) / obj.height;
            scaleY = Math.min(scaleY, maxScaleY);
        }

        // After max constraints, enforce uniform scaling (use the smaller to stay within bounds)
        const boundedUniform = Math.min(scaleX, scaleY);

        // Final check: ensure bounded uniform still meets minimum
        const finalScale = Math.max(boundedUniform, minScaleX, minScaleY);

        obj.scaleX = finalScale;
        obj.scaleY = finalScale;
    },

    /**
     * Handle selection changes to update toolbar state.
     * @param {object} event - Fabric.js event object
     */
    onSelectionChanged(event) {
        // Update toolbar if available
        if (typeof Toolbar !== 'undefined' && Toolbar.updateForSelection) {
            const activeObject = this.canvas.getActiveObject();
            Toolbar.updateForSelection(activeObject || null);
        }
    },

    /**
     * Set up text editing behavior:
     * - 200-character limit enforcement
     * - Escape key to revert text
     * - Click-outside to exit editing
     * @private
     */
    _setupTextEditing() {
        const canvas = this.canvas;
        const MAX_TEXT_LENGTH = 200;

        // 200-character limit: listen to text:changed event on canvas
        canvas.on('text:changed', (event) => {
            const textObj = event.target;
            if (textObj && textObj.text && textObj.text.length > MAX_TEXT_LENGTH) {
                textObj.text = textObj.text.substring(0, MAX_TEXT_LENGTH);
                // Move cursor to end after truncation
                if (textObj.selectionStart > MAX_TEXT_LENGTH) {
                    textObj.selectionStart = MAX_TEXT_LENGTH;
                }
                if (textObj.selectionEnd > MAX_TEXT_LENGTH) {
                    textObj.selectionEnd = MAX_TEXT_LENGTH;
                }
                canvas.renderAll();
            }
        });

        // Escape key to revert: store pre-edit text on editing:entered
        canvas.on('text:editing:entered', (event) => {
            const textObj = event.target;
            if (textObj) {
                textObj._preEditText = textObj.text;
            }
        });

        // Listen for keydown on the canvas upper canvas element to catch Escape
        const upperCanvas = canvas.upperCanvasEl || canvas.getElement();
        const container = upperCanvas.parentNode;

        this._escapeKeyHandler = (e) => {
            if (e.key === 'Escape') {
                const activeObj = canvas.getActiveObject();
                if (activeObj && activeObj.isEditing) {
                    // Restore pre-edit text
                    if (typeof activeObj._preEditText === 'string') {
                        activeObj.text = activeObj._preEditText;
                    }
                    activeObj.exitEditing();
                    canvas.renderAll();
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        };
        document.addEventListener('keydown', this._escapeKeyHandler);

        // Click-outside to exit editing: use mouse:down event
        canvas.on('mouse:down', (event) => {
            const activeObj = canvas.getActiveObject();
            if (activeObj && activeObj.isEditing) {
                // If clicking on a different object or the canvas background, exit editing
                if (event.target !== activeObj) {
                    activeObj.exitEditing();
                    canvas.renderAll();
                }
            }
        });
    },

    /**
     * Set up the "Add Text" button to create a new Textbox at the canvas center.
     * @private
     */
    _setupAddTextButton() {
        const btn = document.getElementById('btn-add-text');
        if (!btn) return;

        btn.addEventListener('click', () => {
            if (!this.canvas) return;

            // Determine font family from current template's first placeholder
            let fontFamily = 'The Serif Hand Black'; // default fallback
            const config = this.templateManager ? this.templateManager.getTemplateConfig() : null;
            if (config && config.placeholders && config.placeholders.length > 0) {
                fontFamily = config.placeholders[0].fontFamily || fontFamily;
            }

            const canvasWidth = this.canvas.getWidth();
            const canvasHeight = this.canvas.getHeight();

            const textbox = new fabric.Textbox('New Text', {
                fontFamily: fontFamily,
                fontSize: 16,
                fill: '#FFFFFF',
                textAlign: 'center',
                width: 200,
                editable: true
            });

            // Center on canvas
            textbox.left = (canvasWidth - textbox.width) / 2;
            textbox.top = (canvasHeight - textbox.height) / 2;

            this.canvas.add(textbox);
            this.canvas.setActiveObject(textbox);
            this.canvas.renderAll();

            // Save state to history
            if (typeof HistoryManager !== 'undefined' && HistoryManager.saveState) {
                HistoryManager.saveState(this.canvas);
            }

            // Schedule persistence save
            if (typeof PersistenceManager !== 'undefined' && PersistenceManager.scheduleSave) {
                PersistenceManager.scheduleSave(this.canvas);
            }

            // Update undo/redo button states
            this._updateUndoRedoState();
        });
    },

    /**
     * Set up keyboard shortcuts for undo/redo.
     * - Ctrl+Z / Cmd+Z for undo
     * - Ctrl+Y / Cmd+Shift+Z for redo
     * Prevents default browser undo/redo behavior.
     * @private
     */
    _setupUndoRedoKeyboardShortcuts() {
        this._undoRedoKeyHandler = (e) => {
            // Don't intercept if a text element is being edited (let normal text input work)
            const activeObj = this.canvas ? this.canvas.getActiveObject() : null;
            if (activeObj && activeObj.isEditing) return;

            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

            // Undo: Ctrl+Z / Cmd+Z
            if (ctrlOrCmd && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                if (typeof HistoryManager !== 'undefined' && HistoryManager.undo) {
                    HistoryManager.undo(this.canvas).then(() => {
                        this._updateUndoRedoState();
                        // Also schedule persistence save after undo
                        if (typeof PersistenceManager !== 'undefined' && PersistenceManager.scheduleSave) {
                            PersistenceManager.scheduleSave(this.canvas);
                        }
                    });
                }
                return;
            }

            // Redo: Ctrl+Y or Cmd+Shift+Z
            if ((ctrlOrCmd && e.key === 'y') || (ctrlOrCmd && e.shiftKey && e.key === 'z') || (ctrlOrCmd && e.shiftKey && e.key === 'Z')) {
                e.preventDefault();
                if (typeof HistoryManager !== 'undefined' && HistoryManager.redo) {
                    HistoryManager.redo(this.canvas).then(() => {
                        this._updateUndoRedoState();
                        // Also schedule persistence save after redo
                        if (typeof PersistenceManager !== 'undefined' && PersistenceManager.scheduleSave) {
                            PersistenceManager.scheduleSave(this.canvas);
                        }
                    });
                }
                return;
            }
        };

        document.addEventListener('keydown', this._undoRedoKeyHandler);
    },

    /**
     * Update undo/redo button states in the toolbar.
     * @private
     */
    _updateUndoRedoState() {
        if (typeof Toolbar !== 'undefined' && Toolbar.updateUndoRedoState) {
            const canUndo = (typeof HistoryManager !== 'undefined' && HistoryManager.canUndo) ? HistoryManager.canUndo() : false;
            const canRedo = (typeof HistoryManager !== 'undefined' && HistoryManager.canRedo) ? HistoryManager.canRedo() : false;
            Toolbar.updateUndoRedoState(canUndo, canRedo);
        }
    },

    /**
     * Cleanup event listeners and destroy canvas instance.
     */
    destroy() {
        if (typeof ResponsiveManager !== 'undefined' && ResponsiveManager.destroy) {
            ResponsiveManager.destroy();
        }
        if (this._escapeKeyHandler) {
            document.removeEventListener('keydown', this._escapeKeyHandler);
            this._escapeKeyHandler = null;
        }
        if (this._undoRedoKeyHandler) {
            document.removeEventListener('keydown', this._undoRedoKeyHandler);
            this._undoRedoKeyHandler = null;
        }
        if (this.canvas) {
            this.canvas.off('object:modified');
            this.canvas.off('object:scaling');
            this.canvas.off('object:moving');
            this.canvas.off('text:changed');
            this.canvas.off('text:editing:entered');
            this.canvas.off('text:editing:exited');
            this.canvas.off('mouse:down');
            this.canvas.off('selection:created');
            this.canvas.off('selection:updated');
            this.canvas.off('selection:cleared');
            this.canvas.dispose();
            this.canvas = null;
        }
    }
};

// Self-initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    Editor.init('poster-canvas');
});
