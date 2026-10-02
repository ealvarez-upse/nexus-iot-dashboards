import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  cloneModel,
  newId,
  type Action,
  type ImindDashboard,
} from "@/lib/dashboard/model";
import { getWidgetDefinition, PALETTE } from "@/lib/dashboard/registry";
import type { ConfigField } from "@/lib/dashboard/widget-def";

export interface DeviceOption {
  _id: string;
  name: string;
  latest?: Record<string, unknown>;
}

const FALLBACK_KEYS = ["temperature", "humidity", "battery"];
const NEW_ACTION = "__new__";
const NO_ACTION = "__none__";

interface WidgetConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dashboard: ImindDashboard;
  widgetId: string | null;
  devices: DeviceOption[];
  onChange: (next: ImindDashboard) => void;
}

/**
 * Diálogo de configuración de un widget del DRAFT LOCAL (solo al Guardar):
 *  - widget.title / widget.configuration
 *  - datasource primario (se crea o actualiza; kind "telemetry")
 *  - acciones por slot (Button: actionId · Switch: onActionId/offActionId);
 *    los renderers las resuelven por widget.actionIds EN EL ORDEN de los slots.
 *  - limpia acciones/datasources huérfanos del documento.
 */
export function WidgetConfigDialog({
  open,
  onOpenChange,
  dashboard,
  widgetId,
  devices,
  onChange,
}: WidgetConfigDialogProps) {
  const widget = widgetId ? dashboard.widgets.find((w) => w.id === widgetId) : undefined;
  const def = widget ? getWidgetDefinition(widget.type) : undefined;

  const [title, setTitle] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [keys, setKeys] = useState<string[]>([]);
  const [customKey, setCustomKey] = useState("");
  const [refresh, setRefresh] = useState("");
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [slotActions, setSlotActions] = useState<Record<string, string>>({});

  // Carga el formulario SOLO al abrir o cambiar de widget. El dashboard NO va
  // en las deps para no resetear el formulario con cada cambio del draft.
  useEffect(() => {
    if (!open || !widget || !def) return;
    setTitle(widget.title);
    const ds = widget.datasourceIds[0]
      ? dashboard.datasources.find((d) => d.id === widget.datasourceIds[0])
      : undefined;
    setDeviceId(ds?.entityId ?? "");
    setKeys([...(ds?.keys ?? [])]);
    setRefresh(ds?.refreshInterval !== undefined ? String(ds.refreshInterval) : "");
    setValues({ ...(widget.configuration ?? {}) });
    const slots: Record<string, string> = {};
    (def.actionSlots ?? []).forEach((slot, i) => {
      slots[slot.key] = widget.actionIds[i] ?? "";
    });
    setSlotActions(slots);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, widgetId]);

  const selectedDevice = devices.find((d) => d._id === deviceId);
  const deviceKeys = useMemo(() => {
    const fromDevice = selectedDevice?.latest ? Object.keys(selectedDevice.latest) : [];
    const all = [...fromDevice];
    for (const k of FALLBACK_KEYS) if (!all.includes(k)) all.push(k);
    return all;
  }, [selectedDevice]);

  const availableKeys = useMemo(() => {
    const all = [...deviceKeys];
    for (const k of keys) if (!all.includes(k)) all.push(k);
    return all;
  }, [deviceKeys, keys]);

  const canSave =
    !!def && (def.dataKeys === "none" || (deviceId !== "" && title.trim() !== ""));

  const addKey = (key: string) => {
    const k = key.trim();
    if (k === "" || keys.includes(k) || keys.length >= 6) return;
    setKeys([...keys, k]);
    setCustomKey("");
  };
  const removeKey = (key: string) => setKeys(keys.filter((k) => k !== key));

  const persist = () => {
    if (!widget || !def || !canSave) return;
    const next = cloneModel(dashboard);
    const w = next.widgets.find((x) => x.id === widget.id);
    if (!w) return;
    w.title = title.trim() || w.title;
    w.configuration = { ...values };

    // --- Datasource primario: crear / actualizar / quitar ---
    const cleanKeys = keys.map((k) => k.trim()).filter((k) => k !== "");
    const oldDsId = w.datasourceIds[0];
    if (def.dataKeys === "none" || deviceId === "") {
      w.datasourceIds = [];
    } else {
      const existing = oldDsId ? next.datasources.find((d) => d.id === oldDsId) : undefined;
      if (existing) {
        existing.kind = "telemetry";
        existing.entityType = "device";
        existing.entityId = deviceId;
        existing.keys = cleanKeys;
        if (refresh.trim() !== "") existing.refreshInterval = Number(refresh);
        else delete existing.refreshInterval;
        w.datasourceIds = [existing.id];
      } else {
        const dsId = newId("ds");
        next.datasources.push({
          id: dsId,
          kind: "telemetry",
          entityType: "device",
          entityId: deviceId,
          keys: cleanKeys,
          ...(refresh.trim() !== "" ? { refreshInterval: Number(refresh) } : {}),
        });
        w.datasourceIds = [dsId];
      }
    }

    // --- Acciones por slot: reutilizar existente o crear nueva ---
    const trigger = w.type === "switch" ? "on_change" : "on_click";
    const resolved: string[] = [];
    (def.actionSlots ?? []).forEach((slot) => {
      const raw = slotActions[slot.key] ?? NO_ACTION;
      const sel = raw === NO_ACTION ? "" : raw;
      if (sel === NEW_ACTION) {
        const actionId = newId("act");
        const action: Action = {
          id: actionId,
          trigger,
          type: "send_command",
          payload: { command: slot.key === "offActionId" ? "OFF" : "ON" },
          ...(deviceId !== ""
            ? { target: { entityType: "device" as const, entityId: deviceId } }
            : {}),
        };
        next.actions.push(action);
        resolved.push(actionId);
      } else if (sel !== "") {
        const action = next.actions.find((a) => a.id === sel);
        if (action && deviceId !== "") {
          action.target = { entityType: "device", entityId: deviceId };
        }
        resolved.push(sel);
      }
    });
    w.actionIds = resolved.filter((id, i, arr) => arr.indexOf(id) === i);

    // --- Limpieza de huérfanos (sin referencia desde ningún widget) ---
    const referencedActions = new Set<string>();
    for (const anyW of next.widgets) for (const aid of anyW.actionIds) referencedActions.add(aid);
    next.actions = next.actions.filter((a) => referencedActions.has(a.id));
    const referencedDs = new Set<string>();
    for (const anyW of next.widgets) for (const did of anyW.datasourceIds) referencedDs.add(did);
    next.datasources = next.datasources.filter((d) => referencedDs.has(d.id));

    onChange(next);
    onOpenChange(false);
  };

  if (!def || !widget) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar widget</DialogTitle>
            <DialogDescription>Selecciona un widget del canvas.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const visibleFields = def.configSchema.filter((f) => {
    if (!f.showIf) return true;
    return String(values[f.showIf.key]) === String(f.showIf.equals);
  });
  const grouped: { label: string; fields: ConfigField[] }[] = [
    {
      label: "Datos y comportamiento",
      fields: visibleFields.filter((f) => (f.group ?? "general") === "general"),
    },
    { label: "Apariencia", fields: visibleFields.filter((f) => f.group === "appearance") },
    { label: "Avanzado", fields: visibleFields.filter((f) => f.group === "advanced") },
  ];

  const targetNameFor = (entityId?: string) => {
    if (!entityId) return "sin destino";
    return devices.find((d) => d._id === entityId)?.name ?? entityId;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar widget</DialogTitle>
          <DialogDescription>{def.label}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="cfg-title">Título</Label>
            <Input
              id="cfg-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nombre visible del widget"
            />
          </div>

          {def.dataKeys !== "none" && (
            <>
              <div className="grid gap-1.5">
                <Label>Dispositivo</Label>
                <Select
                  value={deviceId || undefined}
                  onValueChange={(v) => {
                    setDeviceId(v);
                    setKeys([]);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona un dispositivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {devices.map((d) => (
                      <SelectItem key={d._id} value={d._id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {def.dataKeys === "single" ? (
                <div className="grid gap-1.5">
                  <Label>Clave de datos</Label>
                  <Select value={keys[0] || undefined} onValueChange={(v) => setKeys([v])}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona una clave" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableKeys.map((k) => (
                        <SelectItem key={k} value={k}>
                          {k}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="grid gap-1.5">
                  <Label>Claves de datos ({keys.length})</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {availableKeys.map((k) => {
                      const active = keys.includes(k);
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => (active ? removeKey(k) : addKey(k))}
                          className={
                            "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors " +
                            (active
                              ? "border-primary bg-primary/15 text-primary"
                              : "bg-muted/50 text-muted-foreground hover:bg-muted")
                          }
                        >
                          {k}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      value={customKey}
                      onChange={(e) => setCustomKey(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addKey(customKey);
                        }
                      }}
                      placeholder="Clave personalizada (ej. setpoint)"
                      className="h-8"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0"
                      onClick={() => addKey(customKey)}
                    >
                      <Plus className="size-4" /> Agregar
                    </Button>
                  </div>
                </div>
              )}

              <div className="grid gap-1.5">
                <Label htmlFor="cfg-refresh">Actualizar cada (segundos)</Label>
                <Input
                  id="cfg-refresh"
                  type="number"
                  min={5}
                  value={refresh}
                  onChange={(e) => setRefresh(e.target.value)}
                  placeholder="Convex es push-reactivo; relevante con MQTT/HTTP"
                />
              </div>
            </>
          )}

          {(def.actionSlots ?? []).map((slot) => (
            <div key={slot.key} className="grid gap-1.5">
              <Label>{slot.label}</Label>
              <Select
                value={slotActions[slot.key] || NO_ACTION}
                onValueChange={(v) => setSlotActions({ ...slotActions, [slot.key]: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sin acción" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ACTION}>Sin acción</SelectItem>
                  <SelectItem value={NEW_ACTION}>Crear nueva acción…</SelectItem>
                  {dashboard.actions.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      send_command
                      {a.payload && typeof a.payload.command === "string"
                        ? ` ${a.payload.command}`
                        : ""}{' '}
                      → {targetNameFor(a.target?.entityId)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}

          {grouped.map((g) =>
            g.fields.length === 0 ? null : (
              <section
                key={g.label}
                className="flex flex-col gap-3 rounded-xl border bg-background/60 p-3"
              >
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {g.label}
                </h3>
                {g.fields.map((field) => (
                  <FieldRenderer
                    key={field.key}
                    field={field}
                    value={values[field.key]}
                    onChange={(v) =>
                      setValues((prev) => {
                        const copy = { ...prev };
                        if (v === undefined) delete copy[field.key];
                        else copy[field.key] = v;
                        return copy;
                      })
                    }
                  />
                ))}
              </section>
            ),
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={persist} disabled={!canSave}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Campo declarativo del configSchema → control real. Es el formulario
 * genérico: cada widget define sus campos y este los renderiza sin
 * conocer el tipo concreto.
 */
function FieldRenderer({
  field,
  value,
  onChange,
}: {
  field: ConfigField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const id = `cfg-${field.key}`;

  if (field.type === "switch") {
    return (
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id} className="font-normal">
          {field.label}
        </Label>
        <Switch id={id} checked={value === true} onCheckedChange={(c) => onChange(c)} />
      </div>
    );
  }

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{field.label}</Label>

      {field.type === "text" && (
        <Input
          id={id}
          value={
            typeof value === "string"
              ? value
              : value === undefined || value === null
                ? ""
                : String(value)
          }
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
        />
      )}

      {field.type === "number" && (
        <Input
          id={id}
          type="number"
          min={field.min}
          max={field.max}
          step={field.step}
          value={
            value === undefined || value === null || value === "" ? "" : String(value)
          }
          onChange={(e) => {
            const raw = e.target.value;
            if (raw.trim() === "") {
              onChange(undefined);
              return;
            }
            const n = Number(raw);
            if (!Number.isNaN(n)) onChange(n);
          }}
        />
      )}

      {field.type === "textarea" && (
        <Textarea
          id={id}
          rows={field.rows ?? 4}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="font-mono text-xs"
        />
      )}

      {field.type === "select" && (
        <Select
          value={typeof value === "string" && value !== "" ? value : undefined}
          onValueChange={(v) => onChange(v)}
        >
          <SelectTrigger id={id} className="w-full">
            <SelectValue placeholder="Selecciona…" />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {field.type === "color" && (
        <ColorPicker value={typeof value === "string" ? value : undefined} onChange={onChange} />
      )}

      {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
    </div>
  );
}

/** Selector de color con la paleta del registry (sin dependencias extra). */
function ColorPicker({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (v: unknown) => void;
}) {
  const colors = useMemo(() => {
    const all = [...PALETTE];
    if (value && !all.includes(value)) all.push(value);
    return all;
  }, [value]);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={c}
          title={c}
          onClick={() => onChange(c)}
          className={
            "size-7 rounded-full border-2 transition-transform hover:scale-110 " +
            (value === c ? "border-foreground ring-2 ring-ring" : "border-transparent")
          }
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}
