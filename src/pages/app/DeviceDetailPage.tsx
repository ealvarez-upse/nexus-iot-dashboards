import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { formatDateTime, formatTime, isOnline, timeAgo, unitSuffix } from "@/lib/format";
import { useNavigate, useParams } from "react-router";
import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BellOff,
  BellRing,
  BatteryCharging,
  Check,
  ChevronDown,
  Copy,
  Droplets,
  KeyRound,
  RadioTower,
  RefreshCcw,
  Save,
  Send,
  SlidersHorizontal,
  Thermometer,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";

type ThresholdsDraft = {
  temperature: { min: string; max: string };
  humidity: { min: string; max: string };
  battery: { min: string; max: string };
};

const EMPTY_THRESHOLDS: ThresholdsDraft = {
  temperature: { min: "", max: "" },
  humidity: { min: "", max: "" },
  battery: { min: "", max: "" },
};

const KEY_META: { key: "temperature" | "humidity" | "battery"; label: string }[] = [
  { key: "temperature", label: "Temperatura (°C)" },
  { key: "humidity", label: "Humedad (%)" },
  { key: "battery", label: "Batería (%)" },
];

function keyIcon(key: string) {
  const k = key.toLowerCase();
  if (k.includes("temp")) return Thermometer;
  if (k.includes("hum")) return Droplets;
  if (k.includes("bat")) return BatteryCharging;
  return RadioTower;
}

function CurlExample({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const cmd = `curl -X POST \\
  -H "Content-Type: application/json" \\
  -d '{"temperature":23.5,"humidity":54}' \\
  ${window.location.origin.replace("5173", "8080")}/api/v1/${token}/telemetry`;

  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg bg-zinc-950 p-3 font-mono text-[11px] leading-5 text-zinc-100">
        {cmd}
      </pre>
      <Button
        variant="secondary"
        size="icon"
        className="absolute right-2 top-2 size-7"
        onClick={() => {
          void navigator.clipboard.writeText(cmd);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        aria-label="Copiar comando"
      >
        <Copy className="size-3.5" />
      </Button>
      {copied ? (
        <span className="absolute -top-5 right-0 text-xs text-emerald-500">¡Copiado!</span>
      ) : null}
    </div>
  );
}

export default function DeviceDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const device = useQuery(api.devices.get, { id: id as never });
  const keys = useQuery(api.devices.knownKeys, { deviceId: id as never });
  const series = useQuery(
    api.devices.latestSeries,
    { deviceId: id as never, keys: keys ?? ["temperature", "humidity"], limit: 240 }
  );
  const deviceAlarms = useQuery(api.alarms.list, {
    deviceId: id as never,
    status: "all",
    limit: 20,
  });

  const removeDevice = useMutation(api.devices.remove);
  const rotateToken = useMutation(api.devices.rotateToken);
  const updateDevice = useMutation(api.devices.update);
  const setThresholdsMut = useMutation(api.devices.setThresholds);
  const ackAlarm = useMutation(api.alarms.ack);
  const clearAlarm = useMutation(api.alarms.clear);
  const ackAll = useMutation(api.alarms.ackAllForDevice);

  const [showCurl, setShowCurl] = useState(false);
  const [editName, setEditName] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [savingInfo, setSavingInfo] = useState(false);
  const [thresholds, setThresholds] = useState<ThresholdsDraft>(EMPTY_THRESHOLDS);
  const [savingThresholds, setSavingThresholds] = useState(false);
  const [thresholdsSaved, setThresholdsSaved] = useState(false);

  // Sincroniza formularios cuando llega el dispositivo
  useEffect(() => {
    if (device) {
      setEditName(device.name);
      setEditLabel(device.label ?? "");
      const t = device.thresholds as
        | { temperature?: { min?: number; max?: number }; humidity?: { min?: number; max?: number }; battery?: { min?: number; max?: number } }
        | undefined;
      setThresholds({
        temperature: {
          min: t?.temperature?.min !== undefined ? String(t.temperature.min) : "",
          max: t?.temperature?.max !== undefined ? String(t.temperature.max) : "",
        },
        humidity: {
          min: t?.humidity?.min !== undefined ? String(t.humidity.min) : "",
          max: t?.humidity?.max !== undefined ? String(t.humidity.max) : "",
        },
        battery: {
          min: t?.battery?.min !== undefined ? String(t.battery.min) : "",
          max: t?.battery?.max !== undefined ? String(t.battery.max) : "",
        },
      });
    }
  }, [device]);

  if (device === undefined) {
    return <div className="flex flex-col gap-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 rounded-xl" /></div>;
  }
  if (device === null) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-lg font-semibold">Dispositivo no encontrado</p>
        <Button variant="outline" onClick={() => navigate("/app/dispositivos")}>
          <ArrowLeft className="mr-2 size-4" /> Volver a dispositivos
        </Button>
      </div>
    );
  }

  const online = isOnline(device.lastSeenAt);
  const seriesData = series ?? {};
  const keysWithColor: [string, string][] = (keys ?? []).map((k, i) => [
    k,
    ["#0891b2", "#0d9488", "#ca8a04", "#dc2626", "#7c3aed"][i % 5],
  ]);

  const handleRemove = async () => {
    if (!window.confirm(`¿Eliminar "${device.name}" y toda su telemetría?`)) return;
    await removeDevice({ id: device._id });
    navigate("/app/dispositivos");
  };

  const handleRotate = async () => {
    if (!window.confirm("¿Regenerar el token? Deberás actualizar la configuración del gateway.")) return;
    await rotateToken({ id: device._id });
  };

  const handleSaveInfo = async () => {
    if (!editName.trim()) return;
    setSavingInfo(true);
    try {
      await updateDevice({ id: device._id, name: editName.trim(), label: editLabel.trim() || undefined });
    } finally {
      setSavingInfo(false);
    }
  };

  const handleSaveThresholds = async () => {
    setSavingThresholds(true);
    setThresholdsSaved(false);
    try {
      const build = (r: { min: string; max: string }) => ({
        ...(r.min.trim() !== "" ? { min: Number(r.min) } : {}),
        ...(r.max.trim() !== "" ? { max: Number(r.max) } : {}),
      });
      const anySet =
        Object.values(thresholds).some((r) => r.min.trim() !== "" || r.max.trim() !== "");
      await setThresholdsMut({
        id: device._id,
        thresholds: anySet
          ? {
              temperature: build(thresholds.temperature),
              humidity: build(thresholds.humidity),
              battery: build(thresholds.battery),
            }
          : {},
      });
      setThresholdsSaved(true);
      setTimeout(() => setThresholdsSaved(false), 2500);
    } finally {
      setSavingThresholds(false);
    }
  };

  const openAlarms = (deviceAlarms ?? []).filter((a) => a.open);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/app/dispositivos")} aria-label="Volver">
            <ArrowLeft className="size-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight">{device.name}</h1>
              <Badge variant={online ? "default" : "secondary"}>
                {online ? <Wifi className="mr-1 size-3" /> : <WifiOff className="mr-1 size-3" />}
                {online ? "En línea" : "Offline"}
              </Badge>
              {openAlarms.length > 0 ? (
                <Badge className="border-transparent bg-destructive text-white">
                  <BellRing className="mr-1 size-3" /> {openAlarms.length} alarma{openAlarms.length > 1 ? "s" : ""}
                </Badge>
              ) : null}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {device.label ? `${device.label} · ` : ""}
              {device.type === "gateway" ? "Gateway HTTP" : "Sensor BLE"} · Último reporte: {timeAgo(device.lastSeenAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={showCurl} onOpenChange={setShowCurl}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Send className="mr-2 size-4" /> Enviar dato prueba
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Publicar telemetría de prueba</DialogTitle>
                <DialogDescription>
                  Ejecuta este comando desde cualquier terminal para verificar la conexión.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-2">
                <CurlExample token={device.token} />
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="destructive" onClick={handleRemove}>
            <Trash2 className="mr-2 size-4" /> Eliminar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="telemetria">
        <TabsList>
          <TabsTrigger value="telemetria">Telemetría</TabsTrigger>
          <TabsTrigger value="alarmas">Alarmas y umbrales</TabsTrigger>
          <TabsTrigger value="credenciales">Credenciales</TabsTrigger>
        </TabsList>

        {/* Telemetría */}
        <TabsContent value="telemetria" className="mt-4">
          {series === undefined ? (
            <Skeleton className="h-72 rounded-xl" />
          ) : keysWithColor.length === 0 ? (
            <Card className="card-layered p-10 text-center">
              <p className="font-medium">Aún no hay telemetría</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Publica un dato de prueba para ver la gráfica en vivo.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {keysWithColor.map(([key, color]) => {
                const data = seriesData[key] ?? [];
                const current = data.length > 0 ? data[data.length - 1].value : undefined;
                const Icon = keyIcon(key);
                const thr = device.thresholds as
                  | Record<string, { min?: number; max?: number }>
                  | undefined;
                const range = thr?.[key];
                return (
                  <Card key={key} className="card-layered">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center justify-between text-base">
                        <span className="flex items-center gap-2">
                          <span
                            className="flex size-8 items-center justify-center rounded-lg"
                            style={{ backgroundColor: `${color}1a`, color }}
                          >
                            <Icon className="size-4" />
                          </span>
                          <span className="font-mono text-sm">{key}</span>
                        </span>
                        <span className="font-mono text-xl font-bold">
                          {current !== undefined ? `${current}${unitSuffix(key)}` : "—"}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-56 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: -18 }}>
                            <defs>
                              <linearGradient id={`dev-${key}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={color} stopOpacity={0.32} />
                                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                            <XAxis dataKey="ts" tickFormatter={(ts: number) => formatTime(ts)} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={48} className="text-muted-foreground" />
                            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={48} domain={["auto", "auto"]} className="text-muted-foreground" />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const p = payload[0].payload as { ts: number; value: number };
                                return (
                                  <div className="rounded-lg border border-border/60 bg-popover px-3 py-2 text-xs shadow-md">
                                    <p className="font-mono text-sm font-semibold">{p.value}{unitSuffix(key)}</p>
                                    <p className="mt-0.5 text-muted-foreground">{formatTime(p.ts)}</p>
                                  </div>
                                );
                              }}
                            />
                            {range?.max !== undefined && (
                              <ReferenceLine
                                y={range.max}
                                stroke="#dc2626"
                                strokeDasharray="5 4"
                                label={{ value: `máx ${range.max}`, fill: "#dc2626", fontSize: 9, position: "insideTopRight" }}
                              />
                            )}
                            {range?.min !== undefined && (
                              <ReferenceLine
                                y={range.min}
                                stroke="#2563eb"
                                strokeDasharray="5 4"
                                label={{ value: `mín ${range.min}`, fill: "#2563eb", fontSize: 9, position: "insideTopRight" }}
                              />
                            )}
                            <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#dev-${key})`} isAnimationActive={false} dot={false} activeDot={{ r: 3, strokeWidth: 0 }} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Alarmas y umbrales */}
        <TabsContent value="alarmas" className="mt-4 flex flex-col gap-5">
          <Card className="card-layered">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <SlidersHorizontal className="size-4 text-primary" />
                Umbrales de alarma
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Deja un campo vacío para desactivar ese límite. Cuando una lectura lo
                supere, se creará una alarma automáticamente.
              </p>
              <div className="grid gap-3">
                {KEY_META.map(({ key, label }) => (
                  <div key={key} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 sm:grid-cols-[220px_1fr_1fr]">
                    <Label className="text-sm">{label}</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      placeholder="mín"
                      className="h-9 w-28"
                      value={thresholds[key].min}
                      onChange={(e) =>
                        setThresholds({
                          ...thresholds,
                          [key]: { ...thresholds[key], min: e.target.value },
                        })
                      }
                    />
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      placeholder="máx"
                      className="h-9 w-28"
                      value={thresholds[key].max}
                      onChange={(e) =>
                        setThresholds({
                          ...thresholds,
                          [key]: { ...thresholds[key], max: e.target.value },
                        })
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={handleSaveThresholds} disabled={savingThresholds}>
                  <Save className="mr-2 size-4" />
                  {savingThresholds ? "Guardando…" : "Guardar umbrales"}
                </Button>
                {thresholdsSaved ? (
                  <span className="inline-flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
                    <Check className="size-4" /> Umbrales guardados
                  </span>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="card-layered">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <BellRing className="size-4 text-primary" />
                  Alarmas del dispositivo
                </span>
                {openAlarms.length > 0 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={async () => {
                      await ackAll({ deviceId: device._id });
                    }}
                  >
                    <Check className="size-3.5" /> Confirmar todas
                  </Button>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {deviceAlarms === undefined ? (
                <Skeleton className="h-24 w-full" />
              ) : deviceAlarms.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3">
                  <BellOff className="size-4 text-emerald-500" />
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">
                    Este dispositivo nunca ha disparado una alarma.
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead>Condición</TableHead>
                        <TableHead>Valor / límite</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Inicio</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deviceAlarms.map((a) => (
                        <TableRow key={a._id}>
                          <TableCell>
                            <span className="inline-flex items-center gap-1.5 text-sm">
                              {a.severity === "critical" ? (
                                <Badge className="border-transparent bg-destructive text-white">Crítica</Badge>
                              ) : (
                                <Badge className="border-transparent bg-amber-500 text-white">Aviso</Badge>
                              )}
                              <code className="font-mono text-xs">{a.dataKey}</code>
                              {a.type === "max" ? (
                                <ArrowUp className="size-3.5 text-destructive" />
                              ) : (
                                <ArrowDown className="size-3.5 text-blue-500" />
                              )}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {a.value} <span className="text-muted-foreground">/ {a.threshold}</span>
                          </TableCell>
                          <TableCell>
                            {a.open ? (
                              <Badge variant="outline" className="text-destructive border-destructive/40">Activa</Badge>
                            ) : (
                              <Badge variant="secondary">Cerrada</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{formatDateTime(a.startTs)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {a.status === "active_unack" ? (
                                <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => ackAlarm({ id: a._id })}>
                                  <Check className="size-3.5" /> Confirmar
                                </Button>
                              ) : null}
                              {a.open ? (
                                <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => clearAlarm({ id: a._id })}>
                                  <BellOff className="size-3.5" /> Cerrar
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info del dispositivo */}
          <Card className="card-layered">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Información del dispositivo</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Nombre</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-label">Ubicación</Label>
                <Input
                  id="edit-label"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  placeholder="Ej. Cuarto frío 1"
                />
              </div>
              <Button onClick={handleSaveInfo} disabled={savingInfo || !editName.trim()} className="w-fit">
                <Save className="mr-2 size-4" />
                {savingInfo ? "Guardando…" : "Guardar cambios"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Credenciales */}
        <TabsContent value="credenciales" className="mt-4">
          <Card className="card-layered">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="size-4 text-primary" />
                Credenciales HTTP API
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">Access token:</span>
                <code className="rounded-md bg-secondary px-2.5 py-1 font-mono text-sm">{device.token}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => void navigator.clipboard.writeText(device.token)}
                  aria-label="Copiar token"
                >
                  <Copy className="size-3.5" />
                </Button>
                <Button variant="ghost" size="sm" onClick={handleRotate} className="text-muted-foreground">
                  <RefreshCcw className="mr-1.5 size-3.5" /> Regenerar
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Publica en <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">POST /api/v1/{device.token}/telemetry</code>{" "}
                — formato compatible con ThingsBoard: <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">{'{"temperature":23.5}'}</code>.
                <button className="ml-2 inline-flex items-center text-xs text-primary hover:underline" onClick={() => setShowCurl(true)}>
                  ver ejemplo curl <ChevronDown className="ml-0.5 size-3" />
                </button>
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
