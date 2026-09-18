import { useMemo, useState } from "react";
import { useEditor } from "@/store/store";
import { docDimensions } from "@/model/poster";
import {
  checkResolution,
  downloadBlob,
  renderPosterToBlob,
  sanitizeFilename,
} from "@/render/export";
import { useToasts } from "@/store/toasts";
import type { ExportFormat } from "@/types";

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const project = useEditor((s) => s.project);
  const push = useToasts((s) => s.push);
  const [format, setFormat] = useState<ExportFormat>("png");
  const [quality, setQuality] = useState(92);
  const [busy, setBusy] = useState(false);

  const doc = docDimensions(project.size);
  const res = useMemo(() => checkResolution(project), [project]);

  const doExport = async () => {
    setBusy(true);
    try {
      const blob = await renderPosterToBlob(project, {
        format,
        quality: quality / 100,
      });
      const ext = format === "png" ? "png" : "jpg";
      downloadBlob(blob, `${sanitizeFilename(project.name)}.${ext}`);
      push("Exported.", "info", 2000);
      onClose();
    } catch (err) {
      push(err instanceof Error ? err.message : "Export failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Export poster</h2>
          <button className="btn ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Format</label>
            <div className="seg">
              <button className={format === "png" ? "active" : ""} onClick={() => setFormat("png")}>
                PNG
              </button>
              <button className={format === "jpeg" ? "active" : ""} onClick={() => setFormat("jpeg")}>
                JPEG
              </button>
            </div>
          </div>

          {format === "jpeg" && (
            <div className="field">
              <label>
                Quality
                <span style={{ float: "right", color: "var(--text-faint)" }}>{quality}%</span>
              </label>
              <input
                type="range"
                min={60}
                max={100}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
              />
            </div>
          )}

          <p className="hint">
            Output: {doc.width} × {doc.height}px ({project.size.widthInches}" × {project.size.heightInches}" @ {project.size.dpi} DPI).
            Rendered from your original image at full resolution.
          </p>

          {res.message && (
            <p className="hint" style={{ color: "#e6b422", marginTop: 8 }}>
              ⚠ {res.message}
            </p>
          )}

          <div className="row" style={{ marginTop: 16, justifyContent: "flex-end" }}>
            <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="btn primary" onClick={doExport} disabled={busy}>
              {busy ? "Rendering…" : "Download"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
