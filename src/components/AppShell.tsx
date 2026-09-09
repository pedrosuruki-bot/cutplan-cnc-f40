import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  FileText,
  FolderPlus,
  LayoutGrid,
  Layers,
  Moon,
  Play,
  Ruler,
  Save,
  Settings2,
  Sun,
  Download,
  Menu,
  X,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { useProject } from "@/hooks/useProject";
import { exportProjectPdf } from "@/lib/pdf";
import { btn, btnPrimary } from "@/components/ui-bits";
import { cn } from "@/lib/utils";

const steps = [
  { to: "/", label: "Projeto", icon: FileText },
  { to: "/chapas", label: "Chapas", icon: Layers },
  { to: "/pecas", label: "Peças", icon: Ruler },
  { to: "/otimizacao", label: "Otimizar", icon: Settings2 },
  { to: "/plano", label: "Plano", icon: LayoutGrid },
  { to: "/relatorio", label: "Relatório", icon: FileText },
] as const;

function useTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const stored = window.localStorage.getItem("cutplan.theme");
    const isDark = stored === "dark";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);
  const toggle = () => {
    setDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      window.localStorage.setItem("cutplan.theme", next ? "dark" : "light");
      return next;
    });
  };
  return { dark, toggle };
}

export function AppShell({ children }: { children: ReactNode }) {
  const { project, result, stale, optimizing, hydrated, runOptimize, save, newProject } = useProject();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);

  const done: Record<string, boolean> = {
    "/": project.name.trim().length > 0,
    "/chapas": project.sheets.length > 0,
    "/pecas": project.parts.length > 0,
    "/otimizacao": !!result,
    "/plano": !!result,
    "/relatorio": !!result,
  };

  const hasProject = project.name.trim().length > 0;
  const hasSheets = project.sheets.length > 0;
  const hasParts = project.parts.length > 0;

  const unlocked: Record<string, boolean> = {
    "/": true,
    "/chapas": hasProject,
    "/pecas": hasProject && hasSheets,
    "/otimizacao": hasProject && hasSheets && hasParts,
    "/plano": !!result,
    "/relatorio": !!result,
  };

  const firstBlockedStep = () => {
    if (!hasProject) return "/" as const;
    if (!hasSheets) return "/chapas" as const;
    if (!hasParts) return "/pecas" as const;
    if (!result) return "/otimizacao" as const;
    return null;
  };

  const handleStepNavigation = (to: (typeof steps)[number]["to"]) => {
    if (unlocked[to]) {
      setMenuOpen(false);
      return;
    }
    const targetIndex = steps.findIndex((s) => s.to === to);
    const blockingIndex = steps.findIndex((s) => !unlocked[s.to]);
    const blockingStep = steps[blockingIndex];
    if (blockingStep && targetIndex >= blockingIndex) {
      toast.error(`Conclui primeiro a etapa “${blockingStep.label}”.`);
      navigate({ to: blockingStep.to });
    }
    setMenuOpen(false);
  };

  useEffect(() => {
    if (!hydrated || path === "/") return;
    if (unlocked[path]) return;
    const target = firstBlockedStep();
    if (!target || target === path) return;
    const blockedStep = steps.find((s) => s.to === path);
    const destinationStep = steps.find((s) => s.to === target);
    toast.error(
      blockedStep && destinationStep
        ? `Conclui primeiro a etapa “${destinationStep.label}” para abrir “${blockedStep.label}”.`
        : "Conclui a etapa anterior antes de continuar.",
    );
    navigate({ to: target, replace: true });
  }, [hydrated, path, hasProject, hasSheets, hasParts, result, navigate]);

  const handleOptimize = async () => {
    const missing = firstBlockedStep();
    if (missing && missing !== "/otimizacao") {
      const target = steps.find((s) => s.to === missing);
      toast.error(`Conclui primeiro a etapa “${target?.label ?? "anterior"}”.`);
      navigate({ to: missing });
      return;
    }
    if (!hasProject || !hasSheets || !hasParts) {
      toast.error("Conclui o projeto, adiciona chapas e peças antes de otimizar.");
      return;
    }
    try {
      const res = await runOptimize();
      if (!res) return;
      toast.success(
        `${res.stats.sheetsUsed} chapa(s) · ${res.stats.usagePct.toFixed(1)}% aproveitamento${
          res.unplaced.length ? ` · ${res.unplaced.length} peça(s) por colocar` : ""
        }`,
      );
      navigate({ to: "/plano" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível otimizar o corte.");
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        void handleOptimize();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
        toast.success("Projeto guardado");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="no-print sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              className={cn(btn, "h-9 w-9 p-0 md:hidden")}
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Menu"
            >
              {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
              <LayoutGrid className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight">CutPlan CNC</p>
              <p className="truncate text-xs text-muted-foreground">{project.name}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button className={cn(btn, "hidden sm:inline-flex")} onClick={newProject}>
              <FolderPlus className="h-4 w-4" /> Novo
            </button>
            <button
              className={btn}
              onClick={() => {
                save();
                toast.success("Projeto guardado");
              }}
            >
              <Save className="h-4 w-4" />
              <span className="hidden sm:inline">Guardar</span>
            </button>
            <button
              className={btn}
              onClick={() => {
                if (!result) {
                  toast.error("Otimiza primeiro para exportar o plano.");
                  return;
                }
                exportProjectPdf(project, result);
              }}
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">PDF</span>
            </button>
            <button className={cn(btn, "h-10 w-10 p-0")} onClick={toggle} aria-label="Tema">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto border-t border-border px-2 py-2">
          {steps.map((s, i) => {
            const active = path === s.to;
            const isUnlocked = unlocked[s.to];
            return (
              <Link
                key={s.to}
                to={s.to}
                onClick={(e) => {
                  if (!isUnlocked) {
                    e.preventDefault();
                    handleStepNavigation(s.to);
                  }
                }}
                aria-disabled={!isUnlocked}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-primary text-primary-foreground font-semibold"
                    : isUnlocked
                      ? "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      : "cursor-not-allowed text-muted-foreground/45",
                )}
              >
                <span
                  className={cn(
                    "grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold",
                    active
                      ? "bg-primary-foreground/20"
                      : done[s.to]
                        ? "bg-success text-success-foreground"
                        : isUnlocked
                          ? "bg-muted"
                          : "bg-muted/60",
                  )}
                >
                  {!isUnlocked ? <Lock className="h-3 w-3" /> : done[s.to] && !active ? "✓" : i + 1}
                </span>
                {s.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {menuOpen ? (
        <div className="no-print border-b border-border bg-card px-4 py-2 md:hidden">
          {steps.map((s, i) => {
            const isUnlocked = unlocked[s.to];
            const active = path === s.to;
            return (
              <button
                key={s.to}
                type="button"
                onClick={() => handleStepNavigation(s.to)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm",
                  active
                    ? "bg-accent font-semibold text-accent-foreground"
                    : isUnlocked
                      ? "hover:bg-accent"
                      : "cursor-not-allowed text-muted-foreground/50",
                )}
              >
                {isUnlocked ? <s.icon className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                <span>{i + 1}. {s.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {stale && result ? (
        <div className="no-print border-b border-warning/40 bg-warning/15 px-4 py-2 text-xs text-foreground">
          Alteraste os dados — o plano atual está desatualizado. Volta a otimizar.
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-7xl px-4 py-6 pb-24">{children}</main>

      <button
        onClick={handleOptimize}
        disabled={optimizing || !hydrated || !hasProject || !hasSheets || !hasParts}
        className={cn(
          btnPrimary,
          "no-print fixed bottom-5 right-5 z-40 h-12 rounded-full px-6 shadow-lg",
          (!hasProject || !hasSheets || !hasParts || !hydrated) && "cursor-not-allowed opacity-50",
        )}
        title="Otimizar (Ctrl+Enter)"
      >
        <Play className="h-4 w-4" />
        {optimizing ? "A OTIMIZAR…" : "OTIMIZAR"}
      </button>
    </div>
  );
}
