import { useRef, useState } from "react";
import { nanoid } from "nanoid";
import { useEditor } from "@/store/store";
import {
  deleteProject,
  listProjects,
  loadProjectById,
  parseProjectFile,
  projectToFile,
  saveProject,
  type ProjectMeta,
} from "@/store/persistence";
import { downloadBlob, sanitizeFilename } from "@/render/export";
import { useToasts } from "@/store/toasts";

export function ProjectsDialog({ onClose }: { onClose: () => void }) {
  const project = useEditor((s) => s.project);
  const loadProject = useEditor((s) => s.loadProject);
  const newProject = useEditor((s) => s.newProject);
  const push = useToasts((s) => s.push);

  const [projects, setProjects] = useState<ProjectMeta[]>(() => listProjects());
  const fileRef = useRef<HTMLInputElement | null>(null);

  const refresh = () => setProjects(listProjects());

  const open = (id: string) => {
    if (id === project.id) {
      onClose();
      return;
    }
    const p = loadProjectById(id);
    if (p) {
      loadProject(p);
      push(`Opened "${p.name}".`, "info", 2000);
      onClose();
    } else {
      push("Could not open that project.", "error");
    }
  };

  const create = () => {
    newProject();
    onClose();
  };

  const duplicate = (id: string) => {
    const p = loadProjectById(id);
    if (!p) return;
    const copy = { ...structuredClone(p), id: nanoid(10), name: `${p.name} copy`, createdAt: Date.now(), updatedAt: Date.now() };
    saveProject(copy);
    refresh();
    push("Project duplicated.", "info", 2000);
  };

  const remove = (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    deleteProject(id);
    refresh();
    if (id === project.id) newProject();
  };

  const exportCurrent = () => {
    const blob = projectToFile(project);
    downloadBlob(blob, `${sanitizeFilename(project.name)}.poster.json`);
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const p = parseProjectFile(text);
      // Give the imported project a fresh id to avoid clobbering an existing one.
      p.id = nanoid(10);
      p.updatedAt = Date.now();
      saveProject(p);
      loadProject(p);
      refresh();
      push(`Imported "${p.name}".`, "info", 2500);
      onClose();
    } catch (err) {
      push(err instanceof Error ? err.message : "Import failed.", "error");
    }
  };

  const fmtDate = (ms: number) =>
    new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Projects</h2>
          <button className="btn ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="row" style={{ marginBottom: 16 }}>
            <button className="btn primary" onClick={create}>+ New</button>
            <button className="btn" onClick={exportCurrent}>Export current…</button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              style={{ display: "none" }}
              onChange={(e) => importFile(e.target.files?.[0])}
            />
            <button className="btn" onClick={() => fileRef.current?.click()}>Import…</button>
          </div>

          <div className="project-list">
            {projects.length === 0 && (
              <p className="hint">No saved projects yet. Your work autosaves as you go.</p>
            )}
            {projects.map((p) => (
              <div className="project-card" key={p.id}>
                <div className="thumb" />
                <div className="meta">
                  <div className="name">
                    {p.name}
                    {p.id === project.id && (
                      <span style={{ color: "var(--accent)", fontSize: 12, marginLeft: 8 }}>current</span>
                    )}
                  </div>
                  <div className="date">{fmtDate(p.updatedAt)}</div>
                </div>
                <button className="btn" onClick={() => open(p.id)}>Open</button>
                <button className="btn" onClick={() => duplicate(p.id)}>Duplicate</button>
                <button className="btn danger" onClick={() => remove(p.id, p.name)}>Delete</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
