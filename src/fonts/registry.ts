/**
 * Font registry.
 *
 * Adding or changing the available fonts is intentionally a one-file change:
 * edit `FONTS` below. Each entry names a Google Font family and the weights we
 * want available. Fonts load on demand (when first used) so the initial page
 * stays light, and export can await `ensureFontLoaded` to avoid rendering with
 * a fallback face.
 */

export interface FontDef {
  /** Exact Google Fonts family name. */
  family: string;
  /** Weights to request from Google Fonts. */
  weights: number[];
  /** Whether an italic axis is available/requested. */
  italic?: boolean;
  /** Rough categorization for grouping in the picker. */
  category: "sans" | "serif" | "display" | "mono" | "handwriting";
}

/**
 * A small, curated set. Focused, not overwhelming. Add entries here to expand.
 */
export const FONTS: FontDef[] = [
  { family: "Inter", weights: [400, 500, 700, 900], italic: true, category: "sans" },
  { family: "Poppins", weights: [400, 500, 600, 700, 800], italic: true, category: "sans" },
  { family: "Montserrat", weights: [400, 600, 700, 800, 900], italic: true, category: "sans" },
  { family: "Oswald", weights: [400, 500, 600, 700], category: "sans" },
  { family: "Bebas Neue", weights: [400], category: "display" },
  { family: "Anton", weights: [400], category: "display" },
  { family: "Archivo Black", weights: [400], category: "display" },
  { family: "Playfair Display", weights: [400, 600, 700, 900], italic: true, category: "serif" },
  { family: "Lora", weights: [400, 500, 600, 700], italic: true, category: "serif" },
  { family: "Merriweather", weights: [400, 700, 900], italic: true, category: "serif" },
  { family: "Abril Fatface", weights: [400], category: "display" },
  { family: "Pacifico", weights: [400], category: "handwriting" },
  { family: "Caveat", weights: [400, 600, 700], category: "handwriting" },
  { family: "Space Mono", weights: [400, 700], italic: true, category: "mono" },
];

export const FONT_MAP: Record<string, FontDef> = Object.fromEntries(
  FONTS.map((f) => [f.family, f]),
);

/** The default/fallback family; guaranteed to be in the registry. */
export const DEFAULT_FONT = "Inter";

function familyToParam(family: string): string {
  return family.replace(/ /g, "+");
}

/**
 * Build the Google Fonts CSS2 URL for one family, requesting all its weights
 * (and italics if available). Using the CSS API keeps us backend-free.
 */
function buildFontUrl(def: FontDef): string {
  const weights = [...def.weights].sort((a, b) => a - b);
  let axis: string;
  if (def.italic) {
    // ital,wght tuples: upright first, then italic for each weight.
    const tuples = [
      ...weights.map((w) => `0,${w}`),
      ...weights.map((w) => `1,${w}`),
    ].join(";");
    axis = `ital,wght@${tuples}`;
  } else {
    axis = `wght@${weights.join(";")}`;
  }
  return `https://fonts.googleapis.com/css2?family=${familyToParam(def.family)}:${axis}&display=swap`;
}

const injected = new Set<string>();

/**
 * Inject the <link> for a family's stylesheet (idempotent). This makes the
 * font available to CSS/canvas; actual glyph files download lazily.
 */
export function injectFontStylesheet(family: string): void {
  const def = FONT_MAP[family];
  if (!def || injected.has(family)) return;
  injected.add(family);

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = buildFontUrl(def);
  link.dataset.font = family;
  document.head.appendChild(link);
}

/** Inject stylesheets for every registered font (used to warm the picker). */
export function injectAllFontStylesheets(): void {
  for (const f of FONTS) injectFontStylesheet(f.family);
}

/**
 * Ensure a specific font (family + weight + style) is actually loaded and ready
 * for rendering. Resolves once the glyphs are available. Falls back gracefully
 * if the Font Loading API is unavailable or the load fails.
 */
export async function ensureFontLoaded(
  family: string,
  weight = 400,
  italic = false,
  sampleText = "Aa",
): Promise<void> {
  injectFontStylesheet(family);
  if (!("fonts" in document)) return;

  const style = italic ? "italic" : "normal";
  const spec = `${style} ${weight} 16px "${family}"`;
  try {
    await document.fonts.load(spec, sampleText);
    await document.fonts.ready;
  } catch {
    // Ignore: rendering will fall back to a system face.
  }
}

/** Ensure every font used by the given text objects is loaded (for export). */
export async function ensureFontsForExport(
  usages: { family: string; weight: number; italic: boolean; text: string }[],
): Promise<void> {
  await Promise.all(
    usages.map((u) => ensureFontLoaded(u.family, u.weight, u.italic, u.text.slice(0, 8) || "Aa")),
  );
}
