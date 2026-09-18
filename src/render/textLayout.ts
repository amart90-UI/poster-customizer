import type { TextObject } from "@/types";

/**
 * Shared text layout engine.
 *
 * Both the on-screen preview and the export renderer use this so wrapping,
 * line height, and the resulting box are identical. All measurements are in
 * document pixels. Measurement uses a canvas 2D context (the same primitive
 * the exporter draws with), which is the source of truth for glyph widths.
 */

export interface LaidOutLine {
  text: string;
  width: number; // measured width in document px
}

export interface TextLayout {
  lines: LaidOutLine[];
  /** Total height of the text block in document px. */
  height: number;
  /** Per-line advance (fontSize * lineHeight) in document px. */
  lineStep: number;
  /** The font shorthand used for measurement/drawing. */
  font: string;
}

let measureCtx: CanvasRenderingContext2D | null = null;
function ctx(): CanvasRenderingContext2D {
  if (!measureCtx) {
    const c = document.createElement("canvas");
    measureCtx = c.getContext("2d");
  }
  if (!measureCtx) throw new Error("Canvas 2D context unavailable");
  return measureCtx;
}

export function fontShorthand(t: Pick<TextObject, "italic" | "fontWeight" | "fontSize" | "fontFamily">): string {
  const style = t.italic ? "italic " : "";
  return `${style}${t.fontWeight} ${t.fontSize}px "${t.fontFamily}"`;
}

/** Apply the transformed display text (uppercase option). */
export function displayText(t: Pick<TextObject, "text" | "uppercase">): string {
  return t.uppercase ? t.text.toUpperCase() : t.text;
}

/**
 * Measure a string's advance width including letter spacing. `letterSpacing`
 * adds `spacing` px after each character (matching CSS letter-spacing closely
 * enough for layout, and matching how we draw with per-glyph spacing).
 */
function measureWithSpacing(c: CanvasRenderingContext2D, text: string, spacing: number): number {
  if (spacing === 0) return c.measureText(text).width;
  let w = 0;
  for (const ch of text) {
    w += c.measureText(ch).width + spacing;
  }
  // Trailing spacing after last glyph is typically not counted.
  return w - spacing;
}

/**
 * Wrap `text` into lines that fit `maxWidth`. Respects explicit newlines and
 * breaks long words by character when a single word exceeds the width.
 */
export function layoutText(
  t: Pick<
    TextObject,
    | "text"
    | "uppercase"
    | "italic"
    | "fontWeight"
    | "fontSize"
    | "fontFamily"
    | "lineHeight"
    | "letterSpacing"
    | "width"
  >,
): TextLayout {
  const c = ctx();
  const font = fontShorthand(t);
  c.font = font;
  const maxWidth = Math.max(1, t.width);
  const spacing = t.letterSpacing;
  const source = displayText(t);

  const lines: LaidOutLine[] = [];

  const pushLine = (str: string) => {
    lines.push({ text: str, width: measureWithSpacing(c, str, spacing) });
  };

  for (const rawLine of source.split("\n")) {
    if (rawLine.length === 0) {
      pushLine("");
      continue;
    }
    const words = rawLine.split(/(\s+)/); // keep whitespace tokens
    let current = "";

    const wordWidth = (w: string) => measureWithSpacing(c, w, spacing);

    for (const token of words) {
      const candidate = current + token;
      if (wordWidth(candidate) <= maxWidth || current === "") {
        // If a single token itself is too wide, hard-break it by character.
        if (current === "" && wordWidth(token) > maxWidth && token.trim() !== "") {
          let chunk = "";
          for (const ch of token) {
            if (wordWidth(chunk + ch) > maxWidth && chunk !== "") {
              pushLine(chunk);
              chunk = ch;
            } else {
              chunk += ch;
            }
          }
          current = chunk;
        } else {
          current = candidate;
        }
      } else {
        pushLine(current.replace(/\s+$/, ""));
        current = token.replace(/^\s+/, "");
      }
    }
    pushLine(current.replace(/\s+$/, ""));
  }

  const lineStep = t.fontSize * t.lineHeight;
  const height = lines.length * lineStep;
  return { lines, height, lineStep, font };
}
