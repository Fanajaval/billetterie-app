import * as FileSystem from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import QRCode from "qrcode-generator";

import { type NormBox, normToPixel } from "./boxes";
import { getImageSizeAsync } from "./image";
import { buildQrPayload } from "./ticketAuth";
import {
  buildNumberOverlaySvg,
  fitNumberFontSize,
  longestTicketNumber,
} from "./ticketText";

function qrToSvg(payload: string, pixelSize: number): string {
  const size = Math.max(96, Math.round(pixelSize));
  const typeNumber = 0; // Auto detection
  const errorCorrectionLevel = "L"; // Lower density for better scan reliability
  const qr = QRCode(typeNumber, errorCorrectionLevel);
  qr.addData(payload);
  qr.make();
  const cellSize = Math.max(1, Math.floor(size / qr.getModuleCount()));
  const svg = qr.createSvgTag(cellSize, 0);
  return svg.replace(
    "<svg ",
    '<svg width="100%" height="100%" preserveAspectRatio="xMidYMid meet" ',
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

function buildTicketPageHtml(
  imgDataUrl: string,
  imgW: number,
  imgH: number,
  qrSvgs: {
    box: { x: number; y: number; w: number; h: number };
    svg: string;
  }[],
  numBoxes: { x: number; y: number; w: number; h: number }[],
  numberStr: string,
  numFontSizes: number[],
): string {
  const qrHtml = qrSvgs
    .map(({ box, svg }) => {
      const b = roundBox(box);
      return `<div style="position:absolute;left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px;display:flex;align-items:center;justify-content:center;overflow:visible;">${svg}</div>`;
    })
    .join("");

  const numHtml = numBoxes
    .map((box, i) =>
      buildNumberOverlaySvg(roundBox(box), numberStr, numFontSizes[i] ?? 12),
    )
    .join("");

  return `<div class="page" style="width:${imgW}px;height:${imgH}px;position:relative;overflow:visible;page-break-after:always;">
    <img src="${imgDataUrl}" width="${imgW}" height="${imgH}" style="position:absolute;left:0;top:0;width:${imgW}px;height:${imgH}px;display:block;" />
    ${qrHtml}
    ${numHtml}
  </div>`;
}

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
    onProgress,
  } = options;

  let pageW = imgW;
  let pageH = imgH;
  try {
    const real = await getImageSizeAsync(imgUri);
    pageW = real.w;
    pageH = real.h;
  } catch {
    pageW = imgW;
    pageH = imgH;
  }

  const mime = imageMimeFromUri(imgUri);
  const safeImageUri = await getPrintableImageUri(imgUri);
  const file = new FileSystem.File(safeImageUri);
  const base64 = await file.base64();
  const imgDataUrl = `data:${mime};base64,${base64}`;

  const qrPixels = qrBoxes.map((b) => normToPixel(b, pageW, pageH));
  const numPixels = numBoxes.map((b) => normToPixel(b, pageW, pageH));

  const longestNumber = longestTicketNumber(prefix, startNum, count, padding);
  const numFontSizes = numPixels.map((box) =>
    fitNumberFontSize(longestNumber, box.w, box.h),
  );

  const pages: string[] = [];
  let firstThumb: string | undefined;

  for (let i = 0; i < count; i++) {
    const ticketNumber = startNum + i;
    const numberStr = `${prefix}${String(ticketNumber).padStart(padding, "0")}`;
    const qrPayload = await buildQrPayload(numberStr, eventId);

    const qrSvgs = qrPixels.map((box) => ({
      box,
      svg: qrToSvg(qrPayload, Math.min(box.w, box.h)),
    }));

    pages.push(
      buildTicketPageHtml(
        imgDataUrl,
        pageW,
        pageH,
        qrSvgs,
        numPixels,
        numberStr,
        numFontSizes,
      ),
    );

    if (i === 0) {
      firstThumb = imgDataUrl;
    }

    onProgress(Math.round(((i + 1) / count) * 100));
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=${pageW}, height=${pageH}" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { margin: 0; padding: 0; width: ${pageW}px; overflow: visible; }
    @page { margin: 0; size: ${pageW}px ${pageH}px; }
    .page { width: ${pageW}px; height: ${pageH}px; position: relative; overflow: visible; }
    .page:last-child { page-break-after: auto; }
  </style>
</head>
<body>${pages.join("")}</body>
</html>`;

  const { uri } = await Print.printToFileAsync({
    html,
    width: pageW,
    height: pageH,
  });

  const filename = `billets_${prefix}${startNum}-${startNum + count - 1}.pdf`;
  const dest = new FileSystem.File(FileSystem.Paths.document, filename);
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
