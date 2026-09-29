import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Shield } from "lucide-react";

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  member: "Equipo",
  user: "Equipo",
};

export default function UsersPage() {
  const { user: me } = useAuth();
  const users = useQuery(api.users.list);
  const setRole = useMutation(api.users.setRole);

  if (me?.role !== "admin") {
    return (
      <Card className="card-layered p-10 text-center">
        <p className="font-medium">Acceso restringido</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Solo los administradores pueden gestionar usuarios.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Usuarios</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gestiona quién puede entrar a la plataforma y con qué rol.
        </p>
      </div>

      {users === undefined || users === null ? (
        <Card className="card-layered p-6">
          <p className="text-sm text-muted-foreground">Cargando…</p>
        </Card>
      ) : (
        <Card className="card-layered">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="size-4 text-primary" />
              {users.length} usuario{users.length === 1 ? "" : "s"} registrado
              {users.length === 1 ? "" : "s"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {users.map((u) => {
              const isMe = me._id === u._id;
              const initials = (u.name || u.email || "U")
                .split(/[\s@.]/)
                .filter(Boolean)
                .slice(0, 2)
                .map((p) => p[0]?.toUpperCase())
                .join("");
              return (
                <div
                  key={u._id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 p-3"
                >
                  <Avatar className="size-9">
                    <AvatarFallback className="bg-secondary text-xs">{initials || "U"}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {u.name || u.email || "Sin nombre"}
                      {isMe ? <span className="ml-2 text-xs text-muted-foreground">(tú)</span> : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  {u.role === "admin" ? (
                    <Badge className="bg-primary/15 text-primary">Admin</Badge>
                  ) : (
                    <Badge variant="secondary">Equipo</Badge>
                  )}
                  {!isMe ? (
                    <Select
                      value={u.role === "admin" ? "admin" : "member"}
                      onValueChange={(role) => void setRole({ userId: u._id, role })}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="member">Equipo</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="w-36 text-center text-xs text-muted-foreground">
                      Tu rol es fijo
                    </span>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
