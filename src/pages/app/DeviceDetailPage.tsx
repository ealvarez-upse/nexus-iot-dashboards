import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "recharts";
import { formatTime, isOnline, timeAgo, unitSuffix } from "@/lib/format";
import { useNavigate, useParams } from "react-router";
import { useState } from "react";
import {
  ArrowLeft,
  BatteryCharging,
  ChevronDown,
  Copy,
  KeyRound,
  RadioTower,
  RefreshCcw,
  Send,
  Thermometer,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";

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
  const removeDevice = useMutation(api.devices.remove);
  const rotateToken = useMutation(api.devices.rotateToken);
  const [showCurl, setShowCurl] = useState(false);

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

      {/* Credenciales */}
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

      {/* Gráficas por clave */}
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
            const Icon = key.includes("temp") ? Thermometer : key.includes("bat") ? BatteryCharging : RadioTower;
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
    </div>
  );
}
