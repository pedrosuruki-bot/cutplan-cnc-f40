import type { GrainDirection, Part } from "@/types";

function splitRow(line: string, delimiter: "," | ";" | "\t"): string[] {
  const out: string[] = []; let cell = ""; let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (quoted && line[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (ch === delimiter && !quoted) { out.push(cell.trim()); cell = ""; } else cell += ch;
  }
  out.push(cell.trim()); return out;
}

function parseNumber(value: string | undefined, fallback = 0): number {
  const raw = (value ?? "").trim().replace(/\s/g, "");
  if (!raw) return fallback;
  // Aceita formatos PT/EU (1.234,5), internacional (1234.5) e simples (1234,5).
  const normalized = raw.includes(",") && raw.includes(".")
    ? (raw.lastIndexOf(",") > raw.lastIndexOf(".") ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, ""))
    : raw.replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : fallback;
}

function cleanHeader(value: string): string { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/[._-]/g, ""); }
const aliases: Record<string, string[]> = {
  id: ["id","codigo","cod","ref","referencia","referência"], name: ["nome","name","peca","peça","descricao","descrição","descricaopeca"],
  length: ["comprimento","length","comp","comprimento mm","c"], width: ["largura","width","larg","l","largura mm"],
  quantity: ["quantidade","qtd","qty","quantity","unidades","unid"], material: ["material","materia"],
  rotate: ["rodar","rodar90","rotacao","rotação","canrotate","rotacionar"], grain: ["sentido","sentidodamadeira","grain","veio"],
  edge: ["fita","fitadebordo","edgebanding","bordo"], notes: ["notas","notes","observacoes","observações","obs"], unit: ["unidade","unit"]
};

export function parsePartsCsv(text: string, defaultMaterial: string, makeId: (used: Set<string>) => string): Part[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  if (!lines.length) return [];
  const delimiter: "," | ";" | "\t" = lines[0]!.includes(";") ? ";" : lines[0]!.includes("\t") ? "\t" : ",";
  const raw = lines.map(line => splitRow(line, delimiter));
  const first = raw[0]!;
  const hasHeader = first.some(x => /^(id|codigo|cod|ref|nome|name|peca|peça|comprimento|length|largura|width|quantidade|qtd|material)$/i.test(cleanHeader(x)));
  const headers = hasHeader ? first.map(cleanHeader) : ["id","nome","comprimento","largura","quantidade","material","rodar","sentido","fita","notas"];
  const find = (key: keyof typeof aliases, row: string[]) => { const idx = headers.findIndex(h => aliases[key].some(a => cleanHeader(a) === h)); return idx >= 0 ? row[idx] ?? "" : ""; };
  const used = new Set<string>(); const data = hasHeader ? raw.slice(1) : raw;
  return data.map((row, i) => {
    let id = find("id", row).trim(); if (!id || used.has(id)) id = makeId(used); used.add(id);
    const unit = cleanHeader(find("unit", row));
    const multiplier = unit === "cm" || unit === "centimetros" ? 10 : unit === "m" || unit === "metro" || unit === "metros" ? 1000 : unit === "in" || unit === "inch" || unit === "polegadas" ? 25.4 : 1;
    const grainRaw = cleanHeader(find("grain", row)); const rotateRaw = cleanHeader(find("rotate", row));
    const l = parseNumber(find("length", row)) * multiplier; const w = parseNumber(find("width", row)) * multiplier;
    const q = Math.round(parseNumber(find("quantity", row), 1));
    return {
      id, name: find("name", row) || `Peça ${i + 1}`, length: Math.round(l * 10) / 10, width: Math.round(w * 10) / 10,
      quantity: Math.max(1, Math.min(10000, q || 1)), material: find("material", row) || defaultMaterial,
      canRotate: !["nao","não","no","0","false","n"].includes(rotateRaw),
      grain: (grainRaw.includes("comprimento") || grainRaw === "length" ? "length" : grainRaw.includes("largura") || grainRaw === "width" ? "width" : "none") as GrainDirection,
      edgeBanding: find("edge", row), notes: find("notes", row)
    };
  }).filter(p => p.length > 0 && p.width > 0 && p.quantity > 0);
}

export function partsCsvTemplate(): string {
  return "ID;Nome;Comprimento;Largura;Quantidade;Material;Rodar;Sentido;Fita;Notas\nP001;Lateral;800;400;2;MDF Branco 18;Sim;Livre;2 lados;\n";
}
