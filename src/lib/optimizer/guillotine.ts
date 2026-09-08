import type { CutStep, Rect } from "@/types";

export interface GuillotinePlacement extends Rect {
  rotated: boolean;
}

interface FreeNode extends Rect { id: number }

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

  get placements(): GuillotinePlacement[] { return this._placements.slice(); }
  get cuts(): CutStep[] { return this._cuts.slice(); }
  get freeRects(): Rect[] { return this.free.map(({ id: _id, ...r }) => r); }

  insert(w: number, h: number, allowRotate: boolean, gap: number): GuillotinePlacement | null {
    const candidates: Array<{ node: FreeNode; w: number; h: number; rotated: boolean; waste: number; long: number }> = [];
    for (const node of this.free) {
      const opts = [{ w, h, rotated: false }];
      if (allowRotate && w !== h) opts.push({ w: h, h: w, rotated: true });
      for (const opt of opts) {
        if (opt.w > node.w + 1e-9 || opt.h > node.h + 1e-9) continue;
        const waste = node.w * node.h - opt.w * opt.h;
        candidates.push({ node, ...opt, waste, long: Math.max(node.w - opt.w, node.h - opt.h) });
      }
    }
    const best = candidates.sort((a, b) => a.waste - b.waste || a.long - b.long || a.node.y - b.node.y || a.node.x - b.node.x)[0];
    if (!best) return null;

    const node = best.node;
    this.free = this.free.filter((f) => f.id !== node.id);
    const placement: GuillotinePlacement = { x: node.x, y: node.y, w: best.w, h: best.h, rotated: best.rotated };
    this._placements.push(placement);

    const rightW = node.w - best.w - gap;
    const bottomH = node.h - best.h - gap;
    // Splitting from the top-left creates a true guillotine tree:
    // one vertical and one horizontal child can be cut independently.
    if (rightW > 1e-6) {
      this.free.push({ id: this.nextId++, x: node.x + best.w + gap, y: node.y, w: rightW, h: node.h });
      this._cuts.push({
        order: this._cuts.length + 1,
        phase: "crosscut",
        type: "vertical",
        position: round(node.x + best.w + gap),
        from: round(node.y),
        to: round(node.y + node.h),
        note: "Corte guilhotinado de separação",
      });
    }
    if (bottomH > 1e-6) {
      const leftW = rightW > 1e-6 ? best.w + gap : node.w;
      this.free.push({ id: this.nextId++, x: node.x, y: node.y + best.h + gap, w: leftW, h: bottomH });
      this._cuts.push({
        order: this._cuts.length + 1,
        phase: "rip",
        type: "horizontal",
        position: round(node.y + best.h + gap),
        from: round(node.x),
        to: round(node.x + leftW),
        note: "Corte guilhotinado de separação",
      });
    }
    return placement;
  }
}

function round(v: number): number { return Math.round(v * 10) / 10; }
