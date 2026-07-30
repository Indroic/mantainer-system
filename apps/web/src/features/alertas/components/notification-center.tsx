import { Popover } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import {
  BellIcon,
  CheckCheckIcon,
  CheckCircle2Icon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  FileTextIcon,
  PackageIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@mantainer-system/ui/lib/utils";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "../hooks/use-notifications";
import type { NotificationResponse, NotificationType } from "../types";

/**
 * Campana de notificaciones.
 *
 * Antes derivaba los avisos en el cliente a partir del inventario y de la
 * maquinaria, por lo que TODOS los roles veían el bajo stock, incluido el
 * Mecánico. Ahora consume la bandeja del backend, que ya viene enrutada y
 * filtrada por rol (spec 3.2).
 */

const TYPE_ICONS: Record<NotificationType, LucideIcon> = {
  OT_CREADA: ClipboardListIcon,
  OT_LIQUIDADA: ClipboardCheckIcon,
  SOLVENCIA_EMITIDA: FileTextIcon,
  BAJO_STOCK: PackageIcon,
  MANTENIMIENTO_PROXIMO: WrenchIcon,
  SERVICIO_COMPONENTE: WrenchIcon,
};

const SEVERITY_STYLES = {
  CRITICAL: {
    container: "bg-rose-500/10 border-rose-500/25",
    title: "text-rose-700 dark:text-rose-400",
    icon: "text-rose-600 dark:text-rose-400",
  },
  WARNING: {
    container: "bg-amber-500/10 border-amber-500/25",
    title: "text-amber-700 dark:text-amber-400",
    icon: "text-amber-600 dark:text-amber-400",
  },
  INFO: {
    container: "bg-accent/10 border-accent/25",
    title: "text-accent",
    icon: "text-accent",
  },
} as const;

function relativeTime(iso: string): string {
  const timestamp = new Date(iso).getTime();
  if (!Number.isFinite(timestamp)) return "";

  const seconds = Math.round((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "hace unos segundos";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `hace ${days} d`;
  return new Date(timestamp).toLocaleDateString();
}

export default function NotificationCenter() {
  const { data: inbox, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const notifications: NotificationResponse[] = Array.isArray(inbox?.items)
    ? inbox.items
    : [];
  const unreadCount = Number(inbox?.unread_count ?? 0);
  const hasUnread = unreadCount > 0;

  return (
    // `placement` va en Popover.Content: la raíz es un DialogTrigger y no lo
    // acepta, por lo que antes se descartaba en silencio y el panel no se
    // anclaba realmente abajo-derecha.
    <Popover>
      <Popover.Trigger>
        <button
          className="relative p-2 rounded-xl bg-default/60 hover:bg-default border border-border transition-colors text-muted hover:text-foreground"
          aria-label={
            hasUnread
              ? `Notificaciones: ${unreadCount} sin leer`
              : "Notificaciones: ninguna sin leer"
          }
        >
          <BellIcon className={cn("size-5", hasUnread && "text-accent")} />
          {hasUnread && (
            <>
              <span className="absolute -top-1 -right-1 flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-4 text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
              <span className="absolute top-1 right-1 size-2 rounded-full bg-rose-500 animate-ping" />
            </>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Content
        placement="bottom end"
        className="w-88 max-w-[92vw] bg-background border border-border text-foreground p-3 rounded-2xl shadow-xl z-50"
      >
        <div className="flex items-center justify-between gap-2 px-2 py-1">
          <span className="text-xs font-bold text-muted uppercase tracking-wider">
            Notificaciones
          </span>
          {hasUnread && (
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
            >
              <CheckCheckIcon className="size-3" />
              Marcar todas
            </button>
          )}
        </div>
        <div className="h-px bg-border my-2" />

        <div className="max-h-96 overflow-y-auto space-y-2 p-1">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-14 rounded-xl bg-default/40 animate-pulse" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted">
              <CheckCircle2Icon className="size-8 text-emerald-500 mb-2" />
              <p className="text-xs font-semibold text-foreground">
                Todo al día
              </p>
              <p className="text-[10px] opacity-80">
                No tienes notificaciones pendientes
              </p>
            </div>
          ) : (
            notifications.map((notification) => {
              const Icon = TYPE_ICONS[notification.type] ?? BellIcon;
              const styles =
                SEVERITY_STYLES[notification.severity] ?? SEVERITY_STYLES.INFO;

              const body = (
                <>
                  <div className="mt-0.5 shrink-0">
                    <Icon className={cn("size-4", styles.icon)} />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <p
                      className={cn(
                        "text-[10px] font-extrabold uppercase tracking-wide",
                        styles.title,
                      )}
                    >
                      {notification.title}
                    </p>
                    <p className="text-[11px] leading-relaxed text-muted">
                      {notification.message}
                    </p>
                    <p className="text-[9px] text-muted/70 font-medium">
                      {relativeTime(notification.created_at)}
                    </p>
                  </div>
                  {!notification.is_read && (
                    <span
                      aria-label="Sin leer"
                      className="mt-1 size-1.5 shrink-0 rounded-full bg-accent"
                    />
                  )}
                </>
              );

              const className = cn(
                "flex w-full gap-3 px-3 py-2.5 rounded-xl border text-left transition-all",
                styles.container,
                notification.is_read && "opacity-60",
              );

              // Si la notificación apunta a una pantalla concreta, se navega y se
              // marca como leída en el mismo gesto.
              return notification.link ? (
                <Link
                  key={notification.id}
                  to={notification.link}
                  onClick={() => {
                    if (!notification.is_read) markRead.mutate(notification.id);
                  }}
                  className={className}
                >
                  {body}
                </Link>
              ) : (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => {
                    if (!notification.is_read) markRead.mutate(notification.id);
                  }}
                  className={className}
                >
                  {body}
                </button>
              );
            })
          )}
        </div>
      </Popover.Content>
    </Popover>
  );
}
