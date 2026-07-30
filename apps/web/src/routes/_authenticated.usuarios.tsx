import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { Button } from "@mantainer-system/ui/components/button";
import { TextField, FieldError, Input, Label } from "@heroui/react";
import { Skeleton } from "@mantainer-system/ui/components/skeleton";
import { Modal } from "@mantainer-system/ui/components/modal";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@mantainer-system/ui/components/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@mantainer-system/ui/components/table";
import { Badge } from "@mantainer-system/ui/components/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@mantainer-system/ui/components/select";
import { useForm } from "@tanstack/react-form";
import { UsersIcon, PlusIcon, Trash2Icon, AlertTriangleIcon, MailIcon, ShieldCheckIcon, LockIcon, PencilIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";

export const Route = createFileRoute("/_authenticated/usuarios")({
  component: UsuariosComponent,
});

const NAME_PATTERN = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ' -]+$/;

const userSchema = z.object({
  name: z
    .string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .regex(NAME_PATTERN, "El nombre solo puede contener letras, espacios, apóstrofes y guiones"),
  // spec 6.1: el acceso se hace por nombre de usuario; el correo sigue siendo
  // obligatorio, pero solo para notificaciones y recuperación de contraseña.
  username: z
    .string()
    .min(3, "El nombre de usuario debe tener al menos 3 caracteres")
    .max(30, "El nombre de usuario no puede exceder 30 caracteres")
    .regex(/^[a-zA-Z0-9_.]+$/, "Solo se permiten letras, números, punto y guion bajo"),
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  role: z.enum(["planner", "supervisor", "mechanic", "warehouse"]),
});

/** Roles asignables desde la gestión de usuarios, con su etiqueta en la UI. */
const ASSIGNABLE_ROLES: { value: ManagedRole; label: string; hint: string }[] = [
  { value: "mechanic", label: "Mecánico", hint: "Ejecuta OT y registra averías" },
  { value: "supervisor", label: "Supervisor", hint: "Supervisa el taller y crea OT" },
  { value: "warehouse", label: "Almacén", hint: "Consulta stock y despacha repuestos" },
  { value: "planner", label: "Planificador", hint: "Control total del sistema" },
];

type ManagedRole = "planner" | "supervisor" | "mechanic" | "warehouse";

const getErrorMessage = (err: any): string => {
  if (!err) return "";
  if (typeof err === "string") return err;
  if (typeof err === "object") {
    if (err.message) return err.message;
    if (err._errors && Array.isArray(err._errors)) return err._errors.join(", ");
  }
  return String(err);
};

function UsuariosComponent() {
  const { canManageUsers, user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedEditUser, setSelectedEditUser] = useState<any>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const res = await authClient.admin.listUsers({
        query: {
          limit: 100,
        },
      });
      if (res.error) {
        throw new Error(res.error.message || "Error al obtener usuarios");
      }
      return res.data.users || [];
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (values: z.infer<typeof userSchema>) => {
      const res = await authClient.admin.createUser({
        email: values.email,
        password: values.password,
        name: values.name,
        role: values.role as any,
        // `username` es un campo del plugin username: va en `data`, no en la raíz.
        data: {
          username: values.username.trim().toLowerCase(),
          displayUsername: values.username.trim(),
        },
      } as never);

      if (res.error) {
        throw new Error(res.error.message || "Error al crear usuario");
      }
      return res.data;
    },
    onSuccess: () => {
      toast.success("Usuario creado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al crear usuario");
    },
  });

  const changeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: ManagedRole }) => {
      const res = await authClient.admin.setRole({
        userId,
        role: role as any,
      });

      if (res.error) {
        throw new Error(res.error.message || "Error al actualizar rol");
      }
      return res.data;
    },
    onSuccess: () => {
      toast.success("Rol actualizado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al actualizar rol");
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await authClient.admin.removeUser({
        userId,
      });
      if (res.error) {
        throw new Error(res.error.message || "Error al eliminar usuario");
      }
      return res.data;
    },
    onSuccess: () => {
      toast.success("Usuario eliminado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al eliminar usuario");
    },
  });

  const updateCredentialsMutation = useMutation({
    mutationFn: async ({ userId, email, password }: { userId: string; email?: string; password?: string }) => {
      if (email && email.trim() !== "") {
        const res = await authClient.admin.updateUser({
          userId,
          data: {
            email: email.trim(),
          },
        });

        if (res.error) {
          throw new Error(res.error.message || "Error al actualizar correo");
        }
      }
      if (password && password.trim() !== "") {
        if (password.length < 8) {
          throw new Error("La contraseña debe tener al menos 8 caracteres");
        }
        const res = await authClient.admin.setUserPassword({
          userId,
          newPassword: password.trim(),
        });
        if (res.error) {
          throw new Error(res.error.message || "Error al actualizar contraseña");
        }
      }
    },
    onSuccess: () => {
      toast.success("Credenciales actualizadas exitosamente");
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setEditDialogOpen(false);
      setEditEmail("");
      setEditPassword("");
      setSelectedEditUser(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Error al actualizar credenciales");
    },
  });

  const form = useForm({
    defaultValues: {
      name: "",
      username: "",
      email: "",
      password: "",
      role: "mechanic" as ManagedRole,
    },
    onSubmit: async ({ value }) => {
      await createUserMutation.mutateAsync(value, {
        onSuccess: () => {
          setDialogOpen(false);
          form.reset();
        },
      });
    },
    validators: {
      onChange: userSchema,
    },
  });

  if (!canManageUsers) {
    return (
      <div className="text-center py-12 bg-surface/20 border border-border rounded-3xl p-6 max-w-xl mx-auto">
        <AlertTriangleIcon className="size-10 mx-auto text-rose-500 mb-2" />
        <p className="text-foreground text-base font-bold">Acceso Restringido</p>
        <p className="text-muted text-xs mt-1">
          Solo el Planificador cuenta con autorización para gestionar las cuentas de usuario y los roles del sistema.
        </p>
      </div>
    );
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      // "admin" es el alias heredado del Planificador: se etiqueta igual para
      // que las cuentas sin migrar no aparezcan con un rol desconocido.
      case "planner":
      case "admin":
        return <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20 font-bold">Planificador</Badge>;
      case "supervisor":
        return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 font-bold">Supervisor</Badge>;
      case "warehouse":
        return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-bold">Almacén</Badge>;
      default:
        return <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 font-bold">Mecánico</Badge>;
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Cabecera de Página */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <UsersIcon className="size-6 text-accent animate-pulse" />
            Gestión de Usuarios y Roles
          </h2>
          <p className="text-sm text-muted">
            Control de cuentas del taller, asignación de roles jerárquicos y políticas de acceso
          </p>
        </div>

        <Button
          onClick={() => setDialogOpen(true)}
          className="rounded-xl px-4 bg-accent hover:bg-accent/80 text-accent-foreground font-semibold flex items-center gap-1.5 shadow-md shadow-accent/20 h-8"
        >
          <PlusIcon className="size-4" />
          Registrar Usuario
        </Button>
      </div>

      {/* Modal de Registro de Usuario (HeroUI v3 Modal) */}
      <Modal isOpen={dialogOpen} onOpenChange={setDialogOpen}>
        <Modal.Backdrop variant="blur">
          <Modal.Container size="cover">
            <Modal.Dialog className="max-w-md bg-background border border-border text-foreground shadow-2xl p-6 rounded-2xl">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading className="text-2xl font-bold flex items-center gap-2">
                  <UsersIcon className="size-6 text-accent" />
                  Registrar Nuevo Usuario
                </Modal.Heading>
                <p className="text-sm text-muted">
                  Crea una nueva cuenta de acceso para el personal del taller operativo
                </p>
              </Modal.Header>
              <Modal.Body className="p-0 pt-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    form.handleSubmit();
                  }}
                  className="space-y-4"
                >
                  {/* Nombre */}
                  <form.Field name="name">
                    {(field) => {
                      const hasError = field.state.meta.errors.length > 0;
                      return (
                        <TextField
                          name={field.name}
                          isRequired
                          isInvalid={hasError}
                          value={field.state.value}
                          onChange={(val) => field.handleChange(val)}
                          className="w-full flex flex-col gap-1.5"
                        >
                          <Label className="text-foreground/85 text-xs font-semibold">Nombre Completo</Label>
                          <Input
                            id={field.name}
                            placeholder="Ej. Juan Pérez"
                            onBlur={field.handleBlur}
                            className="bg-default/60 border-border focus-visible:border-accent rounded-xl text-foreground text-sm"
                          />
                          {field.state.meta.errors.map((error) => (
                            <FieldError key={getErrorMessage(error)} className="text-xs text-rose-400 font-medium">
                              {getErrorMessage(error)}
                            </FieldError>
                          ))}
                        </TextField>
                      );
                    }}
                  </form.Field>

                  {/* Email */}
                  {/* Nombre de usuario: credencial de acceso (spec 6.1) */}
                  <form.Field name="username">
                    {(field) => {
                      const hasError = field.state.meta.errors.length > 0;
                      return (
                        <TextField
                          name={field.name}
                          isRequired
                          isInvalid={hasError}
                          value={field.state.value}
                          onChange={(val) => field.handleChange(val)}
                          className="w-full flex flex-col gap-1.5"
                        >
                          <Label className="text-foreground/85 text-xs font-semibold">
                            Nombre de Usuario
                          </Label>
                          <Input
                            id={field.name}
                            placeholder="Ej. jmorales1"
                            autoCapitalize="none"
                            spellCheck={false}
                            onBlur={field.handleBlur}
                            className="bg-default/60 border-border focus-visible:border-accent rounded-xl text-foreground text-sm"
                          />
                          <p className="text-[10px] text-muted">
                            Credencial con la que el usuario iniciará sesión.
                          </p>
                          {field.state.meta.errors.map((error) => (
                            <FieldError key={getErrorMessage(error)} className="text-xs text-rose-400 font-medium">
                              {getErrorMessage(error)}
                            </FieldError>
                          ))}
                        </TextField>
                      );
                    }}
                  </form.Field>

                  <form.Field name="email">
                    {(field) => {
                      const hasError = field.state.meta.errors.length > 0;
                      return (
                        <TextField
                          name={field.name}
                          isRequired
                          isInvalid={hasError}
                          value={field.state.value}
                          onChange={(val) => field.handleChange(val)}
                          className="w-full flex flex-col gap-1.5"
                        >
                          <Label className="text-foreground/85 text-xs font-semibold">Correo Electrónico</Label>
                          <Input
                            id={field.name}
                            type="email"
                            placeholder="Ej. juan@taller.com"
                            onBlur={field.handleBlur}
                            className="bg-default/60 border-border focus-visible:border-accent rounded-xl text-foreground text-sm"
                          />
                          <p className="text-[10px] text-muted">
                            Obligatorio para notificaciones y recuperación de contraseña; no se
                            usa para iniciar sesión.
                          </p>
                          {field.state.meta.errors.map((error) => (
                            <FieldError key={getErrorMessage(error)} className="text-xs text-rose-400 font-medium">
                              {getErrorMessage(error)}
                            </FieldError>
                          ))}
                        </TextField>
                      );
                    }}
                  </form.Field>

                  {/* Password */}
                  <form.Field name="password">
                    {(field) => {
                      const hasError = field.state.meta.isTouched && field.state.meta.errors.length > 0;
                      return (
                        <TextField
                          name={field.name}
                          isRequired
                          isInvalid={hasError}
                          value={field.state.value}
                          onChange={(val) => field.handleChange(val)}
                          className="w-full flex flex-col gap-1.5"
                        >
                          <Label className="text-foreground/85 text-xs font-semibold">Contraseña Inicial</Label>
                          <Input
                            id={field.name}
                            type="password"
                            placeholder="•••••••• (mínimo 8 caracteres)"
                            onBlur={field.handleBlur}
                            className="bg-default/60 border-border focus-visible:border-accent rounded-xl text-foreground text-sm"
                          />
                          {field.state.meta.isTouched && field.state.meta.errors.map((error) => (
                            <FieldError key={getErrorMessage(error)} className="text-xs text-rose-400 font-medium">
                              {getErrorMessage(error)}
                            </FieldError>
                          ))}
                        </TextField>
                      );
                    }}
                  </form.Field>

                  {/* Rol */}
                  <form.Field name="role">
                    {(field) => (
                      <div className="space-y-1.5 flex flex-col">
                        <Label className="text-foreground/85 text-xs font-semibold">Rol del Sistema</Label>
                        <Select
                          value={field.state.value}
                          onValueChange={(val: any) => field.handleChange(val as ManagedRole)}
                        >
                          <SelectTrigger className="bg-default/60 border-border rounded-xl text-foreground text-sm h-9">
                            <SelectValue placeholder="Seleccione un rol" />
                          </SelectTrigger>
                          <SelectContent className="bg-overlay border border-border text-foreground rounded-xl">
                            {ASSIGNABLE_ROLES.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label} ({option.hint})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {field.state.meta.errors.map((error) => (
                          <p key={getErrorMessage(error)} className="text-xs text-rose-400 font-medium mt-1">
                            {getErrorMessage(error)}
                          </p>
                        ))}
                      </div>
                    )}
                  </form.Field>

                  <div className="flex gap-4 pt-4 border-t border-border mt-6">
                    <Button
                      type="submit"
                      disabled={createUserMutation.isPending}
                      className="flex-1 rounded-xl bg-accent hover:bg-accent/80 text-accent-foreground font-semibold"
                    >
                      {createUserMutation.isPending ? "Registrando..." : "Registrar"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDialogOpen(false)}
                      className="flex-1 rounded-xl border-border text-foreground hover:bg-default"
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Modal de Edición de Credenciales (HeroUI v3 Modal) */}
      <Modal isOpen={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <Modal.Backdrop variant="blur">
          <Modal.Container size="cover">
            <Modal.Dialog className="max-w-md bg-background border border-border text-foreground shadow-2xl p-6 rounded-2xl">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading className="text-2xl font-bold flex items-center gap-2">
                  <PencilIcon className="size-6 text-accent" />
                  Editar Credenciales
                </Modal.Heading>
                <p className="text-sm text-muted">
                  Actualiza el correo y contraseña de {selectedEditUser?.name}
                </p>
              </Modal.Header>
              <Modal.Body className="p-0 pt-4">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!selectedEditUser) return;
                    await updateCredentialsMutation.mutateAsync({
                      userId: selectedEditUser.id,
                      email: editEmail,
                      password: editPassword,
                    });
                  }}
                  className="space-y-4"
                >
                  {/* Nuevo Email */}
                  <TextField
                    className="w-full flex flex-col gap-1.5"
                    value={editEmail}
                    onChange={(val) => setEditEmail(val)}
                  >
                    <Label className="text-foreground/85 text-xs font-semibold">Correo Electrónico</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      placeholder="Ej. nuevo-correo@taller.com"
                      className="bg-default/60 border-border focus-visible:border-accent rounded-xl text-foreground text-sm"
                    />
                    <p className="text-[10px] text-muted">Opcional. Deja en blanco para no modificar.</p>
                  </TextField>

                  {/* Nueva Contraseña */}
                  <TextField
                    className="w-full flex flex-col gap-1.5"
                    value={editPassword}
                    onChange={(val) => setEditPassword(val)}
                  >
                    <Label className="text-foreground/85 text-xs font-semibold">Nueva Contraseña</Label>
                    <Input
                      id="edit-password"
                      type="password"
                      placeholder="•••••••• (mínimo 8 caracteres)"
                      className="bg-default/60 border-border focus-visible:border-accent rounded-xl text-foreground text-sm"
                    />
                    <p className="text-[10px] text-muted">Opcional. Deja en blanco para no modificar.</p>
                  </TextField>

                  <div className="flex gap-4 pt-4 border-t border-border mt-6">
                    <Button
                      type="submit"
                      disabled={updateCredentialsMutation.isPending}
                      className="flex-1 rounded-xl bg-accent hover:bg-accent/80 text-accent-foreground font-semibold"
                    >
                      {updateCredentialsMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEditDialogOpen(false);
                        setEditEmail("");
                        setEditPassword("");
                        setSelectedEditUser(null);
                      }}
                      className="flex-1 rounded-xl border-border text-foreground hover:bg-default"
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Tabla de Usuarios */}
      <Card className="border-border bg-surface/40 backdrop-blur-md rounded-2xl shadow-xl overflow-hidden">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
            <ShieldCheckIcon className="size-5 text-accent" />
            Personal Registrado y Niveles de Acceso
          </CardTitle>
          <CardDescription className="text-xs text-muted">
            Lista completa de usuarios autenticados que tienen permitido el acceso al portal del taller
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-10 rounded-xl bg-default/50" />
              <Skeleton className="h-44 rounded-xl bg-default/50" />
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-default/40 border-b border-border">
                <TableRow>
                  <TableHead className="font-semibold text-foreground/80 text-xs px-6 py-4">Usuario</TableHead>
                  <TableHead className="font-semibold text-foreground/80 text-xs px-6 py-4">Correo Electrónico</TableHead>
                  <TableHead className="font-semibold text-foreground/80 text-xs px-6 py-4">Nivel de Acceso</TableHead>
                  <TableHead className="font-semibold text-foreground/80 text-xs px-6 py-4">Cambiar Rol</TableHead>
                  <TableHead className="font-semibold text-foreground/80 text-xs px-6 py-4 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((item) => {
                  const isSelf = item.id === user?.id;
                  // El Planificador (y el alias heredado "admin") está protegido frente a
                  // cambios de rol y eliminación, igual que en el backend.
                  const isPlannerUser = item.role === "planner" || item.role === "admin";
                  const isModifyDisabled = isSelf || isPlannerUser || changeRoleMutation.isPending;

                  return (
                    <TableRow key={item.id} className="border-b border-border hover:bg-default/25 transition-colors">
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center font-bold text-accent">
                            {item.name[0].toUpperCase()}
                          </div>
                          <span className="font-bold text-foreground text-xs">
                            {item.name}
                            {isSelf && (
                              <span className="text-accent font-normal text-[10px] ml-1.5 bg-accent/15 px-1.5 py-0.5 rounded border border-accent/20">
                                Tú
                              </span>
                            )}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-xs font-mono text-muted">
                        <div className="flex items-center gap-1.5">
                          <MailIcon className="size-3.5 text-muted/80" />
                          {item.email}
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        {getRoleBadge(item.role || "")}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <Select
                          value={item.role}
                          onValueChange={(val: any) =>
                            changeRoleMutation.mutate({
                              userId: item.id,
                              role: val as ManagedRole,
                            })
                          }
                          disabled={isModifyDisabled}
                        >
                          <SelectTrigger className="w-40 bg-default/60 border-border rounded-lg text-[11px] h-8 text-foreground disabled:opacity-50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-overlay border border-border text-foreground rounded-lg">
                            {ASSIGNABLE_ROLES.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-right">
                        {isSelf || isPlannerUser ? (
                          <div className="flex justify-end pr-2 text-muted" title="Protegido contra cambios/eliminación">
                            <LockIcon className="size-4 text-muted/60" />
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-lg text-accent hover:text-accent-foreground hover:bg-accent/20 border border-transparent hover:border-accent/20 transition-all duration-200 size-8"
                              onClick={() => {
                                setSelectedEditUser(item);
                                setEditEmail(item.email);
                                setEditPassword("");
                                setEditDialogOpen(true);
                              }}
                            >
                              <PencilIcon className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-lg text-rose-400 hover:text-rose-200 hover:bg-rose-950/35 border border-transparent hover:border-rose-900/35 transition-all duration-200 size-8"
                              onClick={() => {
                                if (confirm(`¿Está seguro de eliminar de forma permanente al usuario "${item.name}"?`)) {
                                  deleteUserMutation.mutate(item.id);
                                }
                              }}
                              disabled={deleteUserMutation.isPending}
                            >
                              <Trash2Icon className="size-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
