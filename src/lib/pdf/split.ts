/* prettier-ignore-file */

import { jsPDF } from "jspdf";
import type { OptimizationResult, Project } from "@/types";
import { drawProductionSheetPage } from "./production-sheet";

function slug(project: Project): string {
  return (
    project.name
      .normalize("NFD")
      .replace(/[^\u0300-\u036f\w]+/g, "-")
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
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  cutListPages(doc, project, result);
  operationPages(doc, project, result);
  doc.save(`${slug(project)}-detalhes.pdf`);
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
  doc.save(`${slug(project)}.pdf`);
}
