/* prettier-ignore-file */

import { jsPDF } from "jspdf";
import type { OptimizationResult, Project, SheetLayout } from "@/types";
import { rgbForPart } from "@/lib/plan-colors";

function slug(project: Project): string {
  const value = project.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return value || "plano-corte";
}

function drawSheet(doc: jsPDF, layout: SheetLayout): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 16;
  const top = 36;
  const dimRight = 18;
  const dimBottom = 16;
  const areaW = pageW - margin * 2 - dimRight;
  const areaH = pageH - top - margin - dimBottom;
  const horizontal = layout.length >= layout.width;
  const sheetW = horizontal ? layout.length : layout.width;
  const sheetH = horizontal ? layout.width : layout.length;
  const scale = Math.min(areaW / sheetW, areaH / sheetH);
  const drawW = sheetW * scale;
  const drawH = sheetH * scale;
  const ox = margin + (areaW - drawW) / 2;
  const oy = top + (areaH - drawH) / 2;

  const mapRect = (x: number, y: number, w: number, h: number) =>
    horizontal ? { x, y, w, h } : { x: layout.width - (y + h), y: x, w: h, h: w };

  doc.setFillColor(248, 248, 248);
  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.6);
  doc.rect(ox, oy, drawW, drawH, "FD");

  for (const o of layout.offcuts) {
    const r = mapRect(o.x, o.y, o.w, o.h);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(170, 170, 170);
    doc.setLineWidth(0.25);
    doc.rect(ox + r.x * scale, oy + r.y * scale, r.w * scale, r.h * scale, "FD");
    if (r.w * scale > 28 && r.h * scale > 12) {
      doc.setTextColor(90, 90, 90);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(`${Math.round(o.w)} × ${Math.round(o.h)}`, ox + (r.x + r.w / 2) * scale, oy + (r.y + r.h / 2) * scale + 2, { align: "center" });
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
    doc.setLineWidth(0.25);
    doc.rect(x, y, w, h, "FD");

    const label = `${p.partId}\n${Math.round(p.w)} × ${Math.round(p.h)}`;
    const font = Math.max(6.5, Math.min(12, Math.min(w / Math.max(10, label.length * 0.45), h / 3)));
    if (w > 28 && h > 14) {
      doc.setTextColor(20, 20, 20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(font);
      const centerY = y + h / 2;
      doc.text(p.partId, x + w / 2, centerY - font * 0.25, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(Math.max(6.5, font - 1));
      doc.text(`${Math.round(p.w)} × ${Math.round(p.h)}`, x + w / 2, centerY + font * 0.8, { align: "center" });
    }
  }

  const dimColor: [number, number, number] = [150, 30, 30];
  doc.setDrawColor(dimColor[0], dimColor[1], dimColor[2]);
  doc.setTextColor(dimColor[0], dimColor[1], dimColor[2]);
  doc.setLineWidth(0.7);
  const yDim = oy + drawH + 8;
  doc.line(ox, yDim, ox + drawW, yDim);
  doc.line(ox, yDim - 2, ox, yDim + 2);
  doc.line(ox + drawW, yDim - 2, ox + drawW, yDim + 2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(`${Math.round(sheetW)} mm`, ox + drawW / 2, yDim + 6, { align: "center" });

  const xDim = ox + drawW + 8;
  doc.line(xDim, oy, xDim, oy + drawH);
  doc.line(xDim - 2, oy, xDim + 2, oy);
  doc.line(xDim - 2, oy + drawH, xDim + 2, oy + drawH);
  doc.setFontSize(15);
  doc.text(`${Math.round(sheetH)} mm`, xDim + 6, oy + drawH / 2 + 2, { align: "center", angle: 90 });

  doc.setTextColor(25, 25, 25);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(`Chapa ${layout.index} — ${layout.material}`, margin, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Dimensão: ${layout.length} × ${layout.width} × ${layout.thickness} mm`, margin, 22);
  doc.text("Desenho para oficina · cotas exteriores representam a dimensão real da chapa", margin, 29);
}

export function exportSheetDrawingPdf(project: Project, result: OptimizationResult): void {
  if (!result.layouts.length) return;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  result.layouts.forEach((layout, index) => {
    if (index > 0) doc.addPage("a4", "landscape");
    drawSheet(doc, layout);
  });
  doc.save(`${slug(project)}-desenho-chapas.pdf`);
}

function frame(doc: jsPDF, project: Project, page: number, total: number): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setTextColor(40);
  doc.setFontSize(10);
  doc.text(`CutPlan CNC — ${project.name}`, 12, 11);
  doc.setDrawColor(60);
  doc.setLineWidth(0.3);
  doc.line(12, 13.5, pageW - 12, 13.5);
  doc.line(12, pageH - 12, pageW - 12, pageH - 12);
  doc.setFontSize(7);
  doc.setTextColor(110);
  doc.text(total > 0 ? `página ${page}/${total}` : `página ${page}`, pageW - 12, pageH - 8, { align: "right" });
  doc.setTextColor(40);
}

function sheetPage(doc: jsPDF, project: Project, layout: SheetLayout, cost: number): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const sx = 12;
  let sy = 22;
  const cutLength = layout.cuts.reduce((s, c) => s + Math.abs(c.to - c.from), 0);
  const offcutAreaRaw = layout.offcuts.reduce((s, o) => s + o.w * o.h, 0);
  const wasteArea = Math.max(0, layout.sheetArea - layout.usedArea);
  const offcutArea = Math.min(offcutAreaRaw, wasteArea);
  const rows: [string, string][] = [
    ["Painel de stock", `${layout.length}×${layout.width}×${layout.thickness}`],
    ["Área utilizada", `${(layout.usedArea / 1e6).toFixed(2)} m²  ${layout.usagePct.toFixed(1)}%`],
    ["Desperdício total", `${(wasteArea / 1e6).toFixed(2)} m²  ${((wasteArea / layout.sheetArea) * 100).toFixed(1)}%`],
    ["Sobras aproveitáveis", `${(offcutArea / 1e6).toFixed(2)} m²  ${((offcutArea / layout.sheetArea) * 100).toFixed(1)}%`],
    ["Cortes", `${layout.cuts.length}`],
    ["Comprimento de corte", `${(cutLength / 1000).toFixed(2)} m`],
    ["Lâmina / margem", `${project.parameters.kerf} / ${project.parameters.margin} mm`],
    ["Painéis", `${layout.placements.length}`],
    ["N.º de sobras", `${layout.offcuts.length}`],
    ["Custo material", `${cost.toFixed(2)} EUR`],
    ["Método de corte", layout.cutMethod === "altendorf-f40" ? "Altendorf F40 — faixas + esquadro" : layout.cutMethod === "guillotine" ? "Guilhotina" : "Heurístico"],
    ["Plano manual", layout.manual ? "Sim" : "Não"],
  ];
  doc.setFontSize(7.5);
  for (const [label, value] of rows) {
    doc.setFont("helvetica", "bold");
    doc.text(label, sx, sy);
    doc.setFont("helvetica", "normal");
    doc.text(value, sx + 32, sy);
    sy += 4.4;
  }
  sy += 4;
  const counts = new Map<string, { n: number; color: [number, number, number] }>();
  for (const p of layout.placements) {
    const key = `${Math.round(p.w)}×${Math.round(p.h)}`;
    const entry = counts.get(key);
    if (entry) entry.n += 1;
    else counts.set(key, { n: 1, color: rgbForPart(p.partId) });
  }
  doc.setFillColor(225, 225, 225);
  doc.rect(sx, sy - 3.2, 48, 4.6, "F");
  doc.setFont("helvetica", "bold");
  doc.text("Painel", sx + 1, sy);
  doc.text("Qtd", sx + 38, sy);
  doc.setFont("helvetica", "normal");
  sy += 4.6;
  for (const [key, { n, color }] of counts) {
    if (sy > pageH - 16) break;
    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(sx + 0.5, sy - 2.4, 2.4, 2.4, "F");
    doc.text(key, sx + 4.5, sy);
    doc.text(String(n), sx + 38, sy);
    doc.setDrawColor(225);
    doc.setLineWidth(0.1);
    doc.line(sx, sy + 1.2, sx + 48, sy + 1.2);
    sy += 4.2;
  }
  const areaX = 68;
  const areaY = 22;
  const areaW = pageW - areaX - 26;
  const areaH = pageH - areaY - 20;
  const scale = Math.min(areaW / layout.length, areaH / layout.width);
  const drawW = layout.length * scale;
  const drawH = layout.width * scale;
  const ox = areaX;
  const oy = areaY;
  doc.setFillColor(248, 248, 248);
  doc.setDrawColor(120);
  doc.setLineWidth(0.3);
  doc.rect(ox, oy, drawW, drawH, "FD");
  for (const o of layout.offcuts) {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(200);
    doc.setLineWidth(0.15);
    doc.rect(ox + o.x * scale, oy + o.y * scale, o.w * scale, o.h * scale, "FD");
  }
  for (const p of layout.placements) {
    const x = ox + p.x * scale;
    const y = oy + p.y * scale;
    const w = p.w * scale;
    const h = p.h * scale;
    const c = rgbForPart(p.partId);
    doc.setFillColor(c[0], c[1], c[2]);
    doc.setDrawColor(110);
    doc.setLineWidth(0.15);
    doc.rect(x, y, w, h, "FD");
    const wTxt = String(Math.round(p.w));
    const hTxt = String(Math.round(p.h));
    const centerTxt = `${wTxt} × ${hTxt}`;
    doc.setTextColor(20);
    doc.setFont("helvetica", "bold");
    const fitCenter = Math.min(13, (w - 3) / (centerTxt.length * 0.55), (h - 3) / 1.6);
    if (fitCenter >= 5.5) {
      doc.setFontSize(fitCenter);
      doc.text(centerTxt, x + w / 2, y + h / 2 + fitCenter * 0.35, { align: "center" });
    }
    doc.setFont("helvetica", "normal");
    doc.setTextColor(70);
    if (w > 40 && h > 26 && fitCenter >= 5.5) {
      doc.setFontSize(6.8);
      doc.text(wTxt, x + w / 2, y + 5, { align: "center" });
      doc.text(hTxt, x + 5, y + h / 2, { align: "center", angle: 90 });
    }
    doc.setTextColor(40);
  }
  doc.setDrawColor(214, 78, 78);
  doc.setTextColor(214, 78, 78);
  doc.setLineWidth(0.3);
  const cx = ox + drawW + 6;
  doc.line(cx, oy, cx, oy + drawH);
  doc.line(cx - 1.2, oy, cx + 1.2, oy);
  doc.line(cx - 1.2, oy + drawH, cx + 1.2, oy + drawH);
  doc.setFontSize(9);
  doc.text(String(layout.width), cx + 3.4, oy + drawH / 2, { align: "center", angle: 90 });
  const cy = oy + drawH + 6;
  doc.line(ox, cy, ox + drawW, cy);
  doc.line(ox, cy - 1.2, ox, cy + 1.2);
  doc.line(ox + drawW, cy - 1.2, ox + drawW, cy + 1.2);
  doc.text(String(layout.length), ox + drawW / 2, cy + 3.4, { align: "center" });
  doc.setTextColor(40);
  doc.setDrawColor(60);
  doc.setFontSize(9);
  doc.text(`Chapa ${layout.index} — ${layout.material} ${layout.length}×${layout.width}×${layout.thickness} mm · ${project.parameters.kerf} mm de lâmina`, areaX, 18);
}

function cutListPage(doc: jsPDF, project: Project, result: OptimizationResult, startIndex: number): number {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const rows = result.layouts.flatMap((layout) => layout.placements.map((p) => ({ layout, p })));
  let i = startIndex;
  frame(doc, project, doc.getNumberOfPages(), 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("LISTA DE CORTE — OFICINA", 12, 25);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`${project.name} · ${project.client || "Sem cliente"} · ${project.date}`, 12, 31);
  doc.text(`Máquina: Altendorf F40 · Kerf: ${project.parameters.kerf} mm · Margem: ${project.parameters.margin} mm · Espaçamento: ${project.parameters.spacing} mm`, 12, 36);
  const cols = [12, 23, 34, 48, 65, 112, 140, 158, 172, 205, 238];
  const headers = ["OK", "#", "Ch", "ID", "Peça", "Compr.", "Larg.", "Rot.", "Material", "Fita", "Observações"];
  let y = 44;
  const rowH = 7;
  const drawHeader = () => {
    doc.setFillColor(35, 35, 35);
    doc.setTextColor(255, 255, 255);
    doc.rect(10, y - 5, pageW - 20, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.2);
    headers.forEach((h, idx) => doc.text(h, cols[idx]!, y));
    y += rowH;
    doc.setTextColor(30, 30, 30);
    doc.setFont("helvetica", "normal");
  };
  drawHeader();
  while (i < rows.length) {
    if (y > pageH - 18) {
      doc.addPage("a4", "portrait");
      frame(doc, project, doc.getNumberOfPages(), 0);
      y = 20;
      drawHeader();
    }
    const { layout, p } = rows[i]!;
    const part = project.parts.find((x) => x.id === p.partId);
    const values = ["[ ]", String(i + 1), String(layout.index), p.partId, p.name.slice(0, 28), String(Math.round(p.w)), String(Math.round(p.h)), p.rotated ? "90°" : "0°", (part?.material ?? layout.material).slice(0, 25), (part?.edgeBanding || "—").slice(0, 16), (part?.notes || "").slice(0, 28)];
    if (i % 2 === 0) {
      doc.setFillColor(245, 245, 245);
      doc.rect(10, y - 5, pageW - 20, rowH, "F");
    }
    doc.setFontSize(7.2);
    values.forEach((v, idx) => doc.text(v, cols[idx]!, y));
    doc.setDrawColor(220);
    doc.line(10, y + 2, pageW - 10, y + 2);
    y += rowH;
    i++;
  }
  if (result.unplaced.length) {
    if (y > pageH - 45) {
      doc.addPage("a4", "portrait");
      frame(doc, project, doc.getNumberOfPages(), 0);
      y = 20;
    }
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("PEÇAS NÃO ACOMODADAS", 12, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    for (const u of result.unplaced) {
      doc.text(`${u.partId} · ${u.name} · ${u.length}×${u.width} mm ×${u.quantity} · ${u.reason}`, 14, y);
      y += 5;
    }
  }
  return i;
}

function operationPages(doc: jsPDF, project: Project, result: OptimizationResult): void {
  for (const layout of result.layouts) {
    doc.addPage("a4", "portrait");
    frame(doc, project, doc.getNumberOfPages(), 0);
    const pageW = doc.internal.pageSize.getWidth();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(`OPERAÇÕES — CHAPA ${layout.index}`, 12, 22);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`${layout.material} · ${layout.length}×${layout.width}×${layout.thickness} mm`, 12, 29);
    doc.setFontSize(7.5);
    let y = 38;
    for (const c of layout.cuts) {
      if (y > pageH - 18) {
        doc.addPage("a4", "portrait");
        frame(doc, project, doc.getNumberOfPages(), 0);
        y = 20;
      }
      doc.setFont("helvetica", "bold");
      doc.text(`Fase ${c.order}`, 12, y);
      doc.setFont("helvetica", "normal");
      doc.text(`${c.phase || ""} · ${c.type} · posição ${c.position} mm · ${c.note}`, 32, y);
      y += 6;
    }
  }
}

export function exportProjectPdf(project: Project, result: OptimizationResult): void {
  if (!result.layouts.length) return;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  result.layouts.forEach((layout, index) => {
    if (index > 0) doc.addPage("a4", "landscape");
    sheetPage(doc, project, layout, result.stats.totalCost);
  });
  cutListPage(doc, project, result, 0);
  operationPages(doc, project, result);
  doc.save(`${slug(project)}.pdf`);
}
