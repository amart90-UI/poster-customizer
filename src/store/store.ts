import { create } from "zustand";
import type { PosterImage, PosterSize, Project, TextObject } from "@/types";
import { createProject, docDimensions, makeText } from "@/model/poster";

/**
 * History model
 * --------------
 * `past` holds prior project snapshots (oldest..newest). `future` holds undone
 * snapshots. Each committed mutation snapshots the *current* project into
 * `past` before applying the change, and clears `future`.
 *
 * Continuous gestures (dragging, resizing, typing, slider drags) would flood
 * history with hundreds of entries. To coalesce them, a mutation may pass a
 * `coalesce` key: consecutive commits sharing the same key reuse the single
 * history entry created by the first commit in the run. Calling `endCoalesce`
 * (on pointer up / blur) ends the run so the next edit starts fresh.
 */

const HISTORY_LIMIT = 100;

function clone<T>(v: T): T {
  return structuredClone(v);
}

export interface EditorState {
  project: Project;
  past: Project[];
  future: Project[];

  /** Currently active coalesce key, if a gesture run is in progress. */
  coalesceKey: string | null;

  /** IDs of selected text objects (single-selection for now, array-ready). */
  selectedIds: string[];
  /** The text object currently being edited inline, if any. */
  editingId: string | null;

  // ---- selection ----
  select: (id: string | null, opts?: { additive?: boolean }) => void;
  setEditing: (id: string | null) => void;

  // ---- history ----
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  endCoalesce: () => void;

  // ---- project-level ----
  loadProject: (project: Project) => void;
  newProject: () => void;
  renameProject: (name: string) => void;
  setSize: (size: PosterSize) => void;
  setBackgroundColor: (color: string) => void;
  setImage: (image: PosterImage | null) => void;
  updateImage: (patch: Partial<PosterImage>, coalesce?: string) => void;

  // ---- text objects ----
  addText: (overrides?: Partial<TextObject>) => string;
  updateText: (id: string, patch: Partial<TextObject>, coalesce?: string) => void;
  removeText: (id: string) => void;
  duplicateText: (id: string) => string | null;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
}

export const useEditor = create<EditorState>((set, get) => {
  /**
   * Apply a mutation to the project, managing history. When `coalesce` is set
   * and matches the active run, the history entry is reused (no new snapshot).
   */
  function commit(
    mutate: (draft: Project) => void,
    opts: { coalesce?: string; skipHistory?: boolean } = {},
  ) {
    const { project, past, coalesceKey } = get();

    const draft = clone(project);
    mutate(draft);
    draft.updatedAt = Date.now();

    if (opts.skipHistory) {
      set({ project: draft });
      return;
    }

    const isContinuation = opts.coalesce != null && opts.coalesce === coalesceKey;

    if (isContinuation) {
      // Reuse the existing history entry; just replace present.
      set({ project: draft, future: [] });
    } else {
      const nextPast = [...past, project];
      if (nextPast.length > HISTORY_LIMIT) nextPast.shift();
      set({
        project: draft,
        past: nextPast,
        future: [],
        coalesceKey: opts.coalesce ?? null,
      });
    }
  }

  return {
    project: createProject(),
    past: [],
    future: [],
    coalesceKey: null,
    selectedIds: [],
    editingId: null,

    select: (id, opts) =>
      set((s) => {
        if (id == null) return { selectedIds: [], editingId: null };
        if (opts?.additive) {
          const exists = s.selectedIds.includes(id);
          return {
            selectedIds: exists
              ? s.selectedIds.filter((x) => x !== id)
              : [...s.selectedIds, id],
          };
        }
        return { selectedIds: [id] };
      }),

    setEditing: (id) => set({ editingId: id }),

    undo: () =>
      set((s) => {
        if (s.past.length === 0) return s;
        const previous = s.past[s.past.length - 1];
        return {
          project: previous,
          past: s.past.slice(0, -1),
          future: [s.project, ...s.future],
          coalesceKey: null,
        };
      }),

    redo: () =>
      set((s) => {
        if (s.future.length === 0) return s;
        const next = s.future[0];
        return {
          project: next,
          past: [...s.past, s.project],
          future: s.future.slice(1),
          coalesceKey: null,
        };
      }),

    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,
    endCoalesce: () => set({ coalesceKey: null }),

    loadProject: (project) =>
      set({
        project: clone(project),
        past: [],
        future: [],
        coalesceKey: null,
        selectedIds: [],
        editingId: null,
      }),

    newProject: () =>
      set({
        project: createProject(),
        past: [],
        future: [],
        coalesceKey: null,
        selectedIds: [],
        editingId: null,
      }),

    renameProject: (name) => commit((d) => { d.name = name; }, { coalesce: "rename" }),

    setSize: (size) =>
      commit((d) => {
        d.size = size;
        // Re-fit the image to the new document if present.
        if (d.image) {
          const { width, height } = docDimensions(size);
          const scale = Math.max(width / d.image.naturalWidth, height / d.image.naturalHeight);
          d.image.scale = scale;
          d.image.offsetX = (width - d.image.naturalWidth * scale) / 2;
          d.image.offsetY = (height - d.image.naturalHeight * scale) / 2;
        }
      }),

    setBackgroundColor: (color) =>
      commit((d) => { d.backgroundColor = color; }, { coalesce: "bgcolor" }),

    setImage: (image) => commit((d) => { d.image = image; }),

    updateImage: (patch, coalesce) =>
      commit(
        (d) => {
          if (d.image) d.image = { ...d.image, ...patch };
        },
        { coalesce },
      ),

    addText: (overrides) => {
      const size = get().project.size;
      const t = makeText(size, overrides);
      commit((d) => { d.texts.push(t); });
      set({ selectedIds: [t.id] });
      return t.id;
    },

    updateText: (id, patch, coalesce) =>
      commit(
        (d) => {
          const t = d.texts.find((x) => x.id === id);
          if (t) Object.assign(t, patch);
        },
        { coalesce },
      ),

    removeText: (id) => {
      commit((d) => { d.texts = d.texts.filter((t) => t.id !== id); });
      set((s) => ({
        selectedIds: s.selectedIds.filter((x) => x !== id),
        editingId: s.editingId === id ? null : s.editingId,
      }));
    },

    duplicateText: (id) => {
      const src = get().project.texts.find((t) => t.id === id);
      if (!src) return null;
      const copy = makeText(get().project.size, {
        ...clone(src),
        x: src.x + Math.round(src.fontSize * 0.4),
        y: src.y + Math.round(src.fontSize * 0.4),
      });
      commit((d) => { d.texts.push(copy); });
      set({ selectedIds: [copy.id] });
      return copy.id;
    },

    bringToFront: (id) =>
      commit((d) => {
        const i = d.texts.findIndex((t) => t.id === id);
        if (i >= 0) d.texts.push(d.texts.splice(i, 1)[0]);
      }),

    sendToBack: (id) =>
      commit((d) => {
        const i = d.texts.findIndex((t) => t.id === id);
        if (i >= 0) d.texts.unshift(d.texts.splice(i, 1)[0]);
      }),
  };
});
