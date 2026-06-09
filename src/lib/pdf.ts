import * as FileSystem from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import QRCode from "qrcode-generator";

import { type NormBox, normToPixel } from "./boxes";
import { getImageSizeAsync } from "./image";
import { buildQrPayload } from "./ticketAuth";
import {
  longestTicketNumber,
  escapeHtml,
} from "./ticketText";

function qrToSvg(payload: string, sizeMm: number): string {
  // Use a fixed internal resolution for QR generation; the SVG will be
  // stretched to fill its container via width/height="100%".
  const internalPx = Math.max(96, Math.round(sizeMm * 3.779)); // 96 DPI
  const typeNumber = 0; // Auto-detect version
  const errorCorrectionLevel = "M"; // Medium (15% redundancy) — much better on small printed QRs
  const qr = QRCode(typeNumber, errorCorrectionLevel);
  qr.addData(payload);
  qr.make();
  const modules = qr.getModuleCount();
  // cellSize = 1 unit in the SVG viewBox → modules × 1 = viewBox width/height
  const cellSize = 1;
  const viewBoxSize = modules; // e.g. 25 for version 2
  const svg = qr.createSvgTag(cellSize, 0); // 0 = no quiet-zone padding

  // Replace the auto-generated <svg ...> attributes:
  //   - width/height 100% so the div container controls physical size
  //   - viewBox in QR module units (integers → no floating-point drift)
  //   - preserveAspectRatio: xMidYMid slice fills the box edge-to-edge
  return svg
    .replace(/\s+width="[^"]*"/, "")
    .replace(/\s+height="[^"]*"/, "")
    .replace(
      "<svg ",
      `<svg width="100%" height="100%" viewBox="0 0 ${viewBoxSize} ${viewBoxSize}" preserveAspectRatio="xMidYMid meet" `,
    );
}

function imageMimeFromUri(
  uri: string,
): "image/png" | "image/jpeg" | "image/webp" {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

function roundMm(v: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(v * factor) / factor;
}

function roundBox(box: { x: number; y: number; w: number; h: number }) {
  return {
    x: Math.round(box.x),
    y: Math.round(box.y),
    w: Math.round(box.w),
    h: Math.round(box.h),
  };
}

async function getPrintableImageUri(uri: string): Promise<string> {
  if (uri.startsWith("file://")) return uri;

  const ext = uri.toLowerCase().includes(".png")
    ? "png"
    : uri.toLowerCase().includes(".webp")
      ? "webp"
      : "jpg";
  const dest = new FileSystem.File(
    FileSystem.Paths.cache,
    `print_${Date.now()}.${ext}`,
  );
  new FileSystem.File(uri).copy(dest);
  return dest.uri;
}

// buildTicketPageHtml removed — the grid layout is built inline in generateTicketsPdf

export async function generateTicketsPdf(options: {
  imgUri: string;
  imgW: number;
  imgH: number;
  qrBoxes: NormBox[];
  numBoxes: NormBox[];
  count: number;
  startNum: number;
  prefix: string;
  padding: number;
  eventId: string;
  format: "2x8" | "1x2";
  pageCount: number;
  onProgress: (percent: number) => void;
}): Promise<{ filename: string; firstThumb?: string }> {
  const {
    imgUri,
    imgW,
    imgH,
    qrBoxes,
    numBoxes,
    count,
    startNum,
    prefix,
    padding,
    eventId,
    format,
    pageCount,
    onProgress,
  } = options;

  let originalPageW = imgW;
  let originalPageH = imgH;
  try {
    const real = await getImageSizeAsync(imgUri);
    originalPageW = real.w;
    originalPageH = real.h;
  } catch {
    originalPageW = imgW;
    originalPageH = imgH;
  }

  // EXACT A4 dimensions
  const A4_WIDTH_MM = 210;
  const A4_HEIGHT_MM = 297;

  // Calculate grid dimensions based on format
  const cols = format === "2x8" ? 2 : 1;
  const rows = format === "2x8" ? 8 : 2;
  const ticketsPerGridPage = cols * rows;

  // NO MARGINS, NO GAPS - tickets fill the entire page exactly
  const availableW = A4_WIDTH_MM;
  const availableH = A4_HEIGHT_MM;
  const ticketW = availableW / cols;
  const ticketH = availableH / rows;

  // expo-print interprets width/height at 72 PPI (same as CSS pt: 1pt = 1/72 inch).
  // A4 at 72 PPI: 210mm / 25.4 * 72 = 595.28 → 595 ; 297mm / 25.4 * 72 = 841.89 → 842
  const MM_TO_INCH = 25.4;
  const PRINT_PPI = 72; // expo-print native resolution
  const A4_WIDTH_PX = Math.round((A4_WIDTH_MM / MM_TO_INCH) * PRINT_PPI);   // 595
  const A4_HEIGHT_PX = Math.round((A4_HEIGHT_MM / MM_TO_INCH) * PRINT_PPI); // 842

  // All HTML/CSS layout uses mm units — we only need a px↔mm factor for
  // computing the QR/number box sizes from the original image pixel coords.
  // Use the same 72 PPI so the coordinate system stays consistent.
  const MM_TO_PX = PRINT_PPI / MM_TO_INCH; // 72/25.4 ≈ 2.8346

  // Scale factors: from original image pixels → mm on the ticket cell
  const ticketW_px = ticketW * MM_TO_PX;
  const ticketH_px = ticketH * MM_TO_PX;
  const scaleX = ticketW_px / originalPageW;
  const scaleY = ticketH_px / originalPageH;

  const mime = imageMimeFromUri(imgUri);
  const safeImageUri = await getPrintableImageUri(imgUri);
  const file = new FileSystem.File(safeImageUri);
  const base64 = await file.base64();
  const imgDataUrl = `data:${mime};base64,${base64}`;

  const qrPixels = qrBoxes.map((b) => normToPixel(b, originalPageW, originalPageH));
  const numPixels = numBoxes.map((b) => normToPixel(b, originalPageW, originalPageH));

  const longestNumber = longestTicketNumber(prefix, startNum, count, padding);
  // Compute font sizes in mm. fitNumberFontSize has a px-based floor of 8 that
  // makes no sense in mm context (8mm would be huge). We compute the raw ratio
  // result directly here without any absolute minimum.
  const numFontSizesMm = numPixels.map((box) => {
    const w_mm = roundMm((box.w * scaleX) / MM_TO_PX);
    const h_mm = roundMm((box.h * scaleY) / MM_TO_PX);
    if (w_mm <= 0 || h_mm <= 0) return 1;
    const byHeight = h_mm * 0.82;
    const byWidth = w_mm / Math.max(longestNumber.length * 0.58, 1);
    // No hard minimum — the box size chosen by the user governs the font size
    return roundMm(Math.min(byHeight, byWidth));
  });

  const pagesContent: string[] = [];
  let firstThumb: string | undefined;

  // Generate A4 pages with grids of tickets
  for (let pageIdx = 0; pageIdx < pageCount; pageIdx++) {
    let pageHtml = "";
    
    // Add tickets for this A4 page
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const ticketIdx = pageIdx * ticketsPerGridPage + row * cols + col;
        if (ticketIdx >= count) break;

        const ticketNumber = startNum + ticketIdx;
        const numberStr = `${prefix}${String(ticketNumber).padStart(padding, "0")}`;
        const qrPayload = await buildQrPayload(numberStr, eventId);

        // Position of this ticket cell on the A4 page (in mm, bord à bord)
        const cellX = roundMm(col * ticketW);
        const cellY = roundMm(row * ticketH);

        // Build ticket HTML with mm units
        const qrHtml = qrPixels
          .map((box) => {
            const x_mm = roundMm((box.x * scaleX) / MM_TO_PX);
            const y_mm = roundMm((box.y * scaleY) / MM_TO_PX);
            const w_mm = roundMm((box.w * scaleX) / MM_TO_PX);
            const h_mm = roundMm((box.h * scaleY) / MM_TO_PX);
            const svgSize_mm = Math.min(w_mm, h_mm);
            const svg = qrToSvg(qrPayload, svgSize_mm);
            return `<div style="position:absolute;left:${x_mm}mm;top:${y_mm}mm;width:${w_mm}mm;height:${h_mm}mm;display:flex;align-items:center;justify-content:center;overflow:visible;">${svg}</div>`;
          })
          .join("");

        const numHtml = numPixels
          .map((box, i) => {
            const x_mm = roundMm((box.x * scaleX) / MM_TO_PX);
            const y_mm = roundMm((box.y * scaleY) / MM_TO_PX);
            const w_mm = roundMm((box.w * scaleX) / MM_TO_PX);
            const h_mm = roundMm((box.h * scaleY) / MM_TO_PX);
            const fontSize_mm = roundMm(numFontSizesMm[i] ?? 3);
            const safe = escapeHtml(numberStr);
            const strokeW = roundMm(Math.max(0.1, fontSize_mm * 0.1));
            // viewBox uses the same mm values so 1 SVG user unit = 1 mm
            return `<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;left:${x_mm}mm;top:${y_mm}mm;width:${w_mm}mm;height:${h_mm}mm;overflow:visible;pointer-events:none;" viewBox="0 0 ${w_mm} ${h_mm}">
              <text x="${roundMm(w_mm / 2)}" y="${roundMm(h_mm / 2)}" dominant-baseline="central" text-anchor="middle"
                font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="${fontSize_mm}"
                fill="#111111" stroke="#ffffff" stroke-width="${strokeW}" paint-order="stroke"
                style="paint-order:stroke fill;">
                ${safe}
              </text>
            </svg>`;
          })
          .join("");

        pageHtml += `<div style="position:absolute;left:${cellX}mm;top:${cellY}mm;width:${ticketW}mm;height:${ticketH}mm;">
          <div style="position:relative;width:100%;height:100%;overflow:visible;">
            <img src="${imgDataUrl}" style="position:absolute;left:0;top:0;width:100%;height:100%;display:block;object-fit:fill;" />
            ${qrHtml}
            ${numHtml}
          </div>
        </div>`;
      }
    }
    pagesContent.push(pageHtml);

    if (pageIdx === 0) {
      firstThumb = imgDataUrl;
    }

    onProgress(Math.round(((pageIdx + 1) / pageCount) * 100));
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    @page { 
      margin: 0; 
      size: 210mm 297mm;
    }
    .a4-page { 
      width: 210mm; 
      height: 297mm; 
      position: relative; 
      overflow: hidden; 
      background: white;
    }
  </style>
</head>
<body>
${pagesContent.map((content, idx) => {
    const isLastPage = idx === pagesContent.length - 1;
    const style = isLastPage ? '' : 'page-break-after: always;';
    return `<div class="a4-page" style="${style}">${content}</div>`;
  }).join('')}
</body>
</html>`;

  const { uri } = await Print.printToFileAsync({
    html,
    width: A4_WIDTH_PX,
    height: A4_HEIGHT_PX,
    // iOS: force zero margins so the WebView doesn't add its own padding
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  const filename = `billets_${prefix}${startNum}-${startNum + count - 1}.pdf`;
  const dest = new FileSystem.File(FileSystem.Paths.document, filename);
  // Delete any pre-existing file with the same name so .move() never throws
  // FileAlreadyExistsException (Android) or equivalent on iOS.
  if (dest.exists) {
    dest.delete();
  }
  new FileSystem.File(uri).move(dest);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(dest.uri, {
      mimeType: "application/pdf",
      dialogTitle: "Partager les billets",
      UTI: "com.adobe.pdf",
    });
  }

  return { filename, firstThumb };
}
