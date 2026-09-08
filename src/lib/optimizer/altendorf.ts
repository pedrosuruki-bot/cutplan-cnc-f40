import type { CutParameters, CutStep, Part, Placement, Sheet } from "@/types";

type Instance = { part: Part; instance: number };
type Candidate = { w: number; h: number; rotated: boolean };
interface StripItem {
  instance: Instance;
  x: number;
  w: number;
  h: number;
  rotated: boolean;
}
interface Strip {
  y: number;
  h: number;
  usedLength: number;
  items: StripItem[];
}
interface Evaluated {
  strips: Strip[];
  remaining: Instance[];
  placedArea: number;
  placedCount: number;
  usefulWaste: number;
  stripCount: number;
}
export interface AltendorfPacked {
  placements: Placement[];
  remaining: Instance[];
  cuts: CutStep[];
}

function canRotate(part: Part, params: CutParameters): boolean {
  return params.allowRotation && part.canRotate && part.grain === "none";
}

function candidates(inst: Instance, params: CutParameters): Candidate[] {
  const out: Candidate[] = [{ w: inst.part.length, h: inst.part.width, rotated: false }];
  if (canRotate(inst.part, params) && inst.part.length !== inst.part.width)
    out.push({ w: inst.part.width, h: inst.part.length, rotated: true });
  return out;
}

function difficulty(inst: Instance, sheet: Sheet, params: CutParameters): number {
  const usableL = Math.max(1, sheet.length - params.margin * 2);
  const usableW = Math.max(1, sheet.width - params.margin * 2);
  const fits = candidates(inst, params).filter((o) => o.w <= usableL + 1e-9 && o.h <= usableW + 1e-9);
  if (!fits.length) return 100;
  const narrowness = 1 / Math.max(1, Math.min(fits[0]!.w, fits[0]!.h));
  const aspect = Math.max(fits[0]!.w, fits[0]!.h) / Math.max(1, Math.min(fits[0]!.w, fits[0]!.h));
  return aspect + narrowness * 1000 + (fits.length === 1 ? 1 : 0);
}

function orderInstances(instances: Instance[], sheet: Sheet, params: CutParameters, variant: number): Instance[] {
  const list = instances.slice();
  list.sort((a, b) => {
    const areaA = a.part.length * a.part.width;
    const areaB = b.part.length * b.part.width;
    const longA = Math.max(a.part.length, a.part.width);
    const longB = Math.max(b.part.length, b.part.width);
    const shortA = Math.min(a.part.length, a.part.width);
    const shortB = Math.min(b.part.length, b.part.width);
    const diffA = difficulty(a, sheet, params);
    const diffB = difficulty(b, sheet, params);
    switch (variant % 10) {
      case 0:
        return areaB - areaA || longB - longA || shortB - shortA;
      case 1:
        return longB - longA || areaB - areaA || shortB - shortA;
      case 2:
        return shortB - shortA || longB - longA || areaB - areaA;
      case 3:
        return diffB - diffA || areaB - areaA;
      case 4:
        return areaB - areaA || diffB - diffA;
      case 5:
        return longB - longA || diffB - diffA;
      case 6:
        return b.part.length + b.part.width - (a.part.length + a.part.width) || areaB - areaA;
      case 7:
        return b.part.width - a.part.width || b.part.length - a.part.length;
      case 8:
        return diffB - diffA || longB - longA;
      default:
        return a.instance - b.instance;
    }
  });
  return list;
}

function hashSeed(instances: Instance[], sheet: Sheet, seed: number): number {
  let h = 2166136261 ^ seed;
  for (const i of instances) {
    h ^= i.part.length | 0;
    h = Math.imul(h, 16777619);
    h ^= i.part.width | 0;
    h = Math.imul(h, 16777619);
    h ^= i.instance;
    h = Math.imul(h, 16777619);
  }
  h ^= sheet.length | 0;
  h = Math.imul(h, 16777619);
  h ^= sheet.width | 0;
  return h >>> 0;
}

function random01(state: { value: number }): number {
  state.value = (Math.imul(state.value, 1664525) + 1013904223) >>> 0;
  return state.value / 4294967296;
}

function perturb(sequence: Instance[], seed: number, strength: number): Instance[] {
  const out = sequence.slice();
  const state = { value: seed >>> 0 };
  const moves = Math.max(1, Math.round(out.length * strength));
  for (let i = 0; i < moves; i++) {
    if (out.length < 2) break;
    const a = Math.floor(random01(state) * out.length);
    const b = Math.floor(random01(state) * out.length);
    if (a === b) continue;
    const item = out.splice(a, 1)[0]!;
    const target = Math.min(out.length, b);
    out.splice(target, 0, item);
  }
  return out;
}

function evaluateSequence(sequence: Instance[], sheet: Sheet, params: CutParameters): Evaluated {
  const margin = Math.max(0, params.margin);
  const separation = Math.max(0, params.kerf) + Math.max(0, params.spacing);
  const usableL = sheet.length - margin * 2;
  const usableW = sheet.width - margin * 2;
  const strips: Strip[] = [];
  const remaining: Instance[] = [];

  for (const inst of sequence) {
    const opts = candidates(inst, params).filter(
      (o) => o.w <= usableL + 1e-9 && o.h <= usableW + 1e-9,
    );
    if (!opts.length) {
      remaining.push(inst);
      continue;
    }

    let best: { strip: Strip | null; opt: Candidate; x: number; score: number } | null = null;
    for (const strip of strips) {
      for (const opt of opts) {
        if (Math.abs(opt.h - strip.h) > 1e-9) continue;
        const x = strip.usedLength === 0 ? 0 : strip.usedLength + separation;
        if (x + opt.w > usableL + 1e-9) continue;
        const tail = Math.max(0, usableL - (x + opt.w));
        const fill = usableL > 0 ? (x + opt.w) / usableL : 0;
        const score = tail + (1 - fill) * opt.h * 0.05;
        if (!best || score < best.score) best = { strip, opt, x, score };
      }
    }

    for (const opt of opts) {
      const y = strips.length
        ? strips[strips.length - 1]!.y + strips[strips.length - 1]!.h + separation
        : 0;
      if (y + opt.h > usableW + 1e-9) continue;
      const futurePenalty = Math.max(0, usableW - (y + opt.h)) * 0.03;
      const score = opt.h * 0.8 + futurePenalty - opt.w * 0.0001;
      if (!best || score < best.score) best = { strip: null, opt, x: 0, score };
    }

    if (!best) {
      remaining.push(inst);
      continue;
    }

    if (best.strip) {
      best.strip.items.push({
        instance: inst,
        x: best.x,
        w: best.opt.w,
        h: best.opt.h,
        rotated: best.opt.rotated,
      });
      best.strip.usedLength = best.x + best.opt.w;
    } else {
      const y = strips.length
        ? strips[strips.length - 1]!.y + strips[strips.length - 1]!.h + separation
        : 0;
      strips.push({
        y,
        h: best.opt.h,
        usedLength: best.opt.w,
        items: [{ instance: inst, x: 0, w: best.opt.w, h: best.opt.h, rotated: best.opt.rotated }],
      });
    }
  }

  const placedArea = strips.reduce(
    (sum, strip) => sum + strip.items.reduce((s, item) => s + item.w * item.h, 0),
    0,
  );
  const usefulWaste = strips.reduce((sum, strip) => {
    const tail = Math.max(0, usableL - strip.usedLength);
    return sum + (tail >= 80 && strip.h >= 80 ? tail * strip.h : 0);
  }, 0);

  return {
    strips,
    remaining,
    placedArea,
    placedCount: sequence.length - remaining.length,
    usefulWaste,
    stripCount: strips.length,
  };
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
  const bases = Array.from({ length: 10 }, (_, variant) => orderInstances(instances, sheet, params, variant));
  let best = evaluateSequence(bases[seed % bases.length]!, sheet, params);
  const maxIterations = instances.length <= 30 ? 80 : instances.length <= 80 ? 55 : 30;
  const state = { value: hashSeed(instances, sheet, seed) };
  let base = bases[seed % bases.length]!;

  for (let i = 0; i < maxIterations; i++) {
    const alpha =
      i < maxIterations * 0.55
        ? 0.08 + (i / maxIterations) * 0.32
        : 0.45 + (i / maxIterations) * 0.45;
    const candidate = perturb(base, state.value, alpha);
    const evaluated = evaluateSequence(candidate, sheet, params);
    if (better(evaluated, best, params.mode)) {
      best = evaluated;
      base = candidate;
      state.value ^= (i + 1) * 2654435761;
    } else if (i % 7 === 6) {
      base = bases[(seed + i) % bases.length]!;
    }
  }
  return best;
}

function r(v: number) {
  return Math.round(v * 10) / 10;
}

export function packForAltendorfF40(
  instances: Instance[],
  sheet: Sheet,
  params: CutParameters,
  variant = 0,
): AltendorfPacked {
  const best = searchBest(instances, sheet, params, variant);
  const margin = Math.max(0, params.margin);
  const placements: Placement[] = best.strips.flatMap((strip) =>
    strip.items.map((item) => ({
      partId: item.instance.part.id,
      instance: item.instance.instance,
      name: item.instance.part.name,
      x: margin + item.x,
      y: margin + strip.y,
      w: item.w,
      h: item.h,
      rotated: item.rotated,
    })),
  );

  const cuts: CutStep[] = [];
  let order = 1;
  for (let si = 0; si < best.strips.length; si++) {
    const strip = best.strips[si]!;
    const y0 = margin + strip.y;
    const y1 = y0 + strip.h;
    if (si < best.strips.length - 1) {
      cuts.push({
        order: order++,
        phase: "rip",
        type: "horizontal",
        position: r(y1),
        from: r(margin),
        to: r(sheet.length - margin),
        note: `RASGO ${si + 1}: separar faixa de ${r(strip.h)} mm`,
      });
    }
    const items = strip.items.slice().sort((a, b) => a.x - b.x);
    for (const item of items) {
      const right = margin + item.x + item.w;
      if (right < sheet.length - margin - 1e-9) {
        cuts.push({
          order: order++,
          phase: "crosscut",
          type: "vertical",
          position: r(right),
          from: r(y0),
          to: r(y1),
          note: `ESQUADRO: ${item.instance.part.id} — ${item.instance.part.name} (${r(item.w)} × ${r(item.h)} mm)`,
        });
      }
    }
  }

  for (const p of placements) {
    if (
      p.x < margin - 1e-6 ||
      p.y < margin - 1e-6 ||
      p.x + p.w > sheet.length - margin + 1e-6 ||
      p.y + p.h > sheet.width - margin + 1e-6
    )
      throw new Error("Otimização F40 produziu uma peça fora dos limites da chapa.");
  }

  return { placements, remaining: best.remaining, cuts };
}
