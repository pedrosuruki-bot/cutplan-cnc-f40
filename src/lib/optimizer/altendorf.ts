import type { CutParameters, CutStep, Part, Placement, Sheet } from "@/types";

type Instance = { part: Part; instance: number };
type Candidate = { w: number; h: number; rotated: boolean };
interface StripItem { instance: Instance; x: number; w: number; h: number; rotated: boolean; }
interface Strip { y: number; h: number; usedLength: number; items: StripItem[]; }
interface Evaluated { strips: Strip[]; remaining: Instance[]; placedArea: number; placedCount: number; usefulWaste: number; stripCount: number; }
export interface AltendorfProgress { progress: number; placedCount: number; placedArea: number; strips: Strip[]; }
export interface AltendorfPacked { placements: Placement[]; remaining: Instance[]; cuts: CutStep[]; }

const EPS = 1e-9;
const PRODUCTION_SEARCH_MS = 60_000;
const TEST_SEARCH_MS = 250;

function defaultBudgetMs(): number {
  if (typeof process !== "undefined") {
    const env = process.env as Record<string, string | undefined>;
    if (env.VITEST === "true" || env.NODE_ENV === "test") return TEST_SEARCH_MS;
  }
  return PRODUCTION_SEARCH_MS;
}
function canRotate(part: Part, params: CutParameters): boolean {
  return params.allowRotation && part.canRotate && part.grain === "none";
}
function candidates(inst: Instance, params: CutParameters): Candidate[] {
  const out: Candidate[] = [{ w: inst.part.length, h: inst.part.width, rotated: false }];
  if (canRotate(inst.part, params) && inst.part.length !== inst.part.width) out.push({ w: inst.part.width, h: inst.part.length, rotated: true });
  return out;
}
function difficulty(inst: Instance, sheet: Sheet, params: CutParameters): number {
  const usableL = Math.max(1, sheet.length - params.margin * 2);
  const usableW = Math.max(1, sheet.width - params.margin * 2);
  const fits = candidates(inst, params).filter(o => o.w <= usableL + EPS && o.h <= usableW + EPS);
  if (!fits.length) return 100;
  const short = Math.max(1, Math.min(fits[0]!.w, fits[0]!.h));
  const long = Math.max(fits[0]!.w, fits[0]!.h);
  return long / short + (fits.length === 1 ? 1 : 0) + 1000 / short;
}
function orderInstances(instances: Instance[], sheet: Sheet, params: CutParameters, variant: number): Instance[] {
  const list = instances.slice();
  list.sort((a, b) => {
    const aa = a.part.length * a.part.width, ab = b.part.length * b.part.width;
    const la = Math.max(a.part.length, a.part.width), lb = Math.max(b.part.length, b.part.width);
    const sa = Math.min(a.part.length, a.part.width), sb = Math.min(b.part.length, b.part.width);
    const da = difficulty(a, sheet, params), db = difficulty(b, sheet, params);
    switch (variant % 10) {
      case 0: return ab - aa || lb - la || sb - sa;
      case 1: return lb - la || ab - aa || sb - sa;
      case 2: return sb - sa || lb - la || ab - aa;
      case 3: return db - da || ab - aa;
      case 4: return ab - aa || db - da;
      case 5: return lb - la || db - da;
      case 6: return b.part.length + b.part.width - a.part.length - a.part.width || ab - aa;
      case 7: return b.part.width - a.part.width || b.part.length - a.part.length;
      case 8: return db - da || lb - la;
      default: return a.instance - b.instance;
    }
  });
  return list;
}
function hashSeed(instances: Instance[], sheet: Sheet, seed: number): number {
  let h = 2166136261 ^ seed;
  for (const i of instances) {
    h ^= i.part.length | 0; h = Math.imul(h, 16777619);
    h ^= i.part.width | 0; h = Math.imul(h, 16777619);
    h ^= i.instance; h = Math.imul(h, 16777619);
  }
  h ^= sheet.length | 0; h = Math.imul(h, 16777619);
  h ^= sheet.width | 0;
  return h >>> 0;
}
function random01(state: { value: number }): number {
  state.value = (Math.imul(state.value, 1664525) + 1013904223) >>> 0;
  return state.value / 4294967296;
}
function perturb(sequence: Instance[], state: { value: number }, strength: number): Instance[] {
  const out = sequence.slice();
  const moves = Math.max(1, Math.round(out.length * strength));
  for (let i = 0; i < moves && out.length > 1; i++) {
    const a = Math.floor(random01(state) * out.length);
    const b = Math.floor(random01(state) * out.length);
    if (a === b) continue;
    const item = out.splice(a, 1)[0]!;
    out.splice(Math.min(out.length, b), 0, item);
  }
  return out;
}

function evaluateSequence(sequence: Instance[], sheet: Sheet, params: CutParameters, deadline: number, onProgress?: (progress: AltendorfProgress) => void): Evaluated {
  const usableW = Math.max(0, sheet.width - params.margin * 2);
  const usableL = Math.max(0, sheet.length - params.margin * 2);
  const spacing = Math.max(0, params.kerf + params.spacing);
  const strips: Strip[] = [];
  const remaining: Instance[] = [];

  for (const inst of sequence) {
    if (Date.now() >= deadline) {
      remaining.push(inst);
      continue;
    }
    const opts = candidates(inst, params);
    let best: { opt: Candidate; y: number; strip: Strip | null; tail: number } | null = null;
    for (const opt of opts) {
      if (opt.w > usableL + EPS || opt.h > usableW + EPS) continue;
      for (const strip of strips) {
        if (Math.abs(strip.h - opt.h) > EPS) continue;
        if (strip.usedLength + opt.w <= usableL + EPS) {
          const tail = usableL - (strip.usedLength + opt.w);
          if (!best || tail < best.tail) best = { opt, y: strip.y, strip, tail };
        }
      }
    }
    if (best) {
      const { opt, strip } = best;
      strip!.items.push({ instance: inst, x: strip!.usedLength, w: opt.w, h: opt.h, rotated: opt.rotated });
      strip!.usedLength += opt.w + spacing;
      continue;
    }

    let startY = params.margin;
    const last = strips[strips.length - 1];
    if (last) startY = last.y + last.h + spacing;
    if (startY + opts[0]!.h <= params.margin + usableW + EPS) {
      const chosen = opts.find(o => o.w <= usableL + EPS && startY + o.h <= params.margin + usableW + EPS);
      if (chosen) {
        const strip: Strip = {
          y: startY,
          h: chosen.h,
          usedLength: chosen.w + spacing,
          items: [{ instance: inst, x: 0, w: chosen.w, h: chosen.h, rotated: chosen.rotated }],
        };
        strips.push(strip);
        continue;
      }
    }

    remaining.push(inst);
  }

  const placedCount = strips.reduce((sum, s) => sum + s.items.length, 0);
  const placedArea = strips.reduce((sum, s) => sum + s.items.reduce((a, item) => a + item.w * item.h, 0), 0);
  const usefulWaste = strips.reduce((sum, s) => sum + Math.max(0, usableL - Math.max(0, s.usedLength - spacing)) * s.h, 0);
  const evaluated: Evaluated = { strips, remaining, placedArea, placedCount, usefulWaste, stripCount: strips.length };
  onProgress?.({ progress: 0, placedCount, placedArea, strips });
  return evaluated;
}
function better(a: Evaluated | null, b: Evaluated): boolean {
  if (!a) return true;
  if (b.placedCount !== a.placedCount) return b.placedCount > a.placedCount;
  if (b.placedArea !== a.placedArea) return b.placedArea > a.placedArea;
  if (b.stripCount !== a.stripCount) return b.stripCount < a.stripCount;
  return b.usefulWaste > a.usefulWaste;
}
function searchBest(instances: Instance[], sheet: Sheet, params: CutParameters, deadline: number, onProgress?: (progress: AltendorfProgress) => void): Evaluated {
  let bestEval: Evaluated | null = null;
  const baseVariants = 10;
  let iteration = 0;
  while (Date.now() < deadline) {
    const remainingMs = Math.max(0, deadline - Date.now());
    const variant = iteration % baseVariants;
    const state = { value: hashSeed(instances, sheet, iteration + 1) };
    const base = orderInstances(instances, sheet, params, variant);
    const strength = iteration < baseVariants ? 0 : Math.min(0.35, 0.05 + (iteration % 7) * 0.05);
    const sequence = strength > 0 ? perturb(base, state, strength) : base;
    const evaluated = evaluateSequence(sequence, sheet, params, deadline, onProgress);
    if (better(bestEval, evaluated)) {
      bestEval = evaluated;
      onProgress?.({ progress: 1 - remainingMs / Math.max(1, deadline - (deadline - 60_000)), placedCount: evaluated.placedCount, placedArea: evaluated.placedArea, strips: evaluated.strips });
    }
    iteration += 1;
  }

  if (bestEval) return bestEval;
  return evaluateSequence(orderInstances(instances, sheet, params, 0), sheet, params, Date.now() + Math.max(1, TEST_SEARCH_MS), onProgress);
}

export function packForAltendorfF40(
  instances: Instance[],
  sheet: Sheet,
  params: CutParameters,
  budgetMs = defaultBudgetMs(),
  onProgress?: (progress: AltendorfProgress) => void,
): AltendorfPacked {
  const deadline = Date.now() + Math.max(1, budgetMs);
  const evaluated = searchBest(instances, sheet, params, deadline, onProgress);
  const placements: Placement[] = [];
  const spacing = Math.max(0, params.kerf + params.spacing);
  let order = 1;
  for (const strip of evaluated.strips) {
    const top = params.margin + strip.y;
    for (const item of strip.items) {
      placements.push({
        partId: item.instance.part.id,
        instance: item.instance.instance,
        name: item.instance.part.name,
        x: params.margin + item.x,
        y: top,
        w: item.w,
        h: item.h,
        rotated: item.rotated,
      });
    }
    void spacing;
    order += strip.items.length;
  }

  const cuts: CutStep[] = [];
  for (const strip of evaluated.strips) {
    if (strip.items.length <= 1) continue;
    cuts.push({
      order: cuts.length + 1,
      phase: "rip",
      type: "vertical",
      position: strip.y,
      from: strip.usedLength,
      to: strip.usedLength,
      note: `Faixa F40 com ${strip.items.length} peça(s)`,
    });
  }

  const placementKeys = new Set(placements.map(p => `${p.partId}:${p.instance}`));
  const remaining = instances.filter(i => !placementKeys.has(`${i.part.id}:${i.instance}`));
  return { placements, remaining, cuts };
}
