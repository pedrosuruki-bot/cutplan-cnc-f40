import { useCallback, useEffect, useRef, useState } from "react";
import type { SheetLayout } from "@/types";
import { colorForPart } from "@/lib/plan-colors";
import { mm } from "@/lib/format";
import { btn } from "@/components/ui-bits";
import { cn } from "@/lib/utils";
import { Maximize2, Minus, Plus } from "lucide-react";

interface Props {
  editable?: boolean;
  onMove?: (placementKey: string, x: number, y: number) => boolean;
  layout: SheetLayout;
  showDimensions: boolean;
  selectedPartId?: string | null;
  onSelect?: (partId: string | null) => void;
}

export function SheetPlanView({ layout, showDimensions, selectedPartId, onSelect, editable = false, onMove }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const stateRef = useRef({ zoom, offset });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragPieceRef = useRef<{ key: string; dx: number; dy: number } | null>(null);
  stateRef.current = { zoom, offset };

  const reset = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    reset();
  }, [layout.index, reset]);

  const wheelRef = useRef((e: WheelEvent) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
    const { zoom: z, offset: off } = stateRef.current;
    const next = Math.min(8, Math.max(0.5, z * Math.exp(-dy * 0.0015)));
    const k = next / z;
    setZoom(next);
    setOffset({ x: px - (px - off.x) * k, y: py - (py - off.y) * k });
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      wheelRef.current(e);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const zoomBy = (factor: number) => {
    const el = containerRef.current;
    const rect = el?.getBoundingClientRect();
    const px = (rect?.width ?? 0) / 2;
    const py = (rect?.height ?? 0) / 2;
    setZoom((z) => {
      const next = Math.min(8, Math.max(0.5, z * factor));
      const k = next / z;
      setOffset((o) => ({ x: px - (px - o.x) * k, y: py - (py - o.y) * k }));
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <div className="no-print flex flex-wrap items-center gap-2">
        <button className={cn(btn, "h-9")} onClick={() => zoomBy(1.2)}>
          <Plus className="h-4 w-4" /> Zoom
        </button>
        <button className={cn(btn, "h-9")} onClick={() => zoomBy(1 / 1.2)}>
          <Minus className="h-4 w-4" /> Zoom
        </button>
        <button className={cn(btn, "h-9")} onClick={reset}>
          <Maximize2 className="h-4 w-4" /> Ajustar ao ecrã
        </button>
        <span className="text-xs text-muted-foreground">
          Roda do rato para zoom · arrasta para mover
        </span>
      </div>

      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-xl border border-border bg-muted/30"
        style={{ touchAction: "none", cursor: drag ? "grabbing" : "grab" }}
        onPointerDown={(e) => {
          setDrag({ x: e.clientX - offset.x, y: e.clientY - offset.y });
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag) return;
          setOffset({ x: e.clientX - drag.x, y: e.clientY - drag.y });
        }}
        onPointerUp={() => setDrag(null)}
        onPointerLeave={() => setDrag(null)}
      >
        <div
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${layout.length} ${layout.width}`}
            className="block h-auto w-full"
            style={{ aspectRatio: `${layout.length} / ${layout.width}` }}
          >
            <rect
              x={0}
              y={0}
              width={layout.length}
              height={layout.width}
              fill="var(--plan-sheet)"
              stroke="var(--color-border)"
              strokeWidth={4}
            />
            {layout.offcuts.map((o, i) => (
              <g key={`o${i}`}>
                <rect
                  x={o.x}
                  y={o.y}
                  width={o.w}
                  height={o.h}
                  fill="var(--plan-offcut)"
                  fillOpacity={0.25}
                  stroke="var(--plan-offcut)"
                  strokeWidth={3}
                  strokeDasharray="18 12"
                />
                {o.w > 260 && o.h > 120 ? (
                  <text
                    x={o.x + o.w / 2}
                    y={o.y + o.h / 2}
                    textAnchor="middle"
                    fontSize={Math.min(46, o.h / 3)}
                    fill="var(--color-muted-foreground)"
                  >
                    sobra {Math.round(o.w)}×{Math.round(o.h)}
                  </text>
                ) : null}
              </g>
            ))}
            {layout.placements.map((p, i) => {
              const selected = selectedPartId === p.partId;
              const key = `${p.partId}:${p.instance}`;
              return (
                <g
                  key={`p${i}`}
                  onClick={() => onSelect?.(selected ? null : p.partId)}
                  onPointerDown={(e) => {
                    if (!editable || !onMove || !svgRef.current) return;
                    e.stopPropagation();
                    const pt = svgRef.current.createSVGPoint(); pt.x=e.clientX; pt.y=e.clientY;
                    const local=pt.matrixTransform(svgRef.current.getScreenCTM()?.inverse());
                    if(local) { dragPieceRef.current={key,dx:local.x-p.x,dy:local.y-p.y}; e.currentTarget.setPointerCapture(e.pointerId); }
                  }}
                  onPointerMove={(e) => {
                    if (!editable || !onMove || dragPieceRef.current?.key !== key || !svgRef.current) return;
                    const pt=svgRef.current.createSVGPoint(); pt.x=e.clientX; pt.y=e.clientY; const local=pt.matrixTransform(svgRef.current.getScreenCTM()?.inverse());
                    if(local) { e.currentTarget.setAttribute("transform", `translate(${local.x-dragPieceRef.current.dx-p.x} ${local.y-dragPieceRef.current.dy-p.y})`); }
                  }}
                  onPointerUp={(e) => {
                    if (!editable || !onMove || dragPieceRef.current?.key !== key || !svgRef.current) return;
                    const pt=svgRef.current.createSVGPoint(); pt.x=e.clientX; pt.y=e.clientY; const local=pt.matrixTransform(svgRef.current.getScreenCTM()?.inverse());
                    const d=dragPieceRef.current; dragPieceRef.current=null; e.currentTarget.removeAttribute("transform");
                    if(local && !onMove(key, local.x-d.dx, local.y-d.dy)) onSelect?.(p.partId);
                  }}
                  style={{ cursor: editable ? "grab" : "pointer" }}
                >
                  <title>{`${p.partId} · ${p.name} · ${Math.round(p.w)}×${Math.round(p.h)} mm${p.rotated ? " (rodada 90°)" : ""}`}</title>
                  <rect
                    x={p.x}
                    y={p.y}
                    width={p.w}
                    height={p.h}
                    fill={colorForPart(p.partId)}
                    fillOpacity={selected ? 1 : 0.75}
                    stroke={selected ? "var(--color-foreground)" : "var(--color-border)"}
                    strokeWidth={selected ? 8 : 3}
                  />
                  <text
                    x={p.x + p.w / 2}
                    y={p.y + p.h / 2 - (showDimensions ? 22 : 0)}
                    textAnchor="middle"
                    fontSize={Math.min(52, p.h / 3.2)}
                    fontWeight={700}
                    fill="oklch(0.2 0.02 60)"
                  >
                    {p.partId}
                  </text>
                  {showDimensions ? (
                    <text
                      x={p.x + p.w / 2}
                      y={p.y + p.h / 2 + 34}
                      textAnchor="middle"
                      fontSize={Math.min(44, p.h / 4)}
                      fill="oklch(0.25 0.02 60)"
                    >
                      {Math.round(p.w)}×{Math.round(p.h)}
                      {p.rotated ? " ↻" : ""}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Chapa {layout.index} · {mm(layout.length)} × {mm(layout.width)} × {layout.thickness} mm ·{" "}
        {layout.material}
      </p>
    </div>
  );
}
