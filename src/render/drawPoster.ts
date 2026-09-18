import type { Project, TextObject } from "@/types";
import { docDimensions } from "@/model/poster";
import { displayText, fontShorthand, layoutText, type TextLayout } from "@/render/textLayout";

/**
 * Canvas rendering of a poster in document pixels. Used by the exporter (and
 * available for thumbnails). The on-screen editor uses DOM for crisp,
 * interactive text, but its styling is kept in lockstep with this via the
 * shared layout engine and identical effect definitions.
 */

export interface DrawOptions {
  /** Image element to use for the background (already loaded). */
  image?: HTMLImageElement | null;
  /** Scale factor applied to the whole drawing (1 = full document pixels). */
  scale?: number;
}

function roundRect(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}

/** Draw one line of text at (x baseline handled by caller) honoring spacing. */
function drawLine(
  c: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
  stroke: boolean,
) {
  if (spacing === 0) {
    if (stroke) c.strokeText(text, x, y);
    else c.fillText(text, x, y);
    return;
  }
  let cursor = x;
  for (const ch of text) {
    if (stroke) c.strokeText(ch, cursor, y);
    else c.fillText(ch, cursor, y);
    cursor += c.measureText(ch).width + spacing;
  }
}

/** X offset for a line based on alignment within the box width. */
function alignOffset(align: TextObject["align"], boxWidth: number, lineWidth: number): number {
  if (align === "center") return (boxWidth - lineWidth) / 2;
  if (align === "right") return boxWidth - lineWidth;
  return 0;
}

export function drawTextObject(
  c: CanvasRenderingContext2D,
  t: TextObject,
  layout: TextLayout,
) {
  c.save();

  // Rotate around the box center.
  const cx = t.x + t.width / 2;
  const cy = t.y + layout.height / 2;
  c.translate(cx, cy);
  c.rotate((t.rotation * Math.PI) / 180);
  c.translate(-cx, -cy);

  c.font = layout.font;
  // Use the "middle" baseline and place each line at the vertical center of its
  // line box. CSS line-height centers glyphs within the line box the same way,
  // so this keeps the canvas export vertically aligned with the DOM preview.
  c.textBaseline = "middle";
  c.textAlign = "left";

  // Text background panel.
  if (t.effects.background.enabled) {
    const pad = t.effects.background.padding;
    c.save();
    c.fillStyle = t.effects.background.color;
    roundRect(c, t.x - pad, t.y - pad, t.width + pad * 2, layout.height + pad * 2, t.effects.background.radius);
    c.fill();
    c.restore();
  }

  const spacing = t.letterSpacing;

  layout.lines.forEach((line, i) => {
    // Center of this line's box (matches CSS line-height centering).
    const lineY = t.y + i * layout.lineStep + layout.lineStep / 2;
    const ox = alignOffset(t.align, t.width, line.width);
    const lineX = t.x + ox;

    // Shadow is applied to the fill pass only.
    if (t.effects.shadow.enabled) {
      c.save();
      c.shadowColor = t.effects.shadow.color;
      c.shadowBlur = t.effects.shadow.blur;
      c.shadowOffsetX = t.effects.shadow.offsetX;
      c.shadowOffsetY = t.effects.shadow.offsetY;
      c.fillStyle = t.color;
      drawLine(c, line.text, lineX, lineY, spacing, false);
      c.restore();
    }

    // Outline (stroke) drawn under the fill for a clean edge.
    if (t.effects.outline.enabled) {
      c.save();
      c.lineJoin = "round";
      c.miterLimit = 2;
      c.lineWidth = t.effects.outline.width;
      c.strokeStyle = t.effects.outline.color;
      drawLine(c, line.text, lineX, lineY, spacing, true);
      c.restore();
    }

    // Main fill (no shadow so we don't double-shadow).
    c.save();
    c.fillStyle = t.color;
    drawLine(c, line.text, lineX, lineY, spacing, false);
    c.restore();
  });

  c.restore();
}

/**
 * Draw the entire poster to a context sized to the document (times scale).
 * The caller must ensure the canvas is `docWidth*scale` by `docHeight*scale`.
 */
export function drawPoster(
  c: CanvasRenderingContext2D,
  project: Project,
  opts: DrawOptions = {},
) {
  const scale = opts.scale ?? 1;
  const { width, height } = docDimensions(project.size);

  c.save();
  c.scale(scale, scale);

  // Background color.
  c.fillStyle = project.backgroundColor;
  c.fillRect(0, 0, width, height);

  // Background image (clipped to the poster).
  if (project.image && opts.image) {
    const img = project.image;
    c.save();
    c.beginPath();
    c.rect(0, 0, width, height);
    c.clip();
    c.drawImage(
      opts.image,
      img.offsetX,
      img.offsetY,
      img.naturalWidth * img.scale,
      img.naturalHeight * img.scale,
    );
    c.restore();
  }

  // Text objects, in order (last = front).
  for (const t of project.texts) {
    const layout = layoutText(t);
    // Ensure the measurement font matches what we draw.
    c.font = fontShorthand(t);
    void displayText(t);
    drawTextObject(c, t, layout);
  }

  c.restore();
}
