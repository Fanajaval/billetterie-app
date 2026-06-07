export function fitNumberFontSize(text: string, boxW: number, boxH: number): number {
  if (boxW <= 0 || boxH <= 0) return 10;
  const byHeight = boxH * 0.82;
  const byWidth = boxW / Math.max(text.length * 0.58, 1);
  return Math.max(8, Math.floor(Math.min(byHeight, byWidth)));
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function longestTicketNumber(
  prefix: string,
  startNum: number,
  count: number,
  padding: number,
): string {
  const last = `${prefix}${String(startNum + Math.max(0, count - 1)).padStart(padding, "0")}`;
  const first = `${prefix}${String(startNum).padStart(padding, "0")}`;
  return first.length >= last.length ? first : last;
}

export function buildNumberOverlaySvg(
  box: { x: number; y: number; w: number; h: number },
  numberStr: string,
  fontSize: number,
): string {
  const x = Math.round(box.x);
  const y = Math.round(box.y);
  const w = Math.round(box.w);
  const h = Math.round(box.h);
  const safe = escapeHtml(numberStr);
  const strokeW = Math.max(1.5, fontSize * 0.12);

  return `<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;overflow:visible;pointer-events:none;" viewBox="0 0 ${w} ${h}">
    <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle"
      font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="${fontSize}"
      fill="#111111" stroke="#ffffff" stroke-width="${strokeW}" paint-order="stroke"
      style="paint-order:stroke fill;">
      ${safe}
    </text>
  </svg>`;
}
