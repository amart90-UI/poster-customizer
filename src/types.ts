/**
 * Core data model for the poster editor.
 *
 * Coordinate system
 * -----------------
 * Everything geometric is stored in "document pixels": the poster's pixel
 * dimensions at its export DPI (widthInches * dpi by heightInches * dpi).
 * Text positions, sizes, and the background transform are all in this space.
 *
 * The on-screen editor renders the document scaled to fit the viewport, but
 * that scale never touches the stored data. Export renders the document at
 * 1:1 document pixels, so the preview and the exported file match exactly.
 */

export type ExportFormat = "png" | "jpeg";

export type TextAlign = "left" | "center" | "right";

/** A registered background image, stored as a data URL so projects are portable. */
export interface PosterImage {
  /** Original image encoded as a data URL (base64). Preserved losslessly. */
  src: string;
  /** Natural pixel dimensions of the source image. */
  naturalWidth: number;
  naturalHeight: number;
  /**
   * Placement transform in document space.
   * The image is drawn at (offsetX, offsetY) scaled by `scale` relative to
   * its natural size. `fit()` computes sensible defaults (cover the poster).
   */
  offsetX: number;
  offsetY: number;
  scale: number;
}

/** Optional visual effects applied to a text object. */
export interface TextEffects {
  shadow: {
    enabled: boolean;
    color: string;
    blur: number; // document px
    offsetX: number; // document px
    offsetY: number; // document px
  };
  outline: {
    enabled: boolean;
    color: string;
    width: number; // document px
  };
  background: {
    enabled: boolean;
    color: string;
    /** Padding around the text box, in document px. */
    padding: number;
    /** Corner radius, in document px. */
    radius: number;
  };
}

/** A single editable text object placed on the poster. */
export interface TextObject {
  id: string;
  text: string;

  /** Top-left position in document pixels. */
  x: number;
  y: number;
  /** Box width in document pixels; text wraps within this width. */
  width: number;

  // Typography
  fontFamily: string; // Google Font family name, e.g. "Inter"
  fontWeight: number; // 100..900
  fontSize: number; // document px
  lineHeight: number; // multiplier (e.g. 1.15)
  letterSpacing: number; // document px
  align: TextAlign;
  color: string;
  italic: boolean;
  uppercase: boolean;

  effects: TextEffects;

  /** Rotation in degrees, around the box center. */
  rotation: number;
}

/** Named poster size presets plus custom/original. */
export type PosterSizeId =
  | "8x10"
  | "11x14"
  | "12x18"
  | "18x24"
  | "original"
  | "custom";

export interface PosterSize {
  id: PosterSizeId;
  /** Physical dimensions in inches (used for print + DPI math). */
  widthInches: number;
  heightInches: number;
  /** Dots per inch used to derive document pixel dimensions. */
  dpi: number;
}

/** A complete, self-contained project. */
export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;

  size: PosterSize;
  /** Solid background color shown when there is no image (or behind it). */
  backgroundColor: string;
  image: PosterImage | null;

  texts: TextObject[];
}

/** The serialized project file format written by export / read by import. */
export interface ProjectFile {
  kind: "poster-project";
  version: 1;
  project: Project;
}
