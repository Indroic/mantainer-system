import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { authClient } from "@/lib/auth-client";
import { Button } from "@mantainer-system/ui/components/button";
import { Skeleton } from "@mantainer-system/ui/components/skeleton";
import { useTheme } from "@mantainer-system/ui/hooks/use-theme";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
} from "@mantainer-system/ui/components/dropdown-menu";
import {
  WrenchIcon,
  CpuIcon,
  ClipboardListIcon,
  PackageIcon,
  BarChart3Icon,
  ShieldAlertIcon,
  LogOutIcon,
  UserIcon,
  MenuIcon,
  UsersIcon,
  SunIcon,
  MoonIcon,
  TruckIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import NotificationCenter from "@/features/alertas/components/notification-center";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    let session: Awaited<ReturnType<typeof authClient.getSession>>["data"] = null;
    try {
      const result = await authClient.getSession();
      session = result.data;
    } catch {
      session = null;
    }

    if (!session) {
      throw redirect({
        to: "/login",
      });
    }
    return { session };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const {
    user,
    roleLabel,
    username,
    isWarehouse,
    canViewInventory,
    canViewReports,
    canViewSolvencies,
    canViewAudit,
    canManageUsers,
    isLoading,
  } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  // -----------------------------------------------------------------
  // Hook de Temas Nativo de HeroUI v3
  // -----------------------------------------------------------------
  const { resolvedTheme, setTheme } = useTheme("system");
  const isDark = resolvedTheme === "dark";

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  const handleLogout = async () => {
    try {
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            toast.success("Sesión cerrada con éxito");
            navigate({ to: "/login" });
          },
        },
      });
    } catch (err) {
      toast.error("Error al cerrar sesión");
    }
  };

  // Navegación por capacidades, no por rol suelto: así el menú no se
  // desincroniza de los permisos que aplica el backend.
  const navigationItems = [
    {
      to: "/dashboard",
      label: "Dashboard",
      icon: ClipboardListIcon,
      visible: true,
    },
    {
      to: "/maquinaria",
      label: "Maquinaria",
      icon: CpuIcon,
      // Almacén no gestiona activos: solo inventario y despacho.
      visible: !isWarehouse,
    },
    {
      to: "/mantenimiento",
      label: "Mantenimiento",
      icon: WrenchIcon,
      visible: !isWarehouse,
    },
    {
      to: "/repuestos",
      label: "Repuestos",
      icon: PackageIcon,
      // Almacén visualiza el stock global (spec 2.3), aunque no pueda editarlo.
      visible: canViewInventory,
    },
    {
      to: "/almacen",
      label: "Despacho",
      icon: TruckIcon,
      // Bandeja de Solvencias de Repuestos por entregar (spec 2.3 / 3.3).
      visible: canViewSolvencies,
    },
    {
      to: "/reportes",
      label: "Reportes",
      icon: BarChart3Icon,
      visible: canViewReports,
    },
    {
      to: "/auditoria",
      label: "Auditoría",
      icon: ShieldAlertIcon,
      visible: canViewAudit,
    },
    {
      to: "/usuarios",
      label: "Usuarios",
      icon: UsersIcon,
      visible: canManageUsers,
    },
  ];

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
        <div className="flex flex-col gap-2 items-center">
          <Skeleton className="h-8 w-48 rounded bg-default/50" />
          <Skeleton className="h-4 w-32 rounded bg-default/50" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground font-sans">
      {/* 1. Sidebar para pantallas grandes */}
      <aside className="hidden md:flex md:w-64 md:flex-col bg-surface/60 backdrop-blur-xl border-r border-border">
        <div className="flex h-16 items-center justify-start gap-2 px-6 border-b border-border">
          <WrenchIcon className="size-6 text-accent animate-pulse" />
          <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-accent to-cyan-400 bg-clip-text text-transparent">
            SGMM Portal
          </span>
        </div>
        <nav className="flex-1 space-y-1 px-4 py-6">
          {navigationItems
            .filter((item) => item.visible)
            .map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 text-muted hover:text-foreground hover:bg-default/50 [&.active]:text-accent-foreground [&.active]:bg-accent [&.active]:shadow-lg [&.active]:shadow-accent/20"
              >
                <item.icon className="size-5" />
                {item.label}
              </Link>
            ))}
        </nav>
        <div className="p-4 border-t border-border">
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="flex w-full items-center justify-start gap-3 px-4 py-3 text-sm font-medium rounded-xl text-danger hover:text-danger hover:bg-danger/10"
          >
            <LogOutIcon className="size-5" />
            Cerrar Sesión
          </Button>
        </div>
      </aside>

      {/* 2. Contenedor de contenido */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header superior premium con efecto de glassmorphism */}
        <header className="flex h-16 items-center justify-between px-6 bg-surface/40 backdrop-blur-xl border-b border-border z-20">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl bg-default/80 hover:bg-default"
            >
              <MenuIcon className="size-5" />
            </button>
            <h1 className="text-lg font-semibold tracking-wide hidden md:block">
              Sistema de Mantenimiento de Maquinaria
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Toggle Dark / Light */}
            <button
              id="theme-toggle"
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-default/60 border border-border hover:bg-default transition-colors text-muted hover:text-foreground"
              title={isDark ? "Cambiar a modo Claro" : "Cambiar a modo Oscuro"}
            >
              {isDark ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
            </button>

            {/* Campana de Notificaciones de Alertas en Tiempo Real */}
            <NotificationCenter />

            {/* Menú de Usuario */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 p-1.5 pr-3 rounded-xl bg-default/60 hover:bg-default border border-border transition-colors text-left">
                  <div className="size-8 rounded-lg bg-accent flex items-center justify-center font-bold text-accent-foreground shadow-md shadow-accent/20">
                    {user?.name?.[0]?.toUpperCase() || <UserIcon className="size-4" />}
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-xs font-bold text-foreground truncate max-w-[140px]">
                      {user?.name}
                    </p>
                    {/* spec 1: el badge muestra la etiqueta del rol en español
                        ("Planificador"), nunca el identificador interno. */}
                    <p className="text-[10px] text-muted tracking-wider font-semibold truncate max-w-[140px]">
                      {roleLabel ?? "Mecánico"}
                      {username ? ` · ${username}` : ""}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-overlay border border-border text-foreground p-2 rounded-2xl shadow-xl">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="px-3 py-2">
                    <span className="block text-xs font-bold text-foreground truncate">
                      {user?.name || "Mi Perfil"}
                    </span>
                    <span className="block text-[10px] font-semibold text-accent">
                      {roleLabel ?? "Mecánico"}
                    </span>
                    {username && (
                      <span className="block font-mono text-[10px] text-muted truncate">
                        @{username}
                      </span>
                    )}
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem asChild>
                  <Link to="/dashboard" className="flex items-center gap-2 px-3 py-2 text-sm rounded-xl hover:bg-default transition-colors">
                    <UserIcon className="size-4 text-accent" />
                    Mi Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 text-sm rounded-xl text-danger hover:bg-danger/10 transition-colors">
                  <LogOutIcon className="size-4" />
                  Cerrar Sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* 3. Panel móvil lateral */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-40 flex">
            <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            <aside className="relative flex w-64 flex-col bg-surface border-r border-border p-6 animate-slide-in">
              <div className="flex h-10 items-center gap-2 mb-8">
                <WrenchIcon className="size-6 text-accent animate-pulse" />
                <span className="text-lg font-bold tracking-tight">SGMM Portal</span>
              </div>
              <nav className="flex-1 space-y-1">
                {navigationItems
                  .filter((item) => item.visible)
                  .map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 text-muted hover:text-foreground hover:bg-default/50 [&.active]:text-accent-foreground [&.active]:bg-accent"
                    >
                      <item.icon className="size-5" />
                      {item.label}
                    </Link>
                  ))}
              </nav>
              <div className="mt-auto border-t border-border pt-4">
                <Button
                  variant="ghost"
                  onClick={handleLogout}
                  className="flex w-full items-center justify-start gap-3 px-4 py-3 text-sm font-medium rounded-xl text-danger hover:text-danger hover:bg-danger/10"
                >
                  <LogOutIcon className="size-5" />
                  Cerrar Sesión
                </Button>
              </div>
            </aside>
          </div>
        )}

        {/* 4. Canvas principal de las pantallas hijas */}
        <main className="flex-1 overflow-y-auto px-6 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

