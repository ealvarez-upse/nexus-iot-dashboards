import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useRef } from "react";
import { NavLink, Outlet, useNavigate } from "react-router";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  Activity,
  Bell,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Moon,
  RadioTower,
  Shield,
  Sun,
} from "lucide-react";

const NAV = [
  { to: "/app", label: "Resumen", icon: Activity, end: true },
  { to: "/app/dispositivos", label: "Dispositivos", icon: RadioTower, end: false },
  { to: "/app/dashboards", label: "Dashboards", icon: LayoutDashboard, end: false },
  { to: "/app/alarmas", label: "Alarmas", icon: Bell, end: false },
];

export function AppLayout() {
  const { user, signOut } = useAuth();
  const { isDark, toggle } = useTheme();
  const navigate = useNavigate();
  const promoteFirstUser = useMutation(api.users.promoteFirstUser);
  const ensureDemoData = useMutation(api.demo.ensureDemoData);
  const seedRequested = useRef(false);

  const activeAlarms = useQuery(api.alarms.activeCount) ?? 0;

  // Primer uso de la plataforma: roles + datos demo (sensor BLE + gateway + dashboard)
  useEffect(() => {
    void promoteFirstUser();
    if (!seedRequested.current) {
      seedRequested.current = true;
      void ensureDemoData();
    }
  }, [promoteFirstUser, ensureDemoData]);

  const isAdmin = user?.role === "admin";
  const initials = (user?.name || user?.email || "U")
    .split(/[\s@.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Barra superior estilo ThingsBoard */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border/70 bg-background/95 px-3 backdrop-blur md:px-5">
        {/* Marca */}
        <a href="/app" className="flex shrink-0 items-center gap-2.5 pr-2">
          <img src="/imind-logo.png" alt="Imind IoT" className="h-7 w-auto" />
          <div className="hidden leading-tight sm:block">
            <p className="text-sm font-bold tracking-tight">Imind IoT</p>
            <p className="text-[10px] text-muted-foreground">Monitoreo HVAC</p>
          </div>
        </a>

        {/* Navegación principal */}
        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "relative flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )
              }
            >
              <item.icon className="size-4" />
              <span className="hidden md:inline">{item.label}</span>
              {item.to === "/app/alarmas" && activeAlarms > 0 ? (
                <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white md:static md:absolute md:-right-1 md:-top-1">
                  {activeAlarms > 99 ? "99+" : activeAlarms}
                </span>
              ) : null}
            </NavLink>
          ))}
          {isAdmin ? (
            <NavLink
              to="/app/usuarios"
              end={false}
              className={({ isActive }) =>
                cn(
                  "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )
              }
            >
              <Shield className="size-4" />
              <span className="hidden md:inline">Usuarios</span>
            </NavLink>
          ) : null}
        </nav>

        {/* Acciones */}
        <div className="flex shrink-0 items-center gap-1.5">
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Cambiar tema">
            {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 px-2">
                <Avatar className="size-7">
                  <AvatarFallback className="bg-primary/10 text-xs text-primary">
                    {initials || "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden max-w-32 truncate text-sm lg:inline">
                  {user?.name || user?.email || "Usuario"}
                </span>
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex flex-col">
                <span className="truncate">{user?.name || "Usuario"}</span>
                <span className="truncate text-xs font-normal text-muted-foreground">
                  {user?.email}
                </span>
                <span className="mt-1 text-xs font-normal text-muted-foreground">
                  {isAdmin ? "Administrador" : "Equipo"}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={toggle}>
                {isDark ? <Sun className="mr-2 size-4" /> : <Moon className="mr-2 size-4" />}
                {isDark ? "Modo claro" : "Modo oscuro"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => {
                  await signOut();
                  navigate("/");
                }}
              >
                <LogOut className="mr-2 size-4" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;
