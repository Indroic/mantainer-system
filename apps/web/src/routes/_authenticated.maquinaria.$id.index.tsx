import { createFileRoute } from "@tanstack/react-router";
import { useMachine, useUpdateHorometer, useChangeMachineStatus } from "@/features/maquinaria/hooks/use-machines";
import { useOrders } from "@/features/mantenimiento/hooks/use-maintenance";
import { useAuth } from "@/features/auth/hooks/use-auth";
import TechnicalHistoryTimeline from "@/features/reportes/components/technical-history-timeline";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@mantainer-system/ui/components/card";
import { Button } from "@mantainer-system/ui/components/button";
import { Input } from "@mantainer-system/ui/components/input";
import { Label } from "@mantainer-system/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@mantainer-system/ui/components/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@mantainer-system/ui/components/tabs";
import { Badge } from "@mantainer-system/ui/components/badge";
import { Skeleton } from "@mantainer-system/ui/components/skeleton";
import { CpuIcon, GaugeIcon, ShieldCheckIcon, AlertTriangleIcon, WrenchIcon, CalendarIcon, InfoIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { cn } from "@mantainer-system/ui/lib/utils";
import type { MachineStatus } from "@/features/maquinaria/types";
import { horometerUnitAbbr, horometerNoun } from "@/features/maquinaria/types";

export const Route = createFileRoute("/_authenticated/maquinaria/$id/")({
  component: MaquinariaFichaComponent,
});

function MaquinariaFichaComponent() {
  const { id } = Route.useParams();
  const { isAdmin, isSupervisor } = useAuth();

  // Queries
  const { data: machine, isLoading: machineLoading } = useMachine(id);
  const { data: orders = [], isLoading: ordersLoading } = useOrders();

  // Mutaciones
  const updateHorometerMutation = useUpdateHorometer(id);
  const changeStatusMutation = useChangeMachineStatus(id);

  // Estados Locales
  const [horometer, setHorometer] = useState<number>(0);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    if (machine) {
      setHorometer(machine.current_horometer);
      setStatus(machine.status);
    }
  }, [machine]);

  if (machineLoading || ordersLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64 rounded bg-default/50" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-44 md:col-span-2 rounded bg-default/50" />
          <Skeleton className="h-44 rounded bg-default/50" />
        </div>
      </div>
    );
  }

  if (!machine) {
    return (
      <div className="text-center py-10 bg-surface/20 border border-border rounded-2xl">
        <AlertTriangleIcon className="size-8 mx-auto text-rose-500 mb-2" />
        <p className="text-muted-foreground text-sm font-semibold">No se encontró la maquinaria pesada solicitada.</p>
      </div>
    );
  }

  const isBaja = machine.status === "DADA_DE_BAJA";
  const machineOrders = orders.filter((o) => o.machine_id === machine.id);

  // Validación local estricta de horómetro
  const isHorometerInvalid = horometer < machine.current_horometer;

  const handleUpdateHorometer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isHorometerInvalid) {
      toast.error("El horómetro acumulado ingresado no puede ser menor al actual");
      return;
    }

    await updateHorometerMutation.mutateAsync({
      current_horometer: horometer,
    });
  };

  const handleStatusChange = async (newStatus: string) => {
    await changeStatusMutation.mutateAsync({
      status: newStatus as MachineStatus,
    });
  };

  // Estilo de estados
  const statusStyles: Record<MachineStatus, string> = {
    ACTIVA: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    EN_MANTENIMIENTO: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    FUERA_DE_SERVICIO: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    DADA_DE_BAJA: "bg-default/10 text-muted-foreground border-border",
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Cabecera superior premium */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <CpuIcon className="size-6 text-accent" />
              Ficha Técnica: {machine.code}
            </h2>
            <Badge className={cn("px-2 py-0.5 rounded-lg border text-[10px] font-bold uppercase", statusStyles[machine.status])}>
              {machine.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {machine.brand} {machine.model} · Serial del Motor: {machine.motor_serial}
          </p>
        </div>
      </div>

      {/* Selector de Pestañas de Ficha vs Historial */}
      <Tabs defaultValue="ficha" className="w-full">
        <TabsList className="bg-default/60 border border-border rounded-xl p-1 mb-6 flex justify-start w-fit">
          <TabsTrigger value="ficha" className="rounded-lg px-4 py-2 text-xs font-semibold text-muted-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
            <InfoIcon className="size-4 mr-2" />
            Especificaciones y Control
          </TabsTrigger>
          <TabsTrigger value="historial" className="rounded-lg px-4 py-2 text-xs font-semibold text-muted-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
            <WrenchIcon className="size-4 mr-2" />
            Historial de Mantenimientos
          </TabsTrigger>
        </TabsList>

        {/* CONTENIDO 1: FICHA TÉCNICA Y CONTROLES */}
        <TabsContent value="ficha" className="space-y-6 outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Especificaciones de Activo */}
            <Card className="lg:col-span-2 border-border bg-card backdrop-blur-md rounded-2xl shadow-xl">
              <CardHeader className="border-b border-border">
                <CardTitle className="text-lg font-bold text-card-foreground">Ficha Técnica e Inserción</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">Características de fábrica del activo</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 grid grid-cols-2 gap-6">
                <div>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Código del Activo</p>
                  <p className="text-sm font-semibold text-foreground mt-0.5">{machine.code}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Serial del Motor</p>
                  <p className="text-sm font-semibold text-foreground mt-0.5">{machine.motor_serial}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Marca</p>
                  <p className="text-sm font-semibold text-foreground mt-0.5">{machine.brand}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Modelo</p>
                  <p className="text-sm font-semibold text-foreground mt-0.5">{machine.model}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Año de Fabricación</p>
                  <p className="text-sm font-semibold text-foreground mt-0.5 flex items-center gap-1.5">
                    <CalendarIcon className="size-4 text-muted-foreground" />
                    {machine.manufacture_year}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{horometerNoun(machine.horometer_unit)} de Alta</p>
                  <p className="text-sm font-mono font-semibold text-foreground mt-0.5">{machine.current_horometer} {horometerUnitAbbr(machine.horometer_unit)}</p>
                </div>
              </CardContent>
            </Card>

            {/* Panel Lateral de Controles Rápidos */}
            <div className="space-y-6">
              {/* Control de Horómetro */}
              <Card className="border-border bg-card backdrop-blur-md rounded-2xl shadow-xl">
                <CardHeader className="border-b border-border pb-3">
                  <CardTitle className="text-sm font-bold text-card-foreground flex items-center gap-2">
                    <GaugeIcon className="size-4.5 text-accent" />
                    Actualizar {horometerNoun(machine.horometer_unit)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <form onSubmit={handleUpdateHorometer} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="horometer" className="text-xs text-foreground/80">{horometerNoun(machine.horometer_unit)} Acumulado ({horometerUnitAbbr(machine.horometer_unit)})</Label>
                      <Input
                        id="horometer"
                        type="number"
                        step="0.1"
                        disabled={isBaja}
                        value={horometer}
                        onChange={(e) => setHorometer(Number(e.target.value))}
                        className="bg-default/60 border-border rounded-xl"
                      />
                      <p className="text-[10px] text-muted-foreground font-medium">
                        {horometerNoun(machine.horometer_unit)} actual del activo: {machine.current_horometer} {horometerUnitAbbr(machine.horometer_unit)}
                      </p>
                    </div>

                    {isHorometerInvalid && (
                      <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex gap-2">
                        <AlertTriangleIcon className="size-4.5 shrink-0 mt-0.5" />
                        <span>No se permite un valor inferior al actual.</span>
                      </div>
                    )}

                    <Button
                      type="submit"
                      disabled={isBaja || updateHorometerMutation.isPending || isHorometerInvalid}
                      className="w-full rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
                    >
                      {updateHorometerMutation.isPending ? "Guardando..." : "Actualizar"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Control de Estado de Activo (Administrador y Supervisor) */}
              {(isAdmin || isSupervisor) && (
                <Card className="border-border bg-card backdrop-blur-md rounded-2xl shadow-xl">
                  <CardHeader className="border-b border-border pb-3">
                    <CardTitle className="text-sm font-bold text-card-foreground flex items-center gap-2">
                      <ShieldCheckIcon className="size-4.5 text-accent" />
                      Estado de Disponibilidad
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-foreground/80">Cambiar disponibilidad</Label>
                      <Select
                        disabled={isBaja}
                        value={status}
                        onValueChange={(val: any) => handleStatusChange(val || "ACTIVA")}
                      >
                        <SelectTrigger className="bg-default/60 border-border rounded-xl text-foreground">
                          <SelectValue placeholder="Estado" />
                        </SelectTrigger>
                        <SelectContent className="bg-overlay border border-border text-foreground rounded-xl">
                          <SelectItem value="ACTIVA">Activa</SelectItem>
                          <SelectItem value="EN_MANTENIMIENTO">En Mantenimiento</SelectItem>
                          <SelectItem value="FUERA_DE_SERVICIO">Fuera de Servicio</SelectItem>
                          {isBaja && <SelectItem value="DADA_DE_BAJA">Dada de Baja</SelectItem>}
                        </SelectContent>
                      </Select>
                    </div>

                    {isBaja && (
                      <div className="p-3 bg-default/40 border border-border rounded-xl text-[10px] text-muted-foreground text-center font-bold uppercase tracking-wider leading-relaxed">
                        Este activo ha sido dado de baja de forma lógica y es inmutable.
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* CONTENIDO 2: HISTORIAL DE MANTENIMIENTOS */}
        <TabsContent value="historial" className="outline-none">
          <TechnicalHistoryTimeline orders={machineOrders} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
