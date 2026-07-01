# Fase 1: Corrección de Bugs Críticos y UI

**Fecha:** 2026-07-01
**Estado:** Aprobado

## Contexto

`mantainer-system` es un panel administrativo de mantenimiento de maquinaria. El backend
de negocio real es `apps/backend` (Python/FastAPI, arquitectura hexagonal con HexCore,
SQLAlchemy async, Postgres). `apps/server` (Node/Hono) es solo un proxy/bootstrap para
Better-Auth y no contiene lógica de negocio. El frontend `apps/web` usa TanStack Start,
`@tanstack/react-form`, zod y componentes shadcn/ui de `packages/ui`.

`apps/backend` y el servidor de Better-Auth comparten la **misma base de datos Postgres**
(`sgmm_auth_db`, confirmado en `docker-compose.api.yml` y `docker-compose.auth.yml`), lo
que permite a Python leer la tabla `user` de Better-Auth vía SQL directo sin necesidad de
llamadas HTTP entre servicios.

Este documento cubre únicamente la **Fase 1** (bugs críticos y ajustes de UI) del pedido
original. Las Fases 2 y 3 (actualización de esquema/CRUD y nuevos flujos de negocio como
SOLPED) se diseñarán como sub-proyectos independientes en specs separados.

## Alcance

1. Auditoría forense: fecha inválida y "Realizado por" mostrando ID.
2. Selector de mecánico en "Programar Orden de Trabajo".
3. Validación de usuarios (contraseña y nombre).

Fuera de alcance: el selector de "Asociar Maquinaria" en el mismo modal ya renderiza
`{code} ({brand} {model})` correctamente (verificado en código); el usuario confirmó que
el bug reportado en realidad correspondía al campo de mecánico.

## Diseño

### 1. Auditoría forense

**Causa raíz:**
- El backend devuelve el campo `created_at` (`audit/application/dtos.py`), pero el
  frontend lee `log.timestamp` (`audit-log-table.tsx:56`), que es `undefined` →
  `new Date(undefined)` → "Invalid Date".
- `performed_by` almacena el ID de usuario de Better-Auth como string plano
  (`audit/domain/entities.py:12`), sin ningún join a nombre de usuario.

**Fix:**
- Frontend: corregir el tipo `AuditLogResponse` y el render para usar `created_at` en
  vez de `timestamp`.
- Backend: en el router de audit-logs (`audit/infrastructure/routes.py`), tras obtener
  la página de resultados, recolectar los `performed_by` únicos y resolverlos con una
  consulta SQL de solo lectura contra la tabla `user` de Better-Auth (mismo Postgres),
  agregando `performed_by_name` a la respuesta. No se modifica el modelo `audit_logs`
  ni su inmutabilidad (no se toca el flujo de escritura de logs).
- Si un `performed_by` no se encuentra en `user` (usuario eliminado), `performed_by_name`
  cae a `null` y el frontend muestra el ID crudo como fallback.

### 2. Selector de mecánico en "Programar Orden de Trabajo"

**Causa raíz:**
- El campo "Código de Técnico" es un `<Input>` de texto libre con valor por defecto
  hardcodeado `"MEC-01"` (`mantenimiento.index.tsx:162-181`).
- El backend espera `assigned_mechanic_id: UUID` y hace `get_by_id()` contra
  `user_metadata` (`maintenance/domain/services.py:35`). Un string como `"MEC-01"`
  nunca es un UUID válido, por lo que el guardado falla — este es el bug de "no
  guarda a pesar de tener mecánico y máquina válidos".

**Fix:**
- Backend: nuevo endpoint `GET /api/user-metadata/mechanics` que lista usuarios con
  `role = MECANICO`, uniendo `user_metadata` (rol, id) con la tabla `user` de
  Better-Auth (nombre) vía la misma consulta de solo lectura del punto 1. Restringido
  a ADMIN/SUPERVISOR (mismo criterio que el resto de endpoints de creación de OT).
- Frontend: reemplazar el `<Input>` por un `<Select>` (mismo patrón visual que el
  selector de maquinaria), `value` = UUID del mecánico, label = nombre. Se elimina el
  valor por defecto hardcodeado.
- El campo "Descripción del Servicio / Falla" pasa de `<Input>` a `<Textarea rows={4}>`.
- Se elimina el mensaje de validación zod "Ingrese el ID del mecánico asignado" (ya no
  aplica al ser un selector).

### 3. Validación de usuarios

**Contraseña:**
- Frontend exige `min(6)` (`usuarios.tsx`); Better-Auth ya exige 8 por defecto
  (`minPasswordLength` default confirmado en la documentación oficial). Fix: subir el
  zod del frontend a `min(8)` y fijar `minPasswordLength: 8` explícitamente en
  `packages/auth/src/index.ts` (`emailAndPassword`) para no depender del default
  implícito.

**Nombre:**
- Sin regex actualmente en ningún lado. Fix: agregar regex tanto en frontend (zod)
  como en backend.
- Patrón permitido: letras (incluyendo tildes y ñ para nombres en español), espacios,
  apóstrofes y guiones. Se bloquea `@`, dígitos y cualquier otro símbolo.
  Regex: `/^[a-zA-ZáéíóúÁÉÍÓÚñÑ' -]+$/`
- Backend: como la creación de usuarios se hace vía `authClient.admin.createUser`
  directo contra Better-Auth (no hay endpoint propio en `apps/backend` para esto), la
  validación server-side se agrega extendiendo el `hooks.before` ya existente en
  `packages/auth/src/index.ts` para interceptar `ctx.path === "/admin/create-user"` y
  rechazar con `APIError("BAD_REQUEST", ...)` si el nombre no matchea el patrón.

## Testing

- Bug de guardado de OT y selector de mecánico: verificación manual end-to-end en el
  navegador (crear una OT completa con mecánico real).
- Auditoría (fecha + nombre resuelto): verificación manual en la tabla de auditoría
  tras generar una acción auditable.
- Validaciones de usuario (password/nombre): agregar tests en
  `apps/backend/tests/` siguiendo el patrón existente de `test_business_rules.py`
  donde aplique (validación de nombre en el hook), y verificación manual del flujo de
  registro para el resto.

## Fuera de alcance (Fase 1)

- Cambios de esquema en maquinaria, repuestos, roles admin (Fase 2).
- Nuevos módulos de negocio: OT expandida, SOLPED, historial de consumo, reportes
  Pareto (Fase 3).
