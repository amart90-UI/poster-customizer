/**
 * Notifications Module
 * Centralized notification system providing toast notifications and modal overlays.
 * 
 * Toast types:
 * - 'info': Blue background, auto-dismiss after 5s (e.g. corrupted state messages)
 * - 'warning': Amber background, auto-dismiss after 5s (e.g. font load failures)
 * - 'error': Red background, auto-dismiss after 5s (e.g. export failures)
 * 
 * Modal overlays:
 * - Error overlay: blocking modal with OK button only (e.g. template load failure on init)
 * - Confirmation dialog: modal with Confirm + Cancel buttons (e.g. reset, template switch)
 */
const Notifications = {
    /**
     * Show a toast notification that auto-dismisses after 5 seconds.
     * @param {string} message - The message to display
     * @param {'info'|'warning'|'error'} type - The toast type (default: 'info')
     */
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.textContent = message;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'polite');
        container.appendChild(toast);

        // Auto-dismiss after 5 seconds with fade-out animation
        setTimeout(() => {
            toast.classList.add('toast--fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    },

    /**
     * Show a blocking error overlay (modal with OK button only).
     * Used for critical failures like template load failure on init.
     * @param {string} message - The error message to display
     */
    showErrorOverlay(message) {
        const overlay = document.getElementById('modal-overlay');
        const messageEl = document.getElementById('modal-message');
        const cancelBtn = document.getElementById('modal-cancel');
        const confirmBtn = document.getElementById('modal-confirm');

        if (!overlay || !messageEl) return;

        messageEl.textContent = message;
        overlay.hidden = false;

        // Hide cancel button for error overlays (only OK needed)
        if (cancelBtn) {
            cancelBtn.hidden = true;
        }

        if (confirmBtn) {
            const handleDismiss = () => {
                overlay.hidden = true;
                if (cancelBtn) cancelBtn.hidden = false;
                confirmBtn.removeEventListener('click', handleDismiss);
            };
            confirmBtn.addEventListener('click', handleDismiss);
        }
    },

    /**
     * Show a confirmation dialog with Confirm and Cancel buttons.
     * @param {string} message - The confirmation message
     * @param {Function} onConfirm - Callback invoked when user confirms
     * @param {Function} [onCancel] - Optional callback invoked when user cancels
     */
    showConfirmation(message, onConfirm, onCancel) {
        const overlay = document.getElementById('modal-overlay');
        const msgEl = document.getElementById('modal-message');
        const confirmBtn = document.getElementById('modal-confirm');
        const cancelBtn = document.getElementById('modal-cancel');

        if (!overlay || !msgEl || !confirmBtn || !cancelBtn) {
            // Fallback to native confirm if modal elements don't exist
            if (confirm(message)) {
                if (onConfirm) onConfirm();
            } else {
                if (onCancel) onCancel();
            }
            return;
        }

        msgEl.textContent = message;
        overlay.hidden = false;
        cancelBtn.hidden = false;

        const cleanup = () => {
            overlay.hidden = true;
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
        };

        const handleConfirm = () => {
            cleanup();
            if (onConfirm) onConfirm();
        };

        const handleCancel = () => {
            cleanup();
            if (onCancel) onCancel();
        };

        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
    }
};
