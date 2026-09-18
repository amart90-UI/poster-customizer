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

/**
 * Re-frame an image transform when the poster document changes size while
 * preserving the user's framing intent (option A).
 *
 * The point of the image currently under the OLD poster center is kept under
 * the NEW poster center, and the existing zoom is preserved. If the current
 * scale no longer covers the new poster, it is increased to the minimum that
 * does (still anchored at the center). Finally offsets are clamped so the image
 * never leaves a visible gap at any edge.
 *
 * This makes size changes gentle and predictable instead of snapping back to a
 * fresh cover-and-center each time.
 */
export function reframeTransform(
  image: Pick<PosterImage, "naturalWidth" | "naturalHeight" | "scale" | "offsetX" | "offsetY">,
  oldDocWidth: number,
  oldDocHeight: number,
  newDocWidth: number,
  newDocHeight: number,
): { scale: number; offsetX: number; offsetY: number } {
  const { naturalWidth, naturalHeight } = image;

  // The image-space point (in natural pixels) currently at the old center.
  // doc = offset + natural * scale  ->  natural = (docPoint - offset) / scale
  const focalNX = (oldDocWidth / 2 - image.offsetX) / image.scale;
  const focalNY = (oldDocHeight / 2 - image.offsetY) / image.scale;

  // Keep the current zoom, but never below what covers the new poster.
  const minScale = Math.max(newDocWidth / naturalWidth, newDocHeight / naturalHeight);
  const scale = Math.max(image.scale, minScale);

  // Place that focal point at the new center.
  let offsetX = newDocWidth / 2 - focalNX * scale;
  let offsetY = newDocHeight / 2 - focalNY * scale;

  // Clamp so the drawn image always covers the poster (no background gap).
  const drawnW = naturalWidth * scale;
  const drawnH = naturalHeight * scale;
  // Left edge must be <= 0 and right edge (offset + drawn) must be >= docWidth.
  offsetX = Math.min(0, Math.max(offsetX, newDocWidth - drawnW));
  offsetY = Math.min(0, Math.max(offsetY, newDocHeight - drawnH));

  return { scale, offsetX, offsetY };
}

/**
 * The minimum scale at which the image still fully covers the poster. Used to
 * stop the user from zooming out so far that a background gap appears.
 */
export function minCoverScale(
  naturalWidth: number,
  naturalHeight: number,
  docWidth: number,
  docHeight: number,
): number {
  return Math.max(docWidth / naturalWidth, docHeight / naturalHeight);
}

/**
 * Clamp an image offset so the drawn image always covers the poster (no gap at
 * any edge). Assumes the scale is already >= minCoverScale.
 */
export function clampOffset(
  naturalWidth: number,
  naturalHeight: number,
  scale: number,
  offsetX: number,
  offsetY: number,
  docWidth: number,
  docHeight: number,
): { offsetX: number; offsetY: number } {
  const drawnW = naturalWidth * scale;
  const drawnH = naturalHeight * scale;
  return {
    offsetX: Math.min(0, Math.max(offsetX, docWidth - drawnW)),
    offsetY: Math.min(0, Math.max(offsetY, docHeight - drawnH)),
  };
}

/**
 * Zoom an image transform toward a fixed document-space anchor point (e.g. the
 * cursor), keeping that anchor visually stationary. The new scale is clamped to
 * at least cover the poster, and offsets are clamped to avoid gaps.
 */
export function zoomAtPoint(
  image: Pick<PosterImage, "naturalWidth" | "naturalHeight" | "scale" | "offsetX" | "offsetY">,
  nextScaleRaw: number,
  anchorDocX: number,
  anchorDocY: number,
  docWidth: number,
  docHeight: number,
): { scale: number; offsetX: number; offsetY: number } {
  const min = minCoverScale(image.naturalWidth, image.naturalHeight, docWidth, docHeight);
  const scale = Math.max(min, Math.min(nextScaleRaw, min * 12));

  // The image-space point currently under the anchor stays under the anchor.
  const imgX = (anchorDocX - image.offsetX) / image.scale;
  const imgY = (anchorDocY - image.offsetY) / image.scale;
  let offsetX = anchorDocX - imgX * scale;
  let offsetY = anchorDocY - imgY * scale;

  const clamped = clampOffset(
    image.naturalWidth,
    image.naturalHeight,
    scale,
    offsetX,
    offsetY,
    docWidth,
    docHeight,
  );
  offsetX = clamped.offsetX;
  offsetY = clamped.offsetY;

  return { scale, offsetX, offsetY };
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
    background: { enabled: false, color: "#2B323F", padding: 16, radius: 8 },
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
    color: "#F8EED1",
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
    backgroundColor: "#2B323F",
    image: null,
    template: null,
    texts: [],
  };
}
