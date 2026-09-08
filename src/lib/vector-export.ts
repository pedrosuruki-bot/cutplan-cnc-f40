import type { OptimizationResult, Project, Placement } from "@/types";
import { colorForPart } from "@/lib/plan-colors";

function escapeXml(v: string): string {
  return v.replace(
    /[&<>\x22]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safe(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "cutplan"
  );
}

export function exportLayoutSvg(project: Project, result: OptimizationResult): void {
  const gapY = 180;
  const totalH =
    result.layouts.reduce((sum, l) => sum + l.width, 0) +
    Math.max(0, result.layouts.length - 1) * gapY;
  let yOffset = 0;
  const groups = result.layouts
    .map((l, i) => {
      const currentY = yOffset;
      yOffset += l.width + gapY;
      const parts = l.placements
        .map(
          (p) =>
            `<g><rect x="${p.x}" y="${currentY + p.y}" width="${p.w}" height="${p.h}" fill="${colorForPart(p.partId)}" fill-opacity="0.35" stroke="#222" stroke-width="2"/><text x="${p.x + p.w / 2}" y="${currentY + p.y + p.h / 2}" text-anchor="middle" dominant-baseline="middle" font-size="28">${escapeXml(p.partId)}</text></g>`,
        )
        .join("");
      return `<g id="sheet-${i + 1}"><rect x="0" y="${currentY}" width="${l.length}" height="${l.width}" fill="#fff" stroke="#000" stroke-width="3"/>${parts}<text x="10" y="${currentY + 35}" font-size="30" font-family="sans-serif">Chapa ${l.index} — ${escapeXml(l.material)}</text></g>`;
    })
    .join("");
  const maxW = Math.max(1, ...result.layouts.map((l) => l.length));
  const content = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${maxW} ${Math.max(1, totalH)}" width="${maxW}" height="${Math.max(1, totalH)}">${groups}</svg>`;
  download(
    new Blob([content], { type: "image/svg+xml;charset=utf-8" }),
    `${safe(project.name)}-planos.svg`,
  );
}

function polyline(points: Array<[number, number]>, layer: string): string {
  let out = `0\nPOLYLINE\n8\n${layer}\n66\n1\n70\n1\n`;
  for (const [x, y] of points) out += `0\nVERTEX\n8\n${layer}\n10\n${x}\n20\n${y}\n30\n0\n`;
  return out + "0\nSEQEND\n";
}

export function exportLayoutDxf(project: Project, result: OptimizationResult): void {
  let out = "0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n";
  for (const l of result.layouts) {
    out += polyline(
      [
        [0, 0],
        [l.length, 0],
        [l.length, l.width],
        [0, l.width],
        [0, 0],
      ],
      `SHEET_${l.index}`,
    );
    for (const p of l.placements) {
      out += polyline(
        [
          [p.x, p.y],
          [p.x + p.w, p.y],
          [p.x + p.w, p.y + p.h],
          [p.x, p.y + p.h],
          [p.x, p.y],
        ],
        `PART_${p.partId}_${p.instance}`,
      );
    }
  }
  out += "0\nENDSEC\n0\nEOF\n";
  download(new Blob([out], { type: "application/dxf" }), `${safe(project.name)}-planos.dxf`);
}

export function exportLayoutSvgSingle(
  project: Project,
  layout: OptimizationResult["layouts"][number],
): void {
  const result = { layouts: [layout] } as OptimizationResult;
  exportLayoutSvg(project, result);
}

export type { Placement };
