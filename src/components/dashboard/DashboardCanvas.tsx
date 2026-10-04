import { useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { getWidgetDefinition } from "@/lib/dashboard/registry";
import {
  canvasHeight,
  clampMove,
  clampResize,
  computeMetrics,
  findFreePosition,
  pxH,
  pxW,
  pxX,
  pxY,
} from "@/lib/dashboard/layout";
import type {
  Action,
  DashboardSettings,
  Datasource,
  Widget,
  WidgetPosition,
} from "@/lib/dashboard/model";
import { WidgetFrame } from "./WidgetFrame";

type DragMode = "move" | "resize";

interface DragState {
  id: string;
  mode: DragMode;
  startX: number;
  startY: number;
  orig: WidgetPosition;
  minW: number;
  minH: number;
}

export interface DashboardCanvasProps {
  widgets: Widget[];
  settings: DashboardSettings;
  datasources: Datasource[];
  actions: Action[];
  editMode: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onPositionChange: (id: string, position: WidgetPosition) => void;
  onConfigure: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onAddWidget: () => void;
}

/**
 * Lienzo del dashboard.
 *  - Desktop (md+): posicionamiento absoluto en cuadrícula de 12 columnas
 *    con drag & drop y resize por pointer events.
 *  - Móvil: apilado automático (el modelo no cambia; el motor decide).
 */
export function DashboardCanvas({
  widgets,
  settings,
  datasources,
  actions,
  editMode,
  selectedId,
  onSelect,
  onPositionChange,
  onConfigure,
  onDuplicate,
  onRemove,
  onAddWidget,
}: DashboardCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  /** Id del widget en drag (estado puro: nada de refs leídas durante el render). */
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const metrics = useMemo(
    () => computeMetrics(containerWidth || 1200, settings),
    [containerWidth, settings],
  );
  const metricsRef = useRef(metrics);
  useEffect(() => {
    metricsRef.current = metrics;
  }, [metrics]);

  const widgetsRef = useRef(widgets);
  useEffect(() => {
    widgetsRef.current = widgets;
  }, [widgets]);

  const onPositionChangeRef = useRef(onPositionChange);
  useEffect(() => {
    onPositionChangeRef.current = onPositionChange;
  }, [onPositionChange]);

  // Ancho del contenedor para métricas de la cuadrícula
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth);
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function startDrag(id: string, mode: DragMode, e: React.PointerEvent) {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();
    const widget = widgetsRef.current.find((w) => w.id === id);
    if (!widget) return;
    const def = getWidgetDefinition(widget.type);
    dragRef.current = {
      id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      orig: { ...widget.position },
      minW: def.minSize.w,
      minH: def.minSize.h,
    };
    setDraggingId(id);
    onSelect(id);
  }

  // Listeners globales mientras dura el drag
  useEffect(() => {
    if (draggingId === null) return;

    function applyPosition(next: WidgetPosition, current: WidgetPosition) {
      if (
        next.x !== current.x ||
        next.y !== current.y ||
        next.w !== current.w ||
        next.h !== current.h
      ) {
        const d = dragRef.current;
        if (d) onPositionChangeRef.current(d.id, next);
      }
    }

    function onPointerMove(e: PointerEvent) {
      const d = dragRef.current;
      if (!d) return;
      const m = metricsRef.current;
      const dx = Math.round((e.clientX - d.startX) / (m.colWidth + m.margin));
      const dy = Math.round((e.clientY - d.startY) / (m.rowHeight + m.margin));
      const current = widgetsRef.current.find((w) => w.id === d.id)?.position;
      if (!current) return;
      if (d.mode === "move") {
        applyPosition(clampMove(d.orig, dx, dy, m.columns), current);
      } else {
        applyPosition(clampResize(d.orig, dx, dy, { w: d.minW, h: d.minH }, m.columns), current);
      }
    }

    function onPointerUp() {
      dragRef.current = null;
      setDraggingId(null);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [draggingId]);

  const heightPx = canvasHeight(widgets, metrics);
  const addTile = editMode
    ? findFreePosition(widgets, 4, 2, metrics.columns)
    : null;
  const canvasH = addTile
    ? Math.max(heightPx, pxY(addTile.y + addTile.h, metrics) + pxH(addTile.h, metrics) - pxH(1, metrics))
    : heightPx;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex w-full flex-col gap-3",
        editMode && "rounded-xl",
        "md:block md:relative md:h-[var(--canvas-h)]",
      )}
      style={
        {
          "--canvas-h": `${canvasH}px`,
        } as React.CSSProperties
      }
      onPointerDown={(e) => {
        // click en el fondo: deseleccionar
        if (e.target === e.currentTarget) onSelect(null);
      }}
    >
      {editMode ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 hidden rounded-xl opacity-60 md:block"
          style={{
            backgroundImage: `repeating-linear-gradient(90deg, oklch(0.62 0.125 195 / 0.10) 0 1px, transparent 1px ${Math.round(
              metrics.colWidth + metrics.margin,
            )}px)`,
          }}
        />
      ) : null}

      {widgets.length === 0 && !editMode ? (
        <div className="card-layered flex h-40 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-card/50 text-center">
          <p className="text-sm font-medium">Dashboard vacío</p>
          <p className="text-xs text-muted-foreground">
            Entra en modo edición para agregar tu primer widget.
          </p>
        </div>
      ) : null}

      {widgets.map((widget) => {
        const def = getWidgetDefinition(widget.type);
        const ds = datasources.find((d) => d.id === widget.datasourceIds[0]);
        const dragging = draggingId === widget.id;
        return (
          <WidgetFrame
            key={widget.id}
            widget={widget}
            def={def}
            datasource={ds}
            actions={actions}
            editMode={editMode}
            selected={selectedId === widget.id}
            dragging={dragging}
            styleVars={{
              "--wx": `${pxX(widget.position.x, metrics)}px`,
              "--wy": `${pxY(widget.position.y, metrics)}px`,
              "--ww": `${pxW(widget.position.w, metrics)}px`,
              "--wh": `${pxH(widget.position.h, metrics)}px`,
            }}
            onSelect={() => onSelect(widget.id)}
            onDragStart={(e) => startDrag(widget.id, "move", e)}
            onResizeStart={(e) => startDrag(widget.id, "resize", e)}
            onConfigure={() => onConfigure(widget.id)}
            onDuplicate={() => onDuplicate(widget.id)}
            onRemove={() => onRemove(widget.id)}
            onPositionChange={(position) => onPositionChange(widget.id, position)}
          />
        );
      })}

      {/* Tile "+ Agregar widget" en modo edición */}
      {addTile ? (
        <button
          type="button"
          onClick={onAddWidget}
          className={cn(
            "relative flex h-24 w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 text-primary transition-colors hover:border-primary/70 hover:bg-primary/10",
            "md:absolute md:h-[var(--tile-h)] md:w-[var(--tile-w)] md:left-[var(--tile-x)] md:top-[var(--tile-y)]",
          )}
          style={
            {
              "--tile-x": `${pxX(addTile.x, metrics)}px`,
              "--tile-y": `${pxY(addTile.y, metrics)}px`,
              "--tile-w": `${pxW(addTile.w, metrics)}px`,
              "--tile-h": `${pxH(addTile.h, metrics)}px`,
            } as React.CSSProperties
          }
        >
          <Plus className="size-5" />
          <span className="text-xs font-semibold">Agregar widget</span>
        </button>
      ) : null}

      {/* Velo que evita que iframes/gráficas roben el puntero durante el drag */}
      {draggingId !== null ? (
        <div
          className="fixed inset-0 z-40 cursor-grabbing"
          style={{ touchAction: "none" }}
        />
      ) : null}
    </div>
  );
}
