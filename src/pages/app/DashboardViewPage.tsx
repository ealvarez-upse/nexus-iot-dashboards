import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TelemetryWidget } from "@/components/widgets/TelemetryWidget";
import {
  WIDGET_TYPE_LABEL,
  WIDGET_WIDTH_CLASS,
  type WidgetConfig,
  type WidgetType,
  type WidgetWidth,
  PALETTE,
} from "@/components/widgets/types";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, Minus, Pencil, Plus } from "lucide-react";

function randomId() {
  return `w${Math.random().toString(36).slice(2, 9)}`;
}

export default function DashboardViewPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const dashboard = useQuery(api.dashboards.get, { id: id as never });
  const devices = useQuery(api.devices.list);
  const setWidgets = useMutation(api.dashboards.setWidgets);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<WidgetConfig | null>(null);
  const [draft, setDraft] = useState<WidgetConfig>({
    id: "",
    type: "timeSeries",
    title: "",
    deviceId: "",
    dataKey: "temperature",
    unit: "°C",
    color: PALETTE[0],
    width: "1/2",
  });
  const [saving, setSaving] = useState(false);

  if (dashboard === undefined) {
    return <div className="flex flex-col gap-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-72 rounded-xl" /></div>;
  }
  if (dashboard === null) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-lg font-semibold">Dashboard no encontrado</p>
        <Button variant="outline" onClick={() => navigate("/app/dashboards")}>
          <ArrowLeft className="mr-2 size-4" /> Volver a dashboards
        </Button>
      </div>
    );
  }

  const deviceList = devices ?? [];
  const widgets = dashboard.widgets ?? [];

  const openCreate = () => {
    setEditing(null);
    setDraft({
      id: randomId(),
      type: "timeSeries",
      title: "",
      deviceId: deviceList[0]?._id ?? "",
      dataKey: "temperature",
      unit: "°C",
      color: PALETTE[0],
      width: "1/2",
    });
    setEditOpen(true);
  };

  const openEdit = (w: WidgetConfig) => {
    setEditing(w);
    setDraft({ ...w });
    setEditOpen(true);
  };

  const saveWidget = async () => {
    if (!draft.title.trim() || !draft.deviceId) return;
    setSaving(true);
    try {
      const next = (
        editing
          ? widgets.map((w) => (w.id === editing.id ? draft : w))
          : [...widgets, draft]
      ) as typeof widgets;
      await setWidgets({ id: dashboard._id, widgets: next });
      setEditOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const removeWidget = async (wid: string) => {
    await setWidgets({ id: dashboard._id, widgets: widgets.filter((w) => w.id !== wid) });
  };

  const selectedDevice = deviceList.find((d) => d._id === draft.deviceId);
  const deviceKeys = selectedDevice
    ? Object.keys(selectedDevice.latest ?? {})
    : ["temperature", "humidity"];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/app/dashboards")} aria-label="Volver">
              <ArrowLeft className="size-5" />
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">{dashboard.name}</h1>
          </div>
          {dashboard.description ? (
            <p className="ml-12 text-sm text-muted-foreground">{dashboard.description}</p>
          ) : null}
        </div>
        <Button onClick={openCreate} disabled={deviceList.length === 0}>
          <Plus className="mr-2 size-4" /> Agregar widget
        </Button>
      </div>

      {deviceList.length === 0 ? (
        <div className="card-layered rounded-xl border bg-card p-10 text-center">
          <p className="font-medium">Primero registra un dispositivo</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Los widgets necesitan un dispositivo del cual leer telemetría.{" "}
            <Link to="/app/dispositivos" className="text-primary underline underline-offset-4">
              Ir a dispositivos
            </Link>
          </p>
        </div>
      ) : widgets.length === 0 ? (
        <div className="card-layered rounded-xl border bg-card p-10 text-center">
          <p className="font-medium">Dashboard vacío</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Agrega tu primer widget: serie temporal, valor actual o indicador.
          </p>
          <Button className="mt-4" onClick={openCreate}>
            <Plus className="mr-2 size-4" /> Agregar widget
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-6">
          {widgets.map((w) => (
            <div key={w.id} className={WIDGET_WIDTH_CLASS[w.width]}>
              <div className="group relative">
                <div className="absolute -top-2 right-2 z-10 flex gap-1 opacity-0 transition group-hover:opacity-100">
                  <button
                    className="rounded-md bg-background/90 p-1.5 shadow-sm ring-1 ring-border hover:bg-accent"
                    onClick={() => openEdit(w)}
                    aria-label="Editar widget"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    className="rounded-md bg-background/90 p-1.5 shadow-sm ring-1 ring-border hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => void removeWidget(w.id)}
                    aria-label="Eliminar widget"
                  >
                    <Minus className="size-3.5" />
                  </button>
                </div>
                <TelemetryWidget widget={w} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialogo crear/editar widget */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar widget" : "Nuevo widget"}</DialogTitle>
            <DialogDescription>
              Conecta una gráfica a la telemetría de cualquier dispositivo.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Tipo</Label>
                <Select
                  value={draft.type}
                  onValueChange={(v) => setDraft({ ...draft, type: v as WidgetType })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(WIDGET_TYPE_LABEL).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Ancho</Label>
                <Select
                  value={draft.width}
                  onValueChange={(v) => setDraft({ ...draft, width: v as WidgetWidth })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1/3">Tercio (1/3)</SelectItem>
                    <SelectItem value="1/2">Mitad (1/2)</SelectItem>
                    <SelectItem value="2/3">Dos tercios (2/3)</SelectItem>
                    <SelectItem value="1">Ancho completo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Título</Label>
              <Input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Ej. Temperatura · Cuarto frío 1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Dispositivo</Label>
                <Select
                  value={draft.deviceId}
                  onValueChange={(v) => setDraft({ ...draft, deviceId: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Elegir…" /></SelectTrigger>
                  <SelectContent>
                    {deviceList.map((d) => (
                      <SelectItem key={d._id} value={d._id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Clave de datos</Label>
                <Select
                  value={draft.dataKey}
                  onValueChange={(v) => setDraft({ ...draft, dataKey: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Elegir…" /></SelectTrigger>
                  <SelectContent>
                    {(deviceKeys.length > 0 ? deviceKeys : ["temperature", "humidity"]).map((k) => (
                      <SelectItem key={k} value={k}>{k}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Unidad</Label>
                <Input
                  value={draft.unit ?? ""}
                  onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                  placeholder="°C, %, …"
                />
              </div>
              <div className="grid gap-2">
                <Label>Color</Label>
                <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
                  {PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setDraft({ ...draft, color: c })}
                      className={`size-6 rounded-full ring-offset-2 transition ${
                        draft.color === c ? "ring-2 ring-ring" : ""
                      }`}
                      style={{ backgroundColor: c }}
                      aria-label={`Color ${c}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={saveWidget} disabled={saving || !draft.title.trim() || !draft.deviceId}>
              {saving ? "Guardando…" : editing ? "Guardar cambios" : "Agregar widget"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
