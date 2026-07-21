import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@mantainer-system/ui/components/card";
import { Badge } from "@mantainer-system/ui/components/badge";
import { Button, buttonVariants } from "@mantainer-system/ui/components/button";
import { Link } from "@tanstack/react-router";
import type { MachineResponse, MachineStatus } from "../types";
import { horometerUnitAbbr, horometerNoun } from "../types";
import { CpuIcon, CalendarIcon, GaugeIcon, ArrowRightIcon, Trash2Icon } from "lucide-react";
import { cn } from "@mantainer-system/ui/lib/utils";
import { useSoftDeleteMachine } from "../hooks/use-machines";

interface MachineCardProps {
  machine: MachineResponse;
  canEdit?: boolean;
}

export default function MachineCard({ machine, canEdit = true }: MachineCardProps) {
  const deleteMutation = useSoftDeleteMachine();
  
  const isBaja = machine.status === "DADA_DE_BAJA";

  // Mapear colores de estados dinámicos
  const statusStyles: Record<MachineStatus, { label: string; className: string }> = {
    ACTIVA: {
      label: "Activa",
      className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    },
    EN_MANTENIMIENTO: {
      label: "En Mantenimiento",
      className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    },
    FUERA_DE_SERVICIO: {
      label: "Fuera de Servicio",
      className: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    },
    DADA_DE_BAJA: {
      label: "Dada de Baja",
      className: "bg-default/10 text-muted-foreground border-border",
    },
  };

  const currentStatus = statusStyles[machine.status] || { label: machine.status, className: "bg-default/10 text-muted-foreground" };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(`¿Estás seguro de que deseas dar de baja la maquinaria ${machine.code}?`)) {
      await deleteMutation.mutateAsync(machine.id);
    }
  };

  return (
    <Card className={cn(
      "group relative overflow-hidden rounded-2xl border bg-surface/40 backdrop-blur-md transition-all duration-300 hover:border-accent/40 hover:shadow-lg hover:shadow-accent/5 flex flex-col justify-between h-full",
      isBaja ? "border-border opacity-60" : "border-border"
    )}>
      {/* Sutil gradiente superior decorativo */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent/0 via-accent/20 to-accent/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CpuIcon className="size-5 text-accent" />
            {machine.code}
          </CardTitle>
          <CardDescription className="text-xs text-muted">
            {machine.brand} {machine.model}
          </CardDescription>
        </div>
        <Badge className={cn("px-2 py-0.5 rounded-lg border text-[10px] font-bold uppercase", currentStatus.className)}>
          {currentStatus.label}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-3 pb-6 flex-1">
        <div className="flex items-center gap-3 text-sm text-foreground">
          <div className="p-1.5 rounded-lg bg-default/60 text-accent">
            <GaugeIcon className="size-4" />
          </div>
          <div>
            <p className="text-[10px] text-muted font-semibold uppercase">{horometerNoun(machine.horometer_unit)} Actual</p>
            <p className="font-mono text-sm font-bold text-foreground">{machine.current_horometer.toFixed(1)} {horometerUnitAbbr(machine.horometer_unit)}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm text-foreground">
          <div className="p-1.5 rounded-lg bg-default/60 text-accent">
            <CalendarIcon className="size-4" />
          </div>
          <div>
            <p className="text-[10px] text-muted font-semibold uppercase">Año de Fabricación</p>
            <p className="text-sm font-bold text-foreground">{machine.manufacture_year}</p>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between border-t border-border pt-4 bg-background/80">
        <Link
          to="/maquinaria/$id"
          params={{ id: machine.id }}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "rounded-xl text-indigo-400 hover:text-indigo-200 hover:bg-indigo-950/20 flex items-center gap-1.5"
          )}
        >
          Ver Ficha
          <ArrowRightIcon className="size-4" />
        </Link>

        {canEdit && !isBaja && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="rounded-xl text-rose-400 hover:text-rose-200 hover:bg-rose-950/20"
          >
            <Trash2Icon className="size-4" />
          </Button>
        )}

        {isBaja && (
          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
            Solo Lectura
          </span>
        )}
      </CardFooter>
    </Card>
  );
}
