import { jsPDF } from "jspdf";
import type { OptimizationResult, Project, SheetLayout } from "@/types";
import { rgbForPart } from "@/lib/plan-colors";

function slug(project: Project): string {
  return project.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "plano-corte";
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
    horizontal
      ? { x, y, w, h }
      : { x: layout.width - (y + h), y: x, w: h, h: w };

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

export function exportProjectDetailsPdf(project: Project, result: OptimizationResult): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const footer = (page: number) => {
    doc.setDrawColor(190, 190, 190);
    doc.setLineWidth(0.2);
    doc.line(12, pageH - 12, pageW - 12, pageH - 12);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(`CutPlan CNC · ${project.name}`, 12, pageH - 7);
    doc.text(`Página ${page}`, pageW - 12, pageH - 7, { align: "right" });
  };
  const title = (text: string) => {
    doc.setTextColor(25, 25, 25);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(text, 12, 18);
  };
  const section = (text: string, y: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(25, 25, 25);
    doc.text(text, 12, y);
    return y + 7;
  };

  title("Detalhes do projeto");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Projeto: ${project.name}`, 12, 27);
  doc.text(`Cliente: ${project.client || "Sem cliente"}`, 12, 33);
  doc.text(`Data: ${project.date}`, 12, 39);
  doc.text(`Observações: ${project.notes || "—"}`, 12, 45);

  let y = section("Resultado da otimização", 56);
  const stats = [
    ["Chapas utilizadas", `${result.stats.sheetsUsed}`],
    ["Peças colocadas", `${result.stats.partsPlaced}/${result.stats.partsTotal}`],
    ["Aproveitamento", `${result.stats.usagePct.toFixed(1)}%`],
    ["Desperdício", `${result.stats.wastePct.toFixed(1)}%`],
    ["Cortes estimados", `${result.stats.totalCuts}`],
    ["Comprimento de corte", `${(result.stats.totalCutLength / 1000).toFixed(2)} m`],
    ["Custo material", `${result.stats.totalCost.toFixed(2)} €`],
    ["Custo de corte", `${result.stats.cuttingCost.toFixed(2)} €`],
    ["Custo líquido estimado", `${result.stats.estimatedNetCost.toFixed(2)} €`],
  ];
  for (const [label, value] of stats) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(label, 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, 72, y);
    y += 5;
  }

  y += 5;
  y = section("Parâmetros de corte", y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Lâmina / kerf: ${project.parameters.kerf} mm`, 14, y);
  doc.text(`Margem: ${project.parameters.margin} mm`, 90, y);
  y += 5;
  doc.text(`Espaçamento: ${project.parameters.spacing} mm`, 14, y);
  doc.text(`Rotação: ${project.parameters.allowRotation ? "Sim" : "Não"}`, 90, y);
  y += 5;
  doc.text(`Modo: ${project.parameters.mode}`, 14, y);
  doc.text(`Serra: ${project.parameters.sawMode}`, 90, y);
  footer(1);

  doc.addPage("a4", "portrait");
  title("Lista de peças");
  y = 28;
  doc.setFillColor(35, 35, 35);
  doc.setTextColor(255, 255, 255);
  doc.rect(10, y - 5, pageW - 20, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  ["ID", "Peça", "Medidas", "Qtd", "Material", "Fita"].forEach((v, i) => doc.text(v, [12, 32, 105, 130, 145, 190][i]!, y));
  y += 7;
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "normal");
  for (const p of project.parts) {
    if (y > pageH - 20) {
      footer(doc.getNumberOfPages());
      doc.addPage("a4", "portrait");
      title("Lista de peças — continuação");
      y = 28;
    }
    doc.setFontSize(8);
    const vals = [p.id, p.name.slice(0, 28), `${p.length} × ${p.width}`, String(p.quantity), p.material.slice(0, 20), p.edgeBanding || "—"];
    vals.forEach((v, i) => doc.text(v, [12, 32, 105, 130, 145, 190][i]!, y));
    y += 6;
  }
  footer(doc.getNumberOfPages());

  for (const layout of result.layouts) {
    doc.addPage("a4", "portrait");
    title(`Chapa ${layout.index} — detalhes`);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Material: ${layout.material}`, 12, 28);
    doc.text(`Dimensão: ${layout.length} × ${layout.width} × ${layout.thickness} mm`, 12, 34);
    doc.text(`Aproveitamento: ${layout.usagePct.toFixed(1)}% · Peças: ${layout.placements.length} · Cortes: ${layout.cuts.length}`, 12, 40);
    y = section("Posicionamentos", 52);
    doc.setFontSize(8);
    for (const p of layout.placements) {
      if (y > pageH - 30) {
        footer(doc.getNumberOfPages());
        doc.addPage("a4", "portrait");
        title(`Chapa ${layout.index} — posicionamentos`);
        y = 28;
      }
      doc.text(`${p.partId} · ${p.name} · X ${Math.round(p.x)} · Y ${Math.round(p.y)} · ${Math.round(p.w)} × ${Math.round(p.h)} mm · ${p.rotated ? "90°" : "0°"}`, 14, y);
      y += 5;
    }
    y += 4;
    y = section("Operações de corte", y);
    doc.setFontSize(8);
    for (const c of layout.cuts) {
      if (y > pageH - 25) {
        footer(doc.getNumberOfPages());
        doc.addPage("a4", "portrait");
        title(`Chapa ${layout.index} — operações`);
        y = 28;
      }
      doc.text(`${c.order}. ${c.phase || ""} · ${c.type} · posição ${c.position} mm · ${c.note}`, 14, y);
      y += 5;
    }
    y += 4;
    y = section("Sobras", y);
    doc.setFontSize(8);
    if (!layout.offcuts.length) doc.text("Nenhuma sobra registada.", 14, y);
    else for (const o of layout.offcuts) { doc.text(`${Math.round(o.w)} × ${Math.round(o.h)} mm · X ${Math.round(o.x)} · Y ${Math.round(o.y)}`, 14, y); y += 5; }
    footer(doc.getNumberOfPages());
  }

  if (result.unplaced.length) {
    doc.addPage("a4", "portrait");
    title("Peças não acomodadas");
    y = 30;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (const u of result.unplaced) {
      doc.text(`${u.partId} · ${u.name} ×${u.quantity} · ${u.length} × ${u.width} mm · ${u.reason}`, 14, y);
      y += 6;
    }
    footer(doc.getNumberOfPages());
  }

  doc.save(`${slug(project)}-detalhes-projeto.pdf`);
}
