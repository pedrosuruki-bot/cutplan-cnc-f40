import { optimize, type OptimizationProgressSnapshot } from "@/lib/optimizer";
import type { CutParameters, OffcutStock, Part, Sheet } from "@/types";

interface OptimizeRequest {
  id: number;
  sheets: Sheet[];
  parts: Part[];
  parameters: CutParameters;
  offcutStock: OffcutStock[];
}

self.onmessage = (event: MessageEvent<OptimizeRequest>) => {
  const { id, sheets, parts, parameters, offcutStock } = event.data;
  try {
    const result = optimize(sheets, parts, parameters, offcutStock, (snapshot: OptimizationProgressSnapshot) => {
      self.postMessage({
        id,
        type: "progress",
        progress: snapshot.progress,
        elapsedMs: snapshot.elapsedMs,
        placed: snapshot.placed,
        total: snapshot.total,
        layouts: snapshot.layouts,
      });
    });
    self.postMessage({ id, type: "done", result });
  } catch (error) {
    self.postMessage({
      id,
      type: "error",
      message: error instanceof Error ? error.message : "Não foi possível otimizar o corte.",
    });
  }
};

export {};
