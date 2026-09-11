/* prettier-ignore-file */

import { jsPDF } from "jspdf";
import type { OptimizationResult, Project } from "@/types";
import { drawProductionSheetPage } from "./production-sheet";

function fileName(project: Project): string {
  const slug = project.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `${slug || "plano-corte"}.pdf`;
}

function frame(doc: jsPDF, project: Project, page: number, total: number): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setTextColor(45);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`CutPlan CNC · ${project.name}`, 10, 9);
  doc.setDrawColor(205);
  doc.setLineWidth(0.25);
  doc.line(10, 11.5, pageW - 10, 11.5);
  doc.line(10, pageH - 10, pageW - 10, pageH - 10);
  doc.setFontSize(6.5);
  doc.setTextColor(105);
  doc.text(`${page}/${total}`, pageW - 10, pageH - 5.5, { align: "right" });
}

function groupedCutRows(project: Project, result: OptimizationResult) {
  const groups = new Map<string, { id: string; name: string; length: number; width: number; quantity: number; material: string; rotation: string }>();
  for (const layout of result.layouts) {
    for (const p of layout.placements) {
      const length = Math.round(Math.max(p.w, p.h));
      const width = Math.round(Math.min(p.w, p.h));
      const key = `${length}x${width}`;
      const part = project.parts.find((item) => item.id === p.partId);
      const current = groups.get(key);
      if (current) {
        current.quantity += 1;
        if (!current.id.includes(p.partId)) current.id += `/${p.partId}`;
      } else {
        groups.set(key, {
          id: p.partId,
          name: p.name,
          length,
          width,
          quantity: 1,
          material: part?.material ?? layout.material,
          rotation: p.rotated ? "90°" : "0°",
        });
      }
    }
  }
  return Array.from(groups.values()).sort((a, b) => b.length * b.width - a.length * a.width);
}

function cutListPages(doc: jsPDF, project: Project, result: OptimizationResult): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let y = 31;
  let page = doc.getNumberOfPages();
  const rows = groupedCutRows(project, result);

  const newPage = (continued = false) => {
    doc.addPage("a4", "portrait");
    page = doc.getNumberOfPages();
    frame(doc, project, page, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(30);
    doc.text(continued ? "LISTA DE CORTE · continuação" : "LISTA DE CORTE", 10, 20);
    y = 29;
    doc.setFillColor(38, 38, 38);
    doc.rect(10, y - 5, pageW - 20, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(255);
    [["ID", 13], ["Medida", 54], ["Qtd", 95], ["Material", 112], ["Rot.", 175]].forEach(([label, x]) => doc.text(String(label), Number(x), y));
    y += 7;
    doc.setTextColor(30);
  };

  newPage();
  for (let i = 0; i < rows.length; i += 1) {
    if (y > pageH - 18) newPage(true);
    const row = rows[i]!;
    if (i % 2 === 0) {
      doc.setFillColor(247, 247, 247);
      doc.rect(10, y - 4.5, pageW - 20, 6.5, "F");
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.2);
    doc.text(row.id.slice(0, 16), 13, y);
    doc.setFont("helvetica", "normal");
    doc.text(`${row.length} × ${row.width} mm`, 54, y);
    doc.setFont("helvetica", "bold");
    doc.text(`×${row.quantity}`, 95, y);
    doc.setFont("helvetica", "normal");
    doc.text(row.material.slice(0, 28), 112, y);
    doc.text(row.rotation, 175, y);
    doc.setDrawColor(225);
    doc.line(10, y + 1.6, pageW - 10, y + 1.6);
    y += 6.5;
  }

  if (result.unplaced.length) {
    if (y > pageH - 55) newPage(true);
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("PEÇAS NÃO ACOMODADAS", 12, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    for (const u of result.unplaced) {
      if (y > pageH - 15) newPage(true);
      doc.text(`${u.partId} · ${u.name} · ${u.length} × ${u.width} mm · ×${u.quantity} · ${u.reason}`, 14, y);
      y += 5;
    }
  }
}

function operationPages(doc: jsPDF, project: Project, result: OptimizationResult): void {
  for (const layout of result.layouts) {
    doc.addPage("a4", "portrait");
    frame(doc, project, doc.getNumberOfPages(), 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30);
    doc.text(`OPERAÇÕES · CHAPA ${layout.index}`, 10, 21);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(`${layout.material} · ${layout.length} × ${layout.width} × ${layout.thickness} mm`, 10, 27);
    doc.text("A orientação de corte é uma referência de produção. Confirma sempre o programa e as regras da máquina antes do corte.", 10, 33);

    let y = 42;
    doc.setFillColor(38, 38, 38);
    doc.rect(10, y - 5, 190, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(255);
    const headers: [string, number][] = [["#", 13], ["Fase", 24], ["Tipo", 52], ["Posição", 80], ["De", 111], ["Até", 135], ["Operação", 158]];
    for (const [h, x] of headers) doc.text(h, x, y);
    y += 7;
    doc.setTextColor(30);
    doc.setFont("helvetica", "normal");
    for (const c of layout.cuts) {
      if (y > 278) {
        doc.addPage("a4", "portrait");
        frame(doc, project, doc.getNumberOfPages(), 0);
        y = 20;
      }
      const phase = c.phase === "rip" ? "RASGO" : c.phase === "crosscut" ? "ESQUADRO" : "ACAB.";
      if (c.order % 2 === 0) {
        doc.setFillColor(247, 247, 247);
        doc.rect(10, y - 5, 190, 7, "F");
      }
      doc.setFontSize(7);
      doc.text(String(c.order), 13, y);
      doc.text(phase, 24, y);
      doc.text(c.type === "horizontal" ? "Horizontal" : "Vertical", 52, y);
      doc.text(`${c.position} mm`, 80, y);
      doc.text(`${c.from} mm`, 111, y);
      doc.text(`${c.to} mm`, 135, y);
      doc.text(c.note.slice(0, 40), 158, y);
      y += 7;
    }
    doc.setFontSize(7);
    doc.setTextColor(90);
    doc.text(`Total: ${layout.cuts.length} operações · ${(layout.cuts.reduce((s, c) => s + Math.abs(c.to - c.from), 0) / 1000).toFixed(2)} m de corte`, 10, 286);
    doc.setTextColor(30);
  }
}

function summaryPage(doc: jsPDF, project: Project, result: OptimizationResult): void {
  doc.addPage("a4", "portrait");
  frame(doc, project, doc.getNumberOfPages(), 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(30);
  doc.text("Resumo do plano de corte", 10, 25);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const lines = [
    `Projeto: ${project.name}`,
    `Cliente: ${project.client || "—"}`,
    `Data: ${project.date}`,
    `Máquina: ${project.parameters.sawMode === "altendorf-f40" ? "Altendorf F40" : "Layout livre"}`,
    `Chapas usadas: ${result.stats.sheetsUsed}`,
    `Peças colocadas: ${result.stats.partsPlaced} de ${result.stats.partsTotal}`,
    `Aproveitamento: ${result.stats.usagePct.toFixed(1)}% · Desperdício: ${result.stats.wastePct.toFixed(1)}%`,
    `Cortes: ${result.stats.totalCuts} · Comprimento: ${(result.stats.totalCutLength / 1000).toFixed(2)} m`,
    `Material: ${result.stats.totalCost.toFixed(2)} EUR · Líquido estimado: ${result.stats.estimatedNetCost.toFixed(2)} EUR`,
    `Parâmetros: lâmina ${project.parameters.kerf} mm · margem ${project.parameters.margin} mm · espaçamento ${project.parameters.spacing} mm · rotação ${project.parameters.allowRotation ? "sim" : "não"}`,
  ];
  let y = 39;
  for (const line of lines) {
    doc.text(line, 10, y);
    y += 7;
  }
  if (project.notes) {
    y += 3;
    doc.text(doc.splitTextToSize(`Observações: ${project.notes}`, 190), 10, y);
  }
}

function offcutPage(doc: jsPDF, project: Project, result: OptimizationResult): void {
  doc.addPage("a4", "portrait");
  frame(doc, project, doc.getNumberOfPages(), 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(30);
  doc.text("Sobras e peças não acomodadas", 10, 24);
  let y = 35;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  for (const layout of result.layouts) {
    doc.setFont("helvetica", "bold");
    doc.text(`Chapa ${layout.index} · ${layout.material}`, 10, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    for (const o of layout.offcuts.slice(0, 14)) {
      if (y > 278) {
        doc.addPage("a4", "portrait");
        frame(doc, project, doc.getNumberOfPages(), 0);
        y = 20;
      }
      doc.text(`• ${Math.round(o.w)} × ${Math.round(o.h)} mm`, 14, y);
      y += 4.5;
    }
    y += 4;
  }
  if (result.unplaced.length) {
    doc.setFont("helvetica", "bold");
    doc.text("Peças não acomodadas", 10, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    for (const u of result.unplaced) {
      if (y > 278) {
        doc.addPage("a4", "portrait");
        frame(doc, project, doc.getNumberOfPages(), 0);
        y = 20;
      }
      doc.text(`${u.partId} · ${u.name} · ×${u.quantity} · ${u.reason}`, 14, y);
      y += 4.5;
    }
  }
}

export function exportProjectPdf(project: Project, result: OptimizationResult): void {
  if (!result.layouts.length) return;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });

  result.layouts.forEach((layout, index) => {
    if (index > 0) doc.addPage("a4", "portrait");
    drawProductionSheetPage(doc, layout, project, true, index + 1, result.layouts.length);
  });

  cutListPages(doc, project, result);
  operationPages(doc, project, result);
  summaryPage(doc, project, result);
  offcutPage(doc, project, result);

  const totalPages = doc.getNumberOfPages();
  for (let n = 1; n <= totalPages; n += 1) {
    doc.setPage(n);
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    doc.setTextColor(105);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text(`${n}/${totalPages}`, pw - 10, ph - 5.5, { align: "right" });
  }

  doc.save(fileName(project));
}
