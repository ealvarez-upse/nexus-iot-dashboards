import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardCanvas } from "@/components/dashboard/DashboardCanvas";
import { WidgetLibrary } from "@/components/dashboard/WidgetLibrary";
import { WidgetConfigDialog } from "@/components/dashboard/WidgetConfigDialog";
import { HtmlCardConfigDialog } from "@/components/dashboard/HtmlCardConfigDialog";
import {
  cloneModel,
  newId,
  type ImindDashboard,
  type WidgetPosition,
  type WidgetType,
} from "@/lib/dashboard/model";
import { normalizeDashboardDoc } from "@/lib/dashboard/normalize";
import { getWidgetDefinition } from "@/lib/dashboard/registry";
import { findFreePosition } from "@/lib/dashboard/layout";
import { duplicateWidget, removeWidget } from "@/lib/dashboard/ops";
import { ArrowLeft, Check, Pencil, X } from "lucide-react";
import { useNavigate, useParams } from "react-router";

/**
 * Dashboard Builder IMIND — Fase 1.
 *  - Modo vista: widgets limpios.
 *  - Modo edición: draft LOCAL (guardar/cancelar explícitos), canvas con
 *    drag/resize, biblioteca y configuración por widget.
 *  - Documentos legacy v1 se normalizan al vuelo (normalizeDashboardDoc).
 */
export default function DashboardViewPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const raw = useQuery(api.dashboards.get, { id: id as never });
  const devices = useQuery(api.devices.list);
  const saveDashboard = useMutation(api.dashboards.save);

  const rawDashboard = useMemo(() => (raw ? normalizeDashboardDoc(raw) : undefined), [raw]);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ImindDashboard | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const model = editing && draft ? draft : rawDashboard;
  const deviceOptions = (devices ?? []).map((d) => ({
    _id: d._id as string,
    name: d.name,
    latest: d.latest as Record<string, unknown> | undefined,
  }));

  if (raw === undefined) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }
  if (raw === null || !model) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-lg font-semibold">Dashboard no encontrado</p>
        <Button variant="outline" onClick={() => navigate("/app/dashboards")}>
          <ArrowLeft className="mr-2 size-4" /> Volver a dashboards
        </Button>
      </div>
    );
  }

  const enterEdit = () => {
    setDraft(cloneModel(model));
    setName(model.metadata.name);
    setSelectedId(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setDraft(null);
    setSelectedId(null);
    setEditing(false);
  };

  const saveEdit = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await saveDashboard({
        id: id as never,
        name: name.trim() || draft.metadata.name,
        description: draft.metadata.description,
        model: { ...draft, metadata: { ...draft.metadata, name: name.trim() || draft.metadata.name } },
      });
      toast.success("Dashboard guardado");
      setDraft(null);
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const addWidget = (type: WidgetType) => {
    if (!draft) return;
    const def = getWidgetDefinition(type);
    const next = cloneModel(draft);
    const pos = findFreePosition(next.widgets, def.defaultSize.w, def.defaultSize.h, next.settings.columns);
    const widget = {
      id: newId("w"),
      type,
      title: def.label,
      position: pos,
      datasourceIds: [],
      actionIds: [],
      configuration: { ...def.defaults },
    };
    next.widgets.push(widget);
    setDraft(next);
    setSelectedId(widget.id);
    setConfigId(widget.id);
  };

  const changePosition = (widgetId: string, position: WidgetPosition) => {
    if (!draft) return;
    setDraft((prev) => {
      if (!prev) return prev;
      const widgets = prev.widgets.map((w) => (w.id === widgetId ? { ...w, position } : w));
      return { ...prev, widgets };
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/app/dashboards")} aria-label="Volver">
            <ArrowLeft className="size-5" />
          </Button>
          {editing ? (
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 max-w-72 text-lg font-bold" />
          ) : (
            <h1 className="truncate text-2xl font-bold tracking-tight">{model.metadata.name}</h1>
          )}
        </div>
        {editing ? (
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">Modo edición · cambios locales</span>
            <Button variant="outline" onClick={cancelEdit}>
              <X className="mr-1 size-4" /> Cancelar
            </Button>
            <Button onClick={() => void saveEdit()} disabled={saving}>
              <Check className="mr-1 size-4" /> {saving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        ) : (
          <Button variant="outline" onClick={enterEdit}>
            <Pencil className="mr-2 size-4" /> Editar dashboard
          </Button>
        )}
      </div>
      {model.metadata.description && !editing ? (
        <p className="-mt-2 text-sm text-muted-foreground">{model.metadata.description}</p>
      ) : null}

      <DashboardCanvas
        widgets={model.widgets}
        settings={model.settings}
        datasources={model.datasources}
        actions={model.actions}
        editMode={editing}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onPositionChange={changePosition}
        onConfigure={(wid) => setConfigId(wid)}
        onDuplicate={(wid) => {
          if (!draft) return;
          const res = duplicateWidget(draft, wid);
          if (res.newWidgetId) {
            setDraft(res.model);
            setSelectedId(res.newWidgetId);
          }
        }}
        onRemove={(wid) => {
          if (!draft) return;
          setDraft(removeWidget(draft, wid));
          if (selectedId === wid) setSelectedId(null);
        }}
        onAddWidget={() => setLibraryOpen(true)}
      />

      <WidgetLibrary open={libraryOpen} onOpenChange={setLibraryOpen} onPick={addWidget} />
      {/* El HTML Card usa su editor dedicado; el resto, el diálogo genérico.
          El enrutado vive aquí (no dentro del diálogo) para no romper las
          reglas de hooks de React. */}
      {(draft ?? model).widgets.find((w) => w.id === configId)?.type === "html_card" ? (
        <HtmlCardConfigDialog
          open={configId !== null && editing}
          onOpenChange={(o) => !o && setConfigId(null)}
          dashboard={draft ?? model}
          widgetId={configId}
          devices={deviceOptions}
          onChange={(next) => setDraft(next)}
        />
      ) : (
        <WidgetConfigDialog
          open={configId !== null && editing}
          onOpenChange={(o) => !o && setConfigId(null)}
          dashboard={draft ?? model}
          widgetId={configId}
          devices={deviceOptions}
          onChange={(next) => setDraft(next)}
        />
      )}
    </div>
  );
}
