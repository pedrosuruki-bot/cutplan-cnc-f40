import type { Rect } from "@/types";

export type FitHeuristic = "best-area" | "bottom-left" | "best-short-side";
export interface PlacedRect extends Rect {
  rotated: boolean;
}
interface Candidate {
  rect: Rect;
  rotated: boolean;
  score1: number;
  score2: number;
}

export class MaxRectsBin {
  readonly width: number;
  readonly height: number;
  private free: Rect[];
  private used: Rect[] = [];
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.free = [{ x: 0, y: 0, w: width, h: height }];
  }
  get usedRects(): Rect[] {
    return this.used.slice();
  }
  get freeRects(): Rect[] {
    return this.free.slice();
  }
  insert(
    w: number,
    h: number,
    allowRotate: boolean,
    heuristic: FitHeuristic,
    gap: number,
  ): PlacedRect | null {
    const best = this.findPosition(w, h, allowRotate, heuristic);
    if (!best) return null;
    this.occupy(best.rect, gap);
    return { ...best.rect, rotated: best.rotated };
  }
  private findPosition(
    w: number,
    h: number,
    allowRotate: boolean,
    heuristic: FitHeuristic,
  ): Candidate | null {
    let best: Candidate | null = null;
    for (const fr of this.free) {
      const options = [
        { w, h, rotated: false },
        ...(allowRotate && w !== h ? [{ w: h, h: w, rotated: true }] : []),
      ];
      for (const opt of options) {
        if (opt.w > fr.w + 1e-9 || opt.h > fr.h + 1e-9) continue;
        const rect: Rect = { x: fr.x, y: fr.y, w: opt.w, h: opt.h };
        const leftoverH = fr.w - opt.w;
        const leftoverV = fr.h - opt.h;
        const [score1, score2] =
          heuristic === "best-area"
            ? [fr.w * fr.h - opt.w * opt.h, Math.min(leftoverH, leftoverV)]
            : heuristic === "best-short-side"
              ? [Math.min(leftoverH, leftoverV), Math.max(leftoverH, leftoverV)]
              : [fr.y + opt.h, fr.x];
        if (
          !best ||
          score1 < best.score1 - 1e-9 ||
          (Math.abs(score1 - best.score1) < 1e-9 && score2 < best.score2)
        )
          best = { rect, rotated: opt.rotated, score1, score2 };
      }
    }
    return best;
  }
  private occupy(rect: Rect, gap: number) {
    this.used.push(rect);
    const buffer = Math.max(0, gap) / 2;
    const x0 = Math.max(0, rect.x - buffer);
    const y0 = Math.max(0, rect.y - buffer);
    const x1 = Math.min(this.width, rect.x + rect.w + buffer);
    const y1 = Math.min(this.height, rect.y + rect.h + buffer);
    const blocked = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    const next: Rect[] = [];
    for (const fr of this.free) next.push(...splitFree(fr, blocked));
    this.free = pruneContained(next);
  }
}

function intersects(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w - 1e-9 &&
    a.x + a.w > b.x + 1e-9 &&
    a.y < b.y + b.h - 1e-9 &&
    a.y + a.h > b.y + 1e-9
  );
}
function splitFree(fr: Rect, blocked: Rect): Rect[] {
  if (!intersects(fr, blocked)) return [fr];
  const out: Rect[] = [];
  if (blocked.y > fr.y) out.push({ x: fr.x, y: fr.y, w: fr.w, h: blocked.y - fr.y });
  const bBottom = blocked.y + blocked.h;
  if (bBottom < fr.y + fr.h) out.push({ x: fr.x, y: bBottom, w: fr.w, h: fr.y + fr.h - bBottom });
  if (blocked.x > fr.x) out.push({ x: fr.x, y: fr.y, w: blocked.x - fr.x, h: fr.h });
  const bRight = blocked.x + blocked.w;
  if (bRight < fr.x + fr.w) out.push({ x: bRight, y: fr.y, w: fr.x + fr.w - bRight, h: fr.h });
  return out.filter((r) => r.w > 1e-6 && r.h > 1e-6);
}
function contained(a: Rect, b: Rect): boolean {
  return (
    a.x >= b.x - 1e-9 &&
    a.y >= b.y - 1e-9 &&
    a.x + a.w <= b.x + b.w + 1e-9 &&
    a.y + a.h <= b.y + b.h + 1e-9
  );
}
export function pruneContained(rects: Rect[]): Rect[] {
  return rects.filter(
    (a, i) => !rects.some((b, j) => i !== j && contained(a, b) && !(j > i && contained(b, a))),
  );
}
export function deriveFreeRects(
  width: number,
  height: number,
  placements: Rect[],
  gap: number,
): Rect[] {
  let free: Rect[] = [{ x: 0, y: 0, w: width, h: height }];
  for (const rect of placements) {
    const buffer = Math.max(0, gap) / 2;
    const blocked = {
      x: Math.max(0, rect.x - buffer),
      y: Math.max(0, rect.y - buffer),
      w: Math.min(width, rect.x + rect.w + buffer) - Math.max(0, rect.x - buffer),
      h: Math.min(height, rect.y + rect.h + buffer) - Math.max(0, rect.y - buffer),
    };
    const next: Rect[] = [];
    for (const fr of free) next.push(...splitFree(fr, blocked));
    free = pruneContained(next);
  }
  return free;
}
