import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mantainer-system/ui/components/table";
import { Button } from "@mantainer-system/ui/components/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@mantainer-system/ui/components/dialog";
import type { AuditLogResponse } from "../types";
import { auditActionLabel, auditActionTone, auditEntityLabel } from "../audit-catalog";
import { ShieldCheckIcon, UserIcon, EyeIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@mantainer-system/ui/lib/utils";

interface AuditLogTableProps {
  logs: AuditLogResponse[];
}

/**
 * Bitácora forense en tabla, con un único diálogo de inspección.
 *
 * IMPORTANTE: el `<Dialog>` vive FUERA del `map` de filas. Antes se renderizaba
 * un diálogo por fila compartiendo el mismo estado `open`, de modo que pulsar
 * "Inspeccionar" abría a la vez tantos modales como registros hubiera (el
 * listado trae hasta 1000): cada uno monta su propio backdrop a pantalla
 * completa y su trampa de foco, y el navegador se colgaba. Con un solo diálogo
 * gobernado por `selectedLog` el coste es constante.
 */
export default function AuditLogTable({ logs }: AuditLogTableProps) {
  const [selectedLog, setSelectedLog] = useState<AuditLogResponse | null>(null);

  // Formateador robusto de fecha y hora para evitar Invalid Date en navegadores estrictos
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "N/A";
    // Si la fecha no trae zona horaria explícita, el backend la emite en UTC.
    // Se comprueba solo la COLA de la cadena: un `-` suelto aparece también en
    // la parte de la fecha (2026-08-12), así que buscarlo en todo el texto daba
    // siempre "ya tiene zona" y desplazaba la hora mostrada.
    const hasTimezone =
      dateStr.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(dateStr);
    const date = new Date(hasTimezone ? dateStr : `${dateStr}Z`);
    return isNaN(date.getTime()) ? "Fecha Inválida" : date.toLocaleString();
  };

  // Formatear el contenido de los JSON de estado
  const formatStateJSON = (stateStr: string | null) => {
    if (!stateStr) return "N/A";
    try {
      const parsed = typeof stateStr === "string" ? JSON.parse(stateStr) : stateStr;
      return JSON.stringify(parsed, null, 2);
    } catch {
      return stateStr;
    }
  };

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-border bg-surface/20 backdrop-blur-md shadow-xl">
        <Table>
          <TableHeader className="bg-background/80 border-b border-border">
            <TableRow>
              <TableHead className="font-semibold text-foreground/80">Fecha y Hora</TableHead>
              <TableHead className="font-semibold text-foreground/80">Entidad</TableHead>
              <TableHead className="font-semibold text-foreground/80">ID del Registro</TableHead>
              <TableHead className="font-semibold text-foreground/80">Acción</TableHead>
              <TableHead className="font-semibold text-foreground/80">Realizado por</TableHead>
              <TableHead className="font-semibold text-foreground/80 text-right">Detalles Forenses</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground font-medium">
                  No hay registros de auditoría forense que coincidan con los filtros.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow
                  key={log.id}
                  className="transition-colors duration-150 hover:bg-default/50 border-b border-border"
                >
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {formatDate(log.created_at)}
                  </TableCell>
                  <TableCell className="font-bold text-foreground text-[11px]">
                    {auditEntityLabel(log.entity_name)}
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground text-xs truncate max-w-[120px]">
                    {log.entity_id}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-lg border text-[9px] font-extrabold uppercase tracking-wide whitespace-nowrap",
                        auditActionTone(log.action),
                      )}
                    >
                      {auditActionLabel(log.action)}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium text-foreground/80 text-xs">
                    <span className="flex items-center gap-1.5">
                      <UserIcon className="size-3.5 shrink-0 text-muted-foreground" />
                      {log.performed_by_name || log.performed_by}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedLog(log)}
                      className="rounded-xl text-indigo-400 hover:text-indigo-200 hover:bg-indigo-950/20"
                    >
                      <EyeIcon className="size-4 mr-1.5" />
                      Inspeccionar
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Un único diálogo para toda la tabla: se monta solo al inspeccionar. */}
      <Dialog
        open={selectedLog !== null}
        onOpenChange={(open: boolean) => {
          if (!open) setSelectedLog(null);
        }}
      >
        <DialogContent className="bg-card border border-border text-foreground p-6 rounded-2xl max-w-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <ShieldCheckIcon className="size-5 text-indigo-400" />
              Registro de Auditoría Forense
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4 text-xs font-semibold">
            <div className="grid grid-cols-2 gap-4 p-3.5 bg-background/80 border border-border rounded-xl">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Entidad Modificada</p>
                <p className="text-foreground font-bold">
                  {auditEntityLabel(selectedLog?.entity_name)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Operación</p>
                <p className="text-indigo-400 font-extrabold">
                  {auditActionLabel(selectedLog?.action)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Ejecutado por</p>
                <p className="text-foreground">
                  {selectedLog?.performed_by_name || selectedLog?.performed_by}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Fecha y Hora</p>
                <p className="text-foreground font-mono">
                  {selectedLog ? formatDate(selectedLog.created_at) : ""}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] text-muted-foreground uppercase">ID del Registro</p>
                <p className="text-foreground font-mono break-all">{selectedLog?.entity_id}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Estado del Registro</p>
              <pre className="p-3.5 rounded-xl border border-border bg-background/80 font-mono text-[10px] text-indigo-300 overflow-x-auto max-h-60 leading-relaxed">
                {formatStateJSON(selectedLog?.payload || null)}
              </pre>
            </div>

            <div className="flex pt-2">
              <Button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="w-full rounded-xl bg-default/50 text-foreground hover:bg-slate-700 font-semibold"
              >
                Cerrar Inspección
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
