import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useRef } from "react";
import { NavLink, Outlet, useNavigate } from "react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
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
import {
  Activity,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Moon,
  RadioTower,
  Shield,
  Sun,
} from "lucide-react";

export function AppLayout() {
  const { user, signOut } = useAuth();
  const { isDark, toggle } = useTheme();
  const navigate = useNavigate();
  const promoteFirstUser = useMutation(api.users.promoteFirstUser);
  const ensureDemoData = useMutation(api.demo.ensureDemoData);
  const seedRequested = useRef(false);

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
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <a href="/app">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <RadioTower className="size-5" />
                  </div>
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="truncate font-bold">Nexus IoT</span>
                    <span className="truncate text-xs text-sidebar-foreground/60">
                      Monitoreo HVAC
                    </span>
                  </div>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Plataforma</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Resumen">
                    <NavLink to="/app" end>
                      <Activity />
                      <span>Resumen</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Dispositivos">
                    <NavLink to="/app/dispositivos">
                      <RadioTower />
                      <span>Dispositivos</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Dashboards">
                    <NavLink to="/app/dashboards">
                      <LayoutDashboard />
                      <span>Dashboards</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {isAdmin ? (
            <SidebarGroup>
              <SidebarGroupLabel>Administración</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Usuarios">
                      <NavLink to="/app/usuarios">
                        <Shield />
                        <span>Usuarios</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ) : null}
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg">
                    <Avatar className="size-8">
                      <AvatarFallback className="bg-sidebar-accent text-xs text-sidebar-accent-foreground">
                        {initials || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left leading-tight">
                      <span className="truncate text-sm font-medium">
                        {user?.name || user?.email || "Usuario"}
                      </span>
                      <span className="truncate text-xs text-sidebar-foreground/60">
                        {isAdmin ? "Administrador" : "Equipo"}
                      </span>
                    </div>
                    <ChevronDown className="ml-auto size-4 text-sidebar-foreground/60" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-56">
                  <DropdownMenuLabel className="flex items-center justify-between">
                    <span className="truncate">{user?.email}</span>
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
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border/70 bg-background/80 px-4 backdrop-blur md:px-6">
          <SidebarTrigger />
          <div className="h-5 w-px bg-border" />
          <p className="text-sm font-medium text-muted-foreground">
            Plataforma de monitoreo HVAC
          </p>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Cambiar tema">
              {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default AppLayout;
