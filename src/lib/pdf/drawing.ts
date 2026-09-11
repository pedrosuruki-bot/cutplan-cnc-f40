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
  const pad = Math.max(1, Math.min(2.2, Math.min(w, h) * 0.035));
  const topBand = Math.max(5, Math.min(12, h * 0.18));
  const sideBand = Math.max(5, Math.min(12, w * 0.18));

  doc.setTextColor(45, 45, 45);
  doc.setFont("helvetica", "normal");

  const widthPt = fitText(
    doc,
    widthText,
    Math.max(2, w - pad * 2),
    Math.max(5.5, Math.min(11, topBand * 1.2)),
    2.8,
  );
  doc.setFontSize(widthPt);
  doc.text(widthText, x + w / 2, y + pad + widthPt * 0.55, { align: "center" });

  const heightPt = fitText(
    doc,
    heightText,
    Math.max(2, h - pad * 2),
    Math.max(5.5, Math.min(11, sideBand * 1.2)),
    2.8,
  );
  doc.setFontSize(heightPt);
  doc.text(heightText, x + pad + heightPt * 0.45, y + h / 2, {
    align: "center",
    angle: 90,
  });
}

function drawCheckerboard(doc: jsPDF, x: number, y: number, w: number, h: number): void {
  const cell = 6;
  const rows = Math.ceil(h / cell);
  const cols = Math.ceil(w / cell);

  for (let row = 0; row < rows; row += 1) {
    const cellY = y + row * cell;
    const cellH = Math.min(cell, y + h - cellY);
    for (let col = 0; col < cols; col += 1) {
      const cellX = x + col * cell;
      const cellW = Math.min(cell, x + w - cellX);
      if ((row + col) % 2 === 0) doc.setFillColor(247, 247, 247);
      else doc.setFillColor(229, 229, 229);
      doc.rect(cellX, cellY, cellW, cellH, "F");
    }
  }
}

function drawSheet(doc: jsPDF, project: Project, layout: SheetLayout, showPartIds: boolean): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 12;
  const top = 34;
  const bottom = 25;
  const right = 18;
  const areaW = pageW - marginX * 2 - right;
  const areaH = pageH - top - bottom;

  const vertical = layout.length >= layout.width;
  const sheetW = vertical ? layout.width : layout.length;
  const sheetH = vertical ? layout.length : layout.width;
  const scale = Math.min(areaW / sheetW, areaH / sheetH);
  const drawW = sheetW * scale;
  const drawH = sheetH * scale;
  const ox = marginX + (areaW - drawW) / 2;
  const oy = top + (areaH - drawH) / 2;

  const mapRect = (x: number, y: number, w: number, h: number) =>
    vertical
      ? { x: layout.width - (y + h), y: x, w: h, h: w }
      : { x, y, w, h };

  doc.setTextColor(25, 25, 25);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`Chapa ${layout.index} — ${layout.material}`, marginX, 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(
    `${project.name}${project.client ? ` · Cliente: ${project.client}` : ""}`,
    marginX,
    16,
  );
  doc.setFontSize(8);
  doc.text(`Data: ${project.date || "—"} · Material: ${layout.material}`, marginX, 21);
  doc.text(
    `Dimensão da chapa: ${layout.length} × ${layout.width} × ${layout.thickness} mm`,
    marginX,
    26,
  );
  doc.setFontSize(7);
  doc.setTextColor(90, 90, 90);
  doc.text("Desenho de corte · medidas das peças em mm", marginX, 30);

  doc.setFillColor(248, 248, 248);
  doc.setDrawColor(70, 70, 70);
  doc.setLineWidth(0.55);
  doc.rect(ox, oy, drawW, drawH, "FD");

  for (const o of layout.offcuts) {
    const r = mapRect(o.x, o.y, o.w, o.h);
    const x = ox + r.x * scale;
    const y = oy + r.y * scale;
    const w = r.w * scale;
    const h = r.h * scale;

    drawCheckerboard(doc, x, y, w, h);
    doc.setDrawColor(145, 145, 145);
    doc.setLineWidth(0.18);
    doc.rect(x, y, w, h, "S");

    if (w > 28 && h > 12) {
      doc.setTextColor(90, 90, 90);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(Math.max(5.5, Math.min(8, Math.min(w, h) * 0.12)));
      doc.text(`${Math.round(r.w)} × ${Math.round(r.h)}`, x + w / 2, y + h / 2 + 2, {
        align: "center",
      });
    }
  }

  for (const p of layout.placements) {
    const r = mapRect(p.x, p.y, p.w, p.h);
    const x = ox + r.x * scale;
    const y = oy + r.y * scale;
    const w = r.w * scale;
    const h = r.h * scale;
    const c = rgbForPart(p.partId);

    doc.setFillColor(c[0], c[1], c[2]);
    doc.setDrawColor(80, 80, 80);
    doc.setLineWidth(0.22);
    doc.rect(x, y, w, h, "FD");

    drawPieceDimensions(doc, x, y, w, h, r.w, r.h);

    if (showPartIds) {
      const idSize = Math.max(6.5, Math.min(14, Math.min(w, h) * 0.22));
      doc.setFont("helvetica", "bold");
      const fittedIdSize = fitText(doc, p.partId, Math.max(4, w - 6), idSize, 5.5);
      doc.setFontSize(fittedIdSize);
      const idWidth = doc.getTextWidth(p.partId);

      if (w > idWidth + 6 && h > 16) {
        doc.setTextColor(25, 25, 25);
        doc.text(p.partId, x + w / 2, y + h * 0.57, { align: "center" });
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
  doc.text(`${Math.round(sheetW)} mm`, ox + drawW / 2, yDim + 5, { align: "center" });

  const xDim = ox + drawW + 8;
  doc.line(xDim, oy, xDim, oy + drawH);
  doc.line(xDim - 2, oy, xDim + 2, oy);
  doc.line(xDim - 2, oy + drawH, xDim + 2, oy + drawH);
  doc.text(`${Math.round(sheetH)} mm`, xDim + 3.5, oy + drawH / 2 + 3, {
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

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  result.layouts.forEach((layout, index) => {
    if (index > 0) doc.addPage("a4", "portrait");
    drawSheet(doc, project, layout, showPartIds);
  });
  doc.save(`${slug(project)}-desenho-chapas.pdf`);
}
