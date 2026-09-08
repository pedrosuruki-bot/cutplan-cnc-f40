import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CutParameters, OptimizationResult, Part, Project, Sheet, Placement } from "@/types";
import { createDemoProject, createEmptyProject } from "@/lib/demo";
import { projectRepository } from "@/lib/storage";
import { deriveFreeRects } from "@/lib/optimizer/maxrects";
import { buildCutSequence } from "@/lib/cut-sequence";
import { optimize } from "@/lib/optimizer";

interface ProjectContextValue {
  project: Project;
  result: OptimizationResult | null;
  stale: boolean;
  optimizing: boolean;
  hasSaved: boolean;
  setProject: (updater: (p: Project) => Project) => void;
  updateInfo: (patch: Partial<Pick<Project, "name" | "client" | "date" | "notes">>) => void;
  setSheets: (sheets: Sheet[]) => void;
  setParts: (parts: Part[]) => void;
  setParameters: (patch: Partial<CutParameters>) => void;
  newProject: () => void;
  replaceProject: (project: Project) => void;
  loadDemo: () => void;
  restoreSaved: () => void;
  save: () => void;
  runOptimize: () => Promise<OptimizationResult | null>;
  movePlacement: (
    layoutIndex: number,
    placementKey: string,
    x: number,
    y: number,
    rotated?: boolean,
  ) => boolean;
}
const ProjectContext = createContext<ProjectContextValue | null>(null);
function keyOf(p: Placement): string {
  return `${p.partId}:${p.instance}`;
}
function overlaps(a: Placement, b: Placement, gap: number): boolean {
  const buffer = Math.max(0, gap) / 2;
  const ax = a.x - buffer,
    ay = a.y - buffer,
    aw = a.w + buffer * 2,
    ah = a.h + buffer * 2;
  return ax < b.x + b.w && ax + aw > b.x && ay < b.y + b.h && ay + ah > b.y;
}
function sheetsForCost(project: Project): number {
  const sheets = project.sheets;
  return sheets.length
    ? sheets.reduce(
        (sum, s) =>
          sum + (s.length > 0 && s.width > 0 ? s.price / ((s.length * s.width) / 1e6) : 0),
        0,
      ) / sheets.length
    : 0;
}
export function ProjectProvider({ children }: { children: ReactNode }) {
  const [project, setProjectState] = useState<Project>(() => createEmptyProject());
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [stale, setStale] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  useEffect(() => {
    void projectRepository.loadPersistent().then((saved) => {
      if (saved) {
        setProjectState(saved.project);
        setResult(saved.result);
        setStale(false);
        setHasSaved(true);
      }
    });
  }, []);
  const setProject = useCallback(
    (updater: (p: Project) => Project) => {
      setProjectState((prev) => {
        const next = updater(prev);
        projectRepository.save(next, result);
        return next;
      });
      setStale(true);
    },
    [result],
  );
  const value = useMemo<ProjectContextValue>(
    () => ({
      project,
      result,
      stale,
      optimizing,
      hasSaved,
      setProject,
      updateInfo: (patch) => setProject((p) => ({ ...p, ...patch })),
      setSheets: (s) => setProject((p) => ({ ...p, sheets: s })),
      setParts: (parts) => setProject((p) => ({ ...p, parts })),
      setParameters: (patch) =>
        setProject((p) => ({ ...p, parameters: { ...p.parameters, ...patch } })),
      newProject: () => {
        if (
          typeof window !== "undefined" &&
          !window.confirm(
            "Criar um novo projeto? O projeto atual fica guardado, mas o resultado atual será substituído.",
          )
        )
          return;
        const p = createEmptyProject();
        setProjectState(p);
        setResult(null);
        projectRepository.save(p, null);
        setStale(false);
      },
      replaceProject: (p) => {
        setProjectState(p);
        setResult(null);
        projectRepository.save(p, null);
        setStale(false);
        setHasSaved(true);
      },
      loadDemo: () => {
        const p = createDemoProject();
        setProjectState(p);
        setResult(null);
        projectRepository.save(p, null);
        setStale(false);
      },
      restoreSaved: () => {
        const saved = projectRepository.load();
        if (saved) {
          setProjectState(saved.project);
          setResult(saved.result);
          setStale(false);
        }
      },
      save: () => {
        projectRepository.save(project, result);
        setHasSaved(true);
      },
      runOptimize: async () => {
        setOptimizing(true);
        await new Promise((r) => setTimeout(r, 20));
        try {
          const res = optimize(
            project.sheets,
            project.parts,
            project.parameters,
            project.offcutStock,
          );
          setResult(res);
          setStale(false);
          projectRepository.saveResult(project, res);
          setHasSaved(true);
          return res;
        } finally {
          setOptimizing(false);
        }
      },
      movePlacement: (layoutIndex, placementKey, x, y, rotated) => {
        if (!result) return false;
        const layout = result.layouts[layoutIndex];
        if (!layout) return false;
        const target = layout.placements.find((p) => keyOf(p) === placementKey);
        if (!target) return false;
        const margin = Math.max(0, project.parameters.margin),
          gap = Math.max(0, project.parameters.kerf) + Math.max(0, project.parameters.spacing);
        const nw = rotated === undefined ? target.w : rotated ? target.h : target.w;
        const nh = rotated === undefined ? target.h : rotated ? target.w : target.h;
        const next = {
          ...target,
          x: Math.max(margin, x),
          y: Math.max(margin, y),
          w: nw,
          h: nh,
          rotated: rotated ?? target.rotated,
        };
        if (
          next.x + next.w > layout.length - margin + 1e-6 ||
          next.y + next.h > layout.width - margin + 1e-6
        )
          return false;
        if (layout.placements.some((p) => p !== target && overlaps(next, p, gap))) return false;
        const placements = layout.placements.map((p) => (p === target ? next : p));
        const free = deriveFreeRects(
          layout.length - 2 * margin,
          layout.width - 2 * margin,
          placements.map((p) => ({ ...p, x: p.x - margin, y: p.y - margin })),
          gap,
        )
          .map((r) => ({ ...r, x: r.x + margin, y: r.y + margin }))
          .filter((r) => r.w >= 80 && r.h >= 80);
        const used = placements.reduce((s, p) => s + p.w * p.h, 0);
        const nextLayout = {
          ...layout,
          placements,
          offcuts: free,
          usedArea: used,
          usagePct: layout.sheetArea ? (used / layout.sheetArea) * 100 : 0,
          cuts: buildCutSequence(placements, layout.length, layout.width),
          cutMethod: "heuristic" as const,
          manual: true,
        };
        const layouts = result.layouts.map((l, i) => (i === layoutIndex ? nextLayout : l));
        const totalUsedArea = layouts.reduce((s, l) => s + l.usedArea, 0);
        const totalOffcutArea = layouts.reduce(
          (s, l) => s + l.offcuts.reduce((a, o) => a + o.w * o.h, 0),
          0,
        );
        const totalSheetArea = layouts.reduce((s, l) => s + l.sheetArea, 0);
        const totalCutLength = layouts.reduce(
          (s, l) => s + l.cuts.reduce((a, c) => a + Math.abs(c.to - c.from), 0),
          0,
        );
        const usagePct = totalSheetArea ? (totalUsedArea / totalSheetArea) * 100 : 0;
        const cuttingCost =
          (totalCutLength / 1000) * Math.max(0, project.parameters.sheetCostPerCut);
        const avgUnit = sheetsForCost(project);
        const offcutCredit =
          (totalOffcutArea / 1e6) *
          avgUnit *
          (Math.max(0, Math.min(100, project.parameters.offcutCreditPct)) / 100);
        const nextResult = {
          ...result,
          layouts,
          stats: {
            ...result.stats,
            totalUsedArea,
            totalOffcutArea,
            usagePct,
            wastePct: 100 - usagePct,
            totalCuts: layouts.reduce((s, l) => s + l.cuts.length, 0),
            totalCutLength,
            cuttingCost,
            offcutCredit,
            estimatedNetCost: Math.max(0, result.stats.totalCost + cuttingCost - offcutCredit),
          },
        };
        setResult(nextResult);
        projectRepository.saveResult(project, nextResult);
        return true;
      },
    }),
    [project, result, stale, optimizing, hasSaved, setProject],
  );
  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}
export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject deve ser usado dentro de ProjectProvider");
  return ctx;
}
