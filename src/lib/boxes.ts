export type NormBox = { x: number; y: number; w: number; h: number };
export type PixelBox = { x: number; y: number; w: number; h: number };

export function defaultBoxes(): { qr: NormBox[]; num: NormBox[] } {
  return {
    qr: [{ x: 0.04, y: 0.05, w: 0.22, h: 0.22 }],
    num: [{ x: 0.04, y: 0.32, w: 0.55, h: 0.09 }],
  };
}

export function normToPixel(box: NormBox, width: number, height: number): PixelBox {
  return { x: box.x * width, y: box.y * height, w: box.w * width, h: box.h * height };
}

export function pixelToNorm(box: PixelBox, width: number, height: number): NormBox {
  if (width <= 0 || height <= 0) return box;
  return {
    x: clamp(box.x / width, 0, 1),
    y: clamp(box.y / height, 0, 1),
    w: clamp(box.w / width, 0.03, 1),
    h: clamp(box.h / height, 0.03, 1),
  };
}

export function clampNormBox(box: NormBox): NormBox {
  const w = Math.min(box.w, 1);
  const h = Math.min(box.h, 1);
  return { x: clamp(box.x, 0, 1 - w), y: clamp(box.y, 0, 1 - h), w, h };
}

export function nudgeBox(box: NormBox, dx: number, dy: number): NormBox {
  return clampNormBox({ ...box, x: box.x + dx, y: box.y + dy });
}

export function resizeBox(box: NormBox, factor: number): NormBox {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const w = clamp(box.w * factor, 0.03, 0.9);
  const h = clamp(box.h * factor, 0.03, 0.9);
  return clampNormBox({ x: cx - w / 2, y: cy - h / 2, w, h });
}

export function setBoxPosition(box: NormBox, x: number, y: number): NormBox {
  return clampNormBox({ ...box, x, y });
}

export const MAX_PLACEMENTS = 10;

export function duplicateBox(box: NormBox): NormBox {
  return clampNormBox({ ...box, x: box.x + 0.08, y: box.y + 0.08 });
}

export function setBoxSize(box: NormBox, size: number, lockSquare = false): NormBox {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const w = clamp(size, 0.05, 0.85);
  const h = lockSquare ? w : clamp(box.h * (w / box.w), 0.03, 0.5);
  return clampNormBox({ x: cx - w / 2, y: cy - h / 2, w, h });
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
