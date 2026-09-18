/**
 * Poster template registry.
 *
 * A template is a shared background plus a set of swappable layers (here:
 * "figures" and "logo"), each composited over the background and under the
 * user's text. Adding another template is a matter of adding assets and a new
 * entry to `TEMPLATES` below.
 *
 * The SVGs are imported with Vite's `?url` suffix so they become hashed asset
 * URLs in the build. They are drawn onto the canvas (preview + export) as
 * images, so they stay crisp at any resolution.
 *
 * All layers of a template are authored on the same artboard. `canvasWidth`/
 * `canvasHeight` describe that artboard; layers are drawn to fill the poster,
 * and any layer authored on a slightly different artboard is centered so the
 * pieces still line up (see the renderer).
 */

import backgroundUrl from "@/assets/templates/hoss/background.svg?url";
import figures1Url from "@/assets/templates/hoss/figures-1.svg?url";
import figures2Url from "@/assets/templates/hoss/figures-2.svg?url";
import figures3Url from "@/assets/templates/hoss/figures-3.svg?url";
import logoHossUrl from "@/assets/templates/hoss/logo-hoss.svg?url";
import logoHangmanUrl from "@/assets/templates/hoss/logo-hangman.svg?url";
import logoHangmenUrl from "@/assets/templates/hoss/logo-hangmen.svg?url";

/** Identifier for the figures layer selection. `null` means "none". */
export type FigureId = "1" | "2" | "3";
/** Identifier for the logo layer selection. `null` means "none". */
export type LogoId = "hoss" | "hangman" | "hangmen";

export interface LayerOption<Id extends string> {
  id: Id;
  label: string;
  url: string;
  /** Column index (1-based) used to align figures with their linked logo. */
  column: number;
}

export interface PosterTemplate {
  id: string;
  name: string;
  /** Artboard the layers were authored on. */
  canvasWidth: number;
  canvasHeight: number;
  /** Suggested poster size id to apply on a fresh project (optional). */
  suggestedSize?: { widthInches: number; heightInches: number };
  background: { label: string; url: string };
  figures: LayerOption<FigureId>[];
  logos: LayerOption<LogoId>[];
  /**
   * Default logo for each figure selection, and vice versa. Selecting a figure
   * sets the linked logo (unless the user overrode it), and selecting a logo
   * sets the linked figure. Either can still be changed independently.
   */
  figureToLogo: Record<FigureId, LogoId>;
  logoToFigure: Record<LogoId, FigureId>;
}

export const HOSS_TEMPLATE: PosterTemplate = {
  id: "hoss",
  name: "Hoss & the Hangmen",
  canvasWidth: 3314,
  canvasHeight: 4409,
  suggestedSize: { widthInches: 18, heightInches: 24 },
  background: { label: "Scenery", url: backgroundUrl },
  figures: [
    { id: "1", label: "1 cowboy", url: figures1Url, column: 1 },
    { id: "2", label: "2 cowboys", url: figures2Url, column: 2 },
    { id: "3", label: "3 cowboys", url: figures3Url, column: 3 },
  ],
  logos: [
    { id: "hoss", label: "Hoss", url: logoHossUrl, column: 1 },
    { id: "hangman", label: "Hangman", url: logoHangmanUrl, column: 2 },
    { id: "hangmen", label: "Hangmen", url: logoHangmenUrl, column: 3 },
  ],
  figureToLogo: { "1": "hoss", "2": "hangman", "3": "hangmen" },
  logoToFigure: { hoss: "1", hangman: "2", hangmen: "3" },
};

export const TEMPLATES: PosterTemplate[] = [HOSS_TEMPLATE];

export function getTemplate(id: string): PosterTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

/** Resolve a figures option's URL by id. */
export function figureUrl(template: PosterTemplate, id: FigureId): string | undefined {
  return template.figures.find((f) => f.id === id)?.url;
}

/** Resolve a logo option's URL by id. */
export function logoUrl(template: PosterTemplate, id: LogoId): string | undefined {
  return template.logos.find((l) => l.id === id)?.url;
}

/**
 * Resolve the ordered (back-to-front) list of layer image URLs for a template
 * selection: background, then figures, then logo. Skips any layer that is off.
 */
export function resolveTemplateLayerUrls(
  state:
    | {
        templateId: string;
        background: boolean;
        figures: string | null;
        logo: string | null;
      }
    | null
    | undefined,
): string[] {
  if (!state) return [];
  const template = getTemplate(state.templateId);
  if (!template) return [];
  const urls: string[] = [];
  if (state.background) urls.push(template.background.url);
  if (state.figures) {
    const u = figureUrl(template, state.figures as FigureId);
    if (u) urls.push(u);
  }
  if (state.logo) {
    const u = logoUrl(template, state.logo as LogoId);
    if (u) urls.push(u);
  }
  return urls;
}
