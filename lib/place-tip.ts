/** Keep a portaled tooltip inside the viewport. Prefer below the icon, then above. */

export type TipAnchor = {
  top: number;
  left: number;
  bottom: number;
};

export type TipBox = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

const MARGIN = 8;
const GAP = 8;

export function placeTip(
  anchor: TipAnchor,
  tip: { width: number; height: number },
  viewport: { width: number; height: number },
): TipBox {
  const maxHeight = Math.max(0, viewport.height - MARGIN * 2);
  const width = Math.min(tip.width, Math.max(0, viewport.width - MARGIN * 2));
  const height = Math.min(Math.max(tip.height, 0), maxHeight);

  const maxLeft = Math.max(MARGIN, viewport.width - width - MARGIN);
  const left = Math.min(Math.max(anchor.left, MARGIN), maxLeft);

  const below = anchor.bottom + GAP;
  const above = anchor.top - GAP - height;
  let top = below;
  if (below + height > viewport.height - MARGIN && above >= MARGIN) {
    top = above;
  } else if (below + height > viewport.height - MARGIN) {
    top = Math.max(MARGIN, viewport.height - MARGIN - height);
  }
  if (top < MARGIN) top = MARGIN;

  return { top, left, width, maxHeight };
}
