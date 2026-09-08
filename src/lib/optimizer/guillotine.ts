import type { CutStep, Rect } from "@/types";

export interface GuillotinePlacement extends Rect {
  rotated: boolean;
}

interface FreeNode extends Rect {
  id: number;
}

interface Candidate {
  node: FreeNode;
  w: number;
  h: number;
  rotated: boolean;
  waste: number;
  short: number;
  long: number;
  split: "vertical" | "horizontal";
  splitScore: number;
}

export class GuillotineBin {
  readonly width: number;
  readonly height: number;
  private free: FreeNode[];
  private _placements: GuillotinePlacement[] = [];
  private _cuts: CutStep[] = [];
  private nextId = 1;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.free = [{ id: this.nextId++, x: 0, y: 0, w: width, h: height }];
  }

  get placements(): GuillotinePlacement[] {
    return this._placements.slice();
  }
  get cuts(): CutStep[] {
    return this._cuts.slice();
  }
  get freeRects(): Rect[] {
    return this.free.map(({ id: _id, ...r }) => r);
  }

  insert(w: number, h: number, allowRotate: boolean, gap: number): GuillotinePlacement | null {
    const safeGap = Math.max(0, gap);
    const candidates: Candidate[] = [];
    for (const node of this.free) {
      const opts = [{ w, h, rotated: false }];
      if (allowRotate && w !== h) opts.push({ w: h, h: w, rotated: true });
      for (const opt of opts) {
        if (opt.w > node.w + 1e-9 || opt.h > node.h + 1e-9) continue;
        const waste = node.w * node.h - opt.w * opt.h;
        const short = Math.min(node.w - opt.w, node.h - opt.h);
        const long = Math.max(node.w - opt.w, node.h - opt.h);
        for (const split of ["vertical", "horizontal"] as const) {
          const children = splitRects(node, opt.w, opt.h, safeGap, split);
          const splitScore = scoreSplit(children, node, opt.w, opt.h);
          candidates.push({
            node,
            ...opt,
            waste,
            short,
            long,
            split,
            splitScore,
          });
        }
      }
    }

    const best = candidates.sort(compareCandidates)[0];
    if (!best) return null;

    const node = best.node;
    this.free = this.free.filter((f) => f.id !== node.id);
    const placement: GuillotinePlacement = {
      x: node.x,
      y: node.y,
      w: best.w,
      h: best.h,
      rotated: best.rotated,
    };
    this._placements.push(placement);

    const children = splitRects(node, best.w, best.h, safeGap, best.split);
    for (const child of children) {
      this.free.push({ id: this.nextId++, ...child });
    }

    const cutPosition =
      best.split === "vertical" ? node.x + best.w + safeGap : node.y + best.h + safeGap;
    const cutFrom = best.split === "vertical" ? node.y : node.x;
    const cutTo = best.split === "vertical" ? node.y + node.h : node.x + node.w;
    if (cutPosition < (best.split === "vertical" ? node.x + node.w : node.y + node.h) + 1e-9) {
      this._cuts.push({
        order: this._cuts.length + 1,
        phase: best.split === "vertical" ? "crosscut" : "rip",
        type: best.split === "vertical" ? "vertical" : "horizontal",
        position: round(cutPosition),
        from: round(cutFrom),
        to: round(cutTo),
        note: "Corte guilhotinado de separação",
      });
    }

    if (children.length === 2) {
      const second = children[1]!;
      const secondCut =
        best.split === "vertical"
          ? node.y + best.h + safeGap
          : node.x + best.w + safeGap;
      const secondFrom =
        best.split === "vertical" ? node.x : node.y;
      const secondTo =
        best.split === "vertical" ? node.x + best.w : node.y + best.h;
      if (secondCut <
        (best.split === "vertical" ? node.y + best.h : node.x + best.w) + 1e-9) {
        this._cuts.push({
          order: this._cuts.length + 1,
          phase: best.split === "vertical" ? "rip" : "crosscut",
          type: best.split === "vertical" ? "horizontal" : "vertical",
          position: round(secondCut),
          from: round(secondFrom),
          to: round(secondTo),
          note: "Corte guilhotinado de separação",
        });
      }
    }

    return placement;
  }
}

function splitRects(
  node: Rect,
  w: number,
  h: number,
  gap: number,
  split: "vertical" | "horizontal",
): Rect[] {
  const rightW = node.w - w - gap;
  const topH = node.h - h - gap;
  if (split === "vertical") {
    const out: Rect[] = [];
    if (rightW > 1e-6)
      out.push({ x: node.x + w + gap, y: node.y, w: rightW, h: node.h });
    if (topH > 1e-6)
      out.push({ x: node.x, y: node.y + h + gap, w, h: topH });
    return out;
  }
  const out: Rect[] = [];
  if (topH > 1e-6)
    out.push({ x: node.x, y: node.y + h + gap, w: node.w, h: topH });
  if (rightW > 1e-6)
    out.push({ x: node.x + w + gap, y: node.y, w: rightW, h });
  return out;
}

function scoreSplit(children: Rect[], node: Rect, w: number, h: number): number {
  if (!children.length) return 0;
  const usable = node.w * node.h - w * h;
  const largest = Math.max(...children.map((r) => r.w * r.h));
  const slivers = children.filter((r) => Math.min(r.w, r.h) < 80).reduce((s, r) => s + r.w * r.h, 0);
  const balance = children.length === 2
    ? Math.abs(children[0]!.w * children[0]!.h - children[1]!.w * children[1]!.h)
    : 0;
  return usable > 0 ? slivers * 5 + balance * 0.0001 - largest * 0.001 : 0;
}

function compareCandidates(a: Candidate, b: Candidate): number {
  return (
    a.waste - b.waste ||
    a.splitScore - b.splitScore ||
    a.short - b.short ||
    a.long - b.long ||
    a.node.y - b.node.y ||
    a.node.x - b.node.x
  );
}

function round(v: number): number {
  return Math.round(v * 10) / 10;
}
