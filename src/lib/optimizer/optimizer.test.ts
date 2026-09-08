import { describe, expect, it } from "vitest";
import { optimize } from "./index";
import { defaultParameters } from "@/lib/demo";
import type { CutParameters, Part, Sheet } from "@/types";

function sheet(over: Partial<Sheet> = {}): Sheet {
  return { id: "S1", name: "Chapa", material: "MDF", length: 2800, width: 2070, thickness: 18, quantity: 1, price: 50, ...over };
}
function part(over: Partial<Part> = {}): Part {
  return { id: "P1", name: "Peça", length: 800, width: 400, quantity: 1, material: "MDF", canRotate: true, grain: "none", edgeBanding: "", notes: "", ...over };
}
const params = (over: Partial<CutParameters> = {}): CutParameters => ({ ...defaultParameters, ...over });
function assertNoOverlap(placements: { x: number; y: number; w: number; h: number }[], gap: number) {
  for (let i = 0; i < placements.length; i++) for (let j = i + 1; j < placements.length; j++) {
    const a = placements[i]!; const b = placements[j]!;
    const overlapX = a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6;
    const overlapY = a.y < b.y + b.h - 1e-6 && b.y < a.y + a.h - 1e-6;
    expect(overlapX && overlapY).toBe(false);
    if (overlapY) expect(Math.abs(a.x - b.x) - Math.min(a.w, b.w)).toBeGreaterThanOrEqual(gap - 1e-6);
    if (overlapX) expect(Math.abs(a.y - b.y) - Math.min(a.h, b.h)).toBeGreaterThanOrEqual(gap - 1e-6);
  }
}

describe("optimize", () => {
  it("coloca uma única peça", () => { const r = optimize([sheet()], [part()], params()); expect(r.stats.partsPlaced).toBe(1); expect(r.layouts).toHaveLength(1); });
  it("coloca peças repetidas sem sobreposição e com kerf", () => { const r = optimize([sheet()], [part({ quantity: 12 })], params()); expect(r.stats.partsPlaced).toBe(12); assertNoOverlap(r.layouts[0]!.placements, params().kerf + params().spacing); });
  it("roda a peça quando necessário", () => { const r = optimize([sheet({ length: 500, width: 1000 })], [part({ length: 900, width: 400 })], params()); expect(r.stats.partsPlaced).toBe(1); expect(r.layouts[0]!.placements[0]!.rotated).toBe(true); });
  it("não roda peças com orientação fixa", () => { const r = optimize([sheet({ length: 500, width: 1000 })], [part({ length: 900, width: 400, canRotate: false })], params()); expect(r.stats.partsPlaced).toBe(0); expect(r.unplaced[0]!.reason).toContain("maior"); });
  it("respeita rotação global desligada", () => { const r = optimize([sheet({ length: 500, width: 1000 })], [part({ length: 900, width: 400 })], params({ allowRotation: false })); expect(r.stats.partsPlaced).toBe(0); });
  it("não roda peças com sentido da madeira definido", () => { const r = optimize([sheet({ length: 500, width: 1000 })], [part({ length: 900, width: 400, grain: "length" })], params()); expect(r.stats.partsPlaced).toBe(0); });
  it("reporta peças maiores do que a chapa", () => { const r = optimize([sheet()], [part({ length: 5000, width: 3000, canRotate: false })], params()); expect(r.unplaced).toHaveLength(1); expect(r.stats.partsPlaced).toBe(0); });
  it("usa múltiplas chapas", () => { const r = optimize([sheet({ quantity: 3 })], [part({ length: 1300, width: 1000, quantity: 9 })], params()); expect(r.stats.sheetsUsed).toBeGreaterThan(1); });
  it("assinala chapas insuficientes", () => { const r = optimize([sheet({ quantity: 1 })], [part({ length: 1300, width: 1000, quantity: 20 })], params()); expect(r.unplaced.some((u) => u.reason.includes("insuficientes"))).toBe(true); });
  it("aplica a margem da chapa", () => { const r = optimize([sheet()], [part({ quantity: 4 })], params({ margin: 10 })); for (const p of r.layouts[0]!.placements) { expect(p.x).toBeGreaterThanOrEqual(10 - 1e-6); expect(p.y).toBeGreaterThanOrEqual(10 - 1e-6); expect(p.x + p.w).toBeLessThanOrEqual(2790 + 1e-6); expect(p.y + p.h).toBeLessThanOrEqual(2060 + 1e-6); } });
  it("gera sobras utilizáveis", () => { const r = optimize([sheet()], [part()], params()); expect(r.layouts[0]!.offcuts.length).toBeGreaterThan(0); });
  it("reporta material sem chapa", () => { const r = optimize([sheet({ material: "MDF" })], [part({ material: "Contraplacado" })], params()); expect(r.unplaced[0]!.reason).toContain("Sem chapa"); });
  it("funciona nos três modos", () => { for (const mode of ["max-yield", "fewer-cuts", "simple"] as const) { const r = optimize([sheet()], [part({ quantity: 10 })], params({ mode, sawMode: "free-layout" })); expect(r.stats.partsPlaced).toBe(10); assertNoOverlap(r.layouts[0]!.placements, params().kerf + params().spacing); } });
  it("mistura tamanhos diferentes", () => { const r = optimize([sheet({ quantity: 2 })], [part({ id: "A", quantity: 5 }), part({ id: "B", length: 1200, width: 500, quantity: 4 })], params()); expect(r.stats.partsPlaced).toBe(9); expect(r.stats.usagePct).toBeGreaterThan(0); });
  it("mantém todos os planos guilhotináveis", () => { for (const mode of ["max-yield", "fewer-cuts", "simple"] as const) { const r = optimize([sheet({ quantity: 2 })], [part({ quantity: 8 }), part({ id: "P2", length: 1200, width: 500, quantity: 4 })], params({ mode, sawMode: "free-layout" })); expect(r.layouts.every((l) => l.cutMethod === "guillotine")).toBe(true); expect(r.layouts.every((l) => l.manual === false)).toBe(true); } });
  it("normaliza materiais", () => { const r = optimize([sheet({ material: " MDF   Branco " })], [part({ material: "mdf branco" })], params()); expect(r.stats.partsPlaced).toBe(1); });
  it("não cria custo negativo nem uso impossível com parâmetros extremos", () => { const r = optimize([sheet()], [part({ quantity: 2 })], params({ kerf: 0, spacing: 0, margin: 0 })); expect(r.stats.usagePct).toBeGreaterThan(0); expect(r.stats.usagePct).toBeLessThanOrEqual(100); expect(r.stats.estimatedNetCost).toBeGreaterThanOrEqual(0); });
  it("calcula custo de corte e crédito de sobra", () => { const r = optimize([sheet({ price: 60 })], [part()], params({ sheetCostPerCut: 10, offcutCreditPct: 10 })); expect(r.stats.cuttingCost).toBeGreaterThan(0); expect(r.stats.estimatedNetCost).toBeLessThan(r.stats.totalCost + r.stats.cuttingCost); });
  it("usa stock de sobras antes de abrir chapa nova", () => { const r = optimize([sheet({ quantity: 1, price: 60 })], [part({ quantity: 1 })], params(), [{ id: "O1", name: "Sobra", material: "MDF", length: 1000, width: 500, thickness: 18, quantity: 1, price: 0 }]); expect(r.stats.sheetsUsed).toBe(1); expect(r.stats.totalCost).toBe(0); expect(r.layouts[0]!.sheetId).toBe("offcut:O1:1"); });
  it("mantém os cortes de esquadro dentro da faixa no modo F40", () => { const r = optimize([sheet()], [part({ quantity: 4 }), part({ id: "P2", length: 500, width: 300, quantity: 3 })], params({ sawMode: "altendorf-f40" })); for (const l of r.layouts) for (const c of l.cuts.filter((x) => x.phase === "crosscut")) { expect(c.from).toBeGreaterThanOrEqual(params().margin - 1e-6); expect(c.to).toBeLessThanOrEqual(l.width - params().margin + 1e-6); } });
});
