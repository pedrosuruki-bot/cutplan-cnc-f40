import type { CutParameters, CutStep, Part, Placement, Sheet } from "@/types";
type Instance = { part: Part; instance: number };
type Candidate = { w: number; h: number; rotated: boolean };
interface Strip {
  y: number;
  h: number;
  usedLength: number;
  items: Array<{ instance: Instance; x: number; w: number; h: number; rotated: boolean }>;
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
  const out = [{ w: inst.part.length, h: inst.part.width, rotated: false }];
  if (canRotate(inst.part, params) && inst.part.length !== inst.part.width)
    out.push({ w: inst.part.width, h: inst.part.length, rotated: true });
  return out;
}
function orderInstances(instances: Instance[], variant: number): Instance[] {
  const list = instances.slice();
  const key = variant % 5;
  list.sort((a, b) => {
    const aa = Math.max(a.part.length, a.part.width),
      bb = Math.max(b.part.length, b.part.width);
    if (key === 0) return bb * bb - aa * aa;
    if (key === 1) return bb - aa;
    if (key === 2) return b.part.length + b.part.width - (a.part.length + a.part.width);
    if (key === 3)
      return Math.min(b.part.length, b.part.width) - Math.min(a.part.length, a.part.width);
    return a.instance - b.instance;
  });
  return list;
}
function r(v: number) {
  return Math.round(v * 10) / 10;
}
/** Modelo de oficina para esquadrejadeira: criar faixas por largura e depois esquadrejar cada faixa em comprimentos. */
export function packForAltendorfF40(
  instances: Instance[],
  sheet: Sheet,
  params: CutParameters,
  variant = 0,
): AltendorfPacked {
  const margin = Math.max(0, params.margin);
  const separation = Math.max(0, params.kerf) + Math.max(0, params.spacing);
  const usableL = sheet.length - margin * 2,
    usableW = sheet.width - margin * 2;
  const strips: Strip[] = [];
  const remaining: Instance[] = [];
  for (const inst of orderInstances(instances, variant)) {
    const opts = candidates(inst, params)
      .filter((o) => o.w <= usableL + 1e-9 && o.h <= usableW + 1e-9)
      .sort((a, b) => a.h - b.h || b.w - a.w);
    if (!opts.length) {
      remaining.push(inst);
      continue;
    }
    let best: { strip: Strip; opt: Candidate; x: number; score: number } | null = null;
    for (const strip of strips)
      for (const opt of opts) {
        if (Math.abs(opt.h - strip.h) > 1e-9) continue;
        const x = strip.usedLength === 0 ? 0 : strip.usedLength + separation;
        const end = x + opt.w;
        if (end > usableL + 1e-9) continue;
        const score = usableL - end + Math.abs(strip.h - opt.h) * 10000;
        if (!best || score < best.score) best = { strip, opt, x, score };
      }
    if (best) {
      best.strip.items.push({
        instance: inst,
        x: best.x,
        w: best.opt.w,
        h: best.opt.h,
        rotated: best.opt.rotated,
      });
      best.strip.usedLength = best.x + best.opt.w;
      continue;
    }
    const opt = opts[0]!;
    const y = strips.length
      ? strips[strips.length - 1]!.y + strips[strips.length - 1]!.h + separation
      : 0;
    if (y + opt.h > usableW + 1e-9) {
      remaining.push(inst);
      continue;
    }
    strips.push({
      y,
      h: opt.h,
      usedLength: opt.w,
      items: [{ instance: inst, x: 0, w: opt.w, h: opt.h, rotated: opt.rotated }],
    });
  }
  const placements: Placement[] = strips.flatMap((s) =>
    s.items.map((i) => ({
      partId: i.instance.part.id,
      instance: i.instance.instance,
      name: i.instance.part.name,
      x: margin + i.x,
      y: margin + s.y,
      w: i.w,
      h: i.h,
      rotated: i.rotated,
    })),
  );
  const cuts: CutStep[] = [];
  let order = 1;
  // No modo F40, o primeiro corte de cada faixa é longitudinal. O segundo estágio é no esquadro.
  for (let si = 0; si < strips.length; si++) {
    const s = strips[si]!;
    const y0 = margin + s.y;
    const y1 = y0 + s.h;
    if (si < strips.length - 1) {
      cuts.push({
        order: order++,
        phase: "rip",
        type: "horizontal",
        position: r(y1),
        from: r(margin),
        to: r(sheet.length - margin),
        note: `RASGO ${si + 1}: separar faixa de ${r(s.h)} mm`,
      });
    }
    const items = s.items.slice().sort((a, b) => a.x - b.x);
    for (let ii = 0; ii < items.length; ii++) {
      const it = items[ii]!;
      const right = margin + it.x + it.w;
      if (right < sheet.length - margin - 1e-9) {
        cuts.push({
          order: order++,
          phase: "crosscut",
          type: "vertical",
          position: r(right),
          from: r(y0),
          to: r(y1),
          note: `ESQUADRO: ${it.instance.part.id} — ${it.instance.part.name} (${r(it.w)} × ${r(it.h)} mm)`,
        });
      }
    }
  }
  return { placements, remaining, cuts };
}
