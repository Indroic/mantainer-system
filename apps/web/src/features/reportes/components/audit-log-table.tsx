import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mantainer-system/ui/components/table";
import { Button } from "@mantainer-system/ui/components/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@mantainer-system/ui/components/dialog";
import type { AuditLogResponse } from "../types";
import { ShieldCheckIcon, UserIcon, EyeIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@mantainer-system/ui/lib/utils";

interface AuditLogTableProps {
  logs: AuditLogResponse[];
}

export default function AuditLogTable({ logs }: AuditLogTableProps) {
  const [selectedLog, setSelectedLog] = useState<AuditLogResponse | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Formateador robusto de fecha y hora para evitar Invalid Date en navegadores estrictos
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "N/A";
    // Si la fecha no termina en Z ni incluye información de zona horaria (+/-), añadimos Z (UTC)
    const normalized = dateStr.endsWith("Z") || dateStr.includes("+") || dateStr.includes("-")
      ? dateStr
      : dateStr + "Z";
    const date = new Date(normalized);
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
                  <TableCell className="font-bold text-foreground uppercase text-[10px] tracking-wider">
                    {log.entity_name}
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground text-xs truncate max-w-[120px]">
                    {log.entity_id}
                  </TableCell>
                  <TableCell>
                    <span className={cn(
                      "px-2 py-0.5 rounded-lg border text-[9px] font-extrabold uppercase tracking-wide",
                      log.action === "CREATE" && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                      log.action === "UPDATE" && "bg-amber-500/10 text-amber-400 border-amber-500/20",
                      log.action === "DELETE" && "bg-rose-500/10 text-rose-400 border-rose-500/20"
                    )}>
                      {log.action}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium text-foreground/80 text-xs flex items-center gap-1.5 pt-4">
                    <UserIcon className="size-3.5 text-muted-foreground" />
                    {log.performed_by_name || log.performed_by}
                  </TableCell>
                  <TableCell className="text-right">
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedLog(log);
                            setDialogOpen(true);
                          }}
                          className="rounded-xl text-indigo-400 hover:text-indigo-200 hover:bg-indigo-950/20"
                        >
                          <EyeIcon className="size-4 mr-1.5" />
                          Inspeccionar
                        </Button>
                      </DialogTrigger>
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
                              <p className="text-foreground uppercase font-bold">{selectedLog?.entity_name}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase">Operación</p>
                              <p className="text-indigo-400 font-extrabold uppercase">{selectedLog?.action}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase">Ejecutado por</p>
                              <p className="text-foreground">{selectedLog?.performed_by_name || selectedLog?.performed_by}</p>
                            </div>
                             <div>
                              <p className="text-[10px] text-muted-foreground uppercase">Fecha y Hora</p>
                              <p className="text-foreground font-mono">
                                {selectedLog ? formatDate(selectedLog.created_at) : ""}
                              </p>
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
                              onClick={() => setDialogOpen(false)}
                              className="w-full rounded-xl bg-default/50 text-foreground hover:bg-slate-700 font-semibold"
                            >
                              Cerrar Inspección
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
