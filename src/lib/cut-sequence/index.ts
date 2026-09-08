import type { CutStep, Placement } from "@/types";

/**
 * Sequência de cortes guilhotinada aproximada, derivada das colocações reais:
 * primeiro cortes horizontais que separam faixas, depois verticais dentro de cada faixa.
 */
export function buildCutSequence(
  placements: Placement[],
  sheetLength: number,
  sheetWidth: number,
): CutStep[] {
  if (placements.length === 0) return [];

  const rows = new Map<number, Placement[]>();
  for (const p of placements) {
    const key = Math.round(p.y);
    const list = rows.get(key) ?? [];
    list.push(p);
    rows.set(key, list);
  }

  const sortedRows = Array.from(rows.entries()).sort((a, b) => a[0] - b[0]);
  const steps: CutStep[] = [];
  let order = 1;

  for (const [y, items] of sortedRows) {
    const bottom = Math.max(...items.map((i) => i.y + i.h));
    if (bottom < sheetWidth - 0.5) {
      steps.push({
        order: order++,
        type: "horizontal",
        position: Math.round(bottom * 10) / 10,
        from: 0,
        to: sheetLength,
        note: `Separar faixa a ${Math.round(y)} mm`,
      });
    }
    const sorted = items.slice().sort((a, b) => a.x - b.x);
    for (const item of sorted) {
      const right = item.x + item.w;
      if (right < sheetLength - 0.5) {
        steps.push({
          order: order++,
          type: "vertical",
          position: Math.round(right * 10) / 10,
          from: y,
          to: bottom,
          note: `Cortar ${item.name} (${item.partId})`,
        });
      }
    }
  }

  return steps;
}
