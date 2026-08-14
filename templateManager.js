/**
 * Template Manager Module
 * Loads and manages poster templates from static JSON configuration files.
 */
const TemplateManager = {
    templates: [],
    currentTemplate: null,
    _currentConfig: null,

    /**
     * Fetches the list of available templates from templates/index.json.
     * @returns {Promise<Array>} Array of template metadata objects
     */
    async loadTemplateList() {
        const response = await fetch('templates/index.json');
        if (!response.ok) {
            throw new Error('Failed to load template list');
        }
        const data = await response.json();
        this.templates = data.templates || [];
        return this.templates;
    },

    /**
     * Loads a specific template onto the Fabric.js canvas.
     * Fetches the template config JSON, sets the background image,
     * and creates Textbox objects for each placeholder.
     *
     * @param {string} templateName - The directory name of the template (e.g. "hoss-dark")
     * @param {fabric.Canvas} canvas - The Fabric.js canvas instance
     * @returns {Promise<void>}
     */
    async loadTemplate(templateName, canvas) {
        let config;

        // Fetch template configuration JSON
        try {
            const response = await fetch(`templates/${templateName}/template.json`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            config = await response.json();
        } catch (err) {
            this._showErrorOverlay('Unable to load poster template. Please check your connection and refresh.');
            throw err;
        }

        // Set canvas dimensions from template config
        const { width, height } = config.dimensions;
        canvas.setDimensions({ width, height });

        // Load the background image
        let bgImage;
        try {
            const bgSrc = `templates/${templateName}/${config.background.src}`;
            bgImage = await fabric.FabricImage.fromURL(bgSrc);
        } catch (err) {
            this._showErrorOverlay('Unable to load poster template. Please check your connection and refresh.');
            throw err;
        }

        // Clear existing objects and add background as a regular object
        canvas.clear();

        // Configure background image as non-interactive regular object
        // This ensures it participates in the viewport transform (setZoom)
        bgImage.set({
            left: 0,
            top: 0,
            scaleX: 1,
            scaleY: 1,
            selectable: false,
            evented: false,
            excludeFromExport: false,
            isBackgroundLayer: true
        });
        canvas.add(bgImage);
        canvas.sendObjectToBack(bgImage);

        // Create Fabric.js Textbox objects for each placeholder
        for (const placeholder of config.placeholders) {
            const textbox = new fabric.Textbox(placeholder.defaultText, {
                left: placeholder.x,
                top: placeholder.y,
                width: placeholder.width,
                height: placeholder.height,
                text: placeholder.defaultText,
                fontFamily: placeholder.fontFamily,
                fontSize: placeholder.fontSize,
                fill: placeholder.fontColor,
                textAlign: placeholder.textAlign,
                placeholderId: placeholder.id
            });
            canvas.add(textbox);
        }

        canvas.renderAll();

        // Store current template reference and config
        this.currentTemplate = templateName;
        this._currentConfig = config;
    },

    /**
     * Returns the JSON config for the currently loaded template.
     * @returns {object|null} The template configuration object, or null if no template loaded
     */
    getTemplateConfig() {
        return this._currentConfig;
    },

    /**
     * Renders clickable thumbnail images for the template selector UI.
     * @param {HTMLElement} container - The container element to render thumbnails into
     */
    renderTemplateThumbnails(container) {
        if (!container) return;
        container.innerHTML = '';

        for (const template of this.templates) {
            const thumb = document.createElement('div');
            thumb.className = 'template-thumbnail';
            thumb.dataset.template = template.directory;
            thumb.title = template.name;

            const img = document.createElement('img');
            img.src = `templates/${template.thumbnail}`;
            img.alt = template.name;
            img.loading = 'lazy';

            const label = document.createElement('span');
            label.className = 'template-thumbnail-label';
            label.textContent = template.name;

            thumb.appendChild(img);
            thumb.appendChild(label);
            container.appendChild(thumb);

            // Mark active template
            if (template.directory === this.currentTemplate) {
                thumb.classList.add('active');
            }
        }
    },

    /**
     * Displays an error overlay using the centralized Notifications module.
     * @param {string} message - The error message to display
     * @private
     */
    _showErrorOverlay(message) {
        if (typeof Notifications !== 'undefined' && Notifications.showErrorOverlay) {
            Notifications.showErrorOverlay(message);
        }
    }
};
