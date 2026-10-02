import type { CSSProperties } from "react";
import { Copy, GripVertical, MoveDiagonal, Settings2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { configWithDefaults } from "@/lib/dashboard/registry";
import { useWidgetData } from "@/lib/dashboard/datasource";
import type { Action, Datasource, Widget, WidgetPosition } from "@/lib/dashboard/model";
import type { WidgetDefinition } from "@/lib/dashboard/widget-def";

export interface WidgetFrameProps {
  widget: Widget;
  def: WidgetDefinition;
  datasource?: Datasource;
  actions: Action[];
  editMode: boolean;
  selected: boolean;
  dragging: boolean;
  styleVars: Record<string, string>;
  onSelect: () => void;
  onDragStart: (e: React.PointerEvent) => void;
  onResizeStart: (e: React.PointerEvent) => void;
  onConfigure: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onPositionChange: (position: WidgetPosition) => void;
}

/**
 * Chrome de un widget sobre el canvas.
 *  - Modo vista: solo el renderer, limpio.
 *  - Modo edición: borde de selección, handle de drag, toolbar
 *    (configurar/duplicar/eliminar) y handle de resize.
 * Los datos llegan por useWidgetData (datasource abstraction).
 */
export function WidgetFrame({
  widget,
  def,
  datasource,
  actions,
  editMode,
  selected,
  dragging,
  styleVars,
  onSelect,
  onDragStart,
  onResizeStart,
  onConfigure,
  onDuplicate,
  onRemove,
}: WidgetFrameProps) {
  const config = configWithDefaults(widget.type, widget.configuration);
  const data = useWidgetData(datasource);
  const actionsById: Record<string, Action> = {};
  for (const a of actions) actionsById[a.id] = a;
  const Renderer = def.Renderer;

  return (
    <div
      style={
        {
          ...styleVars,
          zIndex: dragging ? 30 : selected ? 20 : undefined,
        } as CSSProperties
      }
      className={cn(
        "relative h-[var(--wh)] w-full outline-none",
        "md:absolute md:left-[var(--wx)] md:top-[var(--wy)] md:h-[var(--wh)] md:w-[var(--ww)]",
        editMode && "cursor-default",
      )}
      onPointerDown={editMode ? onSelect : undefined}
    >
      <div
        className={cn(
          "h-full w-full rounded-xl transition-shadow duration-150",
          editMode && selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
          editMode && !selected && "ring-1 ring-border/70",
        )}
      >
        {/* Toolbar de edición */}
        {editMode ? (
          <>
            <div
              onPointerDown={onDragStart}
              style={{ touchAction: "none" }}
              title="Mover widget"
              className="absolute -top-3 left-2 z-30 flex h-6 w-6 cursor-grab items-center justify-center rounded-md border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground active:cursor-grabbing"
            >
              <GripVertical className="size-3.5" />
            </div>
            <div
              className="absolute -top-3 right-2 z-30 flex items-center gap-1 rounded-md border border-border bg-background p-0.5 shadow-sm"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <FrameButton title="Configurar" onClick={onConfigure}>
                <Settings2 className="size-3.5" />
              </FrameButton>
              <FrameButton title="Duplicar" onClick={onDuplicate}>
                <Copy className="size-3.5" />
              </FrameButton>
              <FrameButton title="Eliminar" onClick={onRemove} danger>
                <Trash2 className="size-3.5" />
              </FrameButton>
            </div>
          </>
        ) : null}

        {/* Contenido: se neutraliza el puntero mientras se arrastra/resize */}
        <div className={cn("h-full w-full", dragging && "pointer-events-none select-none")}>
          <Renderer
            widget={widget}
            config={config}
            data={data}
            editMode={editMode}
            actionsById={actionsById}
          />
        </div>

        {/* Handle de resize */}
        {editMode ? (
          <div
            onPointerDown={onResizeStart}
            style={{ touchAction: "none" }}
            title="Redimensionar"
            className="absolute bottom-1 right-1 z-30 flex h-5 w-5 cursor-nwse-resize items-center justify-center rounded text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
          >
            <MoveDiagonal className="size-3.5" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FrameButton({
  children,
  title,
  onClick,
  danger = false,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(
        "flex size-6 cursor-pointer items-center justify-center rounded transition-colors",
        danger
          ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
