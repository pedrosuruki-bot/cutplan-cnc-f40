import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Download, FileUp, FolderPlus, RotateCcw, Sparkles } from "lucide-react";
import { useProject } from "@/hooks/useProject";
import { Field, PageHeader, Panel, Stat, btn, btnPrimary, inputClass } from "@/components/ui-bits";
import { m2, num, pct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { exportProjectJson, importProjectJson } from "@/lib/project-file";
import { toast } from "sonner";
import { useRef } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CutPlan CNC — Otimizador de planos de corte" },
      {
        name: "description",
        content:
          "Otimize planos de corte de chapas para carpintaria, marcenaria e CNC: kerf, margens, sobras e relatório em PDF.",
      },
      { property: "og:title", content: "CutPlan CNC — Otimizador de planos de corte" },
      {
        property: "og:description",
        content: "Planos de corte otimizados em milímetros, com sobras, sequência de cortes e PDF.",
      },
    ],
  }),
  component: ProjectPage,
});

function ProjectPage() {
  const { project, result, updateInfo, newProject, loadDemo, restoreSaved, hasSaved, replaceProject } =
    useProject();
  const importRef = useRef<HTMLInputElement>(null);

  const totalParts = project.parts.reduce((s, p) => s + p.quantity, 0);
  const partsArea = project.parts.reduce((s, p) => s + p.length * p.width * p.quantity, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projeto"
        subtitle="Começa por escolher um ponto de partida e preencher os dados do trabalho."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <button
          onClick={newProject}
          className="rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-primary"
        >
          <FolderPlus className="h-6 w-6 text-primary" />
          <p className="mt-3 font-semibold">Começar novo</p>
          <p className="mt-1 text-sm text-muted-foreground">Projeto vazio, do zero.</p>
        </button>
        <button
          onClick={loadDemo}
          className="rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-primary"
        >
          <Sparkles className="h-6 w-6 text-primary" />
          <p className="mt-3 font-semibold">Carregar demo</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Chapa MDF 2800×2070×18 e 6 peças de exemplo.
          </p>
        </button>
        <button
          onClick={restoreSaved}
          disabled={!hasSaved}
          className="rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-primary disabled:opacity-50"
        >
          <RotateCcw className="h-6 w-6 text-primary" />
          <p className="mt-3 font-semibold">Continuar guardado</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasSaved ? "Retomar o último projeto guardado." : "Ainda não há projeto guardado."}
          </p>
        </button>
      </div>

      <Panel title="Backup e transferência" description="Guarda o projeto completo num ficheiro .cutplan.json. É a forma mais segura de levar um trabalho para outro computador ou fazer uma cópia antes de alterações grandes.">
        <div className="flex flex-wrap gap-2">
          <button className={btn} onClick={() => exportProjectJson(project)}><Download className="h-4 w-4" /> Exportar projeto</button>
          <button className={btn} onClick={() => importRef.current?.click()}><FileUp className="h-4 w-4" /> Importar projeto</button>
          <input ref={importRef} type="file" accept=".json,.cutplan.json,application/json" className="hidden" onChange={async (e) => {
            const file = e.target.files?.[0]; if (!file) return;
            try { const imported = await importProjectJson(file); replaceProject(imported); toast.success("Projeto importado. Otimiza novamente antes de cortar."); }
            catch (error) { toast.error(error instanceof Error ? error.message : "Ficheiro inválido."); }
            finally { e.currentTarget.value = ""; }
          }} />
        </div>
      </Panel>

      <Panel title="Dados do projeto">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Nome do projeto">
            <input
              className={inputClass}
              value={project.name}
              onChange={(e) => updateInfo({ name: e.target.value })}
            />
          </Field>
          <Field label="Cliente">
            <input
              className={inputClass}
              value={project.client}
              onChange={(e) => updateInfo({ client: e.target.value })}
            />
          </Field>
          <Field label="Data">
            <input
              type="date"
              className={inputClass}
              value={project.date}
              onChange={(e) => updateInfo({ date: e.target.value })}
            />
          </Field>
          <Field label="Observações">
            <input
              className={inputClass}
              value={project.notes}
              placeholder="Notas para a oficina"
              onChange={(e) => updateInfo({ notes: e.target.value })}
            />
          </Field>
        </div>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Chapas registadas" value={num(project.sheets.length)} />
        <Stat
          label="Peças a cortar"
          value={num(totalParts)}
          hint={`${project.parts.length} tipos`}
        />
        <Stat label="Área das peças" value={m2(partsArea)} />
        <Stat
          label="Aproveitamento"
          value={result ? pct(result.stats.usagePct) : "—"}
          progress={result?.stats.usagePct ?? 0}
          hint={result ? `${result.stats.sheetsUsed} chapa(s) usada(s)` : "Ainda não otimizado"}
        />
      </div>

      <div className="flex justify-end">
        <Link to="/chapas" className={cn(btnPrimary)}>
          Continuar para Chapas <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="flex justify-end">
        <Link to="/pecas" className={btn}>
          Ir direto às Peças
        </Link>
      </div>
    </div>
  );
}
