import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card } from "@/components/ui/card";
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
import { useState } from "react";
import { Link } from "react-router";
import { LayoutDashboard, Plus, Trash2 } from "lucide-react";

export default function DashboardsPage() {
  const dashboards = useQuery(api.dashboards.list);
  const createDashboard = useMutation(api.dashboards.create);
  const removeDashboard = useMutation(api.dashboards.remove);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const dashList = dashboards ?? [];

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createDashboard({ name: name.trim(), description: description.trim() || undefined });
      setOpen(false);
      setName("");
      setDescription("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboards</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vistas con widgets de telemetría en tiempo real.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 size-4" /> Nuevo dashboard
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={submitCreate}>
              <DialogHeader>
                <DialogTitle>Crear dashboard</DialogTitle>
                <DialogDescription>
                  Después podrás agregarle widgets con gráficas de cualquier dispositivo.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 flex flex-col gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="dash-name">Nombre</Label>
                  <Input
                    id="dash-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej. Monitoreo Cuarto Frío 1"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dash-desc">Descripción (opcional)</Label>
                  <Input
                    id="dash-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ej. Control de cadena de frío del almacén"
                  />
                </div>
              </div>
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving || !name.trim()}>
                  {saving ? "Creando…" : "Crear dashboard"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {dashboards === undefined ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
        </div>
      ) : dashList.length === 0 ? (
        <Card className="card-layered flex flex-col items-center gap-3 p-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-accent">
            <LayoutDashboard className="size-6 text-accent-foreground" />
          </div>
          <p className="font-medium">Sin dashboards todavía</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Crea tu primer dashboard y agrega widgets: series temporales, valores
            actuales e indicadores de cualquier sensor.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {dashList.map((d) => (
            <Card key={d._id} className="card-layered group relative p-5">
              <Link to={`/app/dashboards/${d._id}`} className="block">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <LayoutDashboard className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{d.name}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {d.description || "Sin descripción"}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {(d.widgets?.length ?? 0)} widget{(d.widgets?.length ?? 0) === 1 ? "" : "s"}
                  </span>
                  <span className="text-xs font-medium text-primary opacity-0 transition group-hover:opacity-100">
                    Abrir →
                  </span>
                </div>
              </Link>
              <button
                className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                onClick={() => {
                  if (window.confirm(`¿Eliminar el dashboard "${d.name}"?`)) {
                    void removeDashboard({ id: d._id });
                  }
                }}
                aria-label="Eliminar dashboard"
              >
                <Trash2 className="size-4" />
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
