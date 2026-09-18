import { nanoid } from "nanoid";
import type {
  PosterImage,
  PosterSize,
  PosterSizeId,
  Project,
  TextEffects,
  TextObject,
} from "@/types";

/** Default DPI used for presets. 150 balances print quality with performance. */
export const DEFAULT_DPI = 150;

export interface SizePreset {
  id: PosterSizeId;
  label: string;
  widthInches: number;
  heightInches: number;
}

/**
 * Built-in poster size presets. "original" and "custom" are handled
 * specially (they depend on the loaded image / user input) and are not listed
 * here with fixed inch values.
 */
export const SIZE_PRESETS: SizePreset[] = [
  { id: "8x10", label: '8 × 10"', widthInches: 8, heightInches: 10 },
  { id: "11x14", label: '11 × 14"', widthInches: 11, heightInches: 14 },
  { id: "12x18", label: '12 × 18"', widthInches: 12, heightInches: 18 },
  { id: "18x24", label: '18 × 24"', widthInches: 18, heightInches: 24 },
];

/** Document pixel dimensions for a given poster size. */
export function docDimensions(size: PosterSize): { width: number; height: number } {
  return {
    width: Math.round(size.widthInches * size.dpi),
    height: Math.round(size.heightInches * size.dpi),
  };
}

export function makeSize(id: PosterSizeId, widthInches: number, heightInches: number, dpi = DEFAULT_DPI): PosterSize {
  return { id, widthInches, heightInches, dpi };
}

/**
 * Compute the image transform that covers the poster (like CSS
 * `background-size: cover`) and centers it. Non-destructive: only the
 * transform changes, never the source pixels.
 */
export function coverTransform(
  naturalWidth: number,
  naturalHeight: number,
  docWidth: number,
  docHeight: number,
): { scale: number; offsetX: number; offsetY: number } {
  const scale = Math.max(docWidth / naturalWidth, docHeight / naturalHeight);
  const drawnW = naturalWidth * scale;
  const drawnH = naturalHeight * scale;
  return {
    scale,
    offsetX: (docWidth - drawnW) / 2,
    offsetY: (docHeight - drawnH) / 2,
  };
}

/** Contain transform: whole image visible, centered (letterboxed). */
export function containTransform(
  naturalWidth: number,
  naturalHeight: number,
  docWidth: number,
  docHeight: number,
): { scale: number; offsetX: number; offsetY: number } {
  const scale = Math.min(docWidth / naturalWidth, docHeight / naturalHeight);
  const drawnW = naturalWidth * scale;
  const drawnH = naturalHeight * scale;
  return {
    scale,
    offsetX: (docWidth - drawnW) / 2,
    offsetY: (docHeight - drawnH) / 2,
  };
}

export function makeImage(
  src: string,
  naturalWidth: number,
  naturalHeight: number,
  size: PosterSize,
): PosterImage {
  const { width, height } = docDimensions(size);
  const t = coverTransform(naturalWidth, naturalHeight, width, height);
  return { src, naturalWidth, naturalHeight, ...t };
}

export function defaultEffects(): TextEffects {
  return {
    shadow: { enabled: false, color: "#000000", blur: 8, offsetX: 0, offsetY: 4 },
    outline: { enabled: false, color: "#000000", width: 3 },
    background: { enabled: false, color: "#000000", padding: 16, radius: 8 },
  };
}

/**
 * Create a new text object with sensible defaults so it already looks good.
 * Positioned centered horizontally near the top-center by default; caller may
 * override x/y. Sizes scale with the document so text reads well at any DPI.
 */
export function makeText(size: PosterSize, overrides: Partial<TextObject> = {}): TextObject {
  const { width: docW, height: docH } = docDimensions(size);
  // Base the default font size on the poster's smaller dimension so it looks
  // proportional regardless of aspect ratio.
  const base = Math.min(docW, docH);
  const fontSize = Math.round(base * 0.09);
  const boxWidth = Math.round(docW * 0.8);
  const x = Math.round((docW - boxWidth) / 2);
  const y = Math.round(docH * 0.5 - fontSize * 0.75);

  return {
    id: nanoid(8),
    text: "Your text",
    x,
    y,
    width: boxWidth,
    fontFamily: "Inter",
    fontWeight: 700,
    fontSize,
    lineHeight: 1.15,
    letterSpacing: 0,
    align: "center",
    color: "#ffffff",
    italic: false,
    uppercase: false,
    effects: {
      ...defaultEffects(),
      // A subtle shadow by default keeps text legible over photos.
      shadow: { enabled: true, color: "#000000", blur: Math.round(base * 0.012), offsetX: 0, offsetY: Math.round(base * 0.004) },
    },
    rotation: 0,
    ...overrides,
  };
}

export function createProject(name = "Untitled poster"): Project {
  const now = Date.now();
  const size = makeSize("11x14", 11, 14);
  return {
    id: nanoid(10),
    name,
    createdAt: now,
    updatedAt: now,
    size,
    backgroundColor: "#1b1b1f",
    image: null,
    texts: [],
  };
}
