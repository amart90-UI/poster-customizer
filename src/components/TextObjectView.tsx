import { useEffect, useRef } from "react";
import type { TextObject } from "@/types";
import { useEditor } from "@/store/store";
import { displayText } from "@/render/textLayout";

interface Props {
  text: TextObject;
  height: number;
  selected: boolean;
  editing: boolean;
  scale: number;
  onStartMove: (e: React.PointerEvent, t: TextObject) => void;
  onStartResize: (e: React.PointerEvent, t: TextObject, side: "e" | "w") => void;
  onStartRotate: (e: React.PointerEvent, t: TextObject) => void;
}

/**
 * Build the CSS text style that mirrors the canvas renderer's output as closely
 * as the DOM allows. The DOM is used for the interactive preview because it
 * gives crisp, sub-pixel text and native editing; the canvas exporter produces
 * the final image using the same geometry from the shared layout engine.
 */
function textStyle(t: TextObject): React.CSSProperties {
  const shadows: string[] = [];
  if (t.effects.shadow.enabled) {
    const s = t.effects.shadow;
    shadows.push(`${s.offsetX}px ${s.offsetY}px ${s.blur}px ${s.color}`);
  }

  const style: React.CSSProperties = {
    fontFamily: `"${t.fontFamily}"`,
    fontWeight: t.fontWeight,
    fontSize: t.fontSize,
    lineHeight: t.lineHeight,
    letterSpacing: t.letterSpacing,
    textAlign: t.align,
    color: t.color,
    fontStyle: t.italic ? "italic" : "normal",
    textTransform: t.uppercase ? "uppercase" : "none",
    textShadow: shadows.length ? shadows.join(", ") : undefined,
  };

  if (t.effects.outline.enabled) {
    // WebkitTextStroke matches the canvas stroke reasonably for preview.
    style.WebkitTextStroke = `${t.effects.outline.width}px ${t.effects.outline.color}`;
    style.paintOrder = "stroke fill";
  }

  if (t.effects.background.enabled) {
    style.background = t.effects.background.color;
    style.padding = t.effects.background.padding;
    style.borderRadius = t.effects.background.radius;
    // Expand the box so padding sits outside the text width, matching canvas.
    style.margin = -t.effects.background.padding;
  }

  return style;
}

export function TextObjectView({
  text: t,
  height,
  selected,
  editing,
  scale,
  onStartMove,
  onStartResize,
  onStartRotate,
}: Props) {
  const updateText = useEditor((s) => s.updateText);
  const setEditing = useEditor((s) => s.setEditing);
  const endCoalesce = useEditor((s) => s.endCoalesce);
  const editRef = useRef<HTMLDivElement | null>(null);

  // When entering edit mode, seed the element's text imperatively (so React
  // never re-renders its children and disturbs the caret), focus it, and place
  // the caret at the end.
  useEffect(() => {
    if (editing && editRef.current) {
      const el = editRef.current;
      el.textContent = t.text;
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
    // Intentionally only re-run when entering/leaving edit mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const boxStyle: React.CSSProperties = {
    left: t.x,
    top: t.y,
    width: t.width,
    transform: `rotate(${t.rotation}deg)`,
    ...textStyle(t),
  };

  // Handles are drawn in screen space so they stay a constant size regardless
  // of zoom. We counter-scale them by dividing by the stage scale.
  const inv = 1 / scale;

  const commitText = () => {
    const el = editRef.current;
    if (!el) return;
    // Read back plain text with newlines. contentEditable uses <div>/<br>.
    const raw = el.innerText.replace(/\u00a0/g, " ");
    updateText(t.id, { text: raw }, `edit-${t.id}`);
    endCoalesce();
  };

  return (
    <>
      <div
        className={`text-object${editing ? " editing" : ""}`}
        style={boxStyle}
        onPointerDown={(e) => {
          if (!editing) onStartMove(e, t);
        }}
        onDoubleClick={() => setEditing(t.id)}
      >
        {editing ? (
          <div
            ref={editRef}
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            style={{ outline: "none", cursor: "text", minHeight: "1em" }}
            onInput={commitText}
            onBlur={() => {
              commitText();
              setEditing(null);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              // Escape exits editing; Enter inserts newline (default).
              if (e.key === "Escape") {
                e.preventDefault();
                (e.target as HTMLElement).blur();
              }
              e.stopPropagation();
            }}
          />
        ) : (
          <span style={{ pointerEvents: "none" }}>{displayText(t) || "\u00a0"}</span>
        )}
      </div>

      {selected && !editing && (
        <div
          className="selection-box"
          style={{
            left: t.x,
            top: t.y,
            width: t.width,
            height,
            transform: `rotate(${t.rotation}deg)`,
          }}
        >
          <div
            className="handle rotate"
            style={{ transform: `translateX(-50%) scale(${inv})` }}
            onPointerDown={(e) => onStartRotate(e, t)}
          />
          <div
            className="handle w"
            style={{ transform: `translateY(-50%) scale(${inv})` }}
            onPointerDown={(e) => onStartResize(e, t, "w")}
          />
          <div
            className="handle e"
            style={{ transform: `translateY(-50%) scale(${inv})` }}
            onPointerDown={(e) => onStartResize(e, t, "e")}
          />
        </div>
      )}
    </>
  );
}
