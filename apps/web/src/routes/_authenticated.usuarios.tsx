import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { Button } from "@mantainer-system/ui/components/button";
import { Input } from "@mantainer-system/ui/components/input";
import { Label } from "@mantainer-system/ui/components/label";
import { Skeleton } from "@mantainer-system/ui/components/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@mantainer-system/ui/components/dialog";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@mantainer-system/ui/components/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@mantainer-system/ui/components/table";
import { Badge } from "@mantainer-system/ui/components/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@mantainer-system/ui/components/select";
import { useForm } from "@tanstack/react-form";
import { UsersIcon, PlusIcon, Trash2Icon, AlertTriangleIcon, MailIcon, ShieldCheckIcon, LockIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";

export const Route = createFileRoute("/_authenticated/usuarios")({
  component: UsuariosComponent,
});

const userSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  role: z.enum(["admin", "supervisor", "mechanic"]),
});

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
  const { isAdmin, user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  // 1. Obtener la lista de usuarios usando react-query y el plugin adminClient
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

  // 2. Mutación para crear usuarios
  const createUserMutation = useMutation({
    mutationFn: async (values: z.infer<typeof userSchema>) => {
      const res = await authClient.admin.createUser({
        email: values.email,
        password: values.password,
        name: values.name,
        role: values.role,
      });
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

  // 3. Mutación para cambiar el rol de un usuario
  const changeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "admin" | "supervisor" | "mechanic" }) => {
      const res = await authClient.admin.setRole({
        userId,
        role,
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

  // 4. Mutación para eliminar un usuario
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

  // Formulario de creación de usuario
  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "mechanic" as "admin" | "supervisor" | "mechanic",
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

  if (!isAdmin) {
    return (
      <div className="text-center py-12 bg-slate-900/20 border border-slate-800 rounded-3xl p-6 max-w-xl mx-auto">
        <AlertTriangleIcon className="size-10 mx-auto text-rose-500 mb-2" />
        <p className="text-slate-200 text-base font-bold">Acceso Restringido</p>
        <p className="text-slate-400 text-xs mt-1">
          Solo los usuarios con el rol de Administrador cuentan con autorización para gestionar las cuentas de usuario y los roles del sistema.
        </p>
      </div>
    );
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20 font-bold">Administrador</Badge>;
      case "supervisor":
        return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 font-bold">Supervisor</Badge>;
      default:
        return <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 font-bold">Mecánico</Badge>;
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Cabecera de Página */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <UsersIcon className="size-6 text-indigo-400 animate-pulse" />
            Gestión de Usuarios y Roles
          </h2>
          <p className="text-sm text-slate-400">
            Control de cuentas del taller, asignación de roles jerárquicos y políticas de acceso
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/20">
              <PlusIcon className="size-4" />
              Registrar Usuario
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border border-slate-800 text-slate-100 p-6 rounded-2xl max-w-md shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <UsersIcon className="size-5 text-indigo-400" />
                Registrar Nuevo Usuario
              </DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                form.handleSubmit();
              }}
              className="space-y-4 mt-2"
            >
              {/* Nombre */}
              <form.Field name="name">
                {(field) => (
                  <div className="space-y-1.5">
                    <Label htmlFor={field.name} className="text-slate-300 text-xs">Nombre Completo</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Ej. Juan Pérez"
                      className="bg-slate-950/80 border-slate-800 focus:border-indigo-500 rounded-xl"
                    />
                    {field.state.meta.errors.map((error) => (
                      <p key={getErrorMessage(error)} className="text-xs text-rose-400 font-medium">
                        {getErrorMessage(error)}
                      </p>
                    ))}
                  </div>
                )}
              </form.Field>

              {/* Email */}
              <form.Field name="email">
                {(field) => (
                  <div className="space-y-1.5">
                    <Label htmlFor={field.name} className="text-slate-300 text-xs">Correo Electrónico</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="email"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Ej. juan@taller.com"
                      className="bg-slate-950/80 border-slate-800 focus:border-indigo-500 rounded-xl"
                    />
                    {field.state.meta.errors.map((error) => (
                      <p key={getErrorMessage(error)} className="text-xs text-rose-400 font-medium">
                        {getErrorMessage(error)}
                      </p>
                    ))}
                  </div>
                )}
              </form.Field>

              {/* Password */}
              <form.Field name="password">
                {(field) => (
                  <div className="space-y-1.5">
                    <Label htmlFor={field.name} className="text-slate-300 text-xs">Contraseña Inicial</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="password"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="••••••••"
                      className="bg-slate-950/80 border-slate-800 focus:border-indigo-500 rounded-xl"
                    />
                    {field.state.meta.errors.map((error) => (
                      <p key={getErrorMessage(error)} className="text-xs text-rose-400 font-medium">
                        {getErrorMessage(error)}
                      </p>
                    ))}
                  </div>
                )}
              </form.Field>

              {/* Rol */}
              <form.Field name="role">
                {(field) => (
                  <div className="space-y-1.5">
                    <Label className="text-slate-300 text-xs">Rol del Sistema</Label>
                    <Select
                      value={field.state.value}
                      onValueChange={(val) => field.handleChange(val as "admin" | "supervisor" | "mechanic")}
                    >
                      <SelectTrigger className="bg-slate-950/80 border-slate-800 focus:border-indigo-500 rounded-xl text-slate-300">
                        <SelectValue placeholder="Seleccione un rol" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-950 border border-slate-800 text-slate-100 rounded-xl">
                        <SelectItem value="mechanic">Mecánico (Lectura / Ejecución)</SelectItem>
                        <SelectItem value="supervisor">Supervisor (Planificación / Repuestos)</SelectItem>
                        <SelectItem value="admin">Administrador (Control Total)</SelectItem>
                      </SelectContent>
                    </Select>
                    {field.state.meta.errors.map((error) => (
                      <p key={getErrorMessage(error)} className="text-xs text-rose-400 font-medium">
                        {getErrorMessage(error)}
                      </p>
                    ))}
                  </div>
                )}
              </form.Field>

              <div className="flex gap-3 pt-3 border-t border-slate-800/80">
                <Button
                  type="submit"
                  disabled={createUserMutation.isPending}
                  className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold"
                >
                  {createUserMutation.isPending ? "Registrando..." : "Registrar"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  className="flex-1 rounded-xl border-slate-800 text-slate-300 hover:bg-slate-800"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabla de Usuarios */}
      <Card className="border-slate-800/80 bg-slate-900/40 backdrop-blur-md rounded-2xl shadow-xl overflow-hidden">
        <CardHeader className="border-b border-slate-800/60 pb-4">
          <CardTitle className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <ShieldCheckIcon className="size-5 text-indigo-400" />
            Personal Registrado y Niveles de Acceso
          </CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Lista completa de usuarios autenticados que tienen permitido el acceso al portal del taller
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-10 rounded-xl bg-slate-800/40" />
              <Skeleton className="h-44 rounded-xl bg-slate-800/45" />
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-950/40 border-b border-slate-850">
                <TableRow>
                  <TableHead className="font-semibold text-slate-300 text-xs px-6 py-4">Usuario</TableHead>
                  <TableHead className="font-semibold text-slate-300 text-xs px-6 py-4">Correo Electrónico</TableHead>
                  <TableHead className="font-semibold text-slate-300 text-xs px-6 py-4">Nivel de Acceso</TableHead>
                  <TableHead className="font-semibold text-slate-300 text-xs px-6 py-4">Cambiar Rol</TableHead>
                  <TableHead className="font-semibold text-slate-300 text-xs px-6 py-4 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((item) => {
                  const isSelf = item.id === user?.id;
                  const isAdminUser = item.role === "admin";
                  const isModifyDisabled = isSelf || isAdminUser || changeRoleMutation.isPending;

                  return (
                    <TableRow key={item.id} className="border-b border-slate-850 hover:bg-slate-900/20 transition-colors">
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-lg bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center font-bold text-indigo-400">
                            {item.name[0].toUpperCase()}
                          </div>
                          <span className="font-bold text-slate-200 text-xs">
                            {item.name}
                            {isSelf && (
                              <span className="text-indigo-400 font-normal text-[10px] ml-1.5 bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-900/30">
                                Tú
                              </span>
                            )}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-xs font-mono text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <MailIcon className="size-3.5 text-slate-500" />
                          {item.email}
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        {getRoleBadge(item.role)}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <Select
                          value={item.role}
                          onValueChange={(val) =>
                            changeRoleMutation.mutate({
                              userId: item.id,
                              role: val as "admin" | "supervisor" | "mechanic",
                            })
                          }
                          disabled={isModifyDisabled}
                        >
                          <SelectTrigger className="w-40 bg-slate-950/60 border-slate-800 rounded-lg text-[11px] h-8 text-slate-300 disabled:opacity-50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-950 border border-slate-800 text-slate-100 rounded-lg">
                            <SelectItem value="mechanic">Mecánico</SelectItem>
                            <SelectItem value="supervisor">Supervisor</SelectItem>
                            <SelectItem value="admin">Administrador</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-right">
                        {isSelf || isAdminUser ? (
                          <div className="flex justify-end pr-2 text-slate-500" title="Protegido contra cambios/eliminación">
                            <LockIcon className="size-4 text-slate-600" />
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-lg text-rose-400 hover:text-rose-200 hover:bg-rose-950/30 border border-transparent hover:border-rose-900/30 transition-all duration-200 size-8"
                            onClick={() => {
                              if (confirm(`¿Está seguro de eliminar de forma permanente al usuario "${item.name}"?`)) {
                                deleteUserMutation.mutate(item.id);
                              }
                            }}
                            disabled={deleteUserMutation.isPending}
                          >
                            <Trash2Icon className="size-4" />
                          </Button>
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
