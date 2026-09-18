import type { ExportFormat, Project } from "@/types";
import { docDimensions } from "@/model/poster";
import { drawPoster } from "@/render/drawPoster";
import { ensureFontsForExport } from "@/fonts/registry";
import { resolveTemplateLayerUrls } from "@/templates/registry";

/** Load an image element from a data URL / URL and await decode. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

export interface ResolutionCheck {
  /** Effective DPI the source image provides at the current placement. */
  effectiveDpi: number;
  /** True when the source has enough pixels for a crisp print (>= ~150 DPI). */
  sufficient: boolean;
  message: string | null;
}

/**
 * Estimate the effective print resolution of the background image. We compare
 * the source pixels mapped onto the poster to the physical poster size. If the
 * image is being upscaled beyond its native pixels, effective DPI drops.
 */
export function checkResolution(project: Project): ResolutionCheck {
  if (!project.image) {
    return { effectiveDpi: project.size.dpi, sufficient: true, message: null };
  }
  const { width: docW, height: docH } = docDimensions(project.size);
  const img = project.image;

  // Pixels of source covering the poster area (approx): source is scaled by
  // img.scale into document space. Native source pixels per document pixel:
  const sourcePerDoc = 1 / img.scale;
  // Effective DPI = document DPI * (source pixels available per doc pixel),
  // capped at the document DPI (extra source detail can't exceed doc DPI).
  const effectiveDpi = Math.min(project.size.dpi, project.size.dpi * sourcePerDoc);

  void docW;
  void docH;

  const GOOD = 150;
  const OK = 100;
  if (effectiveDpi >= GOOD) {
    return { effectiveDpi, sufficient: true, message: null };
  }
  const rounded = Math.round(effectiveDpi);
  if (effectiveDpi >= OK) {
    return {
      effectiveDpi,
      sufficient: false,
      message: `Image resolution is about ${rounded} DPI at this size. Fine for viewing, a bit soft for print.`,
    };
  }
  return {
    effectiveDpi,
    sufficient: false,
    message: `Image is only about ${rounded} DPI at this size and may look blurry when printed. Consider a smaller poster size or a higher-resolution image.`,
  };
}

export interface ExportOptions {
  format: ExportFormat;
  /** JPEG quality 0..1 (ignored for PNG). */
  quality?: number;
  /**
   * Scale multiplier for the output relative to the document pixel size.
   * 1 = exactly the document (widthInches*dpi). Usually 1.
   */
  scale?: number;
}

/**
 * Render the poster at full document resolution using the ORIGINAL image and
 * return a Blob. Fonts are awaited so the export never falls back to a system
 * face. This uses the same `drawPoster` routine as the rest of the app, so the
 * output matches the editing preview.
 */
export async function renderPosterToBlob(
  project: Project,
  opts: ExportOptions,
): Promise<Blob> {
  const scale = opts.scale ?? 1;
  const { width, height } = docDimensions(project.size);

  // Ensure all fonts used are ready.
  await ensureFontsForExport(
    project.texts.map((t) => ({
      family: t.fontFamily,
      weight: t.fontWeight,
      italic: t.italic,
      text: t.text,
    })),
  );

  const image = project.image ? await loadImage(project.image.src) : null;

  // Load template layer SVGs (if any). Drawn to canvas, SVGs rasterize at the
  // target draw size, so they stay crisp at full export resolution.
  const layerUrls = resolveTemplateLayerUrls(project.template);
  const templateLayers = await Promise.all(layerUrls.map((u) => loadImage(u)));

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // JPEG has no alpha; fill white behind everything so transparent areas print
  // white rather than black.
  if (opts.format === "jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  drawPoster(ctx, project, { image, scale, templateLayers });

  const mime = opts.format === "png" ? "image/png" : "image/jpeg";
  const quality = opts.format === "jpeg" ? opts.quality ?? 0.92 : undefined;

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to encode image"));
      },
      mime,
      quality,
    );
  });
}

/** Trigger a browser download for a Blob. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke shortly after to allow the download to start.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9\-_ ]/gi, "").trim().replace(/\s+/g, "-") || "poster";
}
