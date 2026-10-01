import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime, timeAgo } from "@/lib/format";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import {
  ArrowDown,
  ArrowUp,
  BellOff,
  BellRing,
  Check,
  CircleCheck,
  Search,
  Thermometer,
  Droplets,
  BatteryCharging,
} from "lucide-react";
import type { Doc, Id } from "@/convex/_generated/dataModel";

type AlarmDoc = Doc<"alarms"> & { deviceId: Id<"devices"> };

function keyIcon(key: string) {
  const k = key.toLowerCase();
  if (k.includes("temp")) return Thermometer;
  if (k.includes("hum")) return Droplets;
  if (k.includes("bat")) return BatteryCharging;
  return BellRing;
}

function StatusBadge({ alarm }: { alarm: AlarmDoc }) {
  if (alarm.open) {
    return alarm.status === "active_unack" ? (
      <Badge className="gap-1 border-transparent bg-destructive text-white">Activa sin confirmar</Badge>
    ) : (
      <Badge className="gap-1 border-transparent bg-amber-500 text-white">Activa confirmada</Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <CircleCheck className="size-3" /> Cerrada
    </Badge>
  );
}

export default function AlarmsPage() {
  const alarms = useQuery(api.alarms.list, { status: "all", limit: 100 });
  const ackAlarm = useMutation(api.alarms.ack);
  const clearAlarm = useMutation(api.alarms.clear);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const rows = alarms ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((a) => {
      if (statusFilter === "active" && !a.open) return false;
      if (statusFilter === "cleared" && a.open) return false;
      if (severityFilter !== "all" && a.severity !== severityFilter) return false;
      if (q && !a.deviceName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, statusFilter, severityFilter, search]);

  const handleAck = async (id: string) => {
    await ackAlarm({ id: id as never });
  };
  const handleClear = async (id: string) => {
    await clearAlarm({ id: id as never });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alarmas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Disparadas automáticamente cuando la telemetría sale de los umbrales configurados.
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar dispositivo…"
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="active">Activas</SelectItem>
            <SelectItem value="cleared">Cerradas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda severidad</SelectItem>
            <SelectItem value="critical">Crítica</SelectItem>
            <SelectItem value="warning">Aviso</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} de {rows.length} alarmas
        </span>
      </div>

      {/* Tabla */}
      {alarms === undefined ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : filtered.length === 0 ? (
        <div className="card-layered flex flex-col items-center gap-3 rounded-xl border bg-card p-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10">
            <BellOff className="size-7 text-emerald-500" />
          </div>
          <p className="font-medium">Sin alarmas</p>
          <p className="max-w-md text-sm text-muted-foreground">
            {rows.length === 0
              ? "Cuando un sensor supere los umbrales definidos en su dispositivo, la alarma aparecerá aquí."
              : "Ninguna alarma coincide con los filtros aplicados."}
          </p>
          {rows.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Configura umbrales en{" "}
              <Link to="/app/dispositivos" className="text-primary underline underline-offset-4">
                Dispositivos → detalles → Alarmas
              </Link>
              .
            </p>
          ) : null}
        </div>
      ) : (
        <div className="card-layered overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Severidad</TableHead>
                <TableHead>Dispositivo</TableHead>
                <TableHead>Condición</TableHead>
                <TableHead>Valor / límite</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Inicio</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => {
                const Icon = keyIcon(a.dataKey);
                return (
                  <TableRow key={a._id} className={a.open && a.severity === "critical" ? "bg-destructive/5" : undefined}>
                    <TableCell>
                      {a.severity === "critical" ? (
                        <Badge className="gap-1 border-transparent bg-destructive text-white">
                          <BellRing className="size-3" /> Crítica
                        </Badge>
                      ) : (
                        <Badge className="gap-1 border-transparent bg-amber-500 text-white">
                          <BellRing className="size-3" /> Aviso
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link
                        to={`/app/dispositivos/${a.deviceId}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {a.deviceName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <Icon className="size-3.5 text-muted-foreground" />
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
                      <StatusBadge alarm={a} />
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{formatDateTime(a.startTs)}</span>
                      <span className="block text-[11px] text-muted-foreground">{timeAgo(a.startTs)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {a.status === "active_unack" ? (
                          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => handleAck(a._id)}>
                            <Check className="size-3.5" /> Confirmar
                          </Button>
                        ) : null}
                        {a.open ? (
                          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => handleClear(a._id)}>
                            <BellOff className="size-3.5" /> Cerrar
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
