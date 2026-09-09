import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Gauge, Layers3, Play, RotateCw, Scissors } from "lucide-react";
import { useProject } from "@/hooks/useProject";
import { Field, PageHeader, Panel, btn, btnPrimary, inputClass } from "@/components/ui-bits";
import type { OptimizationMode, SawMode } from "@/types";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

export const Route = createFileRoute("/otimizacao")({
  head: () => ({
    meta: [
      { title: "Otimizar corte — CutPlan CNC" },
      {
        name: "description",
        content: "Encontra uma solução de corte eficiente para a tua chapa e prepara o plano para a F40.",
      },
      { property: "og:title", content: "Otimizar corte — CutPlan CNC" },
      {
        property: "og:description",
        content: "Otimização de corte com validação e preparação para a Altendorf F40.",
      },
    ],
  }),
  component: OptimizePage,
});

const modes: { id: OptimizationMode; title: string; text: string; icon: typeof Gauge }[] = [
  {
    id: "max-yield",
    title: "Melhor aproveitamento",
    text: "Prioriza o uso da chapa e o menor desperdício.",
    icon: Gauge,
  },
  {
    id: "fewer-cuts",
    title: "Menos cortes",
    text: "Procura uma solução com menos operações de serra.",
    icon: Scissors,
  },
  {
    id: "simple",
    title: "Corte simples",
    text: "Prioriza um plano fácil de seguir na oficina.",
    icon: Layers3,
  },
];

function progressLabel(progress: number): string {
  if (progress < 15) return "A preparar peças e materiais...";
  if (progress < 35) return "A analisar rotações e combinações...";
  if (progress < 60) return "A procurar padrões de corte melhores...";
  if (progress < 80) return "A melhorar o aproveitamento da chapa...";
  if (progress < 100) return "A validar a melhor solução encontrada...";
  return "Solução encontrada!";
}

function OptimizePage() {
  const { project, setParameters, runOptimize, optimizing, optimizationProgress, result } = useProject();
  const p = project.parameters;
  const [showAdvanced, setShowAdvanced] = useState(false);
  const navigate = useNavigate();

  const errors: string[] = [];
  if (p.kerf < 0) errors.push("A espessura da lâmina não pode ser negativa.");
  if (p.margin < 0) errors.push("A margem não pode ser negativa.");
  if (project.sheets.length === 0) errors.push("Adiciona pelo menos uma chapa.");
  if (project.parts.length === 0) errors.push("Adiciona pelo menos uma peça.");

  const run = async () => {
    if (errors.length) {
      toast.error(errors[0]!);
      return;
    }
    try {
      const res = await runOptimize();
      if (res) {
        toast.success(
          `${res.stats.sheetsUsed} chapa(s) · ${res.stats.usagePct.toFixed(1)}% aproveitamento`,
        );
        navigate({ to: "/plano" });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível otimizar o corte.");
    }
  };

  const completionStats = result
    ? `${result.stats.sheetsUsed} chapa(s) · ${result.stats.usagePct.toFixed(1)}% aproveitamento`
    : "Pronto para otimizar";

  return (
    <>
      <div className="space-y-5">
        <PageHeader
          title="Otimizar corte"
          subtitle="Configura apenas o necessário. O CutPlan procura combinações eficientes e prepara o plano para a F40."
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Scissors className="h-4 w-4" /> Peças
            </div>
            <p className="mt-2 text-2xl font-bold">{project.parts.reduce((s, part) => s + part.quantity, 0)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Layers3 className="h-4 w-4" /> Chapas disponíveis
            </div>
            <p className="mt-2 text-2xl font-bold">{project.sheets.reduce((s, sheet) => s + sheet.quantity, 0)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" /> Estado
            </div>
            <p className="mt-2 truncate text-base font-semibold">{completionStats}</p>
          </div>
        </div>

        <Panel
          title="Modo da máquina"
          description="Para a tua F40, usa o modo Altendorf para obter um plano prático de executar."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {(["altendorf-f40", "free-layout"] as SawMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setParameters({ sawMode: mode })}
                className={cn(
                  "rounded-xl border p-4 text-left transition-all",
                  p.sawMode === mode
                    ? "border-primary bg-accent shadow-sm"
                    : "border-border bg-card hover:border-primary/60",
                )}
              >
                <p className="font-semibold">
                  {mode === "altendorf-f40" ? "Altendorf F40 — Modo Corte" : "Layout livre"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {mode === "altendorf-f40"
                    ? "Padrões sequenciais pensados para execução manual."
                    : "Mais liberdade geométrica para aproveitar espaço."}
                </p>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Modo de otimização" description="Escolhe o resultado que mais importa neste trabalho.">
          <div className="grid gap-3 md:grid-cols-3">
            {modes.map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setParameters({ mode: m.id })}
                  className={cn(
                    "rounded-xl border p-4 text-left transition-all",
                    p.mode === m.id
                      ? "border-primary bg-accent shadow-sm"
                      : "border-border bg-card hover:border-primary/60",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span className="font-semibold">{m.title}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{m.text}</p>
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel title="Parâmetros de corte">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Kerf da lâmina (mm)" hint="Normalmente 3,2 mm">
              <input
                type="number"
                step="0.1"
                min={0}
                className={inputClass}
                value={p.kerf}
                onChange={(e) => setParameters({ kerf: Number(e.target.value) })}
              />
            </Field>
            <Field label="Margem da chapa (mm)">
              <input
                type="number"
                step="1"
                min={0}
                className={inputClass}
                value={p.margin}
                onChange={(e) => setParameters({ margin: Number(e.target.value) })}
              />
            </Field>
            <Field label="Rodar peças 90°">
              <button
                type="button"
                className={cn(btn, "w-full justify-start")}
                onClick={() => setParameters({ allowRotation: !p.allowRotation })}
              >
                {p.allowRotation ? "Permitido" : "Não permitido"}
              </button>
            </Field>
          </div>

          <button type="button" className={cn(btn, "mt-4 h-9")} onClick={() => setShowAdvanced((s) => !s)}>
            {showAdvanced ? "Ocultar avançado" : "Mostrar opções avançadas"}
          </button>

          {showAdvanced ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Distância extra entre peças (mm)">
                <input type="number" step="0.1" min={0} className={inputClass} value={p.spacing} onChange={(e) => setParameters({ spacing: Number(e.target.value) })} />
              </Field>
              <Field label="Custo de corte (€/metro)">
                <input type="number" step="0.1" min={0} className={inputClass} value={p.sheetCostPerCut} onChange={(e) => setParameters({ sheetCostPerCut: Number(e.target.value) })} />
              </Field>
              <Field label="Valor recuperável das sobras (%)">
                <input type="number" step="1" min={0} max={100} className={inputClass} value={p.offcutCreditPct} onChange={(e) => setParameters({ offcutCreditPct: Number(e.target.value) })} />
              </Field>
              <Field label="Usar stock de sobras">
                <button type="button" className={cn(btn, "w-full justify-start")} onClick={() => setParameters({ useOffcutStock: !p.useOffcutStock })}>
                  {p.useOffcutStock ? "Ativo — usar sobras" : "Desativado"}
                </button>
              </Field>
            </div>
          ) : null}
        </Panel>

        {errors.length ? <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">{errors[0]}</div> : null}

        <div className="flex justify-end pb-2">
          <button type="button" className={cn(btnPrimary, "h-12 w-full px-8 sm:w-auto")} onClick={run} disabled={optimizing}>
            <Play className="h-4 w-4" />
            {optimizing ? "A PROCURAR A MELHOR SOLUÇÃO…" : "ENCONTRAR MELHOR CORTE"}
          </button>
        </div>
      </div>

      {optimizing ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/45 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="optimization-title">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-primary">Otimização em curso</p>
                <h2 id="optimization-title" className="mt-1 text-xl font-bold">A encontrar a melhor solução</h2>
                <p className="mt-2 text-sm text-muted-foreground">{progressLabel(optimizationProgress)}</p>
              </div>
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent">
                <RotateCw className="h-5 w-5 animate-spin" />
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between text-sm font-semibold">
                <span>Progresso da pesquisa</span>
                <span>{optimizationProgress}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out" style={{ width: `${optimizationProgress}%` }} />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-muted-foreground">Peças</p>
                <p className="mt-1 font-semibold">{project.parts.reduce((s, part) => s + part.quantity, 0)}</p>
              </div>
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-muted-foreground">Objetivo</p>
                <p className="mt-1 truncate font-semibold">{modes.find((m) => m.id === p.mode)?.title}</p>
              </div>
            </div>

            <p className="mt-5 text-xs text-muted-foreground">
              O cálculo corre em segundo plano para manter a interface disponível.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
