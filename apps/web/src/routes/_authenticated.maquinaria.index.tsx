import { createFileRoute } from "@tanstack/react-router";
import {
  useDownloadMachineTemplate,
  useExportMachines,
  useImportMachines,
  useMachines,
} from "@/features/maquinaria/hooks/use-machines";
import { useAuth } from "@/features/auth/hooks/use-auth";
import MachineCard from "@/features/maquinaria/components/machine-card";
import { Button } from "@mantainer-system/ui/components/button";
import { Input } from "@mantainer-system/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@mantainer-system/ui/components/select";
import { Skeleton } from "@mantainer-system/ui/components/skeleton";
import { Modal } from "@mantainer-system/ui/components/modal";
import MachineForm from "@/features/maquinaria/components/machine-form";
import {
  PlusIcon,
  SearchIcon,
  CpuIcon,
  DownloadIcon,
  UploadIcon,
  FileSpreadsheetIcon,
} from "lucide-react";
import { useRef, useState } from "react";

export const Route = createFileRoute("/_authenticated/maquinaria/")({
  component: MaquinariaIndexComponent,
});

function MaquinariaIndexComponent() {
  const { canManageMachines, canImportMachines } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: machines = [], isLoading } = useMachines({
    status,
    search,
  });

  // Importación / exportación del catálogo (spec 4.4)
  const exportMachines = useExportMachines();
  const downloadTemplate = useDownloadMachineTemplate();
  const importMachines = useImportMachines();

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    importMachines.mutate(file, {
      // Se limpia el input para poder volver a subir el mismo archivo tras corregirlo.
      onSettled: () => {
        if (fileInputRef.current) fileInputRef.current.value = "";
      },
    });
  };

  const canCreate = canManageMachines;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Cabecera de Página */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CpuIcon className="size-6 text-accent" />
            Flota de Maquinarias
          </h2>
          <p className="text-sm text-muted">
            Catálogo completo de activos pesados y su estado operativo
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* spec 4.4: importación / exportación del catálogo, exclusiva del
              Planificador. La plantilla y la exportación comparten columnas, de
              modo que se puede exportar, editar en Excel y volver a subir. */}
          {canImportMachines && (
            <>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImport}
                accept=".xlsx,.xlsm,.csv"
                className="hidden"
              />
              {/* El Button compartido no admite `title`: el tooltip nativo va en el envoltorio. */}
              <span title="Descarga una plantilla Excel con ejemplos e instrucciones">
                <Button
                  variant="outline"
                  onClick={() => downloadTemplate.mutate()}
                  disabled={downloadTemplate.isPending}
                  className="rounded-xl border-border text-foreground hover:bg-default font-semibold flex items-center gap-1.5 h-8 px-4"
                >
                  <FileSpreadsheetIcon className="size-4" />
                  Plantilla
                </Button>
              </span>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={importMachines.isPending}
                className="rounded-xl border-border text-foreground hover:bg-default font-semibold flex items-center gap-1.5 h-8 px-4"
              >
                <UploadIcon className="size-4" />
                {importMachines.isPending ? "Importando..." : "Importar"}
              </Button>
              <Button
                variant="outline"
                onClick={() => exportMachines.mutate("xlsx")}
                disabled={exportMachines.isPending}
                className="rounded-xl border-border text-foreground hover:bg-default font-semibold flex items-center gap-1.5 h-8 px-4"
              >
                <DownloadIcon className="size-4" />
                Excel
              </Button>
              <Button
                variant="outline"
                onClick={() => exportMachines.mutate("pdf")}
                disabled={exportMachines.isPending}
                className="rounded-xl border-border text-foreground hover:bg-default font-semibold flex items-center gap-1.5 h-8 px-4"
              >
                <DownloadIcon className="size-4" />
                PDF
              </Button>
            </>
          )}

          {canCreate && (
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="rounded-xl bg-accent hover:bg-accent/80 font-semibold text-accent-foreground flex items-center gap-1.5 shadow-md shadow-accent/10 h-8 px-4"
            >
              <PlusIcon className="size-4" />
              Registrar Maquinaria
            </Button>
          )}
        </div>
      </div>

      {/* Controles de Búsqueda y Filtrado */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-surface/40 border border-border backdrop-blur-md">
        {/* Buscador de Texto */}
        <div className="relative sm:col-span-2">
          <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4.5 text-muted" />
          <Input
            type="text"
            placeholder="Buscar por código, marca, modelo o motor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-default/60 border-border focus:border-accent rounded-xl text-foreground"
          />
        </div>

        {/* Filtro por Estado */}
        <div>
          <Select value={status} onValueChange={(val: any) => setStatus(val || "ALL")}>
            <SelectTrigger className="bg-default/60 border-border rounded-xl text-foreground">
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent className="bg-overlay border border-border text-foreground rounded-xl">
              <SelectItem value="ALL">Todos los estados</SelectItem>
              <SelectItem value="ACTIVA">Activa</SelectItem>
              <SelectItem value="EN_MANTENIMIENTO">En Mantenimiento</SelectItem>
              <SelectItem value="FUERA_DE_SERVICIO">Fuera de Servicio</SelectItem>
              <SelectItem value="DADA_DE_BAJA">Dada de Baja</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grid de Maquinarias */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-44 rounded-2xl bg-default/50" />
          <Skeleton className="h-44 rounded-2xl bg-default/50" />
          <Skeleton className="h-44 rounded-2xl bg-default/50" />
        </div>
      ) : machines.length === 0 ? (
        <div className="text-center py-16 bg-surface/20 border border-border rounded-3xl p-6">
          <CpuIcon className="size-10 mx-auto text-muted mb-2 animate-bounce" />
          <p className="text-muted text-sm font-semibold">No se encontraron maquinarias pesadas.</p>
          <p className="text-muted/65 text-xs mt-1">Intenta modificar los criterios de búsqueda o filtros.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {machines.map((machine) => (
            <MachineCard
              key={machine.id}
              machine={machine}
              canEdit={canManageMachines}
            />
          ))}
        </div>
      )}

      {/* Modal de Registro de Maquinaria (HeroUI v3 Modal) */}
      <Modal isOpen={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <Modal.Backdrop variant="blur">
          <Modal.Container size="cover">
            <Modal.Dialog className="max-w-2xl bg-background border border-border text-foreground shadow-2xl p-6 rounded-2xl">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading className="text-2xl font-bold flex items-center gap-2">
                  <CpuIcon className="size-6 text-accent" />
                  Registrar Nueva Maquinaria
                </Modal.Heading>
                <p className="text-sm text-muted">
                  Inscribe un nuevo activo pesado al inventario del taller operativo
                </p>
              </Modal.Header>
              <Modal.Body className="p-0 pt-4">
                <MachineForm
                  onSuccess={() => setIsCreateOpen(false)}
                  onCancel={() => setIsCreateOpen(false)}
                />
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}

