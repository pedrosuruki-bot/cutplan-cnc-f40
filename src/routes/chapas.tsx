import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Copy, Plus, Trash2, Zap } from "lucide-react";
import { useProject } from "@/hooks/useProject";
import { EmptyState, PageHeader, Panel, btn, btnPrimary, inputClass } from "@/components/ui-bits";
import type { Sheet, OffcutStock } from "@/types";
import { m2 } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/chapas")({
  head: () => ({
    meta: [
      { title: "Chapas — CutPlan CNC" },
      {
        name: "description",
        content:
          "Registe as chapas disponíveis: material, dimensões, espessura, quantidade e preço.",
      },
      { property: "og:title", content: "Chapas — CutPlan CNC" },
      { property: "og:description", content: "Stock de chapas para o plano de corte." },
    ],
  }),
  component: SheetsPage,
});

function newSheet(): Sheet {
  return {
    id: crypto.randomUUID(),
    name: "Chapa",
    material: "MDF Branco 18",
    length: 2800,
    width: 2070,
    thickness: 18,
    quantity: 1,
    price: 0,
  };
}

function SheetsPage() {
  const { project, setSheets, setProject } = useProject();
  const sheets = project.sheets;

  const update = (id: string, patch: Partial<Sheet>) =>
    setSheets(sheets.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const totalArea = sheets.reduce((s, x) => s + x.length * x.width * x.quantity, 0);

  const addPreset = (length: number, width: number, thickness: number, material: string) => {
    const same = sheets.find(
      (s) =>
        s.length === length &&
        s.width === width &&
        s.thickness === thickness &&
        s.material === material,
    );
    if (same) {
      update(same.id, { quantity: same.quantity + 1 });
      return;
    }
    setSheets([
      ...sheets,
      {
        ...newSheet(),
        id: crypto.randomUUID(),
        name: material,
        material,
        length,
        width,
        thickness,
        quantity: 1,
      },
    ]);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chapas"
        subtitle="O stock disponível para o corte. As dimensões estão em milímetros."
        actions={
          <button className={btnPrimary} onClick={() => setSheets([...sheets, newSheet()])}>
            <Plus className="h-4 w-4" /> Adicionar chapa
          </button>
        }
      />

      <Panel
        title="Atalhos de chapa"
        description="Adiciona rapidamente formatos usados na oficina."
      >
        <div className="flex flex-wrap gap-2">
          <button className={btn} onClick={() => addPreset(2800, 2070, 18, "MDF Branco 18")}>
            <Zap className="h-4 w-4" /> MDF 2800×2070×18
          </button>
          <button className={btn} onClick={() => addPreset(2750, 1830, 18, "MDF 18")}>
            <Zap className="h-4 w-4" /> MDF 2750×1830×18
          </button>
          <button className={btn} onClick={() => addPreset(2440, 1220, 18, "MDF 18")}>
            <Zap className="h-4 w-4" /> MDF 2440×1220×18
          </button>
        </div>
      </Panel>

      <Panel
        title="Stock de sobras"
        description="Guarda sobras reais para o otimizador tentar usar antes de abrir uma chapa nova."
      >
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            className={btn}
            onClick={() =>
              setProject((p) => ({
                ...p,
                offcutStock: [
                  ...p.offcutStock,
                  {
                    id: crypto.randomUUID(),
                    name: `Sobra ${p.offcutStock.length + 1}`,
                    material: p.sheets[0]?.material ?? "MDF 18",
                    length: 1000,
                    width: 400,
                    thickness: p.sheets[0]?.thickness ?? 18,
                    quantity: 1,
                    price: 0,
                  },
                ],
              }))
            }
          >
            <Plus className="h-4 w-4" /> Adicionar sobra
          </button>
          <label className="inline-flex items-center gap-2 rounded-lg border px-3 text-sm">
            <input
              type="checkbox"
              checked={project.parameters.useOffcutStock !== false}
              onChange={(e) =>
                setProject((p) => ({
                  ...p,
                  parameters: { ...p.parameters, useOffcutStock: e.target.checked },
                }))
              }
            />{" "}
            Usar sobras na otimização
          </label>
        </div>
        {project.offcutStock.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-3">Nome</th>
                  <th className="py-2 pr-3">Material</th>
                  <th className="py-2 pr-3">Compr.</th>
                  <th className="py-2 pr-3">Larg.</th>
                  <th className="py-2 pr-3">Esp.</th>
                  <th className="py-2 pr-3">Qtd</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {project.offcutStock.map((o) => (
                  <tr key={o.id} className="border-b border-border/60">
                    <td className="py-2 pr-3">
                      <input
                        className={inputClass}
                        value={o.name}
                        onChange={(e) =>
                          setProject((p) => ({
                            ...p,
                            offcutStock: p.offcutStock.map((x) =>
                              x.id === o.id ? { ...x, name: e.target.value } : x,
                            ),
                          }))
                        }
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        className={inputClass}
                        value={o.material}
                        onChange={(e) =>
                          setProject((p) => ({
                            ...p,
                            offcutStock: p.offcutStock.map((x) =>
                              x.id === o.id ? { ...x, material: e.target.value } : x,
                            ),
                          }))
                        }
                      />
                    </td>
                    {(["length", "width", "thickness", "quantity"] as const).map((k) => (
                      <td className="py-2 pr-3" key={k}>
                        <input
                          type="number"
                          min={0}
                          className={cn(inputClass, "w-24")}
                          value={o[k]}
                          onChange={(e) =>
                            setProject((p) => ({
                              ...p,
                              offcutStock: p.offcutStock.map((x) =>
                                x.id === o.id ? { ...x, [k]: Number(e.target.value) } : x,
                              ),
                            }))
                          }
                        />
                      </td>
                    ))}
                    <td>
                      <button
                        className={cn(btn, "h-9 w-9 p-0 text-destructive")}
                        onClick={() =>
                          setProject((p) => ({
                            ...p,
                            offcutStock: p.offcutStock.filter((x) => x.id !== o.id),
                          }))
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma sobra registada.</p>
        )}
      </Panel>

      {sheets.length === 0 ? (
        <EmptyState
          title="Ainda não tens chapas"
          description="Adiciona a primeira chapa ou carrega o projeto demo na página Projeto."
          action={
            <button className={btnPrimary} onClick={() => setSheets([newSheet()])}>
              <Plus className="h-4 w-4" /> Adicionar chapa
            </button>
          }
        />
      ) : (
        <Panel
          title={`${sheets.length} chapa(s)`}
          description={`Área total em stock: ${m2(totalArea)}`}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Material</th>
                  <th className="py-2 pr-3 font-medium">Comprimento</th>
                  <th className="py-2 pr-3 font-medium">Largura</th>
                  <th className="py-2 pr-3 font-medium">Espessura</th>
                  <th className="py-2 pr-3 font-medium">Qtd</th>
                  <th className="py-2 pr-3 font-medium">Preço (€)</th>
                  <th className="py-2 pr-3" />
                </tr>
              </thead>
              <tbody>
                {sheets.map((s) => {
                  const invalid = s.length <= 0 || s.width <= 0 || s.quantity < 1;
                  return (
                    <tr key={s.id} className="border-b border-border/60">
                      <td className="py-2 pr-3">
                        <input
                          className={inputClass}
                          value={s.material}
                          onChange={(e) =>
                            update(s.id, { material: e.target.value, name: e.target.value })
                          }
                        />
                      </td>
                      {(["length", "width", "thickness", "quantity", "price"] as const).map((k) => (
                        <td key={k} className="py-2 pr-3">
                          <input
                            type="number"
                            min={0}
                            className={cn(inputClass, "w-28")}
                            value={s[k]}
                            onChange={(e) =>
                              update(s.id, { [k]: Number(e.target.value) } as Partial<Sheet>)
                            }
                          />
                        </td>
                      ))}
                      <td className="py-2 pr-3">
                        <div className="flex gap-1">
                          <button
                            className={cn(btn, "h-9 w-9 p-0")}
                            title="Duplicar"
                            onClick={() =>
                              setSheets([...sheets, { ...s, id: crypto.randomUUID() }])
                            }
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            className={cn(btn, "h-9 w-9 p-0 text-destructive")}
                            title="Eliminar"
                            onClick={() => setSheets(sheets.filter((x) => x.id !== s.id))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        {invalid ? (
                          <span className="text-xs text-destructive">Valores inválidos</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <div className="flex justify-end">
        <Link to="/pecas" className={btnPrimary}>
          Continuar para Peças <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
