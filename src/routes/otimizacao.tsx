import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Play } from "lucide-react";
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
        content: "Defina espessura da lâmina, margem e o modo de otimização do plano de corte.",
      },
      { property: "og:title", content: "Otimizar corte — CutPlan CNC" },
      {
        property: "og:description",
        content: "Parâmetros de corte simples e três modos de otimização.",
      },
    ],
  }),
  component: OptimizePage,
});

const modes: { id: OptimizationMode; title: string; text: string }[] = [
  {
    id: "max-yield",
    title: "Máximo aproveitamento",
    text: "Menos desperdício de material possível.",
  },
  { id: "fewer-cuts", title: "Menos cortes", text: "Menos operações na serra, corte mais rápido." },
  { id: "simple", title: "Corte simples", text: "Layout em faixas, fácil de seguir na oficina." },
];

function OptimizePage() {
  const { project, setParameters, runOptimize, optimizing } = useProject();
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
    const res = await runOptimize();
    if (res) {
      toast.success(`Aproveitamento ${res.stats.usagePct.toFixed(1)}%`);
      navigate({ to: "/plano" });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Otimizar corte"
        subtitle="Configura uma vez e usa o Modo Corte para transformar o plano numa lista de operações para a F40."
      />

      <Panel title="Parâmetros de corte">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Espessura da lâmina (kerf, mm)" hint="Normalmente 3,2 mm">
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
              className={cn(btn, "w-full justify-start")}
              onClick={() => setParameters({ allowRotation: !p.allowRotation })}
            >
              {p.allowRotation ? "Permitido" : "Não permitido"}
            </button>
          </Field>
        </div>

        <button className={cn(btn, "mt-4 h-9")} onClick={() => setShowAdvanced((s) => !s)}>
          {showAdvanced ? "Ocultar avançado" : "Avançado"}
        </button>

        {showAdvanced ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Distância extra entre peças (mm)">
              <input
                type="number"
                step="0.1"
                min={0}
                className={inputClass}
                value={p.spacing}
                onChange={(e) => setParameters({ spacing: Number(e.target.value) })}
              />
            </Field>
            <Field label="Custo de corte (€/metro)">
              <input
                type="number"
                step="0.1"
                min={0}
                className={inputClass}
                value={p.sheetCostPerCut}
                onChange={(e) => setParameters({ sheetCostPerCut: Number(e.target.value) })}
              />
            </Field>
            <Field label="Valor recuperável das sobras (%)">
              <input
                type="number"
                step="1"
                min={0}
                max={100}
                className={inputClass}
                value={p.offcutCreditPct}
                onChange={(e) => setParameters({ offcutCreditPct: Number(e.target.value) })}
              />
            </Field>
            <Field label="Usar stock de sobras">
              <button
                className={cn(btn, "w-full justify-start")}
                onClick={() => setParameters({ useOffcutStock: !p.useOffcutStock })}
              >
                {p.useOffcutStock ? "Ativo — tentar sobras primeiro" : "Desativado"}
              </button>
            </Field>
          </div>
        ) : null}
      </Panel>

      <Panel
        title="Modo da máquina"
        description="Para a tua F40, usa o modo Altendorf: primeiro rasgos/faixas e depois cortes no esquadro. O plano evita layouts que dependam de encaixes impossíveis na serra."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {(["altendorf-f40", "free-layout"] as SawMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setParameters({ sawMode: mode })}
              className={cn(
                "rounded-xl border p-4 text-left",
                p.sawMode === mode
                  ? "border-primary bg-accent"
                  : "border-border bg-card hover:border-primary",
              )}
            >
              <p className="font-semibold">
                {mode === "altendorf-f40" ? "Altendorf F40 — Modo Corte" : "Layout livre"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "altendorf-f40"
                  ? "Planeia faixas e cortes sequenciais para executar manualmente."
                  : "Mais liberdade geométrica, menos orientação de execução."}
              </p>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Modo de otimização">
        <div className="grid gap-4 sm:grid-cols-3">
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => setParameters({ mode: m.id })}
              className={cn(
                "rounded-xl border p-4 text-left transition-colors",
                p.mode === m.id
                  ? "border-primary bg-accent"
                  : "border-border bg-card hover:border-primary",
              )}
            >
              <p className="font-semibold">{m.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{m.text}</p>
            </button>
          ))}
        </div>
      </Panel>

      {errors.length ? (
        <ul className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          {errors.map((e) => (
            <li key={e}>• {e}</li>
          ))}
        </ul>
      ) : null}

      <div className="flex justify-end">
        <button className={cn(btnPrimary, "h-12 px-8")} onClick={run} disabled={optimizing}>
          <Play className="h-4 w-4" />
          {optimizing ? "A OTIMIZAR…" : "OTIMIZAR CORTE"}
        </button>
      </div>
    </div>
  );
}
