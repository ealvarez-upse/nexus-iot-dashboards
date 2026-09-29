import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isOnline, timeAgo } from "@/lib/format";
import { useState } from "react";
import { Link } from "react-router";
import { Plus, RadioTower, Thermometer, Wifi, WifiOff } from "lucide-react";

export default function DevicesPage() {
  const devices = useQuery(api.devices.list);
  const createDevice = useMutation(api.devices.create);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"sensor" | "gateway">("sensor");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deviceList = devices ?? [];

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

  return (
    <div className="flex flex-col gap-6">
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

      {devices === undefined ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      ) : deviceList.length === 0 ? (
        <Card className="card-layered flex flex-col items-center gap-3 p-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-accent">
            <RadioTower className="size-6 text-accent-foreground" />
          </div>
          <p className="font-medium">Sin dispositivos todavía</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Registra tu gateway y tus sensores BLE para empezar a publicar telemetría
            y construir dashboards en tiempo real.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {deviceList.map((d) => {
            const online = isOnline(d.lastSeenAt);
            const temp = d.latest?.["temperature"];
            const hum = d.latest?.["humidity"];
            return (
              <Link
                key={d._id}
                to={`/app/dispositivos/${d._id}`}
                className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Card className="card-layered h-full p-5 transition group-hover:border-primary/40">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        {d.type === "gateway" ? <RadioTower className="size-5" /> : <Thermometer className="size-5" />}
                      </div>
                      <div>
                        <p className="font-semibold leading-tight">{d.name}</p>
                        <p className="text-xs text-muted-foreground">{d.label || (d.type === "gateway" ? "Gateway HTTP" : "Sensor BLE")}</p>
                      </div>
                    </div>
                    <Badge variant={online ? "default" : "secondary"} className="gap-1 text-[10px]">
                      {online ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
                      {online ? "Online" : "Offline"}
                    </Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-secondary/60 p-2.5">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Temp</p>
                      <p className="font-mono text-lg font-bold">{temp ? `${temp.value}°C` : "—"}</p>
                    </div>
                    <div className="rounded-lg bg-secondary/60 p-2.5">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Humedad</p>
                      <p className="font-mono text-lg font-bold">{hum ? `${hum.value}%` : "—"}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Último reporte: {timeAgo(d.lastSeenAt)}
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
