import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor } from "@/store/store";
import { clampOffset, docDimensions, zoomAtPoint } from "@/model/poster";
import { useElementSize } from "@/hooks/useElementSize";
import { layoutText } from "@/render/textLayout";
import { snapBox, type SnapGuide } from "@/render/snapping";
import { TextObjectView } from "@/components/TextObjectView";
import { resolveTemplateLayerUrls } from "@/templates/registry";
import type { TextObject } from "@/types";

/** Margin (in inches) used for margin snapping/guides. */
const MARGIN_INCHES = 0.5;

type DragState =
  | { kind: "move"; id: string; startX: number; startY: number; objX: number; objY: number }
  | { kind: "resize-e"; id: string; startX: number; objX: number; objW: number }
  | { kind: "resize-w"; id: string; startX: number; objX: number; objW: number }
  | { kind: "rotate"; id: string; cx: number; cy: number; startAngle: number; objRot: number }
  | { kind: "bg-pan"; startX: number; startY: number; imgX: number; imgY: number };

export function Stage() {
  const project = useEditor((s) => s.project);
  const selectedIds = useEditor((s) => s.selectedIds);
  const editingId = useEditor((s) => s.editingId);
  const select = useEditor((s) => s.select);
  const updateText = useEditor((s) => s.updateText);
  const updateImage = useEditor((s) => s.updateImage);
  const endCoalesce = useEditor((s) => s.endCoalesce);
  const bgEditMode = useEditor((s) => s.bgEditMode);

  const { ref: wrapRef, size: wrapSize } = useElementSize<HTMLDivElement>();
  const doc = docDimensions(project.size);
  const margin = MARGIN_INCHES * project.size.dpi;

  // Ordered (back-to-front) template layer image URLs, if a template is active.
  const templateLayerUrls = resolveTemplateLayerUrls(project.template);

  // Fit the document within the viewport with padding.
  const scale = useMemo(() => {
    const pad = 48;
    const availW = Math.max(1, wrapSize.width - pad * 2);
    const availH = Math.max(1, wrapSize.height - pad * 2);
    if (wrapSize.width === 0) return 0.2;
    return Math.min(availW / doc.width, availH / doc.height, 1.5);
  }, [wrapSize, doc.width, doc.height]);

  // The sizer takes up the SCALED on-screen size so the flex container centers
  // it correctly. The inner .stage keeps full document pixel dimensions and is
  // scaled from its top-left corner to fit exactly inside the sizer. (Scaling
  // the .stage directly would leave its layout box at full document size, so a
  // large poster's box would extend far past the viewport and get mis-centered.)
  const sizerStyle: React.CSSProperties = {
    width: doc.width * scale,
    height: doc.height * scale,
  };
  const stageStyle: React.CSSProperties = {
    width: doc.width,
    height: doc.height,
    transform: `scale(${scale})`,
    transformOrigin: "top left",
  };

  const [drag, setDrag] = useState<DragState | null>(null);
  const [guides, setGuides] = useState<SnapGuide[]>([]);
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;
  const stageRef = useRef<HTMLDivElement | null>(null);

  // Precompute layouts (heights) for text objects.
  const layouts = useMemo(() => {
    const map = new Map<string, ReturnType<typeof layoutText>>();
    for (const t of project.texts) map.set(t.id, layoutText(t));
    return map;
  }, [project.texts]);

  const clientToDoc = useCallback(
    (clientX: number, clientY: number) => {
      const wrap = wrapRef.current;
      if (!wrap) return { x: 0, y: 0 };
      const stageEl = wrap.querySelector(".stage") as HTMLElement | null;
      const rect = stageEl?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left) / scale,
        y: (clientY - rect.top) / scale,
      };
    },
    [scale, wrapRef],
  );

  // Pointer handlers for drag/resize/rotate at the document level.
  useEffect(() => {
    if (!drag) return;

    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const p = clientToDoc(e.clientX, e.clientY);

      // Background pan is independent of any text object; handle it first.
      if (d.kind === "bg-pan") {
        const img = project.image;
        if (!img) return;
        const nx = d.imgX + (p.x - d.startX);
        const ny = d.imgY + (p.y - d.startY);
        const clamped = clampOffset(
          img.naturalWidth,
          img.naturalHeight,
          img.scale,
          nx,
          ny,
          doc.width,
          doc.height,
        );
        updateImage({ offsetX: clamped.offsetX, offsetY: clamped.offsetY }, "bg-pan");
        return;
      }

      const t = project.texts.find((x) => x.id === d.id);
      if (!t) return;
      const layout = layouts.get(d.id);
      const height = layout?.height ?? t.fontSize;

      if (d.kind === "move") {
        const rawX = d.objX + (p.x - d.startX);
        const rawY = d.objY + (p.y - d.startY);

        // Holding Shift temporarily disables snapping for free positioning.
        if (e.shiftKey) {
          setGuides([]);
          updateText(d.id, { x: Math.round(rawX), y: Math.round(rawY) }, `move-${d.id}`);
        } else {
          const snap = snapBox({
            x: rawX,
            y: rawY,
            width: t.width,
            height,
            docWidth: doc.width,
            docHeight: doc.height,
            threshold: 8 / scale,
            margin,
          });
          setGuides(snap.guides);
          updateText(d.id, { x: Math.round(snap.x), y: Math.round(snap.y) }, `move-${d.id}`);
        }
      } else if (d.kind === "resize-e") {
        const nw = Math.max(24, Math.round(d.objW + (p.x - d.startX)));
        updateText(d.id, { width: nw }, `resize-${d.id}`);
      } else if (d.kind === "resize-w") {
        const dx = p.x - d.startX;
        const nw = Math.max(24, Math.round(d.objW - dx));
        const nx = Math.round(d.objX + (d.objW - nw));
        updateText(d.id, { width: nw, x: nx }, `resize-${d.id}`);
      } else if (d.kind === "rotate") {
        const angle = (Math.atan2(p.y - d.cy, p.x - d.cx) * 180) / Math.PI;
        let rot = d.objRot + (angle - d.startAngle);
        // Snap rotation to 15° increments unless shift is held.
        if (!e.shiftKey) rot = Math.round(rot / 15) * 15;
        updateText(d.id, { rotation: Math.round(rot) }, `rotate-${d.id}`);
      }
    };

    const onUp = () => {
      setDrag(null);
      setGuides([]);
      endCoalesce();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [drag, clientToDoc, project.texts, project.image, layouts, doc.width, doc.height, scale, margin, updateText, updateImage, endCoalesce]);

  const startMove = (e: React.PointerEvent, t: TextObject) => {
    if (editingId === t.id) return; // don't drag while editing text
    e.preventDefault();
    const p = clientToDoc(e.clientX, e.clientY);
    select(t.id);
    setDrag({ kind: "move", id: t.id, startX: p.x, startY: p.y, objX: t.x, objY: t.y });
  };

  const startResize = (e: React.PointerEvent, t: TextObject, side: "e" | "w") => {
    e.preventDefault();
    e.stopPropagation();
    const p = clientToDoc(e.clientX, e.clientY);
    setDrag(
      side === "e"
        ? { kind: "resize-e", id: t.id, startX: p.x, objX: t.x, objW: t.width }
        : { kind: "resize-w", id: t.id, startX: p.x, objX: t.x, objW: t.width },
    );
  };

  const startRotate = (e: React.PointerEvent, t: TextObject) => {
    e.preventDefault();
    e.stopPropagation();
    const layout = layouts.get(t.id);
    const height = layout?.height ?? t.fontSize;
    const cx = t.x + t.width / 2;
    const cy = t.y + height / 2;
    const p = clientToDoc(e.clientX, e.clientY);
    const startAngle = (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI;
    setDrag({ kind: "rotate", id: t.id, cx, cy, startAngle, objRot: t.rotation });
  };

  const onStageBackgroundDown = (e: React.PointerEvent) => {
    if (bgEditMode) {
      // In background-edit mode, dragging anywhere pans the image.
      if (!project.image) return;
      e.preventDefault();
      const p = clientToDoc(e.clientX, e.clientY);
      setDrag({
        kind: "bg-pan",
        startX: p.x,
        startY: p.y,
        imgX: project.image.offsetX,
        imgY: project.image.offsetY,
      });
      return;
    }
    // Otherwise, clicking empty stage clears selection.
    if (e.target === e.currentTarget) select(null);
  };

  // Wheel zoom in background-edit mode, centered on the cursor. Attached as a
  // non-passive listener so we can preventDefault (React binds wheel passively).
  useEffect(() => {
    const el = stageRef.current;
    if (!el || !bgEditMode) return;

    let endTimer: number | null = null;
    const onWheel = (e: WheelEvent) => {
      const img = useEditor.getState().project.image;
      if (!img) return;
      e.preventDefault();
      const p = clientToDoc(e.clientX, e.clientY);
      // Scroll up (negative deltaY) zooms in; smooth exponential response.
      const factor = Math.exp(-e.deltaY * 0.0015);
      const t = zoomAtPoint(img, img.scale * factor, p.x, p.y, doc.width, doc.height);
      updateImage(t, "bg-zoom");
      // End the coalesce run once scrolling pauses, so each zoom "session" is a
      // single undo step.
      if (endTimer) window.clearTimeout(endTimer);
      endTimer = window.setTimeout(() => useEditor.getState().endCoalesce(), 250);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      if (endTimer) window.clearTimeout(endTimer);
    };
  }, [bgEditMode, clientToDoc, doc.width, doc.height, updateImage]);

  return (
    <div className="stage-wrap" ref={wrapRef}>
      <div className="stage-sizer" style={sizerStyle}>
        <div
          className={`stage${bgEditMode ? " bg-edit" : ""}`}
          ref={stageRef}
          style={stageStyle}
          onPointerDown={onStageBackgroundDown}
        >
        {/* Background */}
        <div className="poster-bg" style={{ background: project.backgroundColor }}>
          {/* Template layers: contained + centered, stacked back-to-front. */}
          {templateLayerUrls.map((url) => (
            <img
              key={url}
              className="template-layer"
              src={url}
              alt=""
              draggable={false}
            />
          ))}
          {project.image && (
            <img
              src={project.image.src}
              alt=""
              draggable={false}
              style={{
                left: project.image.offsetX,
                top: project.image.offsetY,
                width: project.image.naturalWidth * project.image.scale,
                height: project.image.naturalHeight * project.image.scale,
              }}
            />
          )}
        </div>

        {/* Text objects */}
        {project.texts.map((t) => (
          <TextObjectView
            key={t.id}
            text={t}
            height={layouts.get(t.id)?.height ?? t.fontSize}
            selected={selectedIds.includes(t.id)}
            editing={editingId === t.id}
            scale={scale}
            onStartMove={startMove}
            onStartResize={startResize}
            onStartRotate={startRotate}
          />
        ))}

        {/* Alignment guides */}
        {guides.map((g, i) =>
          g.orientation === "v" ? (
            <div key={`v${i}`} className="guide v" style={{ left: g.pos }} />
          ) : (
            <div key={`h${i}`} className="guide h" style={{ top: g.pos }} />
          ),
        )}
        </div>
      </div>
    </div>
  );
}
