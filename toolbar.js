/**
 * Toolbar Module
 * Manages all toolbar controls: font size, font family, color picker, undo/redo,
 * export, add-text, reset, and template selector interactions.
 */
const Toolbar = {
    editor: null,

    // DOM element references
    els: {
        fontSize: null,
        fontFamily: null,
        fontColor: null,
        fontColorHex: null,
        btnUndo: null,
        btnRedo: null,
        btnExport: null,
        btnReset: null,
        textSection: null
    },

    /**
     * Initialize toolbar: cache DOM references, populate font dropdown,
     * and wire all event listeners.
     * @param {object} editor - Reference to the Editor module
     */
    async init(editor) {
        this.editor = editor;

        // Cache DOM elements
        this.els.fontSize = document.getElementById('font-size');
        this.els.fontFamily = document.getElementById('font-family');
        this.els.fontColor = document.getElementById('font-color');
        this.els.fontColorHex = document.getElementById('font-color-hex');
        this.els.btnUndo = document.getElementById('btn-undo');
        this.els.btnRedo = document.getElementById('btn-redo');
        this.els.btnExport = document.getElementById('btn-export');
        this.els.btnReset = document.getElementById('btn-reset');
        this.els.textSection = document.querySelector('.toolbar-section--text');

        // Populate font family dropdown from fonts.json
        await this._populateFontFamily();

        // Wire event listeners
        this._setupFontSizeControl();
        this._setupFontColorControls();
        this._setupFontFamilyControl();
        this._setupUndoRedoButtons();
        this._setupExportButton();
        this._setupResetButton();
        this._setupTemplateSelector();

        // Initial state: disable font controls until a text element is selected
        this._setFontControlsEnabled(false);
    },

    /**
     * Update toolbar controls based on the active selection.
     * Shows/enables font controls only when a text element is selected.
     * @param {fabric.Object|null} activeObject - The currently selected canvas object
     */
    updateForSelection(activeObject) {
        if (activeObject && activeObject.type === 'textbox') {
            this._setFontControlsEnabled(true);
            // Update control values to match the selected object's properties
            if (this.els.fontSize) {
                this.els.fontSize.value = Math.round(activeObject.fontSize || 16);
            }
            if (this.els.fontFamily) {
                this.els.fontFamily.value = activeObject.fontFamily || '';
            }
            if (this.els.fontColor) {
                const color = activeObject.fill || '#FFFFFF';
                this.els.fontColor.value = this._normalizeHexColor(color);
            }
            if (this.els.fontColorHex) {
                this.els.fontColorHex.value = (activeObject.fill || '#FFFFFF').toUpperCase();
            }
        } else {
            this._setFontControlsEnabled(false);
        }
    },

    /**
     * Enable/disable undo and redo buttons with visual distinction.
     * @param {boolean} canUndo - Whether undo is available
     * @param {boolean} canRedo - Whether redo is available
     */
    updateUndoRedoState(canUndo, canRedo) {
        if (this.els.btnUndo) {
            this.els.btnUndo.disabled = !canUndo;
        }
        if (this.els.btnRedo) {
            this.els.btnRedo.disabled = !canRedo;
        }
    },

    /**
     * Get current font size control value.
     * @returns {number} Font size in points
     */
    getFontSize() {
        if (this.els.fontSize) {
            return parseInt(this.els.fontSize.value, 10) || 16;
        }
        return 16;
    },

    /**
     * Get current font family selection.
     * @returns {string} Font family name
     */
    getFontFamily() {
        if (this.els.fontFamily) {
            return this.els.fontFamily.value || '';
        }
        return '';
    },

    /**
     * Get current color picker value.
     * @returns {string} Hex color string
     */
    getFontColor() {
        if (this.els.fontColorHex) {
            return this.els.fontColorHex.value || '#FFFFFF';
        }
        if (this.els.fontColor) {
            return this.els.fontColor.value || '#FFFFFF';
        }
        return '#FFFFFF';
    },

    // ─── Private Methods ────────────────────────────────────────────────

    /**
     * Fetch fonts.json and populate the font family dropdown.
     * After populating, verifies each font loaded successfully using the Font Loading API.
     * Fonts that fail to load are marked unavailable, and a warning toast is shown.
     * @private
     */
    async _populateFontFamily() {
        if (!this.els.fontFamily) return;

        let fonts = [];

        try {
            const response = await fetch('fonts/fonts.json');
            if (!response.ok) {
                throw new Error(`Failed to fetch fonts.json: ${response.status}`);
            }
            const data = await response.json();
            fonts = data.fonts || [];
        } catch (err) {
            console.warn('Toolbar: Could not load fonts list', err);
            // Use hardcoded defaults if fonts.json can't be fetched
            fonts = [
                { family: 'The Serif Hand Black', weight: 'normal' },
                { family: 'The Serif Hand Extrablack', weight: '900' }
            ];
        }

        // Clear existing options
        this.els.fontFamily.innerHTML = '';

        // Add an option for each font
        fonts.forEach((font) => {
            const option = document.createElement('option');
            option.value = font.family;
            option.textContent = font.family;
            this.els.fontFamily.appendChild(option);
        });

        // Verify fonts loaded successfully using the Font Loading API
        await this._verifyFontLoading(fonts);
    },

    /**
     * Verify that fonts loaded successfully using the Font Loading API.
     * If a font fails to load, marks it unavailable in the dropdown and shows a warning toast.
     * Falls back to browser default serif for text elements using the failed font.
     * @param {Array} fonts - Array of font objects with `family` property
     * @private
     */
    async _verifyFontLoading(fonts) {
        if (!document.fonts || !fonts.length) return;

        try {
            const failedFonts = [];

            for (const font of fonts) {
                const family = font.family;
                const weight = font.weight || 'normal';
                try {
                    // Force the browser to load the font by triggering a layout with it.
                    // document.fonts.load() only works for fonts already in the FontFaceSet,
                    // which may not include swap fonts that haven't been rendered yet.
                    // Creating a temporary element forces the font into the set.
                    const probe = document.createElement('span');
                    probe.style.fontFamily = `"${family}"`;
                    probe.style.fontWeight = weight;
                    probe.style.position = 'absolute';
                    probe.style.left = '-9999px';
                    probe.style.visibility = 'hidden';
                    probe.textContent = 'font probe';
                    document.body.appendChild(probe);

                    // Now that text is rendered with the font, load() will find it
                    const loaded = await document.fonts.load(`${weight} 16px "${family}"`);
                    document.body.removeChild(probe);

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

                // Apply fallback to any canvas text elements using the failed font
                this._applyFontFallback(failedFonts);
            }
        } catch (err) {
            console.warn('Toolbar: Font verification failed', err);
        }
    },

    /**
     * Apply browser default serif fallback to canvas text elements using unavailable fonts.
     * @param {string[]} failedFonts - Array of font family names that failed to load
     * @private
     */
    _applyFontFallback(failedFonts) {
        if (!this.editor || !this.editor.canvas) return;

        const objects = this.editor.canvas.getObjects();
        let needsRender = false;

        objects.forEach((obj) => {
            if (obj.type === 'textbox' && failedFonts.includes(obj.fontFamily)) {
                obj.set('fontFamily', 'serif');
                needsRender = true;
            }
        });

        if (needsRender) {
            this.editor.canvas.renderAll();
        }
    },

    /**
     * Set up font size input change handler.
     * Applies font size to the active text object on change.
     * @private
     */
    _setupFontSizeControl() {
        if (!this.els.fontSize) return;

        this.els.fontSize.addEventListener('input', () => {
            const activeObject = this._getActiveTextObject();
            if (!activeObject) return;

            let size = parseInt(this.els.fontSize.value, 10);
            // Clamp to valid range
            if (size < 8) size = 8;
            if (size > 200) size = 200;

            activeObject.set('fontSize', size);
            this.editor.canvas.renderAll();
            this._triggerModified(activeObject);
        });

        // Also handle blur to enforce bounds on the displayed value
        this.els.fontSize.addEventListener('change', () => {
            let size = parseInt(this.els.fontSize.value, 10);
            if (isNaN(size) || size < 8) size = 8;
            if (size > 200) size = 200;
            this.els.fontSize.value = size;
        });
    },

    /**
     * Set up color picker and hex input synchronization.
     * Keeps both controls in sync and applies fill to active text object.
     * @private
     */
    _setupFontColorControls() {
        const colorInput = this.els.fontColor;
        const hexInput = this.els.fontColorHex;

        if (colorInput) {
            colorInput.addEventListener('input', () => {
                const color = colorInput.value;
                if (hexInput) {
                    hexInput.value = color.toUpperCase();
                }
                this._applyColorToSelection(color);
            });
        }

        if (hexInput) {
            hexInput.addEventListener('input', () => {
                const hex = hexInput.value.trim();
                // Validate hex format
                if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
                    if (colorInput) {
                        colorInput.value = hex.toLowerCase();
                    }
                    this._applyColorToSelection(hex);
                }
            });

            // On blur, normalize the value
            hexInput.addEventListener('blur', () => {
                let hex = hexInput.value.trim();
                // Add # prefix if missing
                if (/^[0-9A-Fa-f]{6}$/.test(hex)) {
                    hex = '#' + hex;
                }
                if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
                    hexInput.value = hex.toUpperCase();
                    if (colorInput) {
                        colorInput.value = hex.toLowerCase();
                    }
                }
            });
        }
    },

    /**
     * Set up font family select change handler.
     * Applies fontFamily to the active text object.
     * If the selected font is marked as unavailable, falls back to serif.
     * @private
     */
    _setupFontFamilyControl() {
        if (!this.els.fontFamily) return;

        this.els.fontFamily.addEventListener('change', () => {
            const activeObject = this._getActiveTextObject();
            if (!activeObject) return;

            const selectedOption = this.els.fontFamily.selectedOptions[0];
            let family = this.els.fontFamily.value;

            // If the font is marked unavailable, use browser default serif
            if (selectedOption && selectedOption.dataset.unavailable === 'true') {
                family = 'serif';
                this._showToast(
                    'Custom font could not be loaded. Using default font.',
                    'warning'
                );
            }

            activeObject.set('fontFamily', family);
            this.editor.canvas.renderAll();
            this._triggerModified(activeObject);
        });
    },

    /**
     * Set up undo and redo button click handlers.
     * @private
     */
    _setupUndoRedoButtons() {
        if (this.els.btnUndo) {
            this.els.btnUndo.addEventListener('click', () => {
                if (typeof HistoryManager !== 'undefined' && HistoryManager.undo) {
                    HistoryManager.undo(this.editor.canvas).then(() => {
                        this._updateUndoRedoFromHistory();
                        // Schedule persistence save after undo
                        if (typeof PersistenceManager !== 'undefined' && PersistenceManager.scheduleSave) {
                            PersistenceManager.scheduleSave(this.editor.canvas);
                        }
                    });
                }
            });
        }

        if (this.els.btnRedo) {
            this.els.btnRedo.addEventListener('click', () => {
                if (typeof HistoryManager !== 'undefined' && HistoryManager.redo) {
                    HistoryManager.redo(this.editor.canvas).then(() => {
                        this._updateUndoRedoFromHistory();
                        // Schedule persistence save after redo
                        if (typeof PersistenceManager !== 'undefined' && PersistenceManager.scheduleSave) {
                            PersistenceManager.scheduleSave(this.editor.canvas);
                        }
                    });
                }
            });
        }
    },

    /**
     * Set up export button click handler.
     * @private
     */
    _setupExportButton() {
        if (!this.els.btnExport) return;

        this.els.btnExport.addEventListener('click', () => {
            if (typeof ExportManager !== 'undefined' && ExportManager.exportAsPNG) {
                const config = this.editor.templateManager
                    ? this.editor.templateManager.getTemplateConfig()
                    : null;
                ExportManager.exportAsPNG(this.editor.canvas, config);
            }
        });
    },

    /**
     * Set up reset button click handler with confirmation.
     * Clears persistence, clears history, and reloads the current template with defaults.
     * @private
     */
    _setupResetButton() {
        if (!this.els.btnReset) return;

        this.els.btnReset.addEventListener('click', () => {
            this._showConfirmation(
                'Reset poster to default? This cannot be undone.',
                async () => {
                    // Clear persistence
                    if (typeof PersistenceManager !== 'undefined' && PersistenceManager.clear) {
                        PersistenceManager.clear();
                    }

                    // Clear history
                    if (typeof HistoryManager !== 'undefined' && HistoryManager.clear) {
                        HistoryManager.clear();
                    }

                    // Reload the current template with default placeholders
                    if (this.editor.templateManager) {
                        // Use the currently active template, fall back to first available
                        let templateToLoad = this.editor.templateManager.currentTemplate;

                        if (!templateToLoad && this.editor.templateManager.templates.length > 0) {
                            templateToLoad = this.editor.templateManager.templates[0].directory;
                        }

                        if (templateToLoad) {
                            try {
                                await this.editor.templateManager.loadTemplate(
                                    templateToLoad,
                                    this.editor.canvas
                                );
                                // Record the template in persistence for next page load
                                if (typeof PersistenceManager !== 'undefined' && PersistenceManager.setLastTemplate) {
                                    PersistenceManager.setLastTemplate(templateToLoad);
                                }
                                // Save initial state as baseline for undo
                                if (typeof HistoryManager !== 'undefined' && HistoryManager.saveState) {
                                    HistoryManager.saveState(this.editor.canvas);
                                }
                            } catch (err) {
                                console.error('Toolbar: Failed to reload template after reset', err);
                            }
                        }
                    }

                    // Update undo/redo state
                    this._updateUndoRedoFromHistory();
                }
            );
        });
    },

    /**
     * Set up the template selector: render thumbnails and add click handlers
     * for switching templates with unsaved-edits confirmation.
     * @private
     */
    _setupTemplateSelector() {
        const container = document.getElementById('template-selector');
        if (!container || !this.editor || !this.editor.templateManager) return;

        const tm = this.editor.templateManager;

        // Render thumbnails into the selector container
        tm.renderTemplateThumbnails(container);

        // Use event delegation on the container for thumbnail clicks
        container.addEventListener('click', (e) => {
            const thumb = e.target.closest('.template-thumbnail');
            if (!thumb) return;

            const templateDir = thumb.dataset.template;
            if (!templateDir || templateDir === tm.currentTemplate) return;

            // Check for unsaved edits by comparing current canvas state against initial
            // Use a simple heuristic: if history has entries, there are edits
            const hasEdits = (typeof HistoryManager !== 'undefined' && HistoryManager.canUndo)
                ? HistoryManager.canUndo()
                : false;

            if (hasEdits) {
                this._showConfirmation(
                    'You have unsaved changes. Switch template and lose changes?',
                    () => this._switchTemplate(templateDir, container)
                );
            } else {
                this._switchTemplate(templateDir, container);
            }
        });
    },

    /**
     * Perform the actual template switch: load new template, update persistence,
     * clear history, and refresh the template selector active state.
     * If loading fails, retain the current template and show an error toast.
     * @param {string} templateDir - The directory name of the template to load
     * @param {HTMLElement} container - The template selector container element
     * @private
     */
    async _switchTemplate(templateDir, container) {
        const tm = this.editor.templateManager;
        const canvas = this.editor.canvas;

        try {
            await tm.loadTemplate(templateDir, canvas);

            // Update persistence with the new template
            if (typeof PersistenceManager !== 'undefined' && PersistenceManager.setLastTemplate) {
                PersistenceManager.setLastTemplate(templateDir);
            }

            // Clear history since we're on a fresh template
            if (typeof HistoryManager !== 'undefined' && HistoryManager.clear) {
                HistoryManager.clear();
            }

            // Save the initial state as the baseline for undo
            if (typeof HistoryManager !== 'undefined' && HistoryManager.saveState) {
                HistoryManager.saveState(canvas);
            }

            // Update undo/redo button states
            this._updateUndoRedoFromHistory();

            // Save the new template state to persistence
            if (typeof PersistenceManager !== 'undefined' && PersistenceManager.save) {
                PersistenceManager.save(canvas);
            }

            // Re-render thumbnails to update active state
            tm.renderTemplateThumbnails(container);
        } catch (err) {
            console.error('Toolbar: Failed to switch template', err);
            this._showToast('Could not load selected template. Current template retained.', 'error');
        }
    },

    /**
     * Apply a color to the currently selected text object.
     * @param {string} color - Hex color string
     * @private
     */
    _applyColorToSelection(color) {
        const activeObject = this._getActiveTextObject();
        if (!activeObject) return;

        activeObject.set('fill', color);
        this.editor.canvas.renderAll();
        this._triggerModified(activeObject);
    },

    /**
     * Get the active object if it's a textbox.
     * @returns {fabric.Textbox|null}
     * @private
     */
    _getActiveTextObject() {
        if (!this.editor || !this.editor.canvas) return null;
        const obj = this.editor.canvas.getActiveObject();
        if (obj && obj.type === 'textbox') {
            return obj;
        }
        return null;
    },

    /**
     * Enable or disable font-related controls.
     * @param {boolean} enabled - Whether to enable the controls
     * @private
     */
    _setFontControlsEnabled(enabled) {
        const controls = [
            this.els.fontSize,
            this.els.fontFamily,
            this.els.fontColor,
            this.els.fontColorHex
        ];

        controls.forEach((el) => {
            if (el) {
                el.disabled = !enabled;
            }
        });
    },

    /**
     * Trigger the object:modified event on the canvas for the given object.
     * This notifies HistoryManager and PersistenceManager of the change.
     * @param {fabric.Object} obj - The modified object
     * @private
     */
    _triggerModified(obj) {
        if (this.editor && this.editor.canvas) {
            this.editor.canvas.fire('object:modified', { target: obj });
        }
    },

    /**
     * Query HistoryManager and update undo/redo button states.
     * @private
     */
    _updateUndoRedoFromHistory() {
        if (typeof HistoryManager !== 'undefined') {
            const canUndo = HistoryManager.canUndo ? HistoryManager.canUndo() : false;
            const canRedo = HistoryManager.canRedo ? HistoryManager.canRedo() : false;
            this.updateUndoRedoState(canUndo, canRedo);
        }
    },

    /**
     * Show a confirmation dialog using the centralized Notifications module.
     * @param {string} message - Confirmation message
     * @param {Function} onConfirm - Callback if confirmed
     * @private
     */
    _showConfirmation(message, onConfirm) {
        if (typeof Notifications !== 'undefined' && Notifications.showConfirmation) {
            Notifications.showConfirmation(message, onConfirm);
        } else {
            // Fallback to native confirm
            if (confirm(message)) {
                onConfirm();
            }
        }
    },

    /**
     * Display a toast notification via the centralized Notifications module.
     * @param {string} message - The message to display
     * @param {string} type - Toast type ('warning', 'error', or 'info')
     * @private
     */
    _showToast(message, type = 'warning') {
        if (typeof Notifications !== 'undefined' && Notifications.showToast) {
            Notifications.showToast(message, type);
        }
    },

    /**
     * Normalize a color string to a 7-character hex format for the color input.
     * @param {string} color - Color string (hex)
     * @returns {string} Normalized 7-character hex string
     * @private
     */
    _normalizeHexColor(color) {
        if (!color) return '#ffffff';
        let hex = color.trim().toLowerCase();
        // Ensure # prefix
        if (!hex.startsWith('#')) {
            hex = '#' + hex;
        }
        // Expand 3-char hex to 6-char
        if (hex.length === 4) {
            hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
        }
        // Validate and return
        if (/^#[0-9a-f]{6}$/.test(hex)) {
            return hex;
        }
        return '#ffffff';
    }
};
