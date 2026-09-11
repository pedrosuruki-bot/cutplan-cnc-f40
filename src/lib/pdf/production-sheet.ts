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
    const w = Math.round(Math.max(piece.w, piece.h));
    const h = Math.round(Math.min(piece.w, piece.h));
    const key = `${w}x${h}`;
    const existing = groups.get(key);
    if (existing) {
      existing.qty += 1;
      if (!existing.ids.includes(piece.partId)) existing.ids.push(piece.partId);
    } else {
      groups.set(key, { w, h, qty: 1, ids: [piece.partId] });
    }
  }
  return Array.from(groups.values()).sort((a, b) => b.w * b.h - a.w * a.h);
}

function drawCheckerboard(doc: jsPDF, x: number, y: number, w: number, h: number): void {
  if (w <= 0 || h <= 0) return;
  const cell = 4;
  for (let row = 0; y + row * cell < y + h; row += 1) {
    for (let col = 0; x + col * cell < x + w; col += 1) {
      const cx = x + col * cell;
      const cy = y + row * cell;
      const cw = Math.min(cell, x + w - cx);
      const ch = Math.min(cell, y + h - cy);
      const v = (row + col) % 2 === 0 ? 248 : 232;
      doc.setFillColor(v, v, v);
      doc.rect(cx, cy, cw, ch, "F");
    }
  }
}

function drawSheetHeader(doc: jsPDF, layout: SheetLayout, project: Project): void {
  doc.setTextColor(25, 25, 25);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Chapa ${layout.index} · ${layout.material}`, 10, 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(75, 75, 75);
  doc.text(project.name, 10, 16);
  doc.text(project.client ? `Cliente: ${project.client}` : "Cliente: —", 10, 20);
  doc.text(`Data: ${project.date} · Material: ${layout.material}`, 10, 24);
  doc.text(
    `Chapa: ${mm(layout.length)} × ${mm(layout.width)} × ${mm(layout.thickness)} mm`,
    10,
    28,
  );
}

function drawInfoColumn(doc: jsPDF, layout: SheetLayout, groups: PieceGroup[]): void {
  const x = 10;
  const y = 35;
  const w = 52;
  const rowH = 5.2;

  const summary: [string, string][] = [
    ["Dimensão", `${mm(layout.width)} × ${mm(layout.length)}`],
    ["Aproveitamento", `${layout.usagePct.toFixed(1)}%`],
    ["Área usada", `${(layout.usedArea / 1e6).toFixed(3)} m²`],
    ["Área excedente", `${(Math.max(0, layout.sheetArea - layout.usedArea) / 1e6).toFixed(3)} m²`],
    ["Sobras úteis", `${(layout.offcuts.reduce((s, o) => s + o.w * o.h, 0) / 1e6).toFixed(3)} m²`],
    ["Cortes", String(layout.cuts.length)],
    ["Peças", String(layout.placements.length)],
  ];

  const blockH = 5 + summary.length * rowH + 3;
  doc.setFillColor(244, 244, 244);
  doc.setDrawColor(205, 205, 205);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, w, blockH, 1.5, 1.5, "FD");

  let sy = y + 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(45, 45, 45);
  doc.text("RESUMO DA CHAPA", x + 2.5, sy);
  sy += 4.5;

  doc.setFontSize(6.4);
  for (const [label, value] of summary) {
    doc.setFont("helvetica", "bold");
    doc.text(label, x + 2.5, sy);
    doc.setFont("helvetica", "normal");
    doc.text(value, x + 25, sy);
    sy += rowH;
  }

  sy += 2;
  const tableY = sy;
  const tableH = Math.max(20, groups.length * rowH + 7);
  doc.setFillColor(248, 248, 248);
  doc.setDrawColor(205, 205, 205);
  doc.roundedRect(x, tableY, w, tableH, 1.5, 1.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(45, 45, 45);
  doc.text("PEÇAS", x + 2.5, tableY + 5);
  doc.text("QTD", x + w - 2.5, tableY + 5, { align: "right" });

  sy = tableY + 10;
  doc.setFontSize(6.5);
  for (const group of groups) {
    if (sy > 276) break;
    const ids = group.ids.join("/");
    const idSize = fitText(doc, ids, 17, 6.5, 4.6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(idSize);
    doc.text(ids, x + 2.5, sy);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.2);
    doc.text(`${group.w} × ${group.h}`, x + 21, sy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.6);
    doc.text(`×${group.qty}`, x + w - 2.5, sy, { align: "right" });
    sy += rowH;
  }
}

function drawPiece(
  doc: jsPDF,
  p: { x: number; y: number; w: number; h: number; partId: string },
  map: (p: { x: number; y: number; w: number; h: number }) => { x: number; y: number; w: number; h: number },
  ox: number,
  oy: number,
  scale: number,
  showPartIds: boolean,
): void {
  const r = map(p);
  const x = ox + r.x * scale;
  const y = oy + r.y * scale;
  const w = r.w * scale;
  const h = r.h * scale;
  const c = rgbForPart(p.partId);

  doc.setFillColor(c[0], c[1], c[2]);
  doc.setDrawColor(70, 70, 70);
  doc.setLineWidth(0.28);
  doc.rect(x, y, w, h, "FD");

  const minPx = Math.min(w, h);
  const maxPx = Math.max(w, h);

  if (minPx >= 18 && showPartIds) {
    const idSize = fitText(doc, p.partId, Math.max(8, w - 5), Math.max(6.5, Math.min(12, minPx * 0.23)), 5.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(idSize);
    doc.setTextColor(25, 25, 25);
    doc.text(p.partId, x + w / 2, y + h / 2 + idSize * 0.12, { align: "center" });
  }

  if (minPx >= 28) {
    const topText = mm(r.w);
    const sideText = mm(r.h);
    const topSize = fitText(doc, topText, Math.max(8, w - 4), Math.min(7.5, Math.max(5.2, minPx * 0.08)), 4.8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(topSize);
    doc.setTextColor(60, 60, 60);
    doc.text(topText, x + w / 2, y + 4, { align: "center" });

    if (maxPx >= 42) {
      const sideSize = fitText(doc, sideText, Math.max(8, h - 4), Math.min(7.5, Math.max(5.2, minPx * 0.08)), 4.8);
      doc.setFontSize(sideSize);
      doc.text(sideText, x + 3, y + h / 2 + sideSize * 0.15, { align: "center", angle: 90 });
    }
  }
}

export function drawProductionSheetPage(
  doc: jsPDF,
  layout: SheetLayout,
  project: Project,
  showPartIds = true,
  pageNumber = 1,
  totalPages = 1,
): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const left = 10;
  const right = 10;
  const drawingX = 70;
  const drawingTop = 35;
  const drawingW = pageW - drawingX - right;
  const drawingH = pageH - drawingTop - 22;

  drawSheetHeader(doc, layout, project);
  const groups = groupPieces(layout);
  drawInfoColumn(doc, layout, groups);

  const vertical = layout.length >= layout.width;
  const sheetW = vertical ? layout.width : layout.length;
  const sheetH = vertical ? layout.length : layout.width;
  const scale = Math.min(drawingW / sheetW, drawingH / sheetH);
  const drawW = sheetW * scale;
  const drawH = sheetH * scale;
  const ox = drawingX + (drawingW - drawW) / 2;
  const oy = drawingTop + (drawingH - drawH) / 2;

  doc.setFillColor(250, 250, 250);
  doc.setDrawColor(55, 55, 55);
  doc.setLineWidth(0.6);
  doc.rect(ox, oy, drawW, drawH, "FD");

  const map = (p: { x: number; y: number; w: number; h: number }) =>
    vertical
      ? { x: layout.width - (p.y + p.h), y: p.x, w: p.h, h: p.w }
      : { x: p.x, y: p.y, w: p.w, h: p.h };

  for (const o of layout.offcuts) {
    const r = map(o);
    const x = ox + r.x * scale;
    const y = oy + r.y * scale;
    const w = r.w * scale;
    const h = r.h * scale;
    drawCheckerboard(doc, x, y, w, h);
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.15);
    doc.rect(x, y, w, h, "S");
  }

  for (const p of layout.placements) {
    drawPiece(doc, p, map, ox, oy, scale, showPartIds);
  }

  const red: [number, number, number] = [170, 45, 45];
  doc.setDrawColor(red[0], red[1], red[2]);
  doc.setTextColor(red[0], red[1], red[2]);
  doc.setLineWidth(0.55);

  const bottomY = oy + drawH + 6;
  if (bottomY < pageH - 13) {
    doc.line(ox, bottomY, ox + drawW, bottomY);
    doc.line(ox, bottomY - 1.6, ox, bottomY + 1.6);
    doc.line(ox + drawW, bottomY - 1.6, ox + drawW, bottomY + 1.6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(`${mm(sheetW)} mm`, ox + drawW / 2, bottomY + 4, { align: "center" });
  }

  const rightX = ox + drawW + 7;
  if (rightX < pageW - 3) {
    doc.line(rightX, oy, rightX, oy + drawH);
    doc.line(rightX - 1.6, oy, rightX + 1.6, oy);
    doc.line(rightX - 1.6, oy + drawH, rightX + 1.6, oy + drawH);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(`${mm(sheetH)} mm`, rightX + 3, oy + drawH / 2 + 3, {
      align: "center",
      angle: 90,
    });
  }

  doc.setDrawColor(190, 190, 190);
  doc.setTextColor(95, 95, 95);
  doc.setLineWidth(0.25);
  doc.line(left, pageH - 8, pageW - right, pageH - 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.2);
  doc.text(`CutPlan CNC · ${project.name}`, left, pageH - 4.5);
  doc.text(`${pageNumber}/${totalPages}`, pageW - right, pageH - 4.5, { align: "right" });
}

export function exportProductionSheetPdf(
  project: Project,
  result: OptimizationResult,
  showPartIds = true,
): void {
  if (!result.layouts.length) return;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  result.layouts.forEach((layout, index) => {
    if (index > 0) doc.addPage("a4", "portrait");
    drawProductionSheetPage(doc, layout, project, showPartIds, index + 1, result.layouts.length);
  });
  doc.save(`${slug(project)}-desenho-chapas.pdf`);
}
