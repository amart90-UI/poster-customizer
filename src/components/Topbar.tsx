import { useEditor } from "@/store/store";

interface Props {
  onOpenProjects: () => void;
  onOpenExport: () => void;
}

export function Topbar({ onOpenProjects, onOpenExport }: Props) {
  const name = useEditor((s) => s.project.name);
  const renameProject = useEditor((s) => s.renameProject);
  const endCoalesce = useEditor((s) => s.endCoalesce);
  const addText = useEditor((s) => s.addText);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);

  return (
    <div className="topbar">
      <div className="brand">
        <span className="dot" />
        <span className="label">Poster</span>
      </div>

      <input
        className="project-name"
        value={name}
        onChange={(e) => renameProject(e.target.value)}
        onBlur={endCoalesce}
        aria-label="Project name"
      />

      <button className="btn ghost icon" onClick={onOpenProjects} title="Projects">
        Projects
      </button>

      <div className="spacer" />

      <button className="btn ghost icon" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
        ↶
      </button>
      <button className="btn ghost icon" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
        ↷
      </button>

      <button className="btn" onClick={() => addText()} title="Add text (T)">
        + Text
      </button>
      <button className="btn primary" onClick={onOpenExport}>
        Export
      </button>
    </div>
  );
}
