import { jsPDF } from "jspdf";
import type { OptimizationResult, Project, SheetLayout } from "@/types";
import { rgbForPart } from "@/lib/plan-colors";

function fileName(project: Project): string {
  const slug = project.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `${slug || "plano-corte"}.pdf`;
}

/** Desenha o cabeçalho/rodapé comum a todas as páginas. */
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
  doc.text(total > 0 ? `página ${page}/${total}` : `página ${page}`, pageW - 12, pageH - 8, {
    align: "right",
  });
  doc.setTextColor(40);
}

function sheetPage(doc: jsPDF, project: Project, layout: SheetLayout, cost: number): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // ---------- painel lateral de informação ----------
  const sx = 12;
  let sy = 22;
  const cutLength = layout.cuts.reduce((s, c) => s + Math.abs(c.to - c.from), 0);
  const offcutAreaRaw = layout.offcuts.reduce((s, o) => s + o.w * o.h, 0);
  const wasteArea = Math.max(0, layout.sheetArea - layout.usedArea);
  const offcutArea = Math.min(offcutAreaRaw, wasteArea);
  const rows: [string, string][] = [
    ["Painel de stock", `${layout.length}×${layout.width}×${layout.thickness}`],
    ["Área utilizada", `${(layout.usedArea / 1e6).toFixed(2)} m²  ${layout.usagePct.toFixed(1)}%`],
    [
      "Desperdício total",
      `${(wasteArea / 1e6).toFixed(2)} m²  ${((wasteArea / layout.sheetArea) * 100).toFixed(1)}%`,
    ],
    [
      "Sobras aproveitáveis",
      `${(offcutArea / 1e6).toFixed(2)} m²  ${((offcutArea / layout.sheetArea) * 100).toFixed(1)}%`,
    ],

    ["Cortes", `${layout.cuts.length}`],
    ["Comprimento de corte", `${(cutLength / 1000).toFixed(2)} m`],
    ["Lâmina / margem", `${project.parameters.kerf} / ${project.parameters.margin} mm`],
    ["Painéis", `${layout.placements.length}`],
    ["N.º de sobras", `${layout.offcuts.length}`],
    ["Custo material", `${cost.toFixed(2)} EUR`],
    [
      "Método de corte",
      layout.cutMethod === "altendorf-f40"
        ? "Altendorf F40 — faixas + esquadro"
        : layout.cutMethod === "guillotine"
          ? "Guilhotina"
          : "Heurístico",
    ],
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

  // tabela de painéis agrupados
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

  // ---------- desenho da chapa ----------
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

  // sobras
  for (const o of layout.offcuts) {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(200);
    doc.setLineWidth(0.15);
    doc.rect(ox + o.x * scale, oy + o.y * scale, o.w * scale, o.h * scale, "FD");
  }

  // peças com cor e medidas dentro
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

    // medida completa ao centro quando há espaço (letra ajustada à peça)
    const fitCenter = Math.min(13, (w - 3) / (centerTxt.length * 0.55), (h - 3) / 1.6);
    if (fitCenter >= 5.5) {
      doc.setFontSize(fitCenter);
      doc.text(centerTxt, x + w / 2, y + h / 2 + fitCenter * 0.35, { align: "center" });
    } else {
      // peças estreitas: só um valor, na orientação que couber
      const fitH = Math.min(9, (h - 2) / (centerTxt.length * 0.55), (w - 2) / 1.6);
      if (fitH >= 4.2) {
        doc.setFontSize(fitH);
        doc.text(centerTxt, x + w / 2 + fitH * 0.35, y + h / 2, {
          align: "center",
          angle: 90,
        });
      }
    }

    // cotas de aresta apenas em peças grandes, bem afastadas da linha
    doc.setFont("helvetica", "normal");
    doc.setTextColor(70);
    if (w > 40 && h > 26 && fitCenter >= 5.5) {
      doc.setFontSize(6.8);
      doc.text(wTxt, x + w / 2, y + 5, { align: "center" });
      doc.text(hTxt, x + 5, y + h / 2, { align: "center", angle: 90 });
    }
    doc.setTextColor(40);
    doc.setFont("helvetica", "normal");
  }

  // ---------- cotas exteriores da chapa (a vermelho) ----------
  doc.setDrawColor(214, 78, 78);
  doc.setTextColor(214, 78, 78);
  doc.setLineWidth(0.3);
  doc.setFontSize(9);

  const cx = ox + drawW + 6; // cota vertical à direita
  doc.line(cx, oy, cx, oy + drawH);
  doc.line(cx - 1.2, oy, cx + 1.2, oy);
  doc.line(cx - 1.2, oy + drawH, cx + 1.2, oy + drawH);
  doc.text(String(layout.width), cx + 3.4, oy + drawH / 2, { align: "center", angle: 90 });

  const cy = oy + drawH + 6; // cota horizontal em baixo
  doc.line(ox, cy, ox + drawW, cy);
  doc.line(ox, cy - 1.2, ox, cy + 1.2);
  doc.line(ox + drawW, cy - 1.2, ox + drawW, cy + 1.2);
  doc.text(String(layout.length), ox + drawW / 2, cy + 3.4, { align: "center" });

  doc.setTextColor(40);
  doc.setDrawColor(60);

  doc.setFontSize(9);
  doc.text(
    `Chapa ${layout.index} — ${layout.material} ${layout.length}×${layout.width}×${layout.thickness} mm · ${project.parameters.kerf} mm de lâmina`,
    areaX,
    18,
  );
}

function cutListPage(
  doc: jsPDF,
  project: Project,
  result: OptimizationResult,
  startIndex: number,
): number {
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
  doc.text(
    `Máquina: Altendorf F40 · Kerf: ${project.parameters.kerf} mm · Margem: ${project.parameters.margin} mm · Espaçamento: ${project.parameters.spacing} mm`,
    12,
    36,
  );

  const cols = [12, 23, 34, 48, 65, 112, 140, 158, 172, 205, 238];
  const headers = [
    "OK",
    "#",
    "Ch",
    "ID",
    "Peça",
    "Compr.",
    "Larg.",
    "Rot.",
    "Material",
    "Fita",
    "Observações",
  ];
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
    const values = [
      "[ ]",
      String(i + 1),
      String(layout.index),
      p.partId,
      p.name.slice(0, 28),
      String(Math.round(p.w)),
      String(Math.round(p.h)),
      p.rotated ? "90°" : "0°",
      (part?.material ?? layout.material).slice(0, 25),
      (part?.edgeBanding || "—").slice(0, 16),
      (part?.notes || "").slice(0, 28),
    ];
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
      doc.text(
        `${u.partId} · ${u.name} · ${u.length}×${u.width} mm ×${u.quantity} · ${u.reason}`,
        14,
        y,
      );
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
    doc.setFontSize(15);
    doc.text(`OPERAÇÕES — CHAPA ${layout.index}`, 12, 25);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
      `${layout.material} · ${layout.length}×${layout.width}×${layout.thickness} mm`,
      12,
      31,
    );
    doc.text(
      "Executar primeiro os RASGOS e depois os cortes no ESQUADRO. A lista é uma orientação de produção, não substitui as regras de segurança da máquina.",
      12,
      36,
    );
    let y = 45;
    const heads = ["#", "Fase", "Tipo", "Posição", "De", "Até", "Operação"];
    const xs = [12, 22, 45, 70, 94, 119, 145];
    const drawOperationHeader = () => {
      doc.setFillColor(35, 35, 35);
      doc.setTextColor(255, 255, 255);
      doc.rect(10, y - 5, pageW - 20, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      heads.forEach((h, i) => doc.text(h, xs[i]!, y));
      y += 7;
      doc.setTextColor(30, 30, 30);
      doc.setFont("helvetica", "normal");
    };
    drawOperationHeader();
    for (const c of layout.cuts) {
      if (y > doc.internal.pageSize.getHeight() - 18) {
        doc.addPage("a4", "portrait");
        frame(doc, project, doc.getNumberOfPages(), 0);
        y = 24;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(`OPERAÇÕES — CHAPA ${layout.index} (continuação)`, 12, 18);
        drawOperationHeader();
      }
      if (c.order % 2 === 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(10, y - 5, pageW - 20, 7, "F");
      }
      const phase = c.phase === "rip" ? "RASGO" : c.phase === "crosscut" ? "ESQUADRO" : "ACAB.";
      const vals = [
        String(c.order),
        phase,
        c.type === "horizontal" ? "Horizontal" : "Vertical",
        `${c.position} mm`,
        `${c.from} mm`,
        `${c.to} mm`,
        c.note.slice(0, 48),
      ];
      vals.forEach((v, i) => doc.text(v, xs[i]!, y));
      y += 7;
    }
    doc.setFontSize(7);
    doc.setTextColor(90);
    doc.text(
      `Total: ${layout.cuts.length} operações · comprimento estimado ${(layout.cuts.reduce((s, c) => s + Math.abs(c.to - c.from), 0) / 1000).toFixed(2)} m`,
      12,
      doc.internal.pageSize.getHeight() - 18,
    );
    doc.setTextColor(30);
  }
}

export function exportProjectPdf(project: Project, result: OptimizationResult): void {
  // A primeira página é deliberadamente a lista que o operador leva para a oficina.
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  let page = 1;

  cutListPage(doc, project, result, 0);
  operationPages(doc, project, result);

  // Resumo geral depois da folha operacional.
  doc.addPage("a4", "portrait");
  page = doc.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  frame(doc, project, page, 0);
  doc.setFontSize(18);
  doc.text("Resumo do plano de corte", 12, 26);
  doc.setFontSize(10);
  let y = 36;
  const lines = [
    `Projeto: ${project.name}`,
    `Cliente: ${project.client || "—"}`,
    `Data: ${project.date}`,
    `Máquina: Altendorf F40 · Modo: ${project.parameters.sawMode === "altendorf-f40" ? "Corte" : "Layout livre"}`,
    `Parâmetros: lâmina ${project.parameters.kerf} mm · margem ${project.parameters.margin} mm · espaçamento ${project.parameters.spacing} mm · rotação ${project.parameters.allowRotation ? "sim" : "não"} · sobras em stock ${project.parameters.useOffcutStock ? "sim" : "não"}`,
    `Chapas usadas: ${result.stats.sheetsUsed}`,
    `Peças colocadas: ${result.stats.partsPlaced} de ${result.stats.partsTotal}`,
    `Aproveitamento: ${result.stats.usagePct.toFixed(1)}% · Desperdício: ${result.stats.wastePct.toFixed(1)}%`,
    `Operações de corte: ${result.stats.totalCuts}`,
    `Comprimento estimado de corte: ${(result.stats.totalCutLength / 1000).toFixed(2)} m`,
    `Custo estimado do material: ${result.stats.totalCost.toFixed(2)} EUR`,
    `Custo líquido estimado: ${result.stats.estimatedNetCost.toFixed(2)} EUR`,
  ];
  for (const line of lines) {
    doc.text(line, 12, y);
    y += 6.5;
  }
  if (project.notes) {
    y += 3;
    doc.text(doc.splitTextToSize(`Observações: ${project.notes}`, pageW - 24), 12, y);
  }

  const costPerSheet = result.stats.sheetsUsed
    ? result.stats.totalCost / result.stats.sheetsUsed
    : 0;
  for (const layout of result.layouts) {
    doc.addPage("a4", "landscape");
    page = doc.getNumberOfPages();
    frame(doc, project, page, 0);
    sheetPage(doc, project, layout, costPerSheet);
  }

  doc.addPage("a4", "portrait");
  page = doc.getNumberOfPages();
  frame(doc, project, page, 0);
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(14);
  doc.text("Sobras e peças não acomodadas", 12, 24);
  doc.setFontSize(9.5);
  let fy = 34;
  for (const layout of result.layouts) {
    doc.text(`Chapa ${layout.index}: ${layout.offcuts.length} sobras aproveitáveis`, 12, fy);
    fy += 6;
    for (const o of layout.offcuts.slice(0, 12)) {
      if (fy > pageH - 18) {
        doc.addPage("a4", "portrait");
        page = doc.getNumberOfPages();
        frame(doc, project, page, 0);
        fy = 20;
      }
      doc.text(`• ${Math.round(o.w)} × ${Math.round(o.h)} mm`, 15, fy);
      fy += 5;
    }
  }
  if (result.unplaced.length) {
    fy += 4;
    doc.setFont("helvetica", "bold");
    doc.text("Peças não acomodadas:", 12, fy);
    fy += 6;
    doc.setFont("helvetica", "normal");
    for (const u of result.unplaced) {
      if (fy > pageH - 18) {
        doc.addPage("a4", "portrait");
        page = doc.getNumberOfPages();
        frame(doc, project, page, 0);
        fy = 20;
      }
      doc.text(
        `• ${u.partId} ${u.name} ${u.length}×${u.width} mm ×${u.quantity} — ${u.reason}`,
        15,
        fy,
      );
      fy += 5;
    }
  }

  // Etiquetas A4, quatro por fila. Uma etiqueta por peça física.
  const labelRows = result.layouts.flatMap((layout) =>
    layout.placements.map((p) => ({
      layout,
      p,
      part: project.parts.find((x) => x.id === p.partId),
    })),
  );
  if (labelRows.length) {
    doc.addPage("a4", "portrait");
    frame(doc, project, doc.getNumberOfPages(), 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("ETIQUETAS DE PEÇAS", 12, 24);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Recortar pelas linhas tracejadas e colar em cada peça.", 12, 30);
    const lw = 91,
      lh = 47,
      startY = 36;
    labelRows.forEach((row, idx) => {
      const col = idx % 2,
        line = Math.floor(idx / 2) % 5,
        pageBlock = Math.floor(idx / 10);
      if (idx > 0 && idx % 10 === 0) {
        doc.addPage("a4", "portrait");
        frame(doc, project, doc.getNumberOfPages(), 0);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(15);
        doc.text("ETIQUETAS DE PEÇAS (continuação)", 12, 24);
      }
      const x = 10 + col * 99,
        y = 36 + line * 51;
      doc.setLineDashPattern([2, 2], 0);
      doc.setDrawColor(120);
      doc.rect(x, y, lw, lh);
      doc.setLineDashPattern([], 0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(row.p.partId, x + 5, y + 9);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text((row.p.name || "Peça").slice(0, 30), x + 5, y + 16);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(`${Math.round(row.p.w)} × ${Math.round(row.p.h)} mm`, x + 5, y + 27);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(
        `${row.part?.material ?? row.layout.material} · Chapa ${row.layout.index} · ${row.p.rotated ? "Rot. 90°" : "Rot. 0°"}`,
        x + 5,
        y + 35,
      );
      doc.text(`Fita: ${row.part?.edgeBanding || "—"} · Corte ${idx + 1}`, x + 5, y + 42);
    });
  }

  const totalPages = doc.getNumberOfPages();
  for (let n = 1; n <= totalPages; n++) {
    doc.setPage(n);
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    doc.setFillColor(255, 255, 255);
    doc.rect(pw - 50, ph - 12.5, 38, 6, "F");
    doc.setTextColor(110);
    doc.setFontSize(7);
    doc.text(`página ${n}/${totalPages}`, pw - 12, ph - 8, { align: "right" });
  }
  doc.save(fileName(project));
}
