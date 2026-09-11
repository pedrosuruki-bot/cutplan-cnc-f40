import { jsPDF } from "jspdf";
import type { OptimizationResult, Project, SheetLayout } from "@/types";
import { rgbForPart } from "@/lib/plan-colors";

function slug(project: Project): string {
  return (
    project.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "plano-corte"
  );
}

function mm(value: number): string {
  return Math.round(value).toString();
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

interface PieceGroup {
  w: number;
  h: number;
  qty: number;
  ids: string[];
}

function groupPieces(layout: SheetLayout): PieceGroup[] {
  const groups = new Map<string, PieceGroup>();
  for (const piece of layout.placements) {
    const a = Math.min(piece.w, piece.h);
    const b = Math.max(piece.w, piece.h);
    const key = `${Math.round(a)}x${Math.round(b)}`;
    const existing = groups.get(key);
    if (existing) {
      existing.qty += 1;
      if (!existing.ids.includes(piece.partId)) existing.ids.push(piece.partId);
    } else {
      groups.set(key, {
        w: b,
        h: a,
        qty: 1,
        ids: [piece.partId],
      });
    }
  }
  return Array.from(groups.values()).sort((a, b) => b.w * b.h - a.w * a.h);
}

function drawCheckerboard(doc: jsPDF, x: number, y: number, w: number, h: number): void {
  const cell = Math.max(3, Math.min(5, Math.min(w, h) / 5));
  const rows = Math.ceil(h / cell);
  const cols = Math.ceil(w / cell);
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const cx = x + col * cell;
      const cy = y + row * cell;
      const cw = Math.min(cell, x + w - cx);
      const ch = Math.min(cell, y + h - cy);
      doc.setFillColor((row + col) % 2 === 0 ? 249 : 232, (row + col) % 2 === 0 ? 249 : 232, (row + col) % 2 === 0 ? 249 : 232);
      doc.rect(cx, cy, cw, ch, "F");
    }
  }
}

function drawDimensionTop(doc: jsPDF, x: number, y: number, w: number, text: string, scale: number): void {
  if (w < 13) return;
  const size = fitText(doc, text, w - 3, Math.max(5.5, Math.min(9.5, 7.2 * scale)), 4.8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(size);
  doc.setTextColor(55, 55, 55);
  doc.text(text, x + w / 2, y + Math.max(3.5, Math.min(6, w * 0.045)), { align: "center" });
}

function drawDimensionSide(doc: jsPDF, x: number, y: number, h: number, text: string, scale: number): void {
  if (h < 13) return;
  const size = fitText(doc, text, h - 3, Math.max(5.5, Math.min(9.5, 7.2 * scale)), 4.8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(size);
  doc.setTextColor(55, 55, 55);
  doc.text(text, x + Math.max(2.7, Math.min(4.5, h * 0.03)), y + h / 2, {
    align: "center",
    angle: 90,
  });
}

function drawPieceLabel(doc: jsPDF, x: number, y: number, w: number, h: number, id: string): void {
  if (w < 17 || h < 13) return;
  const maxPt = Math.max(6, Math.min(11.5, Math.min(w, h) * 0.24));
  const size = fitText(doc, id, Math.max(7, w - 7), maxPt, 5.2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(size);
  doc.setTextColor(28, 28, 28);
  if (doc.getTextWidth(id) <= w - 6) {
    doc.text(id, x + w / 2, y + h / 2 + size * 0.12, { align: "center" });
  }
}

function drawSheet(
  doc: jsPDF,
  layout: SheetLayout,
  project: Project,
  showPartIds: boolean,
  pageNumber: number,
  totalPages: number,
): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const left = 10;
  const top = 10;
  const bottom = 9;
  const right = 10;
  const infoW = 52;
  const gap = 7;
  const drawingX = left + infoW + gap;
  const drawingTop = 25;
  const drawingAreaW = pageW - drawingX - right - 10;
  const drawingAreaH = pageH - drawingTop - bottom - 9;

  const sheetIsVerticalOnPage = layout.length >= layout.width;
  const sheetW = sheetIsVerticalOnPage ? layout.width : layout.length;
  const sheetH = sheetIsVerticalOnPage ? layout.length : layout.width;
  const scale = Math.min(drawingAreaW / sheetW, drawingAreaH / sheetH);
  const drawW = sheetW * scale;
  const drawH = sheetH * scale;
  const ox = drawingX + (drawingAreaW - drawW) / 2;
  const oy = drawingTop + (drawingAreaH - drawH) / 2;

  const mapRect = (p: { x: number; y: number; w: number; h: number }) =>
    sheetIsVerticalOnPage
      ? { x: layout.width - (p.y + p.h), y: p.x, w: p.h, h: p.w }
      : { x: p.x, y: p.y, w: p.w, h: p.h };

  const wasteArea = Math.max(0, layout.sheetArea - layout.usedArea);
  const offcutArea = Math.min(
    wasteArea,
    layout.offcuts.reduce((sum, o) => sum + o.w * o.h, 0),
  );
  const cutLength = layout.cuts.reduce((sum, c) => sum + Math.abs(c.to - c.from), 0);
  const groups = groupPieces(layout);

  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Chapa ${layout.index}  ·  ${layout.material}`, left, top + 2);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.1);
  doc.setTextColor(75, 75, 75);
  doc.text(project.name, left, top + 7);
  if (project.client) doc.text(`Cliente: ${project.client}`, left, top + 11.2);
  doc.text(`Data: ${project.date}  ·  Material: ${layout.material}`, left, top + 15.4);
  doc.text(
    `Chapa: ${mm(layout.length)} × ${mm(layout.width)} × ${mm(layout.thickness)} mm`,
    left,
    top + 19.5,
  );

  let sy = drawingTop + 4;
  doc.setFillColor(232, 232, 232);
  doc.roundedRect(left, sy - 4.3, infoW, 6.3, 1, 1, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.4);
  doc.setTextColor(45, 45, 45);
  doc.text("PAINEL DE STOCK", left + 2, sy);
  doc.text("QTD", left + infoW - 11, sy);
  sy += 5.7;

  const summary: [string, string][] = [
    ["Dimensão", `${mm(layout.width)}×${mm(layout.length)}`],
    ["Área usada", `${(layout.usedArea / 1e6).toFixed(3)} m²`],
    ["Aproveitamento", `${layout.usagePct.toFixed(1)}%`],
    ["Área excedente", `${(wasteArea / 1e6).toFixed(3)} m²`],
    ["Sobras úteis", `${(offcutArea / 1e6).toFixed(3)} m²`],
    ["Cortes", String(layout.cuts.length)],
    ["Comprimento", `${(cutLength / 1000).toFixed(2)} m`],
    ["Peças", String(layout.placements.length)],
    ["Excedentes", String(layout.offcuts.length)],
  ];

  doc.setFontSize(6.7);
  for (const [label, value] of summary) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(65, 65, 65);
    doc.text(label, left, sy);
    doc.setFont("helvetica", "normal");
    doc.text(value, left + 25, sy);
    sy += 4.25;
  }

  sy += 2.5;
  doc.setFillColor(242, 242, 242);
  doc.roundedRect(left, sy - 4.2, infoW, 6.2, 1, 1, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.4);
  doc.setTextColor(45, 45, 45);
  doc.text(showPartIds ? "PEÇAS" : "MEDIDAS", left + 2, sy);
  doc.text("QTD", left + infoW - 11, sy);
  sy += 5.7;

  doc.setFontSize(6.5);
  for (const group of groups) {
    const idText = showPartIds ? group.ids.join("/") : `${mm(group.w)}×${mm(group.h)}`;
    const dims = showPartIds ? `${mm(group.w)}×${mm(group.h)}` : "";
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40, 40, 40);
    const idSize = fitText(doc, idText, 26, 6.5, 4.8);
    doc.setFontSize(idSize);
    doc.text(idText, left, sy);
    if (showPartIds) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.2);
      doc.text(dims, left + 27, sy);
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.text(`×${group.qty}`, left + infoW - 11, sy);
    sy += 4.25;
    if (sy > pageH - 25) break;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.8);
  doc.setTextColor(90, 90, 90);
  doc.text("Cada medida repetida é agrupada", left, pageH - 16);
  doc.text("na lista para acelerar a produção.", left, pageH - 12.5);

  doc.setFillColor(250, 250, 250);
  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.55);
  doc.rect(ox, oy, drawW, drawH, "FD");

  for (const o of layout.offcuts) {
    const r = mapRect(o);
    const x = ox + r.x * scale;
    const y = oy + r.y * scale;
    const w = r.w * scale;
    const h = r.h * scale;
    drawCheckerboard(doc, x, y, w, h);
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.18);
    doc.rect(x, y, w, h, "S");
    if (w > 21 && h > 12) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(Math.max(5.2, Math.min(7.2, Math.min(w, h) * 0.12)));
      doc.setTextColor(95, 95, 95);
      doc.text(`${mm(r.w)} × ${mm(r.h)}`, x + w / 2, y + h / 2 + 1.8, { align: "center" });
    }
  }

  for (const p of layout.placements) {
    const r = mapRect(p);
    const x = ox + r.x * scale;
    const y = oy + r.y * scale;
    const w = r.w * scale;
    const h = r.h * scale;
    const c = rgbForPart(p.partId);

    doc.setFillColor(c[0], c[1], c[2]);
    doc.setDrawColor(65, 65, 65);
    doc.setLineWidth(0.28);
    doc.rect(x, y, w, h, "FD");

    drawDimensionTop(doc, x, y, w, mm(r.w), scale);
    drawDimensionSide(doc, x, y, h, mm(r.h), scale);
    if (showPartIds) drawPieceLabel(doc, x, y, w, h, p.partId);
  }

  const red: [number, number, number] = [170, 45, 45];
  doc.setDrawColor(red[0], red[1], red[2]);
  doc.setTextColor(red[0], red[1], red[2]);
  doc.setLineWidth(0.55);

  const yDim = oy + drawH + 5.5;
  doc.line(ox, yDim, ox + drawW, yDim);
  doc.line(ox, yDim - 1.7, ox, yDim + 1.7);
  doc.line(ox + drawW, yDim - 1.7, ox + drawW, yDim + 1.7);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(`${mm(sheetW)} mm`, ox + drawW / 2, yDim + 4.1, { align: "center" });

  const xDim = ox + drawW + 6.5;
  doc.line(xDim, oy, xDim, oy + drawH);
  doc.line(xDim - 1.7, oy, xDim + 1.7, oy);
  doc.line(xDim - 1.7, oy + drawH, xDim + 1.7, oy + drawH);
  doc.setFontSize(8.5);
  doc.text(`${mm(sheetH)} mm`, xDim + 3.2, oy + drawH / 2 + 3, {
    align: "center",
    angle: 90,
  });

  doc.setDrawColor(185, 185, 185);
  doc.setTextColor(95, 95, 95);
  doc.setLineWidth(0.25);
  doc.line(left, pageH - 8, pageW - right, pageH - 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.2);
  doc.text(`CutPlan CNC  ·  ${project.name}`, left, pageH - 4.5);
  doc.text(`${pageNumber}/${totalPages}`, pageW - right, pageH - 4.5, { align: "right" });
}

export function exportSheetDrawingPdf(
  project: Project,
  result: OptimizationResult,
  showPartIds = true,
): void {
  if (!result.layouts.length) return;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  result.layouts.forEach((layout, index) => {
    if (index > 0) doc.addPage("a4", "portrait");
    drawSheet(doc, layout, project, showPartIds, index + 1, result.layouts.length);
  });
  doc.save(`${slug(project)}-desenho-chapas.pdf`);
}
