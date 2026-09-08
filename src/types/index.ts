export type GrainDirection = "none" | "length" | "width";

export type OptimizationMode = "max-yield" | "fewer-cuts" | "simple";
export type SawMode = "altendorf-f40" | "free-layout";

export interface Sheet {
  id: string;
  name: string;
  material: string;
  length: number; // mm
  width: number; // mm
  thickness: number; // mm
  quantity: number;
  price: number; // por chapa
}

export interface Part {
  id: string;
  name: string;
  length: number; // mm
  width: number; // mm
  quantity: number;
  material: string;
  canRotate: boolean;
  grain: GrainDirection;
  edgeBanding: string;
  notes: string;
}

export interface Placement {
  partId: string;
  instance: number;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Offcut = Rect;

export interface OffcutStock {
  id: string;
  name: string;
  material: string;
  length: number;
  width: number;
  thickness: number;
  quantity: number;
  price: number;
}

export type CutMethod = "altendorf-f40" | "guillotine" | "heuristic";

export interface SheetLayout {
  sheetId: string;
  sheetName: string;
  material: string;
  index: number; // nº da chapa usada (1-based)
  length: number;
  width: number;
  thickness: number;
  placements: Placement[];
  offcuts: Offcut[];
  usedArea: number;
  sheetArea: number;
  usagePct: number;
  cuts: CutStep[];
  cutMethod: CutMethod;
  manual: boolean;
}

export interface UnplacedPart {
  partId: string;
  name: string;
  length: number;
  width: number;
  quantity: number;
  reason: string;
}

export interface CutStep {
  order: number;
  phase?: "rip" | "crosscut" | "trim";
  type: "horizontal" | "vertical";
  position: number; // mm no eixo perpendicular
  from: number;
  to: number;
  note: string;
}

export interface OptimizationStats {
  sheetsUsed: number;
  partsPlaced: number;
  partsTotal: number;
  totalSheetArea: number; // mm2
  totalUsedArea: number; // mm2
  totalOffcutArea: number;
  usagePct: number;
  wastePct: number;
  totalCuts: number;
  totalCost: number;
  totalCutLength: number; // mm
  cuttingCost: number;
  offcutCredit: number;
  estimatedNetCost: number;
}

export interface CutParameters {
  kerf: number;
  margin: number;
  spacing: number;
  allowRotation: boolean;
  mode: OptimizationMode;
  sawMode: SawMode;
  sheetCostPerCut: number; // EUR por metro linear de corte
  offcutCreditPct: number; // percentagem do valor estimado recuperável das sobras
  useOffcutStock: boolean;
}

export interface OptimizationResult {
  layouts: SheetLayout[];
  unplaced: UnplacedPart[];
  stats: OptimizationStats;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  date: string;
  notes: string;
  sheets: Sheet[];
  parts: Part[];
  parameters: CutParameters;
  offcutStock: OffcutStock[];
}
