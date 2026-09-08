import type {
  CutParameters,
  OptimizationResult,
  Part,
  Placement,
  Sheet,
  SheetLayout,
  UnplacedPart,
  CutStep,
  Rect,
  OffcutStock,
} from "@/types";
import { MaxRectsBin, type FitHeuristic, deriveFreeRects } from "./maxrects";
import { GuillotineBin } from "./guillotine";
import { packForAltendorfF40 } from "./altendorf";
import { buildCutSequence } from "@/lib/cut-sequence";

export { MaxRectsBin, GuillotineBin };
export type { FitHeuristic };

interface Instance { part: Part; instance: number }
type Strategy = "maxrects" | "guillotine" | "altendorf-f40";

export function normalizeMaterial(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function heuristicFor(mode: CutParameters["mode"]): FitHeuristic {
  if (mode === "fewer-cuts") return "best-short-side";
  if (mode === "simple") return "bottom-left";
  return "best-area";
}

function canRotatePart(part: Part, params: CutParameters): boolean {
  return params.allowRotation && part.canRotate && part.grain === "none";
}

function sortInstances(list: Instance[], variant = 0): Instance[] {
  const copy = list.slice();
  const keys = [
    (i: Instance) => i.part.length * i.part.width,
    (i: Instance) => Math.max(i.part.length, i.part.width),
    (i: Instance) => i.part.length + i.part.width,
  ];
  const key = keys[variant % keys.length]!;
  copy.sort((a, b) => key(b) - key(a) || Math.min(b.part.length, b.part.width) - Math.min(a.part.length, a.part.width));
  return copy;
}

function validateInputs(sheets: Sheet[], parts: Part[], p: CutParameters, offcutStock: OffcutStock[] = []): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(p.kerf) || p.kerf < 0) errors.push("Kerf inválido.");
  if (!Number.isFinite(p.margin) || p.margin < 0) errors.push("Margem inválida.");
  if (!Number.isFinite(p.spacing) || p.spacing < 0) errors.push("Espaçamento inválido.");
  if (!Number.isFinite(p.sheetCostPerCut) || p.sheetCostPerCut < 0) errors.push("Custo por corte inválido.");
  if (!Number.isFinite(p.offcutCreditPct) || p.offcutCreditPct < 0 || p.offcutCreditPct > 100) errors.push("Crédito de sobra inválido.");
  sheets.forEach((s) => {
    if (!Number.isFinite(s.length) || !Number.isFinite(s.width) || s.length <= 0 || s.width <= 0) errors.push(`Chapa ${s.name || s.id}: dimensões inválidas.`);
    if (!Number.isFinite(s.quantity) || s.quantity < 0 || !Number.isInteger(s.quantity)) errors.push(`Chapa ${s.name || s.id}: quantidade inválida.`);
    if (!Number.isFinite(s.price) || s.price < 0) errors.push(`Chapa ${s.name || s.id}: preço inválido.`);
  });
  offcutStock.forEach((o) => {
    if (!Number.isFinite(o.length) || !Number.isFinite(o.width) || o.length <= 0 || o.width <= 0) errors.push(`Sobra ${o.name || o.id}: dimensões inválidas.`);
    if (!Number.isFinite(o.quantity) || o.quantity < 0 || !Number.isInteger(o.quantity)) errors.push(`Sobra ${o.name || o.id}: quantidade inválida.`);
  });
  parts.forEach((part) => {
    if (!Number.isFinite(part.length) || !Number.isFinite(part.width) || part.length <= 0 || part.width <= 0) errors.push(`Peça ${part.id}: dimensões inválidas.`);
    if (!Number.isFinite(part.quantity) || part.quantity < 0 || !Number.isInteger(part.quantity)) errors.push(`Peça ${part.id}: quantidade inválida.`);
  });
  return errors;
}

interface Packed {
  placements: Placement[];
  remaining: Instance[];
  cuts: CutStep[];
  strategy: Strategy;
}

function pack(
  instances: Instance[],
  sheet: Sheet,
  params: CutParameters,
  strategy: Strategy,
  orderVariant: number,
): Packed {
  if (strategy === "altendorf-f40") {
    const planned = packForAltendorfF40(instances, sheet, params, orderVariant);
    return { placements: planned.placements, remaining: planned.remaining, cuts: planned.cuts, strategy };
  }
  const margin = Math.max(0, params.margin);
  const gap = Math.max(0, params.kerf) + Math.max(0, params.spacing);
  const usableW = sheet.length - margin * 2;
  const usableH = sheet.width - margin * 2;
  const ordered = sortInstances(instances, orderVariant);
  const placements: Placement[] = [];
  const remaining: Instance[] = [];
  let cuts: CutStep[] = [];

  const heuristic = heuristicFor(params.mode);
  const guillotine = strategy === "guillotine" ? new GuillotineBin(usableW, usableH) : null;
  const maxrects = strategy === "maxrects" ? new MaxRectsBin(usableW, usableH) : null;
  for (const inst of ordered) {
    const allowRotate = canRotatePart(inst.part, params);
    const placed = strategy === "guillotine"
      ? guillotine!.insert(inst.part.length, inst.part.width, allowRotate, gap)
      : maxrects!.insert(inst.part.length, inst.part.width, allowRotate, heuristic, gap);
    if (!placed) {
      remaining.push(inst);
      continue;
    }
    placements.push({ partId: inst.part.id, instance: inst.instance, name: inst.part.name, x: placed.x + margin, y: placed.y + margin, w: placed.w, h: placed.h, rotated: placed.rotated });
  }
  cuts = strategy === "guillotine"
    ? guillotine!.cuts.map((c, i) => ({ ...c, order: i + 1, position: c.position + margin, from: c.from + margin, to: c.to + margin }))
    : buildCutSequence(placements, sheet.length, sheet.width);
  return { placements, remaining, cuts, strategy };
}

function choosePacked(instances: Instance[], sheet: Sheet, params: CutParameters): Packed {
  const strategy: Strategy = params.sawMode === "altendorf-f40" ? "altendorf-f40" : "guillotine";
  const candidates: Packed[] = [];
  for (let v = 0; v < 10; v++) candidates.push(pack(instances, sheet, params, strategy, v));
  candidates.sort((a, b) => {
    if (b.placements.length !== a.placements.length) return b.placements.length - a.placements.length;
    const aa = a.placements.reduce((sum, p) => sum + p.w * p.h, 0);
    const ba = b.placements.reduce((sum, p) => sum + p.w * p.h, 0);
    if (params.mode === "fewer-cuts" && a.cuts.length !== b.cuts.length) return a.cuts.length - b.cuts.length;
    if (ba !== aa) return ba - aa;
    return a.cuts.length - b.cuts.length;
  });
  return candidates[0]!;
}

export function optimize(
  sheets: Sheet[],
  parts: Part[],
  params: CutParameters,
  offcutStock: OffcutStock[] = [],
): OptimizationResult {
  const errors = validateInputs(sheets, parts, params, offcutStock);
  if (errors.length) throw new Error(errors[0]);

  const layouts: SheetLayout[] = [];
  const unplacedMap = new Map<string, UnplacedPart>();
  const materials = Array.from(new Set(parts.filter((p) => p.quantity > 0).map((p) => normalizeMaterial(p.material))));
  let sheetCounter = 0;
  let totalCost = 0;
  let totalCutLength = 0;
  let totalCuts = 0;

  const addUnplaced = (part: Part, reason: string) => {
    const key = `${part.id}|${reason}`;
    const existing = unplacedMap.get(key);
    if (existing) existing.quantity += 1;
    else unplacedMap.set(key, { partId: part.id, name: part.name, length: part.length, width: part.width, quantity: 1, reason });
  };

  for (const material of materials) {
    const materialParts = parts.filter((p) => normalizeMaterial(p.material) === material && p.quantity > 0);
    let instances: Instance[] = [];
    for (const part of materialParts) for (let i = 0; i < part.quantity; i++) instances.push({ part, instance: i + 1 });

    const materialSheets = sheets.filter((s) => normalizeMaterial(s.material) === material && s.quantity > 0);
    const materialOffcuts = params.useOffcutStock
      ? offcutStock.filter((o) => normalizeMaterial(o.material) === material && o.quantity > 0)
      : [];

    const offcutSheets = materialOffcuts.flatMap((o) =>
      Array.from({ length: o.quantity }, (_, i) => ({
        sheet: {
          id: `offcut:${o.id}:${i + 1}`,
          name: `${o.name} #${i + 1}`,
          material: o.material,
          length: o.length,
          width: o.width,
          thickness: o.thickness,
          quantity: 1,
          price: 0,
        } satisfies Sheet,
        left: 1,
        isOffcut: true,
      })),
    );
    const purchasedSheets = materialSheets.map((s) => ({ sheet: s, left: s.quantity, isOffcut: false }));
    const stock = [...offcutSheets, ...purchasedSheets];

    if (!stock.length) {
      instances.forEach((i) => addUnplaced(i.part, "Sem chapa deste material"));
      continue;
    }

    while (instances.length) {
      const available = stock.filter((s) => s.left > 0);
      if (!available.length) { instances.forEach((i) => addUnplaced(i.part, "Chapas insuficientes")); break; }

      const candidates = available.map((slot) => ({ slot, packed: choosePacked(instances, slot.sheet, params) }));
      candidates.sort((a, b) => {
        if (b.packed.placements.length !== a.packed.placements.length) return b.packed.placements.length - a.packed.placements.length;
        const au = a.packed.placements.reduce((s, p) => s + p.w * p.h, 0);
        const bu = b.packed.placements.reduce((s, p) => s + p.w * p.h, 0);
        return bu - au;
      });
      const chosen = candidates[0]!;
      if (!chosen.packed.placements.length) {
        for (const inst of instances) {
          const sheet = chosen.slot.sheet;
          const uw = sheet.length - 2 * Math.max(0, params.margin);
          const uh = sheet.width - 2 * Math.max(0, params.margin);
          const direct = inst.part.length <= uw && inst.part.width <= uh;
          const rotated = canRotatePart(inst.part, params) && inst.part.width <= uw && inst.part.length <= uh;
          addUnplaced(inst.part, direct || rotated ? "Não coube nas chapas disponíveis" : "Peça maior do que a chapa");
        }
        break;
      }

      const slot = chosen.slot;
      slot.left -= 1;
      const sheet = slot.sheet;
      sheetCounter += 1;
      if (!slot.isOffcut) totalCost += sheet.price;
      totalCuts += chosen.packed.cuts.length;
      const cutLength = chosen.packed.cuts.reduce((sum, c) => sum + Math.abs(c.to - c.from), 0);
      totalCutLength += cutLength;
      const gap = Math.max(0, params.kerf) + Math.max(0, params.spacing);
      const freeRects: Rect[] = deriveFreeRects(
        sheet.length - 2 * Math.max(0, params.margin),
        sheet.width - 2 * Math.max(0, params.margin),
        chosen.packed.placements.map((p) => ({ ...p, x: p.x - params.margin, y: p.y - params.margin })),
        gap,
      ).map((r) => ({ ...r, x: r.x + params.margin, y: r.y + params.margin }));
      const offcuts = freeRects.filter((r) => r.w >= 80 && r.h >= 80);
      const usedArea = chosen.packed.placements.reduce((sum, p) => sum + p.w * p.h, 0);
      const sheetArea = sheet.length * sheet.width;
      layouts.push({
        sheetId: sheet.id,
        sheetName: sheet.name,
        material: sheet.material,
        index: sheetCounter,
        length: sheet.length,
        width: sheet.width,
        thickness: sheet.thickness,
        placements: chosen.packed.placements,
        offcuts,
        usedArea,
        sheetArea,
        usagePct: sheetArea ? (usedArea / sheetArea) * 100 : 0,
        cuts: chosen.packed.cuts,
        cutMethod: chosen.packed.strategy === "altendorf-f40" ? "altendorf-f40" : chosen.packed.strategy === "guillotine" ? "guillotine" : "heuristic",
        manual: false,
      });
      instances = chosen.packed.remaining;
    }
  }

  const partsTotal = parts.reduce((s, p) => s + p.quantity, 0);
  const partsPlaced = layouts.reduce((s, l) => s + l.placements.length, 0);
  const totalSheetArea = layouts.reduce((s, l) => s + l.sheetArea, 0);
  const totalUsedArea = layouts.reduce((s, l) => s + l.usedArea, 0);
  const totalOffcutArea = layouts.reduce((s, l) => s + l.offcuts.reduce((a, o) => a + o.w * o.h, 0), 0);
  const usagePct = totalSheetArea ? totalUsedArea / totalSheetArea * 100 : 0;
  const wastePct = 100 - usagePct;
  const avgSheetUnitCost = sheets.length
    ? sheets.reduce((sum, s) => sum + (s.length > 0 && s.width > 0 ? s.price / (s.length * s.width / 1e6) : 0), 0) / sheets.length
    : 0;
  const offcutCredit = (totalOffcutArea / 1e6) * avgSheetUnitCost * (Math.max(0, Math.min(100, params.offcutCreditPct)) / 100);
  const cuttingCost = totalCutLength / 1000 * Math.max(0, params.sheetCostPerCut);
  return {
    layouts,
    unplaced: Array.from(unplacedMap.values()),
    stats: {
      sheetsUsed: layouts.length,
      partsPlaced,
      partsTotal,
      totalSheetArea,
      totalUsedArea,
      totalOffcutArea,
      usagePct,
      wastePct,
      totalCuts,
      totalCost,
      totalCutLength,
      cuttingCost,
      offcutCredit,
      estimatedNetCost: Math.max(0, totalCost + cuttingCost - offcutCredit),
    },
    createdAt: new Date().toISOString(),
  };
}
