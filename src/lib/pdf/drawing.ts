import { jsPDF } from "jspdf";
import type { OptimizationResult, Project, SheetLayout } from "@/types";
import { rgbForPart } from "@/lib/plan-colors";

function slug(project: Project): string {
  return (
    project.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\u0300-\u036f\w]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "plano-corte"
  );
}

function fitText(doc: jsPDF, text: string, maxWidth: number, maxPt: number, minPt: number): number {
  let size = maxPt;
  while (size > minPt) {
    doc.setFontSize(size);
    if (doc.getTextWidth(text) <= maxWidth) return size;
    size -= 0.2;
  }
  return minPt;
}

function drawPieceDimensions(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  actualW: number,
  actualH: number,
): void {
  const widthText = `${Math.round(actualW)}`;
  const heightText = `${Math.round(actualH)}`;
  const pad = Math.max(0.8, Math.min(1.6, Math.min(w, h) * 0.04));
  const topBand = Math.max(3.5, Math.min(8, h * 0.2));
  const sideBand = Math.max(3.5, Math.min(8, w * 0.2));

  doc.setTextColor(55, 55, 55);
  doc.setFont("helvetica", "normal");

  const widthPt = fitText(
    doc,
    widthText,
    Math.max(1.5, w - pad * 2),
    Math.max(4.8, Math.min(8, topBand * 1.15)),
    1.8,
  );
  doc.setFontSize(widthPt);
  doc.text(widthText, x + w / 2, y + pad + widthPt * 0.35, { align: "center" });

  const heightPt = fitText(
    doc,
    heightText,
    Math.max(1.5, h - pad * 2),
    Math.max(4.8, Math.min(8, sideBand * 1.15)),
    1.8,
  );
  doc.setFontSize(heightPt);
  doc.text(heightText, x + pad + heightPt * 0.35, y + h / 2, {
    align: "center",
    angle: 90,
  });
}

function drawSheet(doc: jsPDF, layout: SheetLayout, showPartIds: boolean): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const left = 12;
  const top = 25;
  const right = 24;
  const bottom = 23;
  const areaW = pageW - left - right;
  const areaH = pageH - top - bottom;
  const sheetW = layout.length;
  const sheetH = layout.width;
  const scale = Math.min(areaW / sheetW, areaH / sheetH);
  const drawW = sheetW * scale;
  const drawH = sheetH * scale;
  const ox = left;
  const oy = top + (areaH - drawH) / 2;

  doc.setTextColor(25, 25, 25);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(`Chapa ${layout.index} — ${layout.material}`, margin, 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`Dimensão: ${layout.length} × ${layout.width} × ${layout.thickness} mm`, margin, 16);

  doc.setFillColor(248, 248, 248);
  doc.setDrawColor(70, 70, 70);
  doc.setLineWidth(0.55);
  doc.rect(ox, oy, drawW, drawH, "FD");

  for (const o of layout.offcuts) {
    const x = ox + o.x * scale;
    const y = oy + o.y * scale;
    const w = o.w * scale;
    const h = o.h * scale;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(165, 165, 165);
    doc.setLineWidth(0.18);
    doc.rect(x, y, w, h, "FD");
    if (w > 28 && h > 12) {
      doc.setTextColor(95, 95, 95);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.text(`${Math.round(o.w)} × ${Math.round(o.h)}`, x + w / 2, y + h / 2 + 2, {
        align: "center",
      });
    }
  }

  for (const p of layout.placements) {
    const x = ox + p.x * scale;
    const y = oy + p.y * scale;
    const w = p.w * scale;
    const h = p.h * scale;
    const c = rgbForPart(p.partId);

    doc.setFillColor(c[0], c[1], c[2]);
    doc.setDrawColor(80, 80, 80);
    doc.setLineWidth(0.22);
    doc.rect(x, y, w, h, "FD");

    drawPieceDimensions(doc, x, y, w, h, p.w, p.h);

    if (showPartIds) {
      const idSize = Math.max(4.2, Math.min(7.5, Math.min(w / 17, h / 8)));
      const minW = doc.getTextWidth(p.partId);
      if (w > minW + 4 && h > 14) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(idSize);
        doc.setTextColor(25, 25, 25);
        doc.text(p.partId, x + w / 2, y + h * 0.56, { align: "center" });
      }
    }
  }

  const dimColor: [number, number, number] = [150, 30, 30];
  doc.setDrawColor(dimColor[0], dimColor[1], dimColor[2]);
  doc.setTextColor(dimColor[0], dimColor[1], dimColor[2]);
  doc.setLineWidth(0.75);

  const yDim = oy + drawH + 7;
  doc.line(ox, yDim, ox + drawW, yDim);
  doc.line(ox, yDim - 2, ox, yDim + 2);
  doc.line(ox + drawW, yDim - 2, ox + drawW, yDim + 2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`${Math.round(layout.length)} mm`, ox + drawW / 2, yDim + 5, { align: "center" });

  const xDim = Math.min(pageW - 12, ox + drawW + 10);
  doc.line(xDim, oy, xDim, oy + drawH);
  doc.line(xDim - 2, oy, xDim + 2, oy);
  doc.line(xDim - 2, oy + drawH, xDim + 2, oy + drawH);
  doc.text(`${Math.round(layout.width)} mm`, xDim + 3.5, oy + drawH / 2 + 3, {
    align: "center",
    angle: 90,
  });

  doc.setTextColor(25, 25, 25);
  doc.setDrawColor(70, 70, 70);
}

export function exportSheetDrawingPdf(
  project: Project,
  result: OptimizationResult,
  showPartIds = true,
): void {
  if (!result.layouts.length) return;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  result.layouts.forEach((layout, index) => {
    if (index > 0) doc.addPage("a4", "landscape");
    drawSheet(doc, layout, showPartIds);
  });
  doc.save(`${slug(project)}-desenho-chapas.pdf`);
}
