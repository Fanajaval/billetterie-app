import jsPDF from "jspdf";
import QRCode from "qrcode-generator";

import { type NormBox, normToPixel } from "./boxes";
import { buildQrPayload } from "./ticketAuth";
import { longestTicketNumber, escapeHtml } from "./ticketText";

function qrToSvg(payload: string, sizeMm: number): string {
  const internalPx = Math.max(96, Math.round(sizeMm * 3.779));
  const typeNumber = 0;
  const errorCorrectionLevel = "M";
  const qr = QRCode(typeNumber, errorCorrectionLevel);
  qr.addData(payload);
  qr.make();
  const modules = qr.getModuleCount();
  const cellSize = 1;
  const viewBoxSize = modules;
  const svg = qr.createSvgTag(cellSize, 0);

  return svg
    .replace(/\s+width="[^"]*"/, "")
    .replace(/\s+height="[^"]*"/, "")
    .replace(
      "<svg ",
      `<svg width="100%" height="100%" viewBox="0 0 ${viewBoxSize} ${viewBoxSize}" preserveAspectRatio="xMidYMid meet" `,
    );
}

function roundMm(v: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(v * factor) / factor;
}

async function getBase64FromImageUrl(url: string): Promise<string> {
  // If already a data URL, return as is
  if (url.startsWith("data:")) {
    return url;
  }
  
  // Otherwise fetch and convert
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function svgToDataUrl(svgString: string): string {
  const base64 = btoa(unescape(encodeURIComponent(svgString)));
  return `data:image/svg+xml;base64,${base64}`;
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
  format: "2x8" | "1x3" | "1x2";
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

  const A4_WIDTH_MM = 210;
  const A4_HEIGHT_MM = 297;

  const cols = format === "2x8" ? 2 : 1;
  const rows = format === "2x8" ? 8 : format === "1x3" ? 3 : 2;
  const ticketsPerGridPage = cols * rows;

  const availableW = A4_WIDTH_MM;
  const availableH = A4_HEIGHT_MM;
  const ticketW = availableW / cols;
  const ticketH = availableH / rows;

  const MM_TO_INCH = 25.4;
  const PRINT_PPI = 72;
  const MM_TO_PX = PRINT_PPI / MM_TO_INCH;

  const ticketW_px = ticketW * MM_TO_PX;
  const ticketH_px = ticketH * MM_TO_PX;
  const scaleX = ticketW_px / imgW;
  const scaleY = ticketH_px / imgH;

  // Get base64 image
  const imgDataUrl = await getBase64FromImageUrl(imgUri);
  const firstThumb = imgDataUrl;

  const qrPixels = qrBoxes.map((b) => normToPixel(b, imgW, imgH));
  const numPixels = numBoxes.map((b) => normToPixel(b, imgW, imgH));

  const longestNumber = longestTicketNumber(prefix, startNum, count, padding);
  const numFontSizesMm = numPixels.map((box) => {
    const w_mm = roundMm((box.w * scaleX) / MM_TO_PX);
    const h_mm = roundMm((box.h * scaleY) / MM_TO_PX);
    if (w_mm <= 0 || h_mm <= 0) return 1;
    const byHeight = h_mm * 0.82;
    const byWidth = w_mm / Math.max(longestNumber.length * 0.58, 1);
    return roundMm(Math.min(byHeight, byWidth));
  });

  // ✅ OPTIMIZATION 1: Pre-calculate QR positions in mm
  const qrPositionsMm = qrPixels.map((box) => {
    const w_mm = roundMm((box.w * scaleX) / MM_TO_PX);
    const h_mm = roundMm((box.h * scaleY) / MM_TO_PX);
    const size_mm = Math.min(w_mm, h_mm);
    return {
      x_offset: roundMm((box.x * scaleX) / MM_TO_PX),
      y_offset: roundMm((box.y * scaleY) / MM_TO_PX),
      w_mm,
      h_mm,
      size_mm,
    };
  });

  // ✅ OPTIMIZATION 2: Pre-calculate text positions in mm
  const textPositionsMm = numPixels.map((box, i) => ({
    x_offset: roundMm((box.x * scaleX) / MM_TO_PX),
    y_offset: roundMm((box.y * scaleY) / MM_TO_PX),
    w_mm: roundMm((box.w * scaleX) / MM_TO_PX),
    h_mm: roundMm((box.h * scaleY) / MM_TO_PX),
    fontSize_mm: roundMm(numFontSizesMm[i] ?? 3),
  }));

  // ✅ OPTIMIZATION 3: Generate all QR codes ONCE and cache them
  console.log(`Génération des ${count} QR codes...`);
  const qrCache = new Map<string, string>();
  const BATCH_SIZE = 100;
  
  for (let i = 0; i < count; i += BATCH_SIZE) {
    const batchEnd = Math.min(i + BATCH_SIZE, count);
    
    // Generate QR payloads in parallel for this batch
    const batchPromises = [];
    for (let j = i; j < batchEnd; j++) {
      const ticketNumber = startNum + j;
      const numberStr = `${prefix}${String(ticketNumber).padStart(padding, "0")}`;
      batchPromises.push(
        buildQrPayload(numberStr, eventId).then((payload) => ({
          numberStr,
          payload,
        }))
      );
    }
    
    const batchResults = await Promise.all(batchPromises);
    
    // Generate QR SVGs for this batch
    for (const { numberStr, payload } of batchResults) {
      // Use first QR box size for generation (all QR codes same size in a ticket)
      const firstQrSize = qrPositionsMm[0]?.size_mm ?? 20;
      const svg = qrToSvg(payload, firstQrSize);
      const svgDataUrl = svgToDataUrl(svg);
      qrCache.set(numberStr, svgDataUrl);
    }
    
    // Update progress: QR generation = 0-20%
    const qrProgress = Math.round((batchEnd / count) * 20);
    onProgress(qrProgress);
  }
  
  console.log(`✅ ${count} QR codes générés et mis en cache`);

  // Create PDF
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  let isFirstPage = true;

  // ✅ OPTIMIZATION 4: Use cached QR codes during PDF generation
  for (let pageIdx = 0; pageIdx < pageCount; pageIdx++) {
    if (!isFirstPage) {
      pdf.addPage();
    }
    isFirstPage = false;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const ticketIdx = pageIdx * ticketsPerGridPage + row * cols + col;
        if (ticketIdx >= count) break;

        const ticketNumber = startNum + ticketIdx;
        const numberStr = `${prefix}${String(ticketNumber).padStart(padding, "0")}`;
        const qrSvgDataUrl = qrCache.get(numberStr)!;

        const cellX = roundMm(col * ticketW);
        const cellY = roundMm(row * ticketH);

        // Add background image
        pdf.addImage(
          imgDataUrl,
          "JPEG",
          cellX,
          cellY,
          ticketW,
          ticketH,
          undefined,
          "FAST"
        );

        // Add QR codes (using cached SVGs)
        for (const pos of qrPositionsMm) {
          const qrX = cellX + pos.x_offset + (pos.w_mm - pos.size_mm) / 2;
          const qrY = cellY + pos.y_offset + (pos.h_mm - pos.size_mm) / 2;

          pdf.addImage(
            qrSvgDataUrl,
            "SVG",
            qrX,
            qrY,
            pos.size_mm,
            pos.size_mm,
            undefined,
            "FAST"
          );
        }

        // Add number text
        textPositionsMm.forEach((pos) => {
          const x_mm = cellX + pos.x_offset;
          const y_mm = cellY + pos.y_offset;

          // Text with white stroke effect (simulate by drawing white text slightly offset)
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(pos.fontSize_mm);
          
          // White outline (draw multiple times with slight offsets)
          pdf.setTextColor(255, 255, 255);
          const offsets = [
            [-0.3, -0.3], [0, -0.3], [0.3, -0.3],
            [-0.3, 0], [0.3, 0],
            [-0.3, 0.3], [0, 0.3], [0.3, 0.3],
          ];
          offsets.forEach(([dx, dy]) => {
            pdf.text(numberStr, x_mm + pos.w_mm / 2 + dx, y_mm + pos.h_mm / 2 + dy, {
              align: "center",
              baseline: "middle",
            });
          });

          // Black text on top
          pdf.setTextColor(17, 17, 17);
          pdf.text(numberStr, x_mm + pos.w_mm / 2, y_mm + pos.h_mm / 2, {
            align: "center",
            baseline: "middle",
          });
        });
      }
    }

    // Update progress: PDF generation = 20-100%
    const pdfProgress = 20 + Math.round(((pageIdx + 1) / pageCount) * 80);
    onProgress(pdfProgress);
  }

  // Download the PDF
  const filename = `billets_${prefix}${startNum}-${startNum + count - 1}.pdf`;
  const pdfBlob = pdf.output('blob');
  
  console.log('Browser:', navigator.userAgent);
  console.log('Checking showSaveFilePicker availability:', 'showSaveFilePicker' in window);
  
  // Try to use File System Access API to let user choose location (Chrome/Edge only)
  if (typeof (window as any).showSaveFilePicker === 'function') {
    console.log('showSaveFilePicker is available, attempting to use it...');
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: 'Fichiers PDF',
          accept: { 'application/pdf': ['.pdf'] },
        }],
        excludeAcceptAllOption: false,
      });
      
      console.log('File handle obtained, writing PDF...');
      const writable = await handle.createWritable();
      await writable.write(pdfBlob);
      await writable.close();
      console.log('PDF saved successfully to user-selected location!');
      
      return { filename, firstThumb };
    } catch (err: any) {
      console.error('showSaveFilePicker error:', err.name, err.message);
      // User cancelled
      if (err.name === 'AbortError') {
        throw new Error('Téléchargement annulé par l\'utilisateur');
      }
      // Other error - fallback to standard download
      console.warn('showSaveFilePicker failed, using fallback download');
    }
  } else {
    console.log('showSaveFilePicker not available in this browser - using standard download');
  }
  
  // Fallback: Create a download link (browser will use its download settings)
  console.log('Creating download link with blob URL...');
  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  
  console.log('Triggering download...');
  link.click();
  
  // Cleanup after a short delay
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    console.log('Download link cleaned up');
  }, 100);

  console.log('PDF generation complete. File should download to browser default location or prompt based on browser settings.');
  
  return { filename, firstThumb };
}
