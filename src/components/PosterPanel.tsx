import { useRef, useState } from "react";
import { useEditor } from "@/store/store";
import {
  DEFAULT_DPI,
  SIZE_PRESETS,
  containTransform,
  coverTransform,
  docDimensions,
  makeImage,
  makeSize,
} from "@/model/poster";
import { ColorField, Section, Slider } from "@/components/ui";
import { fileToDataURL, imageDimensions } from "@/utils/image";
import { useToasts } from "@/store/toasts";
import type { PosterSizeId } from "@/types";

export function PosterPanel() {
  const project = useEditor((s) => s.project);
  const setSize = useEditor((s) => s.setSize);
  const setImage = useEditor((s) => s.setImage);
  const updateImage = useEditor((s) => s.updateImage);
  const setBackgroundColor = useEditor((s) => s.setBackgroundColor);
  const endCoalesce = useEditor((s) => s.endCoalesce);
  const bgEditMode = useEditor((s) => s.bgEditMode);
  const setBgEditMode = useEditor((s) => s.setBgEditMode);
  const push = useToasts((s) => s.push);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [customW, setCustomW] = useState(project.size.widthInches);
  const [customH, setCustomH] = useState(project.size.heightInches);

  const doc = docDimensions(project.size);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      push("Please choose an image file.", "warn");
      return;
    }
    try {
      const src = await fileToDataURL(file);
      const dims = await imageDimensions(src);
      setImage(makeImage(src, dims.width, dims.height, project.size));
      push("Image added.", "info", 2000);
    } catch {
      push("Could not load that image.", "error");
    }
  };

  const applyPreset = (id: PosterSizeId) => {
    const preset = SIZE_PRESETS.find((p) => p.id === id);
    if (preset) {
      setSize(makeSize(id, preset.widthInches, preset.heightInches, DEFAULT_DPI));
    }
  };

  const applyOriginal = () => {
    if (!project.image) {
      push("Add an image first to use its dimensions.", "warn");
      return;
    }
    // Use the image's native aspect at DEFAULT_DPI, sized so the long edge is
    // a reasonable print dimension.
    const { naturalWidth, naturalHeight } = project.image;
    const wIn = naturalWidth / DEFAULT_DPI;
    const hIn = naturalHeight / DEFAULT_DPI;
    setSize(makeSize("original", wIn, hIn, DEFAULT_DPI));
  };

  const applyCustom = () => {
    const w = Math.max(1, Math.min(60, customW || 1));
    const h = Math.max(1, Math.min(60, customH || 1));
    setSize(makeSize("custom", w, h, DEFAULT_DPI));
  };

  const refit = (mode: "cover" | "contain") => {
    if (!project.image) return;
    const fn = mode === "cover" ? coverTransform : containTransform;
    const t = fn(project.image.naturalWidth, project.image.naturalHeight, doc.width, doc.height);
    updateImage(t);
  };

  return (
    <>
      <Section title="Poster size">
        <div className="row wrap">
          {SIZE_PRESETS.map((p) => (
            <button
              key={p.id}
              className={`btn${project.size.id === p.id ? " primary" : ""}`}
              onClick={() => applyPreset(p.id)}
            >
              {p.label}
            </button>
          ))}
          <button
            className={`btn${project.size.id === "original" ? " primary" : ""}`}
            onClick={applyOriginal}
          >
            Original
          </button>
        </div>

        <div className="field" style={{ marginTop: 12 }}>
          <label>Custom size (inches)</label>
          <div className="row">
            <input
              type="number"
              min={1}
              max={60}
              step={0.5}
              value={customW}
              onChange={(e) => setCustomW(Number(e.target.value))}
            />
            <span style={{ color: "var(--text-faint)" }}>×</span>
            <input
              type="number"
              min={1}
              max={60}
              step={0.5}
              value={customH}
              onChange={(e) => setCustomH(Number(e.target.value))}
            />
            <button className={`btn${project.size.id === "custom" ? " primary" : ""}`} onClick={applyCustom}>
              Set
            </button>
          </div>
        </div>
        <p className="hint">
          {project.size.widthInches}" × {project.size.heightInches}" · {doc.width} × {doc.height}px @ {project.size.dpi} DPI
        </p>
      </Section>

      <Section title="Background">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <button className="btn primary" style={{ width: "100%" }} onClick={() => fileRef.current?.click()}>
          {project.image ? "Replace image" : "Upload image"}
        </button>

        {project.image && (
          <>
            <div className="row wrap" style={{ marginTop: 10 }}>
              <button className="btn" onClick={() => refit("cover")}>Fill</button>
              <button className="btn" onClick={() => refit("contain")}>Fit</button>
              <button
                className="btn danger"
                onClick={() => {
                  setImage(null);
                  setBgEditMode(false);
                }}
              >
                Remove
              </button>
            </div>

            <button
              className={`btn${bgEditMode ? " primary" : ""}`}
              style={{ width: "100%", marginTop: 10 }}
              onClick={() => setBgEditMode(!bgEditMode)}
            >
              {bgEditMode ? "Done adjusting" : "Adjust background on poster"}
            </button>
            {bgEditMode && (
              <p className="hint" style={{ marginTop: 8 }}>
                Drag on the poster to reposition. Scroll to zoom toward the
                cursor. Click "Done adjusting" when finished.
              </p>
            )}

            <Slider
              label="Image zoom"
              value={project.image.scale * 100}
              min={Math.round(
                Math.min(doc.width / project.image.naturalWidth, doc.height / project.image.naturalHeight) * 100 * 0.5,
              )}
              max={Math.round(
                Math.max(doc.width / project.image.naturalWidth, doc.height / project.image.naturalHeight) * 100 * 3,
              )}
              onChange={(v) => {
                if (!project.image) return;
                // Zoom around the poster center to keep framing stable.
                const old = project.image.scale;
                const next = v / 100;
                const cx = doc.width / 2;
                const cy = doc.height / 2;
                const nx = cx - ((cx - project.image.offsetX) / old) * next;
                const ny = cy - ((cy - project.image.offsetY) / old) * next;
                updateImage({ scale: next, offsetX: nx, offsetY: ny }, "img-zoom");
              }}
              onCommit={endCoalesce}
              suffix="%"
            />
            <Slider
              label="Offset X"
              value={project.image.offsetX}
              min={-doc.width}
              max={doc.width}
              onChange={(v) => updateImage({ offsetX: v }, "img-x")}
              onCommit={endCoalesce}
            />
            <Slider
              label="Offset Y"
              value={project.image.offsetY}
              min={-doc.height}
              max={doc.height}
              onChange={(v) => updateImage({ offsetY: v }, "img-y")}
              onCommit={endCoalesce}
            />
          </>
        )}

        <div className="field" style={{ marginTop: 12 }}>
          <div className="row">
            <ColorField
              value={project.backgroundColor}
              onChange={(v) => setBackgroundColor(v)}
              onCommit={endCoalesce}
            />
            <span className="hint">Background color (shown behind or without an image)</span>
          </div>
        </div>
      </Section>
    </>
  );
}
