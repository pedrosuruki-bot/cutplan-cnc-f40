import type { Project } from "@/types";
import { defaultParameters } from "@/lib/demo";

export interface ProjectBackup {
  version: 1;
  exportedAt: string;
  project: Project;
}

export function exportProjectJson(project: Project): void {
  const payload: ProjectBackup = { version: 1, exportedAt: new Date().toISOString(), project };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeName(project.name) || "cutplan-projeto"}.cutplan.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export async function importProjectJson(file: File): Promise<Project> {
  const text = await file.text();
  const raw: unknown = JSON.parse(text);
  const candidate =
    raw && typeof raw === "object" && "project" in raw
      ? (raw as { project?: unknown }).project
      : raw;
  if (!candidate || typeof candidate !== "object") throw new Error("Ficheiro de projeto inválido.");
  const p = candidate as Partial<Project>;
  if (typeof p.name !== "string" || !Array.isArray(p.sheets) || !Array.isArray(p.parts))
    throw new Error("O ficheiro não contém um projeto CutPlan válido.");
  const parameters = { ...defaultParameters, ...(p.parameters ?? {}) };
  if (parameters.sawMode !== "altendorf-f40" && parameters.sawMode !== "free-layout")
    parameters.sawMode = "altendorf-f40";
  parameters.useOffcutStock = parameters.useOffcutStock !== false;
  return {
    id: typeof p.id === "string" ? p.id : crypto.randomUUID(),
    name: p.name,
    client: typeof p.client === "string" ? p.client : "",
    date: typeof p.date === "string" ? p.date : new Date().toISOString().slice(0, 10),
    notes: typeof p.notes === "string" ? p.notes : "",
    sheets: p.sheets,
    parts: p.parts,
    parameters,
    offcutStock: Array.isArray(p.offcutStock)
      ? (p.offcutStock.filter((o) => o && typeof o === "object") as Project["offcutStock"])
      : [],
  } as Project;
}

function safeName(value: string): string {
  return value
    .trim()
    .replace(/[^\p{L}\p{N}_-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
