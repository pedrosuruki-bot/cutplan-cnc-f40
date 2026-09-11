import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, FileCode2, FileType2, Printer } from "lucide-react";
import { useProject } from "@/hooks/useProject";
import { EmptyState, PageHeader, Panel, Stat, btn, btnPrimary } from "@/components/ui-bits";
import { exportProjectDetailsPdf } from "@/lib/pdf/split";
import { exportSheetDrawingPdf } from "@/lib/pdf/drawing";
import { eur, m2, num, pct } from "@/lib/format";
import { exportLayoutDxf, exportLayoutSvg } from "@/lib/vector-export";

export const Route = createFileRoute("/relatorio")({
  head: () => ({ meta: [{ title: "Relatório — CutPlan CNC" }, { name: "description", content: "Resumo de produção e exportação do plano de corte." }] }),
  component: ReportPage,
});

function ReportPage() {
  const { project, result } = useProject();
  const [showPartIds, setShowPartIds] = useState(true);

  if (!result) {
    return <div className="space-y-5"><PageHeader title="Relatório" /><EmptyState title="Sem resultado" description="Executa a otimização para gerar o plano e o relatório." action={<Link to="/otimizacao" className={btnPrimary}>Ir para otimizar</Link>} /></div>;
  }

  const complete = result.stats.partsPlaced === result.stats.partsTotal;
  const unplacedQty = result.unplaced.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Relatório"
        subtitle={`${project.name}${project.client ? ` · ${project.client}` : ""} · ${project.date}`}
        actions={<div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
          <button className={btn} onClick={() => window.print()}><Printer className="h-4 w-4" /> Imprimir</button>
          <button className={btn} onClick={() => exportLayoutSvg(project, result)}><FileType2 className="h-4 w-4" /> SVG</button>
          <button className={btn} onClick={() => exportLayoutDxf(project, result)}><FileCode2 className="h-4 w-4" /> DXF</button>
          <button className={btnPrimary} onClick={() => exportSheetDrawingPdf(project, result, showPartIds)}><Download className="h-4 w-4" /> PDF desenho</button>
          <button className={btn} onClick={() => exportProjectDetailsPdf(project, result)}><Download className="h-4 w-4" /> PDF detalhes</button>
        </div>}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Peças" value={`${num(result.stats.partsPlaced)}/${num(result.stats.partsTotal)}`} hint={complete ? "Tudo acomodado" : `${num(unplacedQty)} por colocar`} />
        <Stat label="Chapas usadas" value={num(result.stats.sheetsUsed)} hint={`${pct(result.stats.usagePct)} aproveitamento`} progress={result.stats.usagePct} />
        <Stat label="Custo estimado" value={eur(result.stats.estimatedNetCost)} hint={`${eur(result.stats.totalCost)} material · ${eur(result.stats.cuttingCost)} corte`} />
      </div>

      {!complete ? <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm"><strong>Atenção:</strong> {num(unplacedQty)} peça(s) não foram acomodadas. Consulta a secção no fim antes de produzir.</div> : null}

      <Panel title="Desenho PDF" description="Exportação rápida para levar para a oficina.">
        <label className="flex cursor-pointer items-center gap-3 text-sm"><input type="checkbox" checked={showPartIds} onChange={(event) => setShowPartIds(event.target.checked)} className="h-4 w-4 rounded border-border accent-primary" /><span>Mostrar IDs das peças no desenho</span></label>
      </Panel>

      <Panel title="Peças" description={`${num(project.parts.length)} tipos · ${num(result.stats.partsTotal)} unidades`}>
        <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground"><th className="py-2 pr-3">ID</th><th className="py-2 pr-3">Nome</th><th className="py-2 pr-3">Medidas</th><th className="py-2 pr-3">Qtd</th><th className="py-2 pr-3">Material</th></tr></thead><tbody>{project.parts.map((p) => <tr key={p.id} className="border-b border-border/60"><td className="py-1.5 pr-3 font-mono text-xs">{p.id}</td><td className="py-1.5 pr-3">{p.name}</td><td className="py-1.5 pr-3">{p.length} × {p.width} mm</td><td className="py-1.5 pr-3">{p.quantity}</td><td className="py-1.5 pr-3">{p.material}</td></tr>)}</tbody></table></div>
      </Panel>

      {result.layouts.map((layout) => <Panel key={layout.index} title={`Chapa ${layout.index}`} description={`${layout.material} · ${layout.length} × ${layout.width} × ${layout.thickness} mm · ${pct(layout.usagePct)} · ${layout.placements.length} peças`}>
        <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground"><th className="py-2 pr-3">Peça</th><th className="py-2 pr-3">X</th><th className="py-2 pr-3">Y</th><th className="py-2 pr-3">Medidas</th><th className="py-2 pr-3">Rotação</th></tr></thead><tbody>{layout.placements.map((p, i) => <tr key={`${p.partId}-${p.instance}-${i}`} className="border-b border-border/60"><td className="py-1.5 pr-3">{p.partId} · {p.name}</td><td className="py-1.5 pr-3">{Math.round(p.x)}</td><td className="py-1.5 pr-3">{Math.round(p.y)}</td><td className="py-1.5 pr-3">{Math.round(p.w)} × {Math.round(p.h)}</td><td className="py-1.5 pr-3">{p.rotated ? "90°" : "0°"}</td></tr>)}</tbody></table></div>
        <p className="mt-3 text-xs text-muted-foreground">Sobras aproveitáveis: {layout.offcuts.length ? layout.offcuts.map((o) => `${Math.round(o.w)}×${Math.round(o.h)}`).join(" · ") : "nenhuma"}</p>
      </Panel>)}

      <Panel title="Resumo" description="Valores úteis para produção e orçamento.">
        <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4"><p>Área das chapas: {m2(result.stats.totalSheetArea)}</p><p>Área usada: {m2(result.stats.totalUsedArea)}</p><p>Sobras: {m2(result.stats.totalOffcutArea)}</p><p>Cortes: {num(result.stats.totalCuts)}</p></div>
      </Panel>

      {result.unplaced.length ? <Panel title="Peças por colocar" description="Verifica primeiro estas peças."><div className="space-y-1 text-sm">{result.unplaced.map((u) => <div key={u.partId + u.reason} className="flex flex-wrap gap-x-2"><span className="font-mono text-xs">{u.partId}</span><span>{u.name} ×{u.quantity}</span><span className="text-muted-foreground">· {u.reason}</span></div>)}</div></Panel> : null}
    </div>
  );
}
