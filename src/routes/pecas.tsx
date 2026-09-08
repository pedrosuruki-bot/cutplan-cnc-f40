import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ArrowRight, Camera, Copy, Download, FileUp, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useProject } from "@/hooks/useProject";
import { EmptyState, PageHeader, Panel, btn, btnPrimary, inputClass } from "@/components/ui-bits";
import type { GrainDirection, Part } from "@/types";
import { m2, num } from "@/lib/format";
import { cn } from "@/lib/utils";
import { scanMeasurementsPhoto, type ScannedPart } from "@/lib/measure-photo.functions";
import { parsePartsCsv, partsCsvTemplate } from "@/lib/csv";

export const Route = createFileRoute("/pecas")({
  head: () => ({
    meta: [
      { title: "Peças — CutPlan CNC" },
      {
        name: "description",
        content:
          "Lista de peças a cortar: dimensões, quantidade, rotação, sentido da madeira e fita de bordo.",
      },
      { property: "og:title", content: "Peças — CutPlan CNC" },
      { property: "og:description", content: "Introdução rápida de peças para o plano de corte." },
    ],
  }),
  component: PartsPage,
});

function nextId(parts: Part[]): string {
  const used = new Set(parts.map((p) => p.id));
  let n = 1;
  while (used.has(`P${String(n).padStart(3, "0")}`)) n++;
  return `P${String(n).padStart(3, "0")}`;
}
function nextUniqueId(used: Set<string>): string {
  let n = 1;
  let id = `P${String(n).padStart(3, "0")}`;
  while (used.has(id)) {
    n++;
    id = `P${String(n).padStart(3, "0")}`;
  }
  return id;
}

function makePart(parts: Part[], material: string, over: Partial<Part> = {}): Part {
  return {
    id: nextId(parts),
    name: "Peça",
    length: 600,
    width: 400,
    quantity: 1,
    material,
    canRotate: true,
    grain: "none",
    edgeBanding: "",
    notes: "",
    ...over,
  };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem"));
    reader.readAsDataURL(file);
  });
}

async function preparePhoto(file: File): Promise<string> {
  const raw = await fileToDataUrl(file);
  const img = new Image();
  img.src = raw;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Não foi possível abrir a imagem"));
  });
  const maxW = 1800;
  const maxH = 1400;
  const scale = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return raw;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.84);
}

function PartsPage() {
  const { project, setParts } = useProject();
  const parts = project.parts;
  const [advanced, setAdvanced] = useState(false);
  const material = project.sheets[0]?.material ?? "MDF Branco 18";

  const [len, setLen] = useState("");
  const [wid, setWid] = useState("");
  const [qty, setQty] = useState("");
  const lenRef = useRef<HTMLInputElement>(null);
  const widRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState<ScannedPart[] | null>(null);
  const scanPhoto = useServerFn(scanMeasurementsPhoto);

  const update = (id: string, patch: Partial<Part>) =>
    setParts(parts.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const addRow = () => {
    const L = Number(len.replace(",", "."));
    const W = Number(wid.replace(",", "."));
    const Q = qty ? Number(qty) : 1;
    if (!L || !W) {
      toast.error("Escreve comprimento e largura");
      lenRef.current?.focus();
      return;
    }
    setParts([...parts, makePart(parts, material, { length: L, width: W, quantity: Q || 1 })]);
    setLen("");
    setWid("");
    setQty("");
    lenRef.current?.focus();
  };

  const pasteBulk = (text: string) => {
    const rows = text
      .split(/\r?\n/)
      .map((r) => r.split(/\t|;|\s{2,}/).map((c) => c.trim()))
      .filter((r) => r.length >= 2 && r[0] && !Number.isNaN(Number(r[0]?.replace(",", "."))));
    if (rows.length === 0) return false;
    let acc = parts;
    for (const r of rows) {
      acc = [
        ...acc,
        makePart(acc, material, {
          length: Number(r[0]!.replace(",", ".")),
          width: Number(r[1]!.replace(",", ".")),
          quantity: r[2] ? Number(r[2].replace(",", ".")) : 1,
        }),
      ];
    }
    setParts(acc);
    toast.success(`${rows.length} peça(s) importada(s)`);
    return true;
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setScanning(true);
    try {
      const imageDataUrl = await preparePhoto(file);
      const res = await scanPhoto({ data: { imageDataUrl } });
      if (res.parts.length === 0) {
        toast.error("Não encontrei medidas nesta foto. Tenta com mais luz e mais perto.");
      } else {
        setScanned(res.parts);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível ler a foto");
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const confirmScanned = () => {
    if (!scanned) return;
    let acc = parts;
    for (const s of scanned) {
      acc = [
        ...acc,
        makePart(acc, material, {
          length: s.length,
          width: s.width,
          quantity: s.quantity,
          ...(s.name ? { name: s.name } : {}),
        }),
      ];
    }
    setParts(acc);
    toast.success(`${scanned.length} peça(s) adicionada(s)`);
    setScanned(null);
  };

  const totalQty = parts.reduce((s, p) => s + p.quantity, 0);
  const totalArea = parts.reduce((s, p) => s + p.length * p.width * p.quantity, 0);
  const missingMaterials = Array.from(
    new Set(
      parts
        .map((p) => p.material)
        .filter(
          (m) =>
            !project.sheets.some(
              (s) =>
                s.material.trim().replace(/\s+/g, " ").toLocaleLowerCase() ===
                m.trim().replace(/\s+/g, " ").toLocaleLowerCase(),
            ),
        ),
    ),
  );

  const bigInput =
    "h-14 w-full rounded-xl border border-input bg-background px-3 text-center text-2xl font-semibold tabular-nums outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-ring focus:ring-2 focus:ring-ring/30";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Peças"
        subtitle="Escreve as medidas e carrega Enter. Ou tira foto à folha de papel."
        actions={
          <>
            <button className={btn} onClick={() => setAdvanced((a) => !a)}>
              {advanced ? "Ocultar avançado" : "Mostrar avançado"}
            </button>
            <button className={btn} onClick={() => csvRef.current?.click()}>
              <FileUp className="h-4 w-4" /> Importar CSV
            </button>
            <button
              className={btn}
              onClick={() => {
                const blob = new Blob([partsCsvTemplate()], { type: "text/csv;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "cutplan-pecas-modelo.csv";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="h-4 w-4" /> Modelo CSV
            </button>
            <button
              className={btn}
              onClick={() => {
                if (!parts.length || window.confirm("Apagar todas as peças deste projeto?"))
                  setParts([]);
              }}
              disabled={!parts.length}
            >
              Limpar
            </button>
            <button
              className={btnPrimary}
              onClick={() => setParts([...parts, makePart(parts, material)])}
            >
              <Plus className="h-4 w-4" /> Nova peça
            </button>
          </>
        }
      />

      <Panel>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-[1fr_1fr_100px_auto] sm:gap-3">
          <label className="col-span-1 block">
            <span className="mb-1 block text-xs font-medium uppercase text-muted-foreground">
              Comprimento
            </span>
            <input
              ref={lenRef}
              className={bigInput}
              inputMode="decimal"
              placeholder="800"
              value={len}
              onChange={(e) => setLen(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") widRef.current?.focus();
              }}
              onPaste={(e) => {
                const text = e.clipboardData.getData("text");
                if ((text.includes("\n") || text.includes("\t")) && pasteBulk(text))
                  e.preventDefault();
              }}
            />
          </label>
          <label className="col-span-1 block">
            <span className="mb-1 block text-xs font-medium uppercase text-muted-foreground">
              Largura
            </span>
            <input
              ref={widRef}
              className={bigInput}
              inputMode="decimal"
              placeholder="400"
              value={wid}
              onChange={(e) => setWid(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") qtyRef.current?.focus();
              }}
            />
          </label>
          <label className="col-span-1 block">
            <span className="mb-1 block text-xs font-medium uppercase text-muted-foreground">
              Qtd
            </span>
            <input
              ref={qtyRef}
              className={bigInput}
              inputMode="numeric"
              placeholder="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addRow();
              }}
            />
          </label>
          <div className="col-span-3 flex gap-2 sm:col-span-1 sm:items-end">
            <button className={cn(btnPrimary, "h-14 flex-1 sm:w-32")} onClick={addRow}>
              <Plus className="h-5 w-5" /> Adicionar
            </button>
            <button
              className={cn(btn, "h-14 w-14 shrink-0 p-0")}
              title="Tirar foto das medidas"
              onClick={() => fileRef.current?.click()}
              disabled={scanning}
            >
              {scanning ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Camera className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => void onPhoto(e.target.files?.[0])}
        />
        <input
          ref={csvRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const text = await file.text();
              const imported = parsePartsCsv(text, material, (used) =>
                nextUniqueId(new Set([...used, ...parts.map((p) => p.id)])),
              );
              if (!imported.length) toast.error("O CSV não contém linhas válidas.");
              else {
                setParts([...parts, ...imported]);
                toast.success(`${imported.length} peça(s) importada(s) do CSV`);
              }
            } catch {
              toast.error("Não foi possível ler o CSV.");
            } finally {
              e.currentTarget.value = "";
            }
          }}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Também podes colar uma lista do Excel no campo Comprimento. Para a foto, usa uma folha
          plana, boa luz e números legíveis. A leitura por IA é assistida: confirma sempre as
          medidas antes de cortar.
        </p>
      </Panel>

      {scanned ? (
        <Panel
          title={`${scanned.length} medida(s) lida(s) da foto`}
          description="Confirma antes de adicionar. Podes corrigir os valores."
          actions={
            <>
              <button className={cn(btn, "h-9")} onClick={() => setScanned(null)}>
                <X className="h-4 w-4" /> Cancelar
              </button>
              <button className={cn(btnPrimary, "h-9")} onClick={confirmScanned}>
                Adicionar todas
              </button>
            </>
          }
        >
          <div className="space-y-2">
            {scanned.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className={cn(inputClass, "w-24")}
                  type="number"
                  value={s.length}
                  onChange={(e) =>
                    setScanned(
                      scanned.map((x, j) =>
                        j === i ? { ...x, length: Math.max(1, Number(e.target.value) || 0) } : x,
                      ),
                    )
                  }
                />
                <span className="text-muted-foreground">×</span>
                <input
                  className={cn(inputClass, "w-24")}
                  type="number"
                  value={s.width}
                  onChange={(e) =>
                    setScanned(
                      scanned.map((x, j) =>
                        j === i ? { ...x, width: Number(e.target.value) } : x,
                      ),
                    )
                  }
                />
                <span className="text-muted-foreground">×</span>
                <input
                  className={cn(inputClass, "w-16")}
                  type="number"
                  value={s.quantity}
                  onChange={(e) =>
                    setScanned(
                      scanned.map((x, j) =>
                        j === i
                          ? { ...x, quantity: Math.max(1, Math.round(Number(e.target.value) || 0)) }
                          : x,
                      ),
                    )
                  }
                />
                <span className="truncate text-sm text-muted-foreground">{s.name ?? ""}</span>
                <button
                  className={cn(btn, "ml-auto h-9 w-9 p-0 text-destructive")}
                  onClick={() => setScanned(scanned.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      {missingMaterials.length > 0 ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
          Sem chapa para: {missingMaterials.join(", ")}
        </p>
      ) : null}

      {parts.length === 0 ? (
        <EmptyState
          title="Ainda não tens peças"
          description="Escreve as medidas acima, tira foto à folha de papel ou carrega o projeto demo."
        />
      ) : (
        <Panel
          title={`${parts.length} tipos · ${num(totalQty)} peças`}
          description={`Área total das peças: ${m2(totalArea)}`}
        >
          {/* Cartões no telemóvel */}
          <div className="space-y-3 md:hidden">
            {parts.map((p) => (
              <div key={p.id} className="rounded-xl border border-border p-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{p.id}</span>
                  <input
                    className={cn(inputClass, "h-9 flex-1")}
                    value={p.name}
                    onChange={(e) => update(p.id, { name: e.target.value })}
                  />
                  <button
                    className={cn(btn, "h-9 w-9 p-0")}
                    title="Duplicar"
                    onClick={() => setParts([...parts, { ...p, id: nextId(parts) }])}
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    className={cn(btn, "h-9 w-9 p-0 text-destructive")}
                    title="Eliminar"
                    onClick={() => setParts(parts.filter((x) => x.id !== p.id))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    className={cn(inputClass, "h-11 text-center text-base")}
                    value={p.length}
                    onChange={(e) => update(p.id, { length: Number(e.target.value) })}
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    className={cn(inputClass, "h-11 text-center text-base")}
                    value={p.width}
                    onChange={(e) => update(p.id, { width: Number(e.target.value) })}
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    className={cn(inputClass, "h-11 text-center text-base")}
                    value={p.quantity}
                    onChange={(e) => update(p.id, { quantity: Number(e.target.value) })}
                  />
                </div>
                {advanced ? (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input
                      className={inputClass}
                      value={p.material}
                      onChange={(e) => update(p.id, { material: e.target.value })}
                    />
                    <select
                      className={inputClass}
                      value={p.grain}
                      onChange={(e) => update(p.id, { grain: e.target.value as GrainDirection })}
                    >
                      <option value="none">Livre</option>
                      <option value="length">Comprimento</option>
                      <option value="width">Largura</option>
                    </select>
                    <input
                      className={inputClass}
                      placeholder="Fita de bordo"
                      value={p.edgeBanding}
                      onChange={(e) => update(p.id, { edgeBanding: e.target.value })}
                    />
                    <input
                      className={inputClass}
                      placeholder="Notas"
                      value={p.notes}
                      onChange={(e) => update(p.id, { notes: e.target.value })}
                    />
                  </div>
                ) : null}
                <label className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--color-primary)]"
                    checked={p.canRotate}
                    onChange={(e) => update(p.id, { canRotate: e.target.checked })}
                  />
                  Pode rodar
                </label>
              </div>
            ))}
          </div>

          {/* Tabela no computador */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">ID</th>
                  <th className="py-2 pr-3 font-medium">Nome</th>
                  <th className="py-2 pr-3 font-medium">Comp.</th>
                  <th className="py-2 pr-3 font-medium">Larg.</th>
                  <th className="py-2 pr-3 font-medium">Qtd</th>
                  <th className="py-2 pr-3 font-medium">Material</th>
                  <th className="py-2 pr-3 font-medium">Rodar</th>
                  {advanced ? (
                    <>
                      <th className="py-2 pr-3 font-medium">Sentido</th>
                      <th className="py-2 pr-3 font-medium">Fita</th>
                      <th className="py-2 pr-3 font-medium">Notas</th>
                    </>
                  ) : null}
                  <th className="py-2 pr-3" />
                </tr>
              </thead>
              <tbody>
                {parts.map((p) => (
                  <tr key={p.id} className="border-b border-border/60">
                    <td className="py-2 pr-3 font-mono text-xs">{p.id}</td>
                    <td className="py-2 pr-3">
                      <input
                        className={cn(inputClass, "min-w-32")}
                        value={p.name}
                        onChange={(e) => update(p.id, { name: e.target.value })}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="number"
                        min={1}
                        className={cn(inputClass, "w-24")}
                        value={p.length}
                        onChange={(e) => update(p.id, { length: Number(e.target.value) })}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="number"
                        min={1}
                        className={cn(inputClass, "w-24")}
                        value={p.width}
                        onChange={(e) => update(p.id, { width: Number(e.target.value) })}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="number"
                        min={1}
                        className={cn(inputClass, "w-20")}
                        value={p.quantity}
                        onChange={(e) => update(p.id, { quantity: Number(e.target.value) })}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        className={cn(inputClass, "min-w-36")}
                        value={p.material}
                        onChange={(e) => update(p.id, { material: e.target.value })}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[var(--color-primary)]"
                        checked={p.canRotate}
                        onChange={(e) => update(p.id, { canRotate: e.target.checked })}
                      />
                    </td>
                    {advanced ? (
                      <>
                        <td className="py-2 pr-3">
                          <select
                            className={cn(inputClass, "w-28")}
                            value={p.grain}
                            onChange={(e) =>
                              update(p.id, { grain: e.target.value as GrainDirection })
                            }
                          >
                            <option value="none">Livre</option>
                            <option value="length">Comprimento</option>
                            <option value="width">Largura</option>
                          </select>
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            className={cn(inputClass, "w-28")}
                            value={p.edgeBanding}
                            onChange={(e) => update(p.id, { edgeBanding: e.target.value })}
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            className={cn(inputClass, "min-w-32")}
                            value={p.notes}
                            onChange={(e) => update(p.id, { notes: e.target.value })}
                          />
                        </td>
                      </>
                    ) : null}
                    <td className="py-2 pr-3">
                      <div className="flex gap-1">
                        <button
                          className={cn(btn, "h-9 w-9 p-0")}
                          title="Duplicar"
                          onClick={() => setParts([...parts, { ...p, id: nextId(parts) }])}
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          className={cn(btn, "h-9 w-9 p-0 text-destructive")}
                          title="Eliminar"
                          onClick={() => setParts(parts.filter((x) => x.id !== p.id))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <div className="flex justify-end">
        <Link to="/otimizacao" className={btnPrimary}>
          Continuar para Otimizar <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
