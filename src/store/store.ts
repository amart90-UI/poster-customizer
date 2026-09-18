import { create } from "zustand";
import type { Overlay, PosterImage, PosterSize, Project, TemplateState, TextObject } from "@/types";
import { createProject, docDimensions, makeText, reframeTransform } from "@/model/poster";
import { getTemplate, type FigureId, type LogoId } from "@/templates/registry";

/**
 * Fill in fields that may be missing on projects saved by older versions, so
 * newer rendering code can rely on them. Currently: the overlay scrim.
 */
function normalizeProject(project: Project): Project {
  if (!project.overlay) {
    return { ...project, overlay: { color: "#2B323F", opacity: 0 } };
  }
  return project;
}

/** Create or reuse a template state object for the given template id. */
function ensureTemplate(current: TemplateState | null, templateId: string): TemplateState {
  if (current && current.templateId === templateId) return current;
  // Switching templates (or first use) starts from a clean, all-on-background
  // state so the user immediately sees the scenery.
  return { templateId, background: true, figures: null, logo: null };
}

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
  /** When true, the stage pans/zooms the background image instead of text. */
  bgEditMode: boolean;

  // ---- selection ----
  select: (id: string | null, opts?: { additive?: boolean }) => void;
  setEditing: (id: string | null) => void;
  setBgEditMode: (on: boolean) => void;

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
  setOverlay: (patch: Partial<Overlay>, coalesce?: string) => void;

  // ---- template layers ----
  setTemplateBackground: (templateId: string, on: boolean) => void;
  setTemplateFigures: (templateId: string, figures: string | null) => void;
  setTemplateLogo: (templateId: string, logo: string | null) => void;

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
    bgEditMode: false,

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

    // Entering background-edit mode clears any text selection so the two modes
    // never fight over the same pointer input.
    setBgEditMode: (on) => set(on ? { bgEditMode: true, selectedIds: [], editingId: null } : { bgEditMode: false }),

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
        project: normalizeProject(clone(project)),
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
        // Re-frame the image so the user's framing is preserved as the poster
        // changes size, only adjusting enough to keep the poster covered.
        if (d.image) {
          const oldDoc = docDimensions(d.size);
          const newDoc = docDimensions(size);
          const t = reframeTransform(
            d.image,
            oldDoc.width,
            oldDoc.height,
            newDoc.width,
            newDoc.height,
          );
          d.image = { ...d.image, ...t };
        }
        d.size = size;
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

    setOverlay: (patch, coalesce) =>
      commit((d) => { d.overlay = { ...d.overlay, ...patch }; }, { coalesce }),

    setTemplateBackground: (templateId, on) =>
      commit((d) => {
        d.template = ensureTemplate(d.template, templateId);
        d.template.background = on;
      }),

    setTemplateFigures: (templateId, figures) =>
      commit((d) => {
        const template = getTemplate(templateId);
        d.template = ensureTemplate(d.template, templateId);
        // Auto-link only fills in the OTHER side when it is currently empty, so
        // the first pick establishes the matching pair but later changes don't
        // drag the other side along (allowing mismatched combos).
        const shouldLink = figures && template && d.template.logo == null;
        d.template.figures = figures;
        if (shouldLink) {
          const linked = template.figureToLogo[figures as FigureId];
          if (linked) d.template.logo = linked;
        }
      }),

    setTemplateLogo: (templateId, logo) =>
      commit((d) => {
        const template = getTemplate(templateId);
        d.template = ensureTemplate(d.template, templateId);
        const shouldLink = logo && template && d.template.figures == null;
        d.template.logo = logo;
        if (shouldLink) {
          const linked = template.logoToFigure[logo as LogoId];
          if (linked) d.template.figures = linked;
        }
      }),

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
