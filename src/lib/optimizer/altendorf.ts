import type { CutParameters, CutStep, Part, Placement, Sheet } from "@/types";

type Instance = { part: Part; instance: number };
type Candidate = { w: number; h: number; rotated: boolean };
interface StripItem { instance: Instance; x: number; w: number; h: number; rotated: boolean; }
interface Strip { y: number; h: number; usedLength: number; items: StripItem[]; }
interface Evaluated { strips: Strip[]; remaining: Instance[]; placedArea: number; placedCount: number; usefulWaste: number; stripCount: number; }
export interface AltendorfPacked { placements: Placement[]; remaining: Instance[]; cuts: CutStep[]; }

const EPS = 1e-9;
const PRODUCTION_SEARCH_MS = 60_000;
const TEST_SEARCH_MS = 250;

function searchBudgetMs(): number {
  return typeof process !== "undefined" && process.env.VITEST ? TEST_SEARCH_MS : PRODUCTION_SEARCH_MS;
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
  const usableL = Math.max(1, sheet.length - params.margin * 2), usableW = Math.max(1, sheet.width - params.margin * 2);
  const fits = candidates(inst, params).filter(o => o.w <= usableL + EPS && o.h <= usableW + EPS);
  if (!fits.length) return 100;
  return Math.max(fits[0]!.w, fits[0]!.h) / Math.max(1, Math.min(fits[0]!.w, fits[0]!.h)) + (fits.length === 1 ? 1 : 0) + 1000 / Math.max(1, Math.min(fits[0]!.w, fits[0]!.h));
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
  for (const i of instances) { h ^= i.part.length | 0; h = Math.imul(h, 16777619); h ^= i.part.width | 0; h = Math.imul(h, 16777619); h ^= i.instance; h = Math.imul(h, 16777619); }
  h ^= sheet.length | 0; h = Math.imul(h, 16777619); h ^= sheet.width | 0;
  return h >>> 0;
}
function random01(state: { value: number }): number { state.value = (Math.imul(state.value, 1664525) + 1013904223) >>> 0; return state.value / 4294967296; }
function perturb(sequence: Instance[], state: { value: number }, strength: number): Instance[] {
  const out = sequence.slice(), moves = Math.max(1, Math.round(out.length * strength));
  for (let i = 0; i < moves && out.length > 1; i++) { const a = Math.floor(random01(state) * out.length), b = Math.floor(random01(state) * out.length); if (a === b) continue; const item = out.splice(a, 1)[0]!; out.splice(Math.min(out.length, b), 0, item); }
  return out;
}
function evaluateSequence(sequence: Instance[], sheet: Sheet, params: CutParameters, deadline?: number): Evaluated {
  const margin = Math.max(0, params.margin), separation = Math.max(0, params.kerf) + Math.max(0, params.spacing);
  const usableL = sheet.length - margin * 2, usableW = sheet.width - margin * 2;
  const strips: Strip[] = [], remaining: Instance[] = [];
  for (let index = 0; index < sequence.length; index++) {
    if (deadline && (index & 15) === 0 && Date.now() >= deadline) { remaining.push(...sequence.slice(index)); break; }
    const inst = sequence[index]!;
    const opts = candidates(inst, params).filter(o => o.w <= usableL + EPS && o.h <= usableW + EPS);
    if (!opts.length) { remaining.push(inst); continue; }
    let best: { strip: Strip | null; opt: Candidate; x: number; score: number } | null = null;
    for (const strip of strips) for (const opt of opts) {
      if (Math.abs(opt.h - strip.h) > EPS) continue;
      const x = strip.usedLength === 0 ? 0 : strip.usedLength + separation;
      if (x + opt.w > usableL + EPS) continue;
      const tail = Math.max(0, usableL - x - opt.w);
      const usefulTail = tail >= 80 && opt.h >= 80 ? tail * opt.h : 0;
      const score = tail - usefulTail * 0.00001 + (1 - (x + opt.w) / Math.max(1, usableL)) * opt.h * 0.05;
      if (!best || score < best.score) best = { strip, opt, x, score };
    }
    const baseY = strips.length ? strips[strips.length - 1]!.y + strips[strips.length - 1]!.h + separation : 0;
    for (const opt of opts) {
      if (baseY + opt.h > usableW + EPS) continue;
      const tailH = Math.max(0, usableW - baseY - opt.h);
      const score = opt.h * 0.8 + tailH * 0.03 - opt.w * 0.0001 - (tailH >= 80 && usableL >= 80 ? tailH * usableL * 0.000001 : 0);
      if (!best || score < best.score) best = { strip: null, opt, x: 0, score };
    }
    if (!best) { remaining.push(inst); continue; }
    if (best.strip) { best.strip.items.push({ instance: inst, x: best.x, w: best.opt.w, h: best.opt.h, rotated: best.opt.rotated }); best.strip.usedLength = best.x + best.opt.w; }
    else strips.push({ y: baseY, h: best.opt.h, usedLength: best.opt.w, items: [{ instance: inst, x: 0, w: best.opt.w, h: best.opt.h, rotated: best.opt.rotated }] });
  }
  const placedArea = strips.reduce((sum, s) => sum + s.items.reduce((v, i) => v + i.w * i.h, 0), 0);
  const usefulWaste = strips.reduce((sum, s) => { const tail = Math.max(0, usableL - s.usedLength); return sum + (tail >= 80 && s.h >= 80 ? tail * s.h : 0); }, 0);
  return { strips, remaining, placedArea, placedCount: sequence.length - remaining.length, usefulWaste, stripCount: strips.length };
}
function better(a: Evaluated, b: Evaluated, mode: CutParameters["mode"]): boolean {
  if (a.placedCount !== b.placedCount) return a.placedCount > b.placedCount;
  if (mode === "max-yield" && a.placedArea !== b.placedArea) return a.placedArea > b.placedArea;
  if (mode === "fewer-cuts" && a.stripCount !== b.stripCount) return a.stripCount < b.stripCount;
  if (a.usefulWaste !== b.usefulWaste) return a.usefulWaste > b.usefulWaste;
  if (a.placedArea !== b.placedArea) return a.placedArea > b.placedArea;
  return a.stripCount < b.stripCount;
}
function searchBest(instances: Instance[], sheet: Sheet, params: CutParameters, seed: number): Evaluated {
  const started = Date.now();
  const searchMs = searchBudgetMs();
  const deadline = started + searchMs;
  const bases = Array.from({ length: 10 }, (_, v) => orderInstances(instances, sheet, params, v));

  let best: Evaluated | null = null;
  let bestSequence: Instance[] | null = null;
  for (let i = 0; i < bases.length && Date.now() < deadline; i++) {
    const evaluated = evaluateSequence(bases[i]!, sheet, params, deadline);
    if (!best || better(evaluated, best, params.mode)) {
      best = evaluated;
      bestSequence = bases[i]!;
    }
  }

  if (!best || !bestSequence) {
    bestSequence = bases[seed % bases.length]!;
    best = evaluateSequence(bestSequence, sheet, params);
  }

  const state = { value: hashSeed(instances, sheet, seed) };
  let base = bestSequence;
  let iterations = 0;
  while (Date.now() < deadline) {
    const progress = Math.min(1, (Date.now() - started) / searchMs);
    const strength = progress < 0.55 ? 0.08 + progress * 0.58 : 0.45 + progress * 0.45;
    const candidate = perturb(base, state, strength);
    const evaluated = evaluateSequence(candidate, sheet, params, deadline);
    iterations++;
    if (better(evaluated, best, params.mode)) {
      best = evaluated;
      base = candidate;
      state.value ^= Math.imul(iterations + 1, 2654435761);
    } else if (iterations % 5 === 0) {
      const alternate = bases[Math.floor(random01(state) * bases.length)]!;
      const alt = evaluateSequence(alternate, sheet, params, deadline);
      if (better(alt, best, params.mode)) {
        best = alt;
        base = alternate;
      } else if (iterations % 17 === 0) {
        base = perturb(best.strips.flatMap(s => s.items.map(i => i.instance)), state, 0.25);
      }
    }
  }
  return best;
}
function r(v: number) { return Math.round(v * 10) / 10; }

export function packForAltendorfF40(instances: Instance[], sheet: Sheet, params: CutParameters, variant = 0): AltendorfPacked {
  const best = searchBest(instances, sheet, params, variant), margin = Math.max(0, params.margin);
  const placements: Placement[] = best.strips.flatMap(strip => strip.items.map(item => ({ partId: item.instance.part.id, instance: item.instance.instance, name: item.instance.part.name, x: margin + item.x, y: margin + strip.y, w: item.w, h: item.h, rotated: item.rotated })));
  const cuts: CutStep[] = []; let order = 1;
  for (let si = 0; si < best.strips.length; si++) {
    const strip = best.strips[si]!, y0 = margin + strip.y, y1 = y0 + strip.h;
    if (si < best.strips.length - 1) cuts.push({ order: order++, phase: "rip", type: "horizontal", position: r(y1), from: r(margin), to: r(sheet.length - margin), note: `RASGO ${si + 1}: separar faixa de ${r(strip.h)} mm` });
    for (const item of strip.items.slice().sort((a, b) => a.x - b.x)) {
      const right = margin + item.x + item.w;
      if (right < sheet.length - margin - EPS) cuts.push({ order: order++, phase: "crosscut", type: "vertical", position: r(right), from: r(y0), to: r(y1), note: `ESQUADRO: ${item.instance.part.id} — ${item.instance.part.name} (${r(item.w)} × ${r(item.h)} mm)` });
    }
  }
  for (const p of placements) if (p.x < margin - 1e-6 || p.y < margin - 1e-6 || p.x + p.w > sheet.length - margin + 1e-6 || p.y + p.h > sheet.width - margin + 1e-6) throw new Error("Otimização F40 produziu uma peça fora dos limites da chapa.");
  return { placements, remaining: best.remaining, cuts };
}