import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, Gauge, Play, RotateCw, Scissors, Settings2 } from "lucide-react";
import { useProject } from "@/hooks/useProject";
import { Field, PageHeader, Panel, btn, btnPrimary, inputClass } from "@/components/ui-bits";
import type { OptimizationMode } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/otimizacao")({
  head: () => ({ meta: [{ title: "Otimizar — CutPlan CNC" }, { name: "description", content: "Encontra um plano de corte prático para a produção diária." }] }),
  component: OptimizePage,
});

const modes: { id: OptimizationMode; title: string; text: string; icon: typeof Gauge }[] = [
  { id: "max-yield", title: "Aproveitamento", text: "Menos desperdício.", icon: Gauge },
  { id: "fewer-cuts", title: "Menos cortes", text: "Execução mais simples.", icon: Scissors },
  { id: "simple", title: "Simples", text: "Plano fácil de seguir.", icon: Settings2 },
];
function mm(v: number) { return new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 0 }).format(v); }
function timeLabel(ms: number) { const seconds = Math.floor(ms / 1000); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }

function OptimizePage() {
  const { project, setParameters, runOptimize, optimizing, optimizationProgress, optimizationElapsedMs, optimizationPlaced, optimizationTotal, optimizationLayouts, result } = useProject();
  const p = project.parameters;
  const [advanced, setAdvanced] = useState(false);
  const navigate = useNavigate();
  const totalParts = useMemo(() => project.parts.reduce((s, part) => s + part.quantity, 0), [project.parts]);
  const totalSheets = useMemo(() => project.sheets.reduce((s, sheet) => s + sheet.quantity, 0), [project.sheets]);
  const liveLayouts = optimizationLayouts.filter((layout) => layout.placements.length > 0).slice(0, 2);
  const progress = optimizing ? optimizationProgress : result ? 100 : 0;
  const placed = optimizing ? optimizationPlaced : result?.stats.partsPlaced ?? 0;
  const total = optimizing ? optimizationTotal : totalParts;

  const run = async () => {
    if (!project.name.trim()) { toast.error("Dá um nome ao trabalho primeiro."); navigate({ to: "/" }); return; }
    if (!project.parts.some((part) => part.quantity > 0)) { toast.error("Adiciona pelo menos uma peça."); navigate({ to: "/pecas" }); return; }
    if (!project.sheets.some((sheet) => sheet.quantity > 0)) { toast.error("Adiciona pelo menos uma chapa."); navigate({ to: "/chapas" }); return; }
    try { const res = await runOptimize(); if (res) navigate({ to: "/plano" }); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível otimizar o corte."); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Otimizar" subtitle={`${project.name || "Trabalho novo"} · ${totalParts} peças · ${totalSheets} chapas disponíveis`} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Peças</p><p className="mt-1 text-2xl font-bold tabular-nums">{totalParts}</p></div>
        <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Chapas</p><p className="mt-1 text-2xl font-bold tabular-nums">{totalSheets}</p></div>
        <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Último plano</p><p className="mt-1 text-base font-semibold">{result ? `${result.stats.partsPlaced}/${result.stats.partsTotal} peças` : "Ainda não calculado"}</p></div>
      </div>
      <Panel title="Como queres cortar?" description="Escolhe uma prioridade e segue para a máquina.">
        <div className="grid gap-2 sm:grid-cols-3">
          {modes.map((mode) => { const Icon = mode.icon; const active = p.mode === mode.id; return <button key={mode.id} type="button" onClick={() => setParameters({ mode: mode.id })} className={cn("flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors", active ? "border-primary bg-accent" : "border-border hover:bg-accent/60")}><span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", active ? "bg-primary text-primary-foreground" : "bg-muted")}>{active ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}</span><span className="min-w-0"><span className="block font-semibold">{mode.title}</span><span className="block truncate text-xs text-muted-foreground">{mode.text}</span></span></button>; })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Máquina: Altendorf F40. O plano prioriza uma execução prática na oficina.</p>
      </Panel>
      <Panel title="Definição rápida" description="Normalmente, estes três valores chegam.">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Kerf da lâmina (mm)" hint="Ex.: 3,2"><input type="number" step="0.1" min={0} className={inputClass} value={p.kerf} onChange={(e) => setParameters({ kerf: Number(e.target.value) })} /></Field>
          <Field label="Margem (mm)" hint="Reserva na borda"><input type="number" step="1" min={0} className={inputClass} value={p.margin} onChange={(e) => setParameters({ margin: Number(e.target.value) })} /></Field>
          <Field label="Rotação"><button type="button" className={cn(btn, "w-full justify-start")} onClick={() => setParameters({ allowRotation: !p.allowRotation })}>{p.allowRotation ? "90° permitidos" : "90° bloqueados"}</button></Field>
        </div>
        <button type="button" className="mt-3 text-sm font-medium text-primary hover:underline" onClick={() => setAdvanced((value) => !value)}>{advanced ? "Ocultar opções avançadas" : "Mostrar opções avançadas"}</button>
        {advanced ? <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Field label="Espaçamento extra (mm)"><input type="number" step="0.1" min={0} className={inputClass} value={p.spacing} onChange={(e) => setParameters({ spacing: Number(e.target.value) })} /></Field>
          <Field label="Custo de corte (€/m)"><input type="number" step="0.1" min={0} className={inputClass} value={p.sheetCostPerCut} onChange={(e) => setParameters({ sheetCostPerCut: Number(e.target.value) })} /></Field>
          <Field label="Usar stock de sobras"><button type="button" className={cn(btn, "w-full justify-start")} onClick={() => setParameters({ useOffcutStock: !p.useOffcutStock })}>{p.useOffcutStock ? "Ativo" : "Desativado"}</button></Field>
        </div> : null}
      </Panel>
      {optimizing ? <Panel title="A encontrar a melhor solução" description="O cálculo continua em segundo plano e vais vendo o melhor plano encontrado.">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm font-semibold"><span>{progress}%</span><span className="text-muted-foreground">{timeLabel(optimizationElapsedMs)}</span></div>
          <div className="h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${progress}%` }} /></div>
          <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Peças colocadas</p><p className="mt-1 text-lg font-semibold">{placed}/{total}</p></div><div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Chapas visíveis</p><p className="mt-1 text-lg font-semibold">{liveLayouts.length || "…"}</p></div><div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Método</p><p className="mt-1 text-lg font-semibold">F40</p></div></div>
          {liveLayouts.length ? <div className="grid gap-3 md:grid-cols-2">{liveLayouts.map((layout) => <div key={layout.index} className="rounded-xl border border-border bg-card p-3"><div className="mb-2 flex items-center justify-between text-xs font-semibold"><span>Chapa {layout.index}</span><span className="text-muted-foreground">{layout.placements.length} peças</span></div><LiveSheet layout={layout} /></div>)}</div> : null}
        </div>
      </Panel> : null}
      <div className="sticky bottom-3 z-20 flex justify-center sm:static sm:justify-end"><button type="button" className={cn(btnPrimary, "h-12 w-full px-8 shadow-lg sm:w-auto")} onClick={() => void run()} disabled={optimizing}>{optimizing ? <RotateCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{optimizing ? "A procurar…" : "Encontrar melhor corte"}</button></div>
    </div>
  );
}

function LiveSheet({ layout }: { layout: { length: number; width: number; placements: Array<{ x: number; y: number; w: number; h: number; partId: string }> } }) {
  return <div className="relative overflow-hidden rounded-lg border border-border bg-background" style={{ aspectRatio: `${layout.length} / ${layout.width}`, maxHeight: 260 }}>{layout.placements.map((piece, index) => { const left = (piece.x / layout.length) * 100; const top = (piece.y / layout.width) * 100; const width = (piece.w / layout.length) * 100; const height = (piece.h / layout.width) * 100; return <div key={`${piece.partId}-${index}`} className="absolute overflow-hidden rounded-[2px] border border-black/15 bg-primary/75 p-0.5 text-[8px] font-semibold text-primary-foreground" style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }} title={`${piece.partId} · ${mm(piece.w)} × ${mm(piece.h)} mm`}><span className="truncate">{piece.partId}</span></div>; })}<div className="pointer-events-none absolute bottom-1 right-1 rounded bg-background/85 px-1.5 py-0.5 text-[9px] text-muted-foreground">{mm(layout.length)} × {mm(layout.width)} mm</div></div>;
}
