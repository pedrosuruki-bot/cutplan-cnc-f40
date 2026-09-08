import { cn } from "@/lib/utils";
import type { ChangeEvent, ReactNode } from "react";

export const PRESET_MATERIALS = [
  "LINHO 16MM",
  "LINHO 10MM",
  "BRANCO 16MM",
  "BRANCO 10MM",
  "CINZA CLARO 16MM",
  "CINZA CLARO 10MM",
  "CINZA ESCURO 10MM",
  "CINZA ESCURO 16MM",
];

export const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm tabular-nums outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30";

export const btn =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50";

export const btnPrimary =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-60";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-border bg-card shadow-sm", className)}>
      {title ? (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
  progress,
}: {
  label: string;
  value: string;
  hint?: string;
  progress?: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {typeof progress === "number" ? (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      ) : null}
      {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-destructive">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

export function MaterialInput({
  value,
  onChange,
  className,
  placeholder = "Material",
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}) {
  return (
    <>
      <input
        list="preset-materials"
        className={cn(inputClass, className)}
        value={value}
        placeholder={placeholder}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      />
      <datalist id="preset-materials">
        {PRESET_MATERIALS.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
    </>
  );
}
