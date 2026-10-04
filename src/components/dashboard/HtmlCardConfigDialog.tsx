/**
 * ============================================================
 *  EDITOR DEL HTML CARD (Fase 2)
 * ============================================================
 *
 * Diálogo dedicado (el formulario genérico no abre este tipo):
 *  - Título, pestañas HTML/CSS/JavaScript con CodeMirror 6.
 *  - Vista previa en el MISMO sandbox que el renderer (allow-scripts +
 *    CSP sin red) con botón "Ejecutar / actualizar" y mensajes de error.
 *  - Dispositivo y claves del datasource primario (capa useWidgetData).
 *  - Acciones permitidas: token visible por el JS + acción del documento;
 *    opcionalmente piden confirmación (window.confirm en el HOST).
 *  - Guardar escribe en el DRAFT local (cancelar descarta): al reabrir se
 *    recarga siempre la última configuración guardada.
 *
 * La vista previa SIMULA las acciones (no envía comandos reales).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { html as htmlLang } from "@codemirror/lang-html";
import { css as cssLang } from "@codemirror/lang-css";
import { javascript as jsLang } from "@codemirror/lang-javascript";
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
import { cloneModel, newId, type Action, type ImindDashboard } from "@/lib/dashboard/model";
import { HTML_CARD_FORMAT_VERSION } from "@/lib/dashboard/htmlcard/defaults";
import {
  buildSnapshot,
  parseAllowedActions,
  type AllowedAction,
} from "@/lib/dashboard/htmlcard/protocol";
import { buildSandboxDoc, SANDBOX_ATTR } from "@/lib/dashboard/htmlcard/srcdoc";
import { useImindSandbox, type ImindSandboxHandlers } from "@/components/widgets/renderers/htmlcard/use-imind-sandbox";
import type { WidgetData } from "@/lib/dashboard/datasource";
import type { DeviceOption } from "./WidgetConfigDialog";

const NEW_ACTION = "__new__";
const NO_ACTION = "__none__";
const MAX_ROWS = 6;

interface ActionRow {
  id: string;
  token: string;
  actionId: string;
  newCommand: string;
  confirm: boolean;
}

export interface HtmlCardConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dashboard: ImindDashboard;
  widgetId: string | null;
  devices: DeviceOption[];
  onChange: (next: ImindDashboard) => void;
}

export function HtmlCardConfigDialog({
  open,
  onOpenChange,
  dashboard,
  widgetId,
  devices,
  onChange,
}: HtmlCardConfigDialogProps) {
  const widget = widgetId ? dashboard.widgets.find((w) => w.id === widgetId) : undefined;

  const [title, setTitle] = useState("");
  const [html, setHtml] = useState("");
  const [css, setCss] = useState("");
  const [javascript, setJavascript] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [keys, setKeys] = useState<string[]>([]);
  const [customKey, setCustomKey] = useState("");
  const [rows, setRows] = useState<ActionRow[]>([]);
  const [tab, setTab] = useState<"html" | "css" | "javascript">("html");
  const [previewDoc, setPreviewDoc] = useState("");
  const [runId, setRunId] = useState(1);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [lastFormKey, setLastFormKey] = useState<string | null>(null);

  // Carga del formulario con el patrón "ajustar estado durante el render":
  // reabrir el MISMO widget recarga desde el draft; escribir no dispara reset.
  const formKey = `${open ? "open" : "closed"}-${widgetId ?? "none"}`;
  if (formKey !== lastFormKey) {
    setLastFormKey(formKey);
    if (open && widget) {
      const cfg = (widget.configuration ?? {}) as Record<string, unknown>;
      const ds = widget.datasourceIds[0]
        ? dashboard.datasources.find((d) => d.id === widget.datasourceIds[0])
        : undefined;
      setTitle(widget.title);
      setHtml(typeof cfg.html === "string" ? cfg.html : "");
      setCss(typeof cfg.css === "string" ? cfg.css : "");
      setJavascript(typeof cfg.javascript === "string" ? cfg.javascript : "");
      setDeviceId(ds?.entityId ?? "");
      setKeys([...(ds?.keys ?? [])]);
      setCustomKey("");
      const allowed = parseAllowedActions(cfg.allowedActions);
      setRows(
        allowed.map((a, i) => ({
          id: `row-${i}-${a.token}`,
          token: a.token,
          actionId: widget.actionIds[a.index] ?? "",
          newCommand: "ON",
          confirm: a.confirm === true,
        })),
      );
      setTab("html");
      setPreviewDoc(buildSandboxDoc({
        html: typeof cfg.html === "string" ? cfg.html : "",
        css: typeof cfg.css === "string" ? cfg.css : "",
        javascript: typeof cfg.javascript === "string" ? cfg.javascript : "",
      }));
      setRunId(1);
      setPreviewError(null);
    } else {
      setTitle("");
      setHtml("");
      setCss("");
      setJavascript("");
      setDeviceId("");
      setKeys([]);
      setCustomKey("");
      setRows([]);
      setPreviewDoc("");
      setPreviewError(null);
    }
  }

  const selectedDevice = devices.find((d) => d._id === deviceId);
  const deviceKeys = useMemo(() => {
    const fromDevice = selectedDevice?.latest ? Object.keys(selectedDevice.latest) : [];
    const all = [...fromDevice];
    for (const k of ["temperature", "humidity", "battery"]) if (!all.includes(k)) all.push(k);
    return all;
  }, [selectedDevice]);
  const availableKeys = useMemo(() => {
    const all = [...deviceKeys];
    for (const k of keys) if (!all.includes(k)) all.push(k);
    return all;
  }, [deviceKeys, keys]);

  const addKey = (key: string) => {
    const k = key.trim();
    if (k === "" || keys.includes(k) || keys.length >= 6) return;
    setKeys([...keys, k]);
    setCustomKey("");
  };

  // Vista previa: snapshot whitelisted con los datos REALES del dispositivo
  // seleccionado (los mismos que entregará useWidgetData al guardar).
  const previewData = useMemo<WidgetData>(() => {
    const dev = devices.find((d) => d._id === deviceId);
    const latest: Record<string, number | undefined> = {};
    if (dev?.latest) {
      const raw = dev.latest as Record<string, unknown>;
      for (const k of keys) {
        if (typeof raw[k] === "number") latest[k] = raw[k] as number;
      }
    }
    return {
      loading: false,
      series: {},
      latest,
      alarms: [],
      device: dev ? { _id: dev._id, name: dev.name } : undefined,
    };
  }, [devices, deviceId, keys]);
  const snapshot = useMemo(() => buildSnapshot(previewData), [previewData]);

  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  // Handler de la vista previa: whitelist de tokens ACTUAL + simulación.
  const previewHandlers = useMemo<ImindSandboxHandlers>(
    () => ({
      onError: (message) => setPreviewError(message),
      onAction: (token, respond) => {
        const entry = rowsRef.current.find((r) => r.token.trim() === token);
        if (!entry || entry.actionId === "") {
          respond(false, `Token de acción no permitido: ${token}`);
          return;
        }
        if (entry.confirm && !window.confirm(`¿Ejecutar la acción "${token}"?`)) {
          respond(false, "Acción cancelada por el usuario");
          return;
        }
        respond(true, "Simulada en la vista previa (al guardar se ejecuta vía commands.simulate)");
      },
    }),
    [setPreviewError],
  );
  const previewRef = useRef<HTMLIFrameElement | null>(null);
  useImindSandbox({ iframeRef: previewRef, snapshot, handlers: previewHandlers });

  const runPreview = () => {
    setPreviewDoc(buildSandboxDoc({ html, css, javascript }));
    setRunId((r) => r + 1);
    setPreviewError(null);
  };

  const setRow = (id: string, patch: Partial<ActionRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const persist = () => {
    if (!widget) return;
    const next = cloneModel(dashboard);
    const w = next.widgets.find((x) => x.id === widget.id);
    if (!w) return;
    w.title = title.trim() || w.title;

    // --- Datasource primario (kind telemetry) ---
    const cleanKeys = keys.map((k) => k.trim()).filter((k) => k !== "");
    const oldDsId = w.datasourceIds[0];
    if (deviceId === "") {
      w.datasourceIds = [];
    } else {
      const existing = oldDsId ? next.datasources.find((d) => d.id === oldDsId) : undefined;
      if (existing) {
        existing.kind = "telemetry";
        existing.entityType = "device";
        existing.entityId = deviceId;
        existing.keys = cleanKeys;
        w.datasourceIds = [existing.id];
      } else {
        const dsId = newId("ds");
        next.datasources.push({
          id: dsId,
          kind: "telemetry",
          entityType: "device",
          entityId: deviceId,
          keys: cleanKeys,
        });
        w.datasourceIds = [dsId];
      }
    }

    // --- Acciones permitidas: token → índice en widget.actionIds ---
    const resolvedIds: string[] = [];
    const allowed: AllowedAction[] = [];
    for (const row of rows) {
      const token = row.token.trim();
      if (token === "") continue;
      let actionId = row.actionId;
      if (actionId === NEW_ACTION) {
        if (deviceId === "") continue;
        const id = newId("act");
        const action: Action = {
          id,
          trigger: "on_click",
          type: "send_command",
          payload: { command: row.newCommand.trim() || "ON" },
          target: { entityType: "device", entityId: deviceId },
        };
        next.actions.push(action);
        actionId = id;
      } else if (actionId === "" || actionId === NO_ACTION) {
        continue;
      } else {
        const existing = next.actions.find((a) => a.id === actionId);
        if (!existing) continue;
        if (deviceId !== "") existing.target = { entityType: "device", entityId: deviceId };
      }
      resolvedIds.push(actionId);
      allowed.push({ token, index: resolvedIds.length - 1, ...(row.confirm ? { confirm: true } : {}) });
    }
    w.actionIds = resolvedIds;

    w.configuration = {
      ...(w.configuration ?? {}),
      html,
      css,
      javascript,
      allowedActions: allowed,
      formatVersion: HTML_CARD_FORMAT_VERSION,
    };

    // --- Limpieza de huérfanos (misma regla que el diálogo genérico) ---
    const referencedActions = new Set<string>();
    for (const anyW of next.widgets) for (const aid of anyW.actionIds) referencedActions.add(aid);
    next.actions = next.actions.filter((a) => referencedActions.has(a.id));
    const referencedDs = new Set<string>();
    for (const anyW of next.widgets) for (const did of anyW.datasourceIds) referencedDs.add(did);
    next.datasources = next.datasources.filter((d) => referencedDs.has(d.id));

    onChange(next);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editor HTML Card</DialogTitle>
          <DialogDescription>
            HTML, CSS y JavaScript se ejecutan en un iframe aislado con la API IMIND controlada.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="hc-title">Título</Label>
            <Input
              id="hc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nombre visible del widget"
            />
          </div>

          <div className="flex flex-col gap-2 rounded-xl border bg-background/60 p-3">
            <div className="flex items-center gap-1">
              {(["html", "css", "javascript"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={
                    "rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors " +
                    (tab === t
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-muted")
                  }
                >
                  {t === "html" ? "HTML" : t === "css" ? "CSS" : "JavaScript"}
                </button>
              ))}
              <span className="ml-auto text-[10px] text-muted-foreground">
                Código guardado en la configuración del widget
              </span>
            </div>
            <div className="overflow-hidden rounded-lg border bg-white">
              <CodeArea
                value={tab === "html" ? html : tab === "css" ? css : javascript}
                language={tab}
                onChange={(v) => (tab === "html" ? setHtml(v) : tab === "css" ? setCss(v) : setJavascript(v))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-xl border bg-background/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <Label className="font-normal">Vista previa (sandbox aislado)</Label>
              <Button type="button" variant="outline" size="sm" onClick={runPreview}>
                Ejecutar / actualizar
              </Button>
            </div>
            <div className="h-56 overflow-hidden rounded-lg border bg-white">
              <iframe
                key={runId}
                ref={previewRef}
                title="Vista previa del HTML Card"
                srcDoc={previewDoc}
                sandbox={SANDBOX_ATTR}
                className="h-full w-full"
              />
            </div>
            {previewError ? (
              <p className="rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
                Error de ejecución: {previewError}
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground">
                La vista previa simula las acciones; no envía comandos reales.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 rounded-xl border bg-background/60 p-3">
            <Label className="font-normal">Datos (datasource primario)</Label>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Dispositivo</Label>
              <Select
                value={deviceId || undefined}
                onValueChange={(v) => {
                  setDeviceId(v);
                  setKeys([]);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sin dispositivo (HTML estático)" />
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
            {deviceId !== "" ? (
              <>
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Claves de telemetría ({keys.length})
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {availableKeys.map((k) => {
                      const active = keys.includes(k);
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() =>
                            setKeys(active ? keys.filter((x) => x !== k) : [...keys, k])
                          }
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
              </>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 rounded-xl border bg-background/60 p-3">
            <div className="flex items-center justify-between">
              <Label className="font-normal">Acciones permitidas (tokens para imind.actions.send)</Label>
            </div>
            {rows.map((row) => (
              <div key={row.id} className="flex flex-col gap-2 rounded-lg border p-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={row.token}
                    onChange={(e) => setRow(row.id, { token: e.target.value })}
                    placeholder="token (ej. encender)"
                    className="h-8 w-40 font-mono"
                  />
                  <Select
                    value={row.actionId || NO_ACTION}
                    onValueChange={(v) =>
                      setRow(row.id, { actionId: v === NO_ACTION ? "" : v })
                    }
                  >
                    <SelectTrigger className="h-8 min-w-44 flex-1">
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
                            : ""}{" "}
                          → {devices.find((d) => d._id === a.target?.entityId)?.name ?? a.target?.entityId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Quitar acción"
                    className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setRows((prev) => prev.filter((r) => r.id !== row.id))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                {row.actionId === NEW_ACTION ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={row.newCommand}
                      onChange={(e) => setRow(row.id, { newCommand: e.target.value })}
                      placeholder="Comando (ej. ON)"
                      className="h-8 w-40 font-mono"
                    />
                    <span className="text-[10px] text-muted-foreground">
                      destino: {selectedDevice?.name ?? "elige un dispositivo"}
                    </span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor={`cf-${row.id}`} className="text-xs font-normal text-muted-foreground">
                    Pedir confirmación al ejecutar
                  </Label>
                  <Switch
                    id={`cf-${row.id}`}
                    checked={row.confirm}
                    onCheckedChange={(c) => setRow(row.id, { confirm: c })}
                  />
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              disabled={rows.length >= MAX_ROWS}
              onClick={() =>
                setRows((prev) => [
                  ...prev,
                  { id: `row-new-${prev.length}-${Date.now()}`, token: "", actionId: "", newCommand: "ON", confirm: false },
                ])
              }
            >
              <Plus className="mr-1 size-4" /> Agregar acción
            </Button>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={persist}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Área de código con CodeMirror 6 (empaquetado local, sin CDN).
 * Un solo componente interno para las tres pestañas.
 */
function CodeArea({
  value,
  language,
  onChange,
}: {
  value: string;
  language: "html" | "css" | "javascript";
  onChange: (value: string) => void;
}) {
  const extensions = useMemo(() => {
    if (language === "html") return [htmlLang()];
    if (language === "css") return [cssLang()];
    return [jsLang()];
  }, [language]);
  return (
    <CodeMirror
      value={value}
      height="240px"
      extensions={extensions}
      onChange={onChange}
      theme="light"
      basicSetup={{ foldGutter: false, highlightActiveLine: true }}
    />
  );
}
