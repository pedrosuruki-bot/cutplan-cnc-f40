import type { OptimizationResult, Project, CutParameters } from "@/types";
import { defaultParameters } from "@/lib/demo";
const KEY = "cutplan.project.v2";
const DB_NAME = "cutplan-cnc";
const STORE = "projects";

interface RecordData { project: Project; result: OptimizationResult | null; updatedAt: string }
function normalizeProject(project: Project): Project {
  const parameters: CutParameters = { ...defaultParameters, ...(project.parameters ?? {}) };
  if (parameters.sawMode !== "altendorf-f40" && parameters.sawMode !== "free-layout") parameters.sawMode = "altendorf-f40";
  parameters.useOffcutStock = parameters.useOffcutStock !== false;
  return { ...project, parameters, offcutStock: Array.isArray(project.offcutStock) ? project.offcutStock : [] };
}
function readLocal(): RecordData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RecordData> & Partial<Project>;
    if (parsed.project && typeof parsed.project === "object") return { ...(parsed as RecordData), project: normalizeProject(parsed.project) };
    // Migração do formato v1, que guardava o Project diretamente.
    if (parsed.id && Array.isArray(parsed.sheets) && Array.isArray(parsed.parts)) {
      const project = normalizeProject(parsed as unknown as Project);
      const record: RecordData = { project, result: null, updatedAt: new Date().toISOString() };
      writeLocal(record);
      return record;
    }
    return null;
  } catch { return null; }
}
function writeLocal(record: RecordData): void { try { localStorage.setItem(KEY, JSON.stringify(record)); } catch { /* fallback remains in memory */ } }
function openDb(): Promise<IDBDatabase | null> { if (typeof indexedDB === "undefined") return Promise.resolve(null); return new Promise((resolve) => { const req = indexedDB.open(DB_NAME, 1); req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" }); req.onsuccess = () => resolve(req.result); req.onerror = () => resolve(null); }); }
export const projectRepository = {
  load(): RecordData | null { return readLocal(); },
  async loadPersistent(): Promise<RecordData | null> {
    const local = readLocal();
    const db = await openDb();
    if (!db) return local;
    return new Promise((resolve) => { const req = db.transaction(STORE, "readonly").objectStore(STORE).get("current"); req.onsuccess = () => resolve((req.result as RecordData | undefined) ?? local); req.onerror = () => resolve(local); });
  },
  save(project: Project, result: OptimizationResult | null = null): void {
    const existing = readLocal();
    const record: RecordData = { project, result: result ?? existing?.result ?? null, updatedAt: new Date().toISOString() };
    writeLocal(record);
    void openDb().then((db) => { if (!db) return; const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).put({ id: "current", ...record }); });
  },
  saveResult(project: Project, result: OptimizationResult | null): void { this.save(project, result); },
  clear(): void { if (typeof window !== "undefined") localStorage.removeItem(KEY); void openDb().then((db) => { if (!db) return; db.transaction(STORE, "readwrite").objectStore(STORE).delete("current"); }); },
};
