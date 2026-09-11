import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Download, FileUp, FolderPlus, Layers3, Play, Ruler, RotateCcw } from "lucide-react";
import { useProject } from "@/hooks/useProject";
import { Field, PageHeader, Stat, btn, btnPrimary, inputClass } from "@/components/ui-bits";
import { m2, num, pct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { exportProjectJson, importProjectJson } from "@/lib/project-file";
import { toast } from "sonner";
import { useRef } from "react";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "CutPlan CNC — Trabalho" }, { name: "description", content: "Planeia e otimiza o corte diário de painéis para a tua oficina." }] }),
  component: ProjectPage,
});

function ProjectPage() {
  const { project, result, updateInfo, newProject, restoreSaved, hasSaved, replaceProject } = useProject();
  const importRef = useRef<HTMLInputElement>(null);
  const totalParts = project.parts.reduce((s, p) => s + p.quantity, 0);
  const partsArea = project.parts.reduce((s, p) => s + p.length * p.width * p.quantity, 0);
  const sheetsTotal = project.sheets.reduce((s, p) => s + p.quantity, 0);
  const complete = result && result.stats.partsPlaced === result.stats.partsTotal;

  return (
    <div className="space-y-5">
      <PageHeader title="Trabalho" subtitle={project.name || "Começa um trabalho novo e prepara o corte."} />

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Nome do trabalho"><input className={inputClass} value={project.name} placeholder="Ex.: Cozinha Cliente Silva" onChange={(e) => updateInfo({ name: e.target.value })} /></Field>
          <Field label="Cliente"><input className={inputClass} value={project.client} placeholder="Opcional" onChange={(e) => updateInfo({ client: e.target.value })} /></Field>
          <Field label="Data"><input type="date" className={inputClass} value={project.date} onChange={(e) => updateInfo({ date: e.target.value })} /></Field>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Peças" value={num(totalParts)} hint={`${project.parts.length} tipos`} />
        <Stat label="Chapas" value={num(sheetsTotal)} hint={`${project.sheets.length} tipos`} />
        <Stat label="Área das peças" value={m2(partsArea)} />
        <Stat label="Último plano" value={result ? pct(result.stats.usagePct) : "—"} hint={complete ? "Tudo acomodado" : result ? `${result.stats.partsPlaced}/${result.stats.partsTotal} colocadas` : "Ainda não calculado"} progress={result?.stats.usagePct ?? 0} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link to="/pecas" className="group rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary hover:bg-accent/30">
          <Ruler className="h-6 w-6 text-primary" /><p className="mt-3 font-semibold">Peças</p><p className="mt-1 text-sm text-muted-foreground">Adicionar e ajustar medidas.</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">Abrir <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
        </Link>
        <Link to="/chapas" className="group rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary hover:bg-accent/30">
          <Layers3 className="h-6 w-6 text-primary" /><p className="mt-3 font-semibold">Chapas e sobras</p><p className="mt-1 text-sm text-muted-foreground">Definir stock disponível.</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">Abrir <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
        </Link>
        <Link to="/otimizacao" className="group rounded-2xl border-2 border-primary bg-accent/40 p-5 shadow-sm transition-colors hover:bg-accent">
          <Play className="h-6 w-6 text-primary" /><p className="mt-3 font-semibold">Otimizar corte</p><p className="mt-1 text-sm text-muted-foreground">Encontrar o melhor plano para a F40.</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">Começar <ArrowRight className="h-4 w-4" /></span>
        </Link>
      </div>

      {result ? <div className="rounded-2xl border border-border bg-card p-5 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">Último resultado</p><p className="mt-1 text-sm text-muted-foreground">{complete ? "Todas as peças foram acomodadas." : "Há peças que precisam de atenção."}</p></div><Link to="/plano" className={cn(btnPrimary, "w-full sm:w-auto")}><Layers3 className="h-4 w-4" /> Ver plano</Link></div>{!complete && result.unplaced.length ? <div className="mt-4 rounded-lg bg-warning/10 px-3 py-2 text-sm">{result.unplaced.reduce((sum, item) => sum + item.quantity, 0)} peça(s) ficaram por colocar. Verifica as dimensões e o stock disponível.</div> : null}</div> : null}

      <div className="flex flex-wrap gap-2">
        <button className={btn} onClick={newProject}><FolderPlus className="h-4 w-4" /> Novo</button>
        <button className={btn} onClick={restoreSaved} disabled={!hasSaved}><RotateCcw className="h-4 w-4" /> Recuperar último</button>
        <button className={btn} onClick={() => exportProjectJson(project)}><Download className="h-4 w-4" /> Exportar</button>
        <button className={btn} onClick={() => importRef.current?.click()}><FileUp className="h-4 w-4" /> Importar</button>
        <input ref={importRef} type="file" accept=".json,.cutplan.json,application/json" className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; try { replaceProject(await importProjectJson(file)); toast.success("Trabalho importado."); } catch (error) { toast.error(error instanceof Error ? error.message : "Ficheiro inválido."); } finally { e.currentTarget.value = ""; } }} />
      </div>
    </div>
  );
}
