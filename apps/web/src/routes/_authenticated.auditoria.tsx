import { createFileRoute } from "@tanstack/react-router";
import { useAuditFacets, useAuditLogs } from "@/features/reportes/hooks/use-reportes";
import { useAuth } from "@/features/auth/hooks/use-auth";
import AuditLogTable from "@/features/reportes/components/audit-log-table";
import {
  auditActionLabel,
  auditEntityLabel,
} from "@/features/reportes/audit-catalog";
import type { AuditLogFilters } from "@/features/reportes/types";
import { Button } from "@mantainer-system/ui/components/button";
import { Skeleton } from "@mantainer-system/ui/components/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@mantainer-system/ui/components/select";
import { ShieldCheckIcon, AlertTriangleIcon, SearchIcon, XIcon } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/auditoria")({
  component: AuditoriaComponent,
});

/** Centinela de los selectores para representar "sin filtro". */
const ALL = "ALL";

const EMPTY_FILTERS: AuditLogFilters = {
  entity_name: ALL,
  action: ALL,
  search: "",
  date_from: "",
  date_to: "",
};

function AuditoriaComponent() {
  const { canViewAudit } = useAuth();
  const [filters, setFilters] = useState<AuditLogFilters>(EMPTY_FILTERS);
  // La búsqueda libre se aplica al enviar, no en cada tecla: la bitácora puede
  // traer miles de registros y no interesa una petición por pulsación.
  const [searchDraft, setSearchDraft] = useState("");

  const { data: facets } = useAuditFacets({ enabled: canViewAudit });
  const { data: logs = [], isLoading, isFetching } = useAuditLogs(filters, {
    enabled: canViewAudit,
  });

  /**
   * Opciones de los desplegables tomadas de la propia bitácora, con su nombre
   * legible y el número de registros. Se construyen a partir de `facets` para
   * que un filtro nunca ofrezca un valor inexistente.
   */
  const entityOptions = useMemo(
    () =>
      (facets?.entity_names ?? []).map((item) => ({
        value: item.value,
        label: `${auditEntityLabel(item.value)} (${item.count})`,
      })),
    [facets],
  );

  const actionOptions = useMemo(
    () =>
      (facets?.actions ?? []).map((item) => ({
        value: item.value,
        label: `${auditActionLabel(item.value)} (${item.count})`,
      })),
    [facets],
  );

  const hasActiveFilters =
    filters.entity_name !== ALL ||
    filters.action !== ALL ||
    !!filters.search ||
    !!filters.date_from ||
    !!filters.date_to;

  const patch = (changes: Partial<AuditLogFilters>) =>
    setFilters((prev) => ({ ...prev, ...changes }));

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setSearchDraft("");
  };

  if (!canViewAudit) {
    return (
      <div className="text-center py-12 bg-surface/20 border border-border rounded-3xl p-6 max-w-xl mx-auto">
        <AlertTriangleIcon className="size-10 mx-auto text-rose-500 mb-2" />
        <p className="text-foreground text-base font-bold">Acceso Restringido</p>
        <p className="text-muted-foreground text-xs mt-1">
          Solo el Planificador cuenta con autorización para realizar auditorías forenses sobre las operaciones transaccionales.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cabecera de Página */}
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ShieldCheckIcon className="size-6 text-indigo-400" />
          Bitácora de Auditoría Forense
        </h2>
        <p className="text-sm text-muted-foreground">
          Registro inmutable de solo lectura para el rastreo y control forense de cambios transaccionales
        </p>
      </div>

      {/* Controles de Filtrado de Auditoría */}
      <div className="space-y-4 p-4 rounded-2xl bg-surface/20 border border-border backdrop-blur-md">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Entidad */}
          <FilterField label="Filtrar por Entidad">
            <Select
              value={filters.entity_name || ALL}
              onValueChange={(val: any) => patch({ entity_name: val || ALL })}
            >
              <SelectTrigger className="bg-background/80 border-border rounded-xl text-foreground/80 h-9 text-sm">
                <SelectValue placeholder="Todas las entidades" />
              </SelectTrigger>
              <SelectContent className="bg-background border border-border text-foreground rounded-xl">
                <SelectItem value={ALL}>Todas las entidades</SelectItem>
                {entityOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>

          {/* Operación */}
          <FilterField label="Filtrar por Operación">
            <Select
              value={filters.action || ALL}
              onValueChange={(val: any) => patch({ action: val || ALL })}
            >
              <SelectTrigger className="bg-background/80 border-border rounded-xl text-foreground/80 h-9 text-sm">
                <SelectValue placeholder="Todas las operaciones" />
              </SelectTrigger>
              <SelectContent className="bg-background border border-border text-foreground rounded-xl">
                <SelectItem value={ALL}>Todas las operaciones</SelectItem>
                {actionOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>

          {/* Rango de fechas */}
          <FilterField label="Desde">
            <input
              type="date"
              value={filters.date_from || ""}
              max={filters.date_to || undefined}
              onChange={(e) => patch({ date_from: e.target.value })}
              className="h-9 w-full rounded-xl border border-border bg-background/80 px-3 text-sm text-foreground/80 outline-none focus:border-accent"
            />
          </FilterField>

          <FilterField label="Hasta">
            <input
              type="date"
              value={filters.date_to || ""}
              min={filters.date_from || undefined}
              onChange={(e) => patch({ date_to: e.target.value })}
              className="h-9 w-full rounded-xl border border-border bg-background/80 px-3 text-sm text-foreground/80 outline-none focus:border-accent"
            />
          </FilterField>
        </div>

        {/* Búsqueda libre sobre el contenido del registro */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            patch({ search: searchDraft });
          }}
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
        >
          <FilterField label="Búsqueda forense" className="flex-1">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                placeholder="ID de registro, usuario, operación o contenido del cambio"
                className="h-9 w-full rounded-xl border border-border bg-background/80 pl-9 pr-3 text-sm text-foreground/80 outline-none focus:border-accent"
              />
            </div>
          </FilterField>
          <div className="flex shrink-0 gap-2">
            <Button
              type="submit"
              className="h-9 rounded-xl bg-accent px-4 text-xs font-semibold text-accent-foreground hover:bg-accent/80"
            >
              Buscar
            </Button>
            {hasActiveFilters && (
              <Button
                type="button"
                variant="outline"
                onClick={clearFilters}
                className="h-9 gap-1.5 rounded-xl border-border px-3 text-xs font-semibold"
              >
                <XIcon className="size-3.5" />
                Limpiar
              </Button>
            )}
          </div>
        </form>

        {/* Recuento del recorte activo, para saber que el filtro sí actuó. */}
        <p className="text-[11px] font-medium text-muted-foreground">
          {isFetching
            ? "Consultando la bitácora…"
            : `${logs.length} registro(s)${
                facets?.total ? ` de ${facets.total} en la bitácora` : ""
              }${hasActiveFilters ? " · filtros aplicados" : ""}`}
        </p>
      </div>

      {/* Tabla de logs de auditoría */}
      <div className="pt-2">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 rounded-xl bg-default/50" />
            <Skeleton className="h-44 rounded-xl bg-default/50" />
          </div>
        ) : (
          <AuditLogTable logs={logs} />
        )}
      </div>
    </div>
  );
}

function FilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <span className="block text-[10px] text-muted-foreground font-bold uppercase tracking-wider pl-1">
        {label}
      </span>
      {children}
    </div>
  );
}
