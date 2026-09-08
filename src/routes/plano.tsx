import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Download, FileCode2, Move, Printer } from "lucide-react";
import { useProject } from "@/hooks/useProject";
import { EmptyState, PageHeader, Panel, Stat, btn, btnPrimary } from "@/components/ui-bits";
import { SheetPlanView } from "@/components/SheetPlanView";
import { m2, num, pct } from "@/lib/format";
import { colorForPart } from "@/lib/plan-colors";
import { cn } from "@/lib/utils";
import type { OptimizationResult, Project } from "@/types";

export const Route = createFileRoute("/plano")({
  head: () => ({
    meta: [
      { title: "Plano de corte — CutPlan CNC" },
      {
        name: "description",
        content:
          "Desenho proporcional do plano de corte por chapa, com sobras e sequência de cortes.",
      },
      { property: "og:title", content: "Plano de corte — CutPlan CNC" },
      {
        property: "og:description",
        content: "Visualize o plano de corte chapa a chapa com zoom e detalhes.",
      },
    ],
  }),
  component: PlanPage,
});

function csvEscape(value: string | number): string {
  const text = String(value);
  return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCutList(project: Project, result: OptimizationResult): void {
  const byId = new Map(project.parts.map((p) => [p.id, p]));
  const header = [
    "Ordem",
    "Chapa",
    "ID",
    "Nome",
    "Comprimento mm",
    "Largura mm",
    "Rotação",
    "Material",
    "Fita de bordo",
    "Notas",
  ];
  const rows = result.layouts.flatMap((layout) =>
    layout.placements.map((p, i) => {
      const part = byId.get(p.partId);
      return [
        i + 1,
        layout.index,
        p.partId,
        p.name,
        Math.round(p.w),
        Math.round(p.h),
        p.rotated ? "90°" : "0°",
        part?.material ?? layout.material,
        part?.edgeBanding ?? "",
        part?.notes ?? "",
      ];
    }),
  );
  const csv = [header, ...rows].map((row) => row.map(csvEscape).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${
    project.name
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "cutplan"
  }-lista-corte.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function PlanPage() {
  const { project, result, movePlacement } = useProject();
  const [index, setIndex] = useState(0);
  const [showDims, setShowDims] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      setChecked(
        JSON.parse(window.localStorage.getItem(`cutplan.checked.${project.id}`) ?? "{}") as Record<
          string,
          boolean
        >,
      );
    } catch {
      setChecked({});
    }
  }, [project.id]);
  const cutRows = useMemo(
    () => result.layouts.flatMap((l) => l.placements.map((p) => ({ ...p, sheetIndex: l.index }))),
    [result],
  );
  const checkedCount = cutRows.reduce(
    (n, p) => n + (checked[`${p.partId}:${p.instance}:${p.sheetIndex}`] ? 1 : 0),
    0,
  );
  const toggleChecked = (key: string) =>
    setChecked((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(`cutplan.checked.${project.id}`, JSON.stringify(next));
      } catch {
        /* Ignore local checklist persistence errors. */
      }
      return next;
    });

  if (!result || result.layouts.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Plano de corte" />
        <EmptyState
          title="Ainda não há plano"
          description="Carrega em OTIMIZAR (canto inferior direito ou Ctrl+Enter) para gerar o plano de corte."
          action={
            <Link to="/otimizacao" className={btnPrimary}>
              Ir para Otimizar
            </Link>
          }
        />
      </div>
    );
  }

  const layout = result.layouts[Math.min(index, result.layouts.length - 1)]!;
  const detail = selected ? layout.placements.find((p) => p.partId === selected) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plano de corte"
        subtitle={`${result.stats.sheetsUsed} chapa(s) · ${result.stats.partsPlaced}/${result.stats.partsTotal} peças colocadas · sequência de referência para a serra; confirma a ordem na F40 antes do corte. Ajustes manuais ficam assinalados`}
        actions={
          <>
            <button className={btn} onClick={() => setShowDims((s) => !s)}>
              {showDims ? "Ocultar dimensões" : "Mostrar dimensões"}
            </button>
            <button className={btn} onClick={() => downloadCutList(project, result)}>
              <Download className="h-4 w-4" /> Lista CSV
            </button>
            <button className={btn} onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Imprimir
            </button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Aproveitamento"
          value={pct(result.stats.usagePct)}
          progress={result.stats.usagePct}
        />
        <Stat label="Desperdício" value={pct(result.stats.wastePct)} />
        <Stat label="Cortes estimados" value={num(result.stats.totalCuts)} />
        <Stat label="Área usada" value={m2(result.stats.totalUsedArea)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
        <div className="flex gap-2 overflow-x-auto lg:flex-col">
          {result.layouts.map((l, i) => (
            <button
              key={l.index}
              onClick={() => setIndex(i)}
              className={cn(
                "shrink-0 rounded-lg border p-2 text-left text-xs transition-colors",
                i === index
                  ? "border-primary bg-accent"
                  : "border-border bg-card hover:border-primary",
              )}
            >
              <p className="font-semibold">Chapa {l.index}</p>
              <p className="text-muted-foreground">
                {pct(l.usagePct)} · {l.placements.length} peças
              </p>
              <p className="text-[11px] text-muted-foreground">
                {l.manual ? "Manual" : "Guilhotina"}
              </p>
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <SheetPlanView
            layout={layout}
            showDimensions={showDims}
            selectedPartId={selected}
            onSelect={setSelected}
            editable
            onMove={(key, x, y) => movePlacement(index, key, x, y)}
          />
          <div className="rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
            <Move className="mr-1 inline h-3.5 w-3.5" /> Arrasta uma peça para ajustar manualmente.
            O sistema recusa sobreposições, margens e espaçamentos inválidos.
          </div>

          {detail ? (
            <Panel title={`${detail.partId} — ${detail.name}`}>
              <div className="grid gap-2 text-sm sm:grid-cols-4">
                <p>
                  Dimensões: {Math.round(detail.w)} × {Math.round(detail.h)} mm
                </p>
                <p>
                  Posição: x {Math.round(detail.x)} · y {Math.round(detail.y)} mm
                </p>
                <p>Rotação: {detail.rotated ? "90°" : "0°"}</p>
                <p>Material: {layout.material}</p>
              </div>
            </Panel>
          ) : null}

          <Panel title="Legenda">
            <div className="flex flex-wrap gap-3 text-xs">
              {Array.from(new Set(layout.placements.map((p) => p.partId))).map((id) => (
                <span key={id} className="inline-flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded"
                    style={{ background: colorForPart(id) }}
                  />
                  {id}
                </span>
              ))}
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded border border-dashed border-foreground/40" />
                sobra aproveitável
              </span>
            </div>
          </Panel>
        </div>
      </div>

      <Panel
        title={`Modo Corte F40 — chapa ${layout.index}`}
        description={`${layout.cuts.length} operações · primeiro rasgos/faixas, depois cortes no esquadro`}
      >
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-3 font-medium">#</th>
                <th className="py-2 pr-3 font-medium">Fase</th>
                <th className="py-2 pr-3 font-medium">Tipo</th>
                <th className="py-2 pr-3 font-medium">Posição (mm)</th>
                <th className="py-2 pr-3 font-medium">Descrição</th>
              </tr>
            </thead>
            <tbody>
              {layout.cuts.map((c) => (
                <tr key={c.order} className="border-b border-border/60">
                  <td className="py-1.5 pr-3">{c.order}</td>
                  <td className="py-1.5 pr-3">
                    {c.phase === "rip"
                      ? "Rasgo"
                      : c.phase === "crosscut"
                        ? "Esquadro"
                        : "Acabamento"}
                  </td>
                  <td className="py-1.5 pr-3">
                    {c.type === "horizontal" ? "Horizontal" : "Vertical"}
                  </td>
                  <td className="py-1.5 pr-3 tabular-nums">{c.position}</td>
                  <td className="py-1.5 pr-3 text-muted-foreground">{c.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        title={`Lista de corte · ${checkedCount}/${cutRows.length} conferidas`}
        description="Marca cada peça quando a tiveres cortado. O estado fica guardado neste projeto neste dispositivo."
      >
        <div className="max-h-[520px] overflow-auto rounded-lg border border-border">
          <table className="w-full min-w-[850px] text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="w-12 p-2">✓</th>
                <th className="p-2">Chapa</th>
                <th className="p-2">ID</th>
                <th className="p-2">Peça</th>
                <th className="p-2">Medida</th>
                <th className="p-2">Material</th>
                <th className="p-2">Fita</th>
              </tr>
            </thead>
            <tbody>
              {cutRows.map((p) => {
                const key = `${p.partId}:${p.instance}:${p.sheetIndex}`;
                const part = project.parts.find((x) => x.id === p.partId);
                const done = !!checked[key];
                return (
                  <tr key={key} className={cn("border-b border-border/60", done && "opacity-55")}>
                    <td className="p-2">
                      <button
                        className={cn(
                          btn,
                          "h-9 w-9 p-0",
                          done && "bg-success text-success-foreground",
                        )}
                        onClick={() => toggleChecked(key)}
                        aria-label={done ? "Desmarcar" : "Marcar cortada"}
                      >
                        {done ? <Check className="h-4 w-4" /> : null}
                      </button>
                    </td>
                    <td className="p-2 tabular-nums">{p.sheetIndex}</td>
                    <td className="p-2 font-mono font-semibold">{p.partId}</td>
                    <td className="p-2">
                      {p.name} <span className="text-xs text-muted-foreground">#{p.instance}</span>
                    </td>
                    <td className="p-2 font-mono tabular-nums">
                      {Math.round(p.w)} × {Math.round(p.h)} {p.rotated ? "↻" : ""}
                    </td>
                    <td className="p-2">{part?.material ?? ""}</td>
                    <td className="p-2">{part?.edgeBanding || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {result.unplaced.length ? (
        <Panel title="Peças não acomodadas">
          <ul className="space-y-1 text-sm">
            {result.unplaced.map((u) => (
              <li key={u.partId + u.reason}>
                {u.partId} · {u.name} · {u.length}×{u.width} mm ×{u.quantity} —{" "}
                <span className="text-destructive">{u.reason}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <div className="flex justify-end">
        <Link to="/relatorio" className={btnPrimary}>
          Ver relatório <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
