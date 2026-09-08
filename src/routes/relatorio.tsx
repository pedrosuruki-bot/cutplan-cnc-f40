import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, FileCode2, FileType2, Printer } from "lucide-react";
import { useProject } from "@/hooks/useProject";
import { EmptyState, PageHeader, Panel, Stat, btn, btnPrimary } from "@/components/ui-bits";
import { exportProjectDetailsPdf, exportSheetDrawingPdf } from "@/lib/pdf/split";
import { eur, m2, num, pct } from "@/lib/format";
import { exportLayoutDxf, exportLayoutSvg } from "@/lib/vector-export";

export const Route = createFileRoute("/relatorio")({
  head: () => ({
    meta: [
      { title: "Relatório — CutPlan CNC" },
      {
        name: "description",
        content:
          "Relatório imprimível do plano de corte: parâmetros, peças, chapas, sobras e estatísticas.",
      },
      { property: "og:title", content: "Relatório — CutPlan CNC" },
      {
        property: "og:description",
        content: "Relatório completo pronto a imprimir ou exportar em PDF.",
      },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
  const { project, result } = useProject();

  if (!result) {
    return (
      <div className="space-y-6">
        <PageHeader title="Relatório" />
        <EmptyState
          title="Sem resultados para reportar"
          description="Executa a otimização para gerar o relatório completo."
          action={
            <Link to="/otimizacao" className={btnPrimary}>
              Ir para Otimizar
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatório"
        subtitle={`${project.name}${project.client ? ` · ${project.client}` : ""} · ${project.date}`}
        actions={
          <>
            <button className={btn} onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Imprimir
            </button>
            <button className={btn} onClick={() => exportLayoutSvg(project, result)}>
              <FileType2 className="h-4 w-4" /> SVG
            </button>
            <button className={btn} onClick={() => exportLayoutDxf(project, result)}>
              <FileCode2 className="h-4 w-4" /> DXF
            </button>
            <button className={btnPrimary} onClick={() => exportSheetDrawingPdf(project, result)}>
              <Download className="h-4 w-4" /> PDF — Desenho das chapas
            </button>
            <button className={btn} onClick={() => exportProjectDetailsPdf(project, result)}>
              <Download className="h-4 w-4" /> PDF — Detalhes do projeto
            </button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Chapas usadas" value={num(result.stats.sheetsUsed)} />
        <Stat
          label="Peças colocadas"
          value={`${result.stats.partsPlaced}/${result.stats.partsTotal}`}
        />
        <Stat
          label="Aproveitamento"
          value={pct(result.stats.usagePct)}
          progress={result.stats.usagePct}
        />
        <Stat label="Custo material" value={eur(result.stats.totalCost)} />
        <Stat label="Custo de corte" value={eur(result.stats.cuttingCost)} />
        <Stat label="Custo líquido estimado" value={eur(result.stats.estimatedNetCost)} />
      </div>

      <Panel title="Parâmetros de corte">
        <p className="text-sm text-muted-foreground">
          Lâmina {project.parameters.kerf} mm · Margem {project.parameters.margin} mm · Espaçamento{" "}
          {project.parameters.spacing} mm · Rotação{" "}
          {project.parameters.allowRotation ? "sim" : "não"} · Modo {project.parameters.mode}
        </p>
      </Panel>

      <Panel title="Peças">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-3 font-medium">ID</th>
                <th className="py-2 pr-3 font-medium">Nome</th>
                <th className="py-2 pr-3 font-medium">Medidas</th>
                <th className="py-2 pr-3 font-medium">Qtd</th>
                <th className="py-2 pr-3 font-medium">Material</th>
                <th className="py-2 pr-3 font-medium">Fita</th>
              </tr>
            </thead>
            <tbody>
              {project.parts.map((p) => (
                <tr key={p.id} className="border-b border-border/60">
                  <td className="py-1.5 pr-3 font-mono text-xs">{p.id}</td>
                  <td className="py-1.5 pr-3">{p.name}</td>
                  <td className="py-1.5 pr-3">
                    {p.length} × {p.width} mm
                  </td>
                  <td className="py-1.5 pr-3">{p.quantity}</td>
                  <td className="py-1.5 pr-3">{p.material}</td>
                  <td className="py-1.5 pr-3">{p.edgeBanding || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {result.layouts.map((l) => (
        <Panel
          key={l.index}
          title={`Chapa ${l.index} — ${l.material}`}
          description={`${l.length}×${l.width}×${l.thickness} mm · aproveitamento ${pct(l.usagePct)} · ${l.cuts.length} cortes`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Peça</th>
                  <th className="py-2 pr-3 font-medium">X</th>
                  <th className="py-2 pr-3 font-medium">Y</th>
                  <th className="py-2 pr-3 font-medium">Medidas</th>
                  <th className="py-2 pr-3 font-medium">Rotação</th>
                </tr>
              </thead>
              <tbody>
                {l.placements.map((p, i) => (
                  <tr key={i} className="border-b border-border/60">
                    <td className="py-1.5 pr-3">
                      {p.partId} · {p.name}
                    </td>
                    <td className="py-1.5 pr-3">{Math.round(p.x)}</td>
                    <td className="py-1.5 pr-3">{Math.round(p.y)}</td>
                    <td className="py-1.5 pr-3">
                      {Math.round(p.w)} × {Math.round(p.h)}
                    </td>
                    <td className="py-1.5 pr-3">{p.rotated ? "90°" : "0°"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Sobras aproveitáveis:{" "}
            {l.offcuts.length
              ? l.offcuts.map((o) => `${Math.round(o.w)}×${Math.round(o.h)}`).join(" · ")
              : "nenhuma"}
          </p>
        </Panel>
      ))}

      <Panel title="Resumo de áreas">
        <div className="grid gap-2 text-sm sm:grid-cols-3">
          <p>Área total das chapas: {m2(result.stats.totalSheetArea)}</p>
          <p>Área usada: {m2(result.stats.totalUsedArea)}</p>
          <p>Área de sobras: {m2(result.stats.totalOffcutArea)}</p>
        </div>
      </Panel>

      {result.unplaced.length ? (
        <Panel title="Peças não acomodadas">
          <ul className="space-y-1 text-sm">
            {result.unplaced.map((u) => (
              <li key={u.partId + u.reason}>
                {u.partId} · {u.name} ×{u.quantity} — {u.reason}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
