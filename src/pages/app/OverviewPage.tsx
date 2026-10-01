import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { formatDateTime, isOnline, timeAgo } from "@/lib/format";
import {
  Activity,
  BatteryCharging,
  LayoutDashboard,
  RadioTower,
  Thermometer,
  Wifi,
  WifiOff,
} from "lucide-react";

export default function OverviewPage() {
  const { user } = useAuth();
  const devices = useQuery(api.devices.list);
  const dashboards = useQuery(api.dashboards.list);
  const events = useQuery(api.events.list);

  const deviceList = devices ?? [];
  const sensors = deviceList.filter((d) => d.type === "sensor");
  const onlineCount = sensors.filter((d) => isOnline(d.lastSeenAt)).length;
  const temps = sensors
    .map((d) => d.latest?.["temperature"]?.value)
    .filter((v): v is number => typeof v === "number");
  const avgTemp =
    temps.length > 0
      ? (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1)
      : null;

  const stats = [
    { label: "Dispositivos", value: deviceList.length, icon: RadioTower, hint: `${sensors.length} sensores` },
    { label: "En línea", value: onlineCount, icon: Wifi, hint: isOnline(deviceList[0]?.lastSeenAt) ? "Datos fluyendo" : "Sin datos recientes" },
    { label: "Dashboards", value: dashboards?.length ?? 0, icon: LayoutDashboard, hint: "Vistas creadas" },
    { label: "Temp. promedio", value: avgTemp ? `${avgTemp}°C` : "—", icon: Thermometer, hint: "Sensores con datos" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Hola{user?.name ? `, ${user.name.split(" ")[0]}` : ""} 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Resumen general de tu plataforma de monitoreo HVAC.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="card-layered hover-lift">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">{s.label}</p>
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <s.icon className="size-4" />
                </div>
              </div>
              {devices === undefined ? (
                <Skeleton className="mt-3 h-8 w-16" />
              ) : (
                <p className="mt-2 font-mono text-3xl font-bold tracking-tight">{s.value}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Dispositivos recientes */}
        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Dispositivos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {devices === undefined ? (
              <>
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </>
            ) : deviceList.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Aún no hay dispositivos.{" "}
                <a href="/app/dispositivos" className="text-primary underline underline-offset-4">
                  Registra el primero
                </a>
                .
              </p>
            ) : (
              deviceList.slice(0, 5).map((d) => {
                const online = isOnline(d.lastSeenAt);
                return (
                  <a
                    key={d._id}
                    href={`/app/dispositivos/${d._id}`}
                    className="flex items-center gap-3 rounded-xl border border-border/60 p-3 transition hover:border-primary/40 hover:bg-accent/40"
                  >
                    <div className="flex size-9 items-center justify-center rounded-lg bg-secondary">
                      {online ? (
                        <Wifi className="size-4 text-emerald-500" />
                      ) : (
                        <WifiOff className="size-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{d.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {d.label || (d.type === "gateway" ? "Gateway" : "Sensor BLE")}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant={online ? "default" : "secondary"} className="text-[10px]">
                        {online ? "En línea" : "Offline"}
                      </Badge>
                      <p className="mt-1 text-[10px] text-muted-foreground">{timeAgo(d.lastSeenAt)}</p>
                    </div>
                  </a>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Actividad */}
        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Actividad reciente</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {events === undefined ? (
              <>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </>
            ) : events.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Sin actividad todavía.
              </p>
            ) : (
              events.slice(0, 6).map((e) => (
                <div key={e._id} className="flex items-start gap-3">
                  <div className="mt-1 flex size-6 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <Activity className="size-3" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{e.message}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(e.ts)}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Baterías */}
      {sensors.some((s) => typeof s.battery === "number") ? (
        <Card className="card-layered">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BatteryCharging className="size-4 text-primary" />
              Nivel de batería de sensores
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sensors
              .filter((s) => typeof s.battery === "number")
              .map((s) => (
                <div key={s._id}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="truncate font-medium">{s.name}</span>
                    <span className="font-mono text-muted-foreground">{Math.round(s.battery!)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${s.battery}%`,
                        backgroundColor: s.battery! > 50 ? "#0d9488" : s.battery! > 20 ? "#ca8a04" : "#dc2626",
                      }}
                    />
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
