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
  Sun,
  Download,
  Menu,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useProject } from "@/hooks/useProject";
import { exportProjectPdf } from "@/lib/pdf";
import { btn, btnPrimary } from "@/components/ui-bits";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Trabalho", icon: FileText },
  { to: "/pecas", label: "Peças", icon: Ruler },
  { to: "/chapas", label: "Chapas", icon: Layers },
  { to: "/plano", label: "Plano", icon: LayoutGrid },
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

  const hasProject = project.name.trim().length > 0;
  const hasSheets = project.sheets.length > 0;
  const hasParts = project.parts.length > 0;

  const handleOptimize = async () => {
    if (!hydrated) return;
    if (!hasSheets) {
      toast.error("Adiciona pelo menos uma chapa antes de otimizar.");
      navigate({ to: "/chapas" });
      return;
    }
    if (!hasParts) {
      toast.error("Adiciona pelo menos uma peça antes de otimizar.");
      navigate({ to: "/pecas" });
      return;
    }
    if (!hasProject) {
      toast.error("Dá um nome ao trabalho antes de otimizar.");
      navigate({ to: "/" });
      return;
    }
    try {
      const res = await runOptimize();
      if (!res) return;
      const message = `${res.stats.partsPlaced}/${res.stats.partsTotal} peças · ${res.stats.sheetsUsed} chapa(s) · ${res.stats.usagePct.toFixed(1)}% aproveitamento`;
      if (res.unplaced.length) toast.warning(message + " · há peças por colocar");
      else toast.success(message);
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
        toast.success("Trabalho guardado");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="no-print sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2 sm:px-4 sm:py-3">
          <button
            className={cn(btn, "h-9 w-9 shrink-0 p-0 sm:hidden")}
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Abrir menu"
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
              <LayoutGrid className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight">CutPlan CNC</p>
              <p className="truncate text-xs text-muted-foreground">
                {hasProject ? project.name : "Trabalho novo"}
              </p>
            </div>
          </Link>

          <nav className="ml-2 hidden min-w-0 flex-1 items-center gap-1 md:flex">
            {nav.map((item) => {
              const active = path === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-primary font-semibold text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button className={cn(btn, "hidden sm:inline-flex")} onClick={newProject} title="Novo trabalho">
              <FolderPlus className="h-4 w-4" /> Novo
            </button>
            <button
              className={btn}
              onClick={() => {
                save();
                toast.success("Trabalho guardado");
              }}
              title="Guardar"
            >
              <Save className="h-4 w-4" />
              <span className="hidden lg:inline">Guardar</span>
            </button>
            {result ? (
              <button
                className={btn}
                onClick={() => exportProjectPdf(project, result)}
                title="Exportar PDF"
              >
                <Download className="h-4 w-4" />
                <span className="hidden lg:inline">PDF</span>
              </button>
            ) : null}
            <button className={cn(btn, "h-9 w-9 p-0")} onClick={toggle} aria-label="Tema">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {menuOpen ? (
          <nav className="no-print border-t border-border bg-card p-2 sm:hidden">
            {nav.map((item) => {
              const active = path === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
                    active ? "bg-accent font-semibold" : "text-muted-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                void handleOptimize();
              }}
              className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-primary"
            >
              <Play className="h-4 w-4" /> Otimizar agora
            </button>
          </nav>
        ) : null}
      </header>

      {stale && result ? (
        <div className="no-print border-b border-warning/40 bg-warning/10 px-4 py-2 text-xs text-foreground">
          O trabalho foi alterado. O plano atual precisa de nova otimização.
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-7xl px-3 py-4 pb-24 sm:px-4 sm:py-6">{children}</main>

      <button
        onClick={() => void handleOptimize()}
        disabled={optimizing || !hydrated}
        className={cn(
          btnPrimary,
          "no-print fixed bottom-4 right-4 z-40 h-12 rounded-full px-5 shadow-lg sm:bottom-5 sm:right-5",
        )}
        title="Otimizar (Ctrl+Enter)"
      >
        <Play className="h-4 w-4" />
        <span className="hidden sm:inline">{optimizing ? "A otimizar…" : "Otimizar"}</span>
      </button>
    </div>
  );
}
