import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Gauge, Layers3, Play, RotateCw, Scissors } from "lucide-react";
import { useProject } from "@/hooks/useProject";
import { Field, PageHeader, Panel, btn, btnPrimary, inputClass } from "@/components/ui-bits";
import type { OptimizationMode, SawMode, SheetLayout } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/otimizacao")({
  head: () => ({
    meta: [
      { title: "Otimizar corte — CutPlan CNC" },
      {
        name: "description",
        content: "Calcula rapidamente o melhor plano de corte para o trabalho diário de oficina.",
      },
    ],
  }),
  component: OptimizePage,
});

const modes: { id: OptimizationMode; title: string; text: string; icon: typeof Gauge }[] = [
  { id: "max-yield", title: "Melhor aproveitamento", text: "Menos desperdício.", icon: Gauge },
  { id: "fewer-cuts", title: "Menos cortes", text: "Mais simples de executar.", icon: Scissors },
  { id: "simple", title: "Corte simples", text: "Plano direto para a oficina.", icon: Layers3 },
];

function progressLabel(progress: number): string {
  if (progress < 15) return "A preparar peças e materiais...";
  if (progress < 35) return "A testar combinações...";
  if (progress < 60) return "A procurar padrões melhores...";
  if (progress < 80) return "A melhorar o aproveitamento...";
  if (progress < 100) return "A refinar e validar a solução...";
  return "Solução encontrada.";
}

function elapsedLabel(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function LiveLayout({ layout }: { layout: SheetLayout }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold">{layout.sheetName}</span>
        <span className="text-muted-foreground">
          {layout.placements.length} peças · {layout.usagePct.toFixed(1)}%
        </span>
      </div>
      <div
        className="relative mx-auto aspect-[2840/2100] max-h-48 w-full overflow-hidden rounded-md border border-border bg-muted"
        aria-label={`Pré-visualização da ${layout.sheetName}`}
      >
        {layout.placements.map((p) => (
          <div
            key={`${p.partId}:${p.instance}`}
            className="absolute overflow-hidden rounded-[2px] border border-white/70 bg-primary/80 text-[8px] font-semibold leading-none text-primary-foreground"
            style={{
              left: `${(p.x / layout.length) * 100}%`,
              top: `${(p.y / layout.width) * 100}%`,
              width: `${(p.w / layout.length) * 100}%`,
              height: `${(p.h / layout.width) * 100}%`,
            }}
            title={`${p.partId} · ${Math.round(p.w)} × ${Math.round(p.h)} mm`}
          >
            <span className="block truncate p-0.5">{p.partId}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OptimizePage() {
  const {
    project,
    setParameters,
    runOptimize,
    optimizing,
    optimizationProgress,
    optimizationElapsedMs,
    optimizationPlaced,
    optimizationTotal,
    optimizationLayouts,
    result,
  } = useProject();
  const p = project.parameters;
  const [showAdvanced, setShowAdvanced] = useState(false);
  const navigate = useNavigate();

  const partTotal = project.parts.reduce((s, part) => s + part.quantity, 0);
  const sheetTotal = project.sheets.reduce((s, sheet) => s + sheet.quantity, 0);
  const errors: string[] = [];
  if (p.kerf < 0) errors.push("A espessura da lâmina não pode ser negativa.");
  if (p.margin < 0) errors.push("A margem não pode ser negativa.");
  if (!project.sheets.length) errors.push("Adiciona pelo menos uma chapa.");
  if (!project.parts.length) errors.push("Adiciona pelo menos uma peça.");

  const run = async () => {
    if (errors.length) {
      toast.error(errors[0]!);
      return;
    }
    try {
      const res = await runOptimize();
      if (res) {
        toast.success(`${res.stats.partsPlaced}/${res.stats.partsTotal} peças · ${res.stats.usagePct.toFixed(1)}% aproveitamento`);
        navigate({ to: "/plano" });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível otimizar o corte.");
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Otimizar corte"
        subtitle="Prepara o trabalho, encontra a melhor solução e vê o plano a formar-se em tempo real."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Peças</p>
          <p className="mt-1 text-2xl font-bold">{partTotal}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Chapas disponíveis</p>
          <p className="mt-1 text-2xl font-bold">{sheetTotal}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Último resultado</p>
          <p className="mt-1 text-base font-bold">{result ? `${result.stats.partsPlaced}/${result.stats.partsTotal}` : "Ainda não calculado"}</p>
        </div>
      </div>

      <Panel title="Como queres cortar?" description="Escolhe uma vez. O resto fica automático.">
        <div className="grid gap-2 md:grid-cols-3">
          {modes.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setParameters({ mode: m.id })}
                className={cn(
                  "rounded-xl border p-4 text-left transition-all",
                  p.mode === m.id ? "border-primary bg-accent shadow-sm" : "border-border bg-card hover:border-primary/60",
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span className="font-semibold">{m.title}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{m.text}</p>
              </button>
            );
          })}
        </div>
      </Panel>

      <Panel title="Máquina" description="Para uma Altendorf F40, mantém o modo recomendado.">
        <div className="grid gap-2 sm:grid-cols-2">
          {(["altendorf-f40", "free-layout"] as SawMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setParameters({ sawMode: mode })}
              className={cn(
                "rounded-xl border p-3 text-left",
                p.sawMode === mode ? "border-primary bg-accent" : "border-border bg-card hover:border-primary/60",
              )}
            >
              <p className="font-semibold">{mode === "altendorf-f40" ? "Altendorf F40" : "Layout livre"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "altendorf-f40" ? "Plano sequencial para execução na oficina." : "Mais liberdade geométrica."}
              </p>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="O essencial">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Kerf da lâmina (mm)" hint="Ex.: 3,2">
            <input type="number" step="0.1" min={0} className={inputClass} value={p.kerf} onChange={(e) => setParameters({ kerf: Number(e.target.value) })} />
          </Field>
          <Field label="Margem da chapa (mm)">
            <input type="number" step="1" min={0} className={inputClass} value={p.margin} onChange={(e) => setParameters({ margin: Number(e.target.value) })} />
          </Field>
          <Field label="Rodar peças 90°">
            <button type="button" className={cn(btn, "w-full justify-start")} onClick={() => setParameters({ allowRotation: !p.allowRotation })}>
              {p.allowRotation ? "Permitido" : "Não permitido"}
            </button>
          </Field>
        </div>
        <button type="button" className={cn(btn, "mt-4 h-9")} onClick={() => setShowAdvanced((s) => !s)}>
          {showAdvanced ? "Ocultar opções avançadas" : "Mostrar opções avançadas"}
        </button>
        {showAdvanced ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Distância extra entre peças (mm)">
              <input type="number" step="0.1" min={0} className={inputClass} value={p.spacing} onChange={(e) => setParameters({ spacing: Number(e.target.value) })} />
            </Field>
            <Field label="Custo de corte (€/metro)">
              <input type="number" step="0.1" min={0} className={inputClass} value={p.sheetCostPerCut} onChange={(e) => setParameters({ sheetCostPerCut: Number(e.target.value) })} />
            </Field>
            <Field label="Crédito de sobras (%)">
              <input type="number" step="1" min={0} max={100} className={inputClass} value={p.offcutCreditPct} onChange={(e) => setParameters({ offcutCreditPct: Number(e.target.value) })} />
            </Field>
            <Field label="Usar stock de sobras">
              <button type="button" className={cn(btn, "w-full justify-start")} onClick={() => setParameters({ useOffcutStock: !p.useOffcutStock })}>
                {p.useOffcutStock ? "Ativo" : "Desativado"}
              </button>
            </Field>
          </div>
        ) : null}
      </Panel>

      {errors.length ? <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">{errors[0]}</div> : null}

      <button type="button" className={cn(btnPrimary, "h-13 w-full justify-center px-8 text-base sm:h-14")} onClick={run} disabled={optimizing || !!errors.length}>
        <Play className="h-4 w-4" />
        {optimizing ? "A PROCURAR A MELHOR SOLUÇÃO…" : "ENCONTRAR MELHOR CORTE"}
      </button>

      {optimizing ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/45 p-3 backdrop-blur-[2px]">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-4 shadow-2xl sm:p-6" role="dialog" aria-modal="true" aria-labelledby="optimization-title">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-primary">Otimização em curso</p>
                <h2 id="optimization-title" className="mt-1 text-xl font-bold sm:text-2xl">A encontrar a melhor solução</h2>
                <p className="mt-1 text-sm text-muted-foreground">{progressLabel(optimizationProgress)}</p>
              </div>
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent">
                <RotateCw className="h-5 w-5 animate-spin" />
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-sm font-semibold">
                <span>Pesquisa</span>
                <span>{optimizationProgress}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${optimizationProgress}%` }} />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-lg border border-border bg-background p-3"><p className="text-muted-foreground">Peças</p><p className="mt-1 font-bold">{optimizationPlaced}/{optimizationTotal || partTotal}</p></div>
              <div className="rounded-lg border border-border bg-background p-3"><p className="text-muted-foreground">Tempo</p><p className="mt-1 font-bold">{elapsedLabel(optimizationElapsedMs)}</p></div>
              <div className="rounded-lg border border-border bg-background p-3"><p className="text-muted-foreground">Chapas</p><p className="mt-1 font-bold">{optimizationLayouts.length || "…"}</p></div>
            </div>

            <div className="mt-5 space-y-3">
              {optimizationLayouts.length ? (
                optimizationLayouts.slice(-2).map((layout) => <LiveLayout key={`${layout.sheetId}:${layout.index}`} layout={layout} />)
              ) : (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  A primeira solução está a ser encontrada. Assim que aparecer uma melhoria, ela ficará visível aqui.
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              A pesquisa continua em segundo plano. O melhor resultado encontrado fica sempre guardado.
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
