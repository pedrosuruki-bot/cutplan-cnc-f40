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

function frame(doc: jsPDF, project: Project): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setTextColor(40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`CutPlan CNC — ${project.name}`, 12, 11);
  doc.setDrawColor(60);
  doc.setLineWidth(0.3);
  doc.line(12, 13.5, pageW - 12, 13.5);
  doc.line(12, pageH - 12, pageW - 12, pageH - 12);
}

function drawReportSheet(doc: jsPDF, layout: SheetLayout, project: Project, cost: number): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const sideW = 54;
  const areaX = 68;
  const areaY = 22;
  const areaW = pageW - areaX - 24;
  const areaH = pageH - areaY - 20;
  const scale = Math.min(areaW / layout.length, areaH / layout.width);
  const drawW = layout.length * scale;
  const drawH = layout.width * scale;
  const ox = areaX;
  const oy = areaY;
  const cutLength = layout.cuts.reduce((s, c) => s + Math.abs(c.to - c.from), 0);
  const wasteArea = Math.max(0, layout.sheetArea - layout.usedArea);
  const offcutArea = Math.min(layout.offcuts.reduce((s, o) => s + o.w * o.h, 0), wasteArea);

  frame(doc, project);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`Chapa ${layout.index} — ${layout.material} ${layout.length}×${layout.width}×${layout.thickness} mm · ${project.parameters.kerf} mm de lâmina`, areaX, 18);

  const rows: [string, string][] = [
    ["Painel de stock", `${layout.length}×${layout.width}×${layout.thickness}`],
    ["Área utilizada", `${(layout.usedArea / 1e6).toFixed(2)} m²  ${layout.usagePct.toFixed(1)}%`],
    ["Desperdício total", `${(wasteArea / 1e6).toFixed(2)} m²  ${((wasteArea / layout.sheetArea) * 100).toFixed(1)}%`],
    ["Sobras aproveitáveis", `${(offcutArea / 1e6).toFixed(2)} m²  ${((offcutArea / layout.sheetArea) * 100).toFixed(1)}%`],
    ["Cortes", String(layout.cuts.length)],
    ["Comprimento de corte", `${(cutLength / 1000).toFixed(2)} m`],
    ["Lâmina / margem", `${project.parameters.kerf} / ${project.parameters.margin} mm`],
    ["Painéis", String(layout.placements.length)],
    ["N.º de sobras", String(layout.offcuts.length)],
    ["Custo material", `${cost.toFixed(2)} EUR`],
    ["Método de corte", layout.cutMethod === "altendorf-f40" ? "Altendorf F40 — faixas + esquadro" : layout.cutMethod === "guillotine" ? "Guilhotina" : "Heurístico"],
    ["Plano manual", layout.manual ? "Sim" : "Não"],
  ];
  doc.setFontSize(7.5);
  let sy = 22;
  for (const [label, value] of rows) {
    doc.setFont("helvetica", "bold");
    doc.text(label, 12, sy);
    doc.setFont("helvetica", "normal");
    doc.text(value, 44, sy);
    sy += 4.4;
  }

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

    const widthText = String(Math.round(p.w));
    const heightText = String(Math.round(p.h));
    doc.setTextColor(70);
    doc.setFont("helvetica", "normal");
    if (w > 30 && h > 16) {
      doc.setFontSize(Math.max(5.5, Math.min(7, w / 10)));
      doc.text(widthText, x + w / 2, y + 5, { align: "center" });
      doc.text(heightText, x + 5, y + h / 2, { align: "center", angle: 90 });
    }

    const centerText = `${widthText} × ${heightText}`;
    if (w > 42 && h > 24) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(Math.min(12, Math.max(6, Math.min(w / (centerText.length * 0.55), h / 3))));
      doc.setTextColor(20);
      doc.text(centerText, x + w / 2, y + h / 2 + 2, { align: "center" });
    }
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
}

function cutListPages(doc: jsPDF, project: Project, result: OptimizationResult): void {
  let row = 0;
  const rowH = 6;
  let y = 27;

  const newPage = () => {
    doc.addPage("a4", "portrait");
    frame(doc, project);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("LISTA DE CORTE", 12, 22);
    doc.setFontSize(7.2);
    doc.setFillColor(225, 225, 225);
    doc.rect(10, 25, 190, 6, "F");
    const headers = ["#", "Ch", "ID", "Nome", "L", "A", "Rot.", "Material", "Fita"];
    const x = [12, 22, 31, 42, 128, 142, 156, 168, 194];
    headers.forEach((h, i) => doc.text(h, x[i]!, 29));
    y = 37;
  };

  newPage();
  for (const layout of result.layouts) {
    for (const p of layout.placements) {
      if (y > 270) newPage();
      if (row % 2 === 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(10, y - 4.5, 190, rowH, "F");
      }
      const part = project.parts.find((item) => item.id === p.partId);
      const values = [
        String(row + 1),
        String(layout.index),
        p.partId,
        p.name.slice(0, 34),
        String(Math.round(p.w)),
        String(Math.round(p.h)),
        p.rotated ? "90°" : "0°",
        (part?.material ?? layout.material).slice(0, 20),
        (part?.edgeBanding || "—").slice(0, 12),
      ];
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.2);
      values.forEach((value, i) => doc.text(value, x[i]!, y));
      doc.setDrawColor(220);
      doc.line(10, y + 1.5, 200, y + 1.5);
      y += rowH;
      row += 1;
    }
  }

  if (result.unplaced.length) {
    if (y > 245) newPage();
    y += 7;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("PEÇAS NÃO ACOMODADAS", 12, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    for (const item of result.unplaced) {
      doc.text(`${item.partId} · ${item.name} · ${item.length}×${item.width} mm ×${item.quantity} · ${item.reason}`, 14, y);
      y += 5;
      if (y > 275) newPage();
    }
  }
}

function operationPages(doc: jsPDF, project: Project, result: OptimizationResult): void {
  for (const layout of result.layouts) {
    doc.addPage("a4", "portrait");
    frame(doc, project);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(`OPERAÇÕES — CHAPA ${layout.index}`, 12, 22);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`${layout.material} · ${layout.length}×${layout.width}×${layout.thickness} mm`, 12, 29);
    let y = 38;
    for (const c of layout.cuts) {
      if (y > 275) {
        doc.addPage("a4", "portrait");
        frame(doc, project);
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

export function exportProjectDetailsPdf(project: Project, result: OptimizationResult): void {
  if (!result.layouts.length) return;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  cutListPages(doc, project, result);
  operationPages(doc, project, result);
  doc.save(`${slug(project)}-detalhes.pdf`);
}

export function exportProjectPdf(project: Project, result: OptimizationResult): void {
  if (!result.layouts.length) return;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  result.layouts.forEach((layout) => drawReportSheet(doc, layout, project, result.stats.totalCost));
  cutListPages(doc, project, result);
  operationPages(doc, project, result);
  doc.save(`${slug(project)}.pdf`);
}
