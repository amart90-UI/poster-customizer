import type { TextObject } from "@/types";

/**
 * Snapping + alignment guides.
 *
 * Given a proposed box position, we snap its key lines (left/center/right edges
 * and top/middle/bottom edges) to the poster's own guides: center lines and
 * margins. Snapping is explicit and gentle — it only engages within a small
 * threshold and returns the guide lines to draw so the user sees why it moved.
 */

export interface SnapGuide {
  orientation: "v" | "h";
  /** Position in document px along the perpendicular axis. */
  pos: number;
}

export interface SnapInput {
  x: number;
  y: number;
  width: number;
  height: number;
  docWidth: number;
  docHeight: number;
  /** Snap threshold in document px (scaled by caller for zoom). */
  threshold: number;
  /** Margin inset for margin guides, in document px. */
  margin: number;
}

export interface SnapResult {
  x: number;
  y: number;
  guides: SnapGuide[];
}

/** Snap a moving box. Returns adjusted x/y and the guides that engaged. */
export function snapBox(input: SnapInput): SnapResult {
  const { x, y, width, height, docWidth, docHeight, threshold, margin } = input;

  // Candidate vertical guide lines (x positions) in the document.
  const vTargets = [0, margin, docWidth / 2, docWidth - margin, docWidth];
  // Horizontal guide lines (y positions).
  const hTargets = [0, margin, docHeight / 2, docHeight - margin, docHeight];

  const guides: SnapGuide[] = [];

  // For the box, the snap-able x anchors are left, center, right.
  const xAnchors = [
    { value: x, edge: 0 }, // left
    { value: x + width / 2, edge: width / 2 }, // center
    { value: x + width, edge: width }, // right
  ];
  const yAnchors = [
    { value: y, edge: 0 },
    { value: y + height / 2, edge: height / 2 },
    { value: y + height, edge: height },
  ];

  let newX = x;
  let bestDX = threshold + 1;
  for (const anchor of xAnchors) {
    for (const target of vTargets) {
      const d = Math.abs(anchor.value - target);
      if (d <= threshold && d < bestDX) {
        bestDX = d;
        newX = target - anchor.edge;
      }
    }
  }
  if (bestDX <= threshold) {
    // Record the guide line at its target (recompute which target won).
    const snappedCenter = newX + 0; // guide is the target line itself
    // Find the target the winning anchor aligned to:
    for (const anchor of xAnchors) {
      const av = newX + anchor.edge;
      for (const target of vTargets) {
        if (Math.abs(av - target) < 0.5) guides.push({ orientation: "v", pos: target });
      }
    }
    void snappedCenter;
  }

  let newY = y;
  let bestDY = threshold + 1;
  for (const anchor of yAnchors) {
    for (const target of hTargets) {
      const d = Math.abs(anchor.value - target);
      if (d <= threshold && d < bestDY) {
        bestDY = d;
        newY = target - anchor.edge;
      }
    }
  }
  if (bestDY <= threshold) {
    for (const anchor of yAnchors) {
      const av = newY + anchor.edge;
      for (const target of hTargets) {
        if (Math.abs(av - target) < 0.5) guides.push({ orientation: "h", pos: target });
      }
    }
  }

  // De-dup guides.
  const seen = new Set<string>();
  const dedup = guides.filter((g) => {
    const k = `${g.orientation}:${Math.round(g.pos)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return { x: newX, y: newY, guides: dedup };
}

/** Center a text box horizontally and/or vertically in the document. */
export function centerBox(
  t: Pick<TextObject, "width">,
  height: number,
  docWidth: number,
  docHeight: number,
  axis: "h" | "v" | "both",
): { x?: number; y?: number } {
  const out: { x?: number; y?: number } = {};
  if (axis === "h" || axis === "both") out.x = Math.round((docWidth - t.width) / 2);
  if (axis === "v" || axis === "both") out.y = Math.round((docHeight - height) / 2);
  return out;
}
