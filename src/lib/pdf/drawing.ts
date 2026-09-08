/* prettier-ignore-file */

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

function drawPartMeasurement(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
): void {
  const pad = 0.7;
  const usableW = Math.max(1.2, w - pad * 2);
  const usableH = Math.max(1.2, h - pad * 2);
  const centerX = x + w / 2;
  const centerY = y + h / 2;
  const minPt = 1.8;
  const maxPt = 9;
  const mmPerPoint = 0.3528;
  const averageGlyphMm = 0.5 * mmPerPoint;
  const textHeightFactor = 1.25;

  // First try horizontal text. The calculation uses the actual conversion
  // from PDF points to millimetres, so the text cannot silently overflow.
  const fitHorizontal = Math.min(
    maxPt,
    usableW / Math.max(1, text.length * averageGlyphMm),
    usableH / (mmPerPoint * textHeightFactor),
  );
  if (fitHorizontal >= minPt) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fitHorizontal);
    doc.text(text, centerX, centerY + fitHorizontal * mmPerPoint * 0.35, {
      align: "center",
    });
    return;
  }

  // For narrow pieces, rotate the complete measurement and use the longer side.
  const fitVertical = Math.min(
    maxPt,
    usableH / Math.max(1, text.length * averageGlyphMm),
    usableW / (mmPerPoint * textHeightFactor),
  );
  if (fitVertical >= minPt) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fitVertical);
    doc.text(text, centerX, centerY + fitVertical * mmPerPoint * 0.35, {
      align: "center",
      angle: 90,
    });
    return;
  }

  // Extremely small pieces: split the two dimensions so both values stay inside.
  const [first, second = ""] = text.split("x");
  const tinyPt = Math.max(
    minPt,
    Math.min(3.8, usableW / (mmPerPoint * 2.8), usableH / (mmPerPoint * 2.8)),
  );
  doc.setFont("helvetica", "bold");
  doc.setFontSize(tinyPt);
  doc.text(first, centerX, centerY - tinyPt * mmPerPoint * 0.55, {
    align: "center",
  });
  doc.text(`x${second}`, centerX, centerY + tinyPt * mmPerPoint * 0.95, {
    align: "center",
  });
}

function drawSheet(doc: jsPDF, layout: SheetLayout, showPartIds: boolean): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const leftPanelW = 43;
  const top = 24;
  const bottom = 23;
  const dimRight = 18;
  const areaX = margin + leftPanelW;
  const areaW = pageW - areaX - margin - dimRight;
  const areaH = pageH - top - bottom;
  const sheetW = layout.width;
  const sheetH = layout.length;
  const scale = Math.min(areaW / sheetW, areaH / sheetH);
  const drawW = sheetW * scale;
  const drawH = sheetH * scale;
  const ox = areaX + (areaW - drawW) / 2;
  const oy = top + (areaH - drawH) / 2;

  const mapRect = (x: number, y: number, w: number, h: number) => ({
    x: layout.width - (y + h),
    y: x,
    w: h,
    h: w,
  });

  doc.setTextColor(25, 25, 25);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`Chapa ${layout.index} — ${layout.material}`, margin, 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(`Dimensão: ${layout.length} × ${layout.width} × ${layout.thickness} mm`, margin, 15);

  const usedPct = layout.usagePct;
  const wastePct = Math.max(0, 100 - usedPct);
  const cutLength = layout.cuts.reduce((sum, cut) => sum + Math.abs(cut.to - cut.from), 0);
  const offcutArea = layout.offcuts.reduce((sum, offcut) => sum + offcut.w * offcut.h, 0);
  const rows: [string, string][] = [
    ["Painel de stock", `${Math.round(layout.length)}×${Math.round(layout.width)}`],
    ["Área utilizada", `${(layout.usedArea / 1e6).toFixed(2)} m²  ${usedPct.toFixed(1)}%`],
    ["Área excedente", `${(Math.max(0, layout.sheetArea - layout.usedArea) / 1e6).toFixed(2)} m²`],
    ["Cortes", `${layout.cuts.length}`],
    ["Comprimento de corte", `${(cutLength / 1000).toFixed(2)} m`],
    ["Sobras", `${layout.offcuts.length}`],
    ["Área aproveitável", `${(offcutArea / 1e6).toFixed(2)} m²`],
    ["Desperdício", `${wastePct.toFixed(1)}%`],
  ];
  let sy = 26;
  doc.setFontSize(6.1);
  for (const [label, value] of rows) {
    doc.setFont("helvetica", "bold");
    doc.text(label, margin, sy);
    doc.setFont("helvetica", "normal");
    doc.text(value, margin + 25, sy);
    sy += 4.3;
  }

  doc.setFont("helvetica", "bold");
  doc.text("Painel", margin, sy + 2);
  doc.text("Qtd", margin + 30, sy + 2);
  sy += 6;
  doc.setFont("helvetica", "normal");
  const counts = new Map<string, { count: number; color: [number, number, number] }>();
  for (const p of layout.placements) {
    const key = `${Math.round(p.w)}×${Math.round(p.h)}`;
    const current = counts.get(key);
    if (current) current.count += 1;
    else counts.set(key, { count: 1, color: rgbForPart(p.partId) });
  }
  for (const [key, item] of counts) {
    doc.setFillColor(item.color[0], item.color[1], item.color[2]);
    doc.rect(margin, sy - 2.1, 2.3, 2.3, "F");
    doc.setTextColor(30, 30, 30);
    doc.text(key, margin + 4, sy);
    doc.text(String(item.count), margin + 30, sy);
    sy += 3.8;
    if (sy > pageH - 14) break;
  }

  doc.setFillColor(248, 248, 248);
  doc.setDrawColor(70, 70, 70);
  doc.setLineWidth(0.65);
  doc.rect(ox, oy, drawW, drawH, "FD");

  for (const o of layout.offcuts) {
    const r = mapRect(o.x, o.y, o.w, o.h);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(165, 165, 165);
    doc.setLineWidth(0.2);
    doc.rect(ox + r.x * scale, oy + r.y * scale, r.w * scale, r.h * scale, "FD");
    if (r.w * scale > 24 && r.h * scale > 10) {
      doc.setTextColor(90, 90, 90);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.text(
        `${Math.round(o.w)} × ${Math.round(o.h)}`,
        ox + (r.x + r.w / 2) * scale,
        oy + (r.y + r.h / 2) * scale + 2,
        { align: "center" },
      );
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

    // Always print the dimensions inside the piece. The label adapts to the piece:
    // horizontal when it fits, vertical for narrow pieces, split for very tiny ones.
    const dimText = `${Math.round(p.w)}x${Math.round(p.h)}`;
    drawPartMeasurement(doc, x, y, w, h, dimText);

    if (showPartIds && w > 25 && h > 18) {
      const idSize = Math.max(4.5, Math.min(7, Math.min(w / 18, h / 8)));
      doc.setFont("helvetica", "normal");
      doc.setFontSize(idSize);
      doc.setTextColor(35, 35, 35);
      doc.text(p.partId, x + w / 2, y + h / 2 - 4, { align: "center" });
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
  doc.text(`${Math.round(layout.width)} mm`, ox + drawW / 2, yDim + 5, { align: "center" });

  const xDim = Math.min(pageW - 13, ox + drawW + 11);
  doc.line(xDim, oy, xDim, oy + drawH);
  doc.line(xDim - 2, oy, xDim + 2, oy);
  doc.line(xDim - 2, oy + drawH, xDim + 2, oy + drawH);
  doc.setFontSize(11);
  doc.text(`${Math.round(layout.length)} mm`, xDim + 3.5, oy + drawH / 2 + 3, {
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
    drawSheet(doc, layout, showPartIds);
  });
  doc.save(`${slug(project)}-desenho-chapas.pdf`);
}
