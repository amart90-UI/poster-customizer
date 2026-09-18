import { useEffect } from "react";
import { useEditor } from "@/store/store";

/**
 * Global keyboard shortcuts for the editor:
 *  - Undo / Redo (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z or Ctrl+Y)
 *  - Delete / Backspace removes the selected text object
 *  - Arrow keys nudge the selection (Shift = larger step)
 *  - Ctrl/Cmd+D duplicates the selection
 *  - Escape clears the selection
 *
 * Shortcuts are ignored while typing in an input, textarea, or the inline text
 * editor so normal editing keeps working.
 */
export function useKeyboard() {
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const editing = useEditor.getState().editingId != null;
      const inField =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      const mod = e.ctrlKey || e.metaKey;

      // Undo / redo work even from fields (except the inline editor).
      if (mod && (e.key === "z" || e.key === "Z") && !editing) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && (e.key === "y" || e.key === "Y") && !editing) {
        e.preventDefault();
        redo();
        return;
      }

      if (inField || editing) return;

      const state = useEditor.getState();
      const id = state.selectedIds[0];

      if (e.key === "Escape") {
        state.select(null);
        return;
      }

      if (!id) return;
      const t = state.project.texts.find((x) => x.id === id);
      if (!t) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        state.removeText(id);
        return;
      }

      if (mod && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        state.duplicateText(id);
        return;
      }

      const step = e.shiftKey ? 20 : 2;
      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowLeft") dx = -step;
      else if (e.key === "ArrowRight") dx = step;
      else if (e.key === "ArrowUp") dy = -step;
      else if (e.key === "ArrowDown") dy = step;
      else return;

      e.preventDefault();
      state.updateText(id, { x: t.x + dx, y: t.y + dy }, `nudge-${id}`);
    };

    // End the nudge coalesce run when the arrow key is released so a new run
    // starts fresh for the next distinct nudge gesture.
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key.startsWith("Arrow")) useEditor.getState().endCoalesce();
    };

    window.addEventListener("keydown", handler);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [undo, redo]);
}
