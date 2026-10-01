import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isOnline, timeAgo } from "@/lib/format";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  BatteryCharging,
  Bell,
  MoreVertical,
  Pencil,
  Plus,
  RadioTower,
  Search,
  Thermometer,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";

const TYPE_OPTIONS = [
  { value: "all", label: "Todos los tipos" },
  { value: "sensor", label: "Sensores" },
  { value: "gateway", label: "Gateways" },
] as const;

const STATE_OPTIONS = [
  { value: "all", label: "Todos los estados" },
  { value: "online", label: "En línea" },
  { value: "offline", label: "Offline" },
] as const;

export default function DevicesPage() {
  const devices = useQuery(api.devices.list);
  const createDevice = useMutation(api.devices.create);
  const updateDevice = useMutation(api.devices.update);
  const removeDevice = useMutation(api.devices.remove);
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"sensor" | "gateway">("sensor");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<string>("all");

  const deviceList = devices ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deviceList.filter((d) => {
      if (q && !`${d.name} ${d.label ?? ""}`.toLowerCase().includes(q)) return false;
      if (typeFilter !== "all" && d.type !== typeFilter) return false;
      if (stateFilter === "online" && !isOnline(d.lastSeenAt)) return false;
      if (stateFilter === "offline" && isOnline(d.lastSeenAt)) return false;
      return true;
    });
  }, [deviceList, search, typeFilter, stateFilter]);

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createDevice({ name: name.trim(), type, label: label.trim() || undefined });
      setOpen(false);
      setName("");
      setLabel("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: string, deviceName: string) => {
    if (!window.confirm(`¿Eliminar "${deviceName}" y toda su telemetría?`)) return;
    await removeDevice({ id: id as never });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dispositivos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gateways y sensores BLE con token de acceso para la API HTTP.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 size-4" />
              Nuevo dispositivo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={submitCreate}>
              <DialogHeader>
                <DialogTitle>Registrar dispositivo</DialogTitle>
                <DialogDescription>
                  Se generará un token de acceso único para publicar telemetría.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 flex flex-col gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="dev-name">Nombre</Label>
                  <Input
                    id="dev-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej. Sensor Cuarto Frío 2"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Tipo</Label>
                  <Select value={type} onValueChange={(v) => setType(v as "sensor" | "gateway")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sensor">Sensor BLE (Joyway JW1407HT)</SelectItem>
                      <SelectItem value="gateway">Gateway (Joyway JW1602G4)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dev-label">Ubicación (opcional)</Label>
                  <Input
                    id="dev-label"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="Ej. Almacén principal"
                  />
                </div>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
              </div>
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving || !name.trim()}>
                  {saving ? "Creando…" : "Crear dispositivo"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Barra de herramientas estilo ThingsBoard */}
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
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={stateFilter} onValueChange={setStateFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} de {deviceList.length} dispositivos
        </span>
      </div>

      {/* Tabla */}
      {devices === undefined ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : filtered.length === 0 ? (
        <div className="card-layered flex flex-col items-center gap-3 rounded-xl border bg-card p-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-accent">
            <RadioTower className="size-6 text-accent-foreground" />
          </div>
          <p className="font-medium">
            {deviceList.length === 0 ? "Sin dispositivos todavía" : "Sin resultados"}
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {deviceList.length === 0
              ? "Registra tu gateway y tus sensores BLE para empezar a publicar telemetría."
              : "Ajusta la búsqueda o los filtros para encontrar el dispositivo."}
          </p>
        </div>
      ) : (
        <div className="card-layered overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Dispositivo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Temperatura</TableHead>
                <TableHead>Humedad</TableHead>
                <TableHead>Batería</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((d) => {
                const online = isOnline(d.lastSeenAt);
                const temp = d.latest?.["temperature"];
                const hum = d.latest?.["humidity"];
                return (
                  <TableRow key={d._id} className="cursor-pointer">
                    <TableCell onClick={() => navigate(`/app/dispositivos/${d._id}`)}>
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          {d.type === "gateway" ? <RadioTower className="size-4" /> : <Thermometer className="size-4" />}
                        </div>
                        <div>
                          <p className="font-medium leading-tight">{d.name}</p>
                          <p className="text-xs text-muted-foreground">{d.label || "—"}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell onClick={() => navigate(`/app/dispositivos/${d._id}`)}>
                      <span className="text-sm text-muted-foreground">
                        {d.type === "gateway" ? "Gateway" : "Sensor BLE"}
                      </span>
                    </TableCell>
                    <TableCell onClick={() => navigate(`/app/dispositivos/${d._id}`)} className="font-mono">
                      {temp ? `${temp.value}°C` : "—"}
                    </TableCell>
                    <TableCell onClick={() => navigate(`/app/dispositivos/${d._id}`)} className="font-mono">
                      {hum ? `${hum.value}%` : "—"}
                    </TableCell>
                    <TableCell onClick={() => navigate(`/app/dispositivos/${d._id}`)}>
                      {typeof d.battery === "number" ? (
                        <span className="inline-flex items-center gap-1.5 font-mono text-sm">
                          <BatteryCharging
                            className={`size-3.5 ${
                              d.battery > 50
                                ? "text-emerald-500"
                                : d.battery > 20
                                  ? "text-amber-500"
                                  : "text-destructive"
                            }`}
                          />
                          {Math.round(d.battery)}%
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell onClick={() => navigate(`/app/dispositivos/${d._id}`)}>
                      <div className="flex flex-col items-start gap-1">
                        <Badge variant={online ? "default" : "secondary"} className="gap-1 text-[10px]">
                          {online ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
                          {online ? "En línea" : "Offline"}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">{timeAgo(d.lastSeenAt)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {d.openAlarms > 0 ? (
                          <Link
                            to="/app/alarmas"
                            className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-1 text-[11px] font-medium text-destructive transition hover:bg-destructive/20"
                          >
                            <Bell className="size-3" /> {d.openAlarms}
                          </Link>
                        ) : null}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => navigate(`/app/dispositivos/${d._id}`)}>
                              <Pencil className="mr-2 size-4" /> Detalles
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleRemove(d._id, d.name)}
                            >
                              <Trash2 className="mr-2 size-4" /> Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
