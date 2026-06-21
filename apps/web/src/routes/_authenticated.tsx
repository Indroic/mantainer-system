import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { authClient } from "@/lib/auth-client";
import { Button } from "@mantainer-system/ui/components/button";
import { Skeleton } from "@mantainer-system/ui/components/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import NotificationCenter from "@/features/alertas/components/notification-center";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    // Verificación de sesión del lado del cliente (SPA estático, sin server functions).
    // Si el servidor de auth no responde (error de red / CORS), getSession puede
    // lanzar "Failed to fetch": lo capturamos y tratamos como sesión ausente para
    // redirigir al login en lugar de romper la carga de la ruta.
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
  const { user, roleLabel, isAdmin, isSupervisor, isLoading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await authClient.signOut({
        onSuccess: () => {
          toast.success("Sesión cerrada con éxito");
          navigate({ to: "/login" });
        },
      });
    } catch (err) {
      toast.error("Error al cerrar sesión");
    }
  };

  // Definir links dinámicos basados en RBAC
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
      visible: true, // Todos lo ven, pero los mecánicos ven vistas simplificadas
    },
    {
      to: "/mantenimiento",
      label: "Mantenimiento",
      icon: WrenchIcon,
      visible: true,
    },
    {
      to: "/repuestos",
      label: "Repuestos",
      icon: PackageIcon,
      visible: isAdmin || isSupervisor,
    },
    {
      to: "/reportes",
      label: "Reportes",
      icon: BarChart3Icon,
      visible: isAdmin || isSupervisor,
    },
    {
      to: "/auditoria",
      label: "Auditoría",
      icon: ShieldAlertIcon,
      visible: isAdmin,
    },
  ];

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-slate-950 text-slate-100">
        <div className="flex flex-col gap-2 items-center">
          <Skeleton className="h-8 w-48 rounded bg-slate-800" />
          <Skeleton className="h-4 w-32 rounded bg-slate-800" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* 1. Sidebar para pantallas grandes */}
      <aside className="hidden md:flex md:w-64 md:flex-col bg-slate-900/60 backdrop-blur-xl border-r border-slate-800/80">
        <div className="flex h-16 items-center justify-start gap-2 px-6 border-b border-slate-800/80">
          <WrenchIcon className="size-6 text-indigo-400 animate-pulse" />
          <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
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
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 [&.active]:text-white [&.active]:bg-indigo-600/90 [&.active]:shadow-lg [&.active]:shadow-indigo-600/20"
              >
                <item.icon className="size-5" />
                {item.label}
              </Link>
            ))}
        </nav>
        <div className="p-4 border-t border-slate-800/80">
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="flex w-full items-center justify-start gap-3 px-4 py-3 text-sm font-medium rounded-xl text-rose-400 hover:text-rose-200 hover:bg-rose-950/20"
          >
            <LogOutIcon className="size-5" />
            Cerrar Sesión
          </Button>
        </div>
      </aside>

      {/* 2. Contenedor de contenido */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header superior premium con efecto de glassmorphism */}
        <header className="flex h-16 items-center justify-between px-6 bg-slate-900/40 backdrop-blur-xl border-b border-slate-800/60 z-20">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80"
            >
              <MenuIcon className="size-5" />
            </button>
            <h1 className="text-lg font-semibold tracking-wide hidden md:block">
              Sistema de Mantenimiento de Maquinaria
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Campana de Notificaciones de Alertas en Tiempo Real */}
            <NotificationCenter />

            {/* Menú de Usuario */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 p-1.5 pr-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/40 transition-colors text-left">
                  <div className="size-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-600/20">
                    {user?.name?.[0]?.toUpperCase() || <UserIcon className="size-4" />}
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-xs font-bold text-slate-100 truncate max-w-[120px]">{user?.name}</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">{roleLabel || "Mecánico"}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-slate-900 border border-slate-800 text-slate-100 p-2 rounded-2xl shadow-xl">
                <DropdownMenuLabel className="px-3 py-2 text-xs font-bold text-slate-400 uppercase">
                  Mi Perfil
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-800" />
                <DropdownMenuItem asChild>
                  <Link to="/dashboard" className="flex items-center gap-2 px-3 py-2 text-sm rounded-xl hover:bg-slate-800 transition-colors">
                    <UserIcon className="size-4 text-indigo-400" />
                    Mi Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-slate-800" />
                <DropdownMenuItem onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 text-sm rounded-xl text-rose-400 hover:bg-rose-950/20 hover:text-rose-200 transition-colors">
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
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            <aside className="relative flex w-64 flex-col bg-slate-900 border-r border-slate-800 p-6 animate-slide-in">
              <div className="flex h-10 items-center gap-2 mb-8">
                <WrenchIcon className="size-6 text-indigo-400 animate-pulse" />
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
                      className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 [&.active]:text-white [&.active]:bg-indigo-600/90"
                    >
                      <item.icon className="size-5" />
                      {item.label}
                    </Link>
                  ))}
              </nav>
              <div className="mt-auto border-t border-slate-800 pt-4">
                <Button
                  variant="ghost"
                  onClick={handleLogout}
                  className="flex w-full items-center justify-start gap-3 px-4 py-3 text-sm font-medium rounded-xl text-rose-400 hover:text-rose-200 hover:bg-rose-950/20"
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
