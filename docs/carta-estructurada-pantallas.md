# Carta Estructurada — Descripción por Pantalla

## 1. Login (`/login`)

| Elemento | Descripción |
|---|---|
| **Propósito** | Autenticar al usuario mediante Better Auth (email/contraseña) |
| **Componentes** | `SignInForm`, `SignUpForm`, selector de modo (inicio/registro) |
| **Flujo** | 1. Ingresar credenciales → 2. `authClient.signIn()` → 3. Redirección a `/dashboard` |
| **Estados** | Cargando (spinner), error (toast), formulario vacío |
| **Validaciones** | Email formato, contraseña >= 8 caracteres |

---

## 2. Dashboard (`/dashboard`)

| Elemento | Descripción |
|---|---|
| **Propósito** | Panel principal con métricas resumidas del taller |
| **Estructura** | Encabezado con saludo → Grid de tarjetas métricas → Grid de módulos |
| **Métricas** | Total máquinas, órdenes pendientes, en ejecución, repuestos con stock bajo |
| **Módulos** | Tarjetas de acceso directo a Maquinaria, Mantenimiento, Reportes |
| **Datos** | `useMachines()`, `useOrders()`, `useSpareParts()`, `useAuth()` |
| **RBAC** | Reportes visibles solo para Admin/Supervisor |

---

## 3. Maquinaria — Listado (`/maquinaria`)

| Elemento | Descripción |
|---|---|
| **Propósito** | Catálogo de todas las máquinas registradas |
| **Estructura** | Header → Barra de búsqueda + filtro por estado → Grid de `MachineCard` |
| **Filtros** | Búsqueda por texto, filtro por estado (ACTIVA / EN_MANTENIMIENTO / FUERA_DE_SERVICIO / TODAS) |
| **Acciones** | Botón "Registrar Maquinaria" (Admin/Supervisor), clic en tarjeta para detalle |
| **Estados** | Cargando (skeleton grid), vacío (mensaje sin datos), error |
| **Datos** | `useMachines({status, search})` |

---

## 4. Maquinaria — Registrar (`/maquinaria/nueva`)

| Elemento | Descripción |
|---|---|
| **Propósito** | Formulario para registrar una nueva máquina |
| **Estructura** | Header → `MachineForm` (formulario completo) |
| **Campos** | Código, serie motor, marca, modelo, año fabricación, horómetro inicial, área de trabajo |
| **Validaciones** | Código único, serie motor única, año >= 1900 |
| **RBAC** | Solo Admin/Supervisor |
| **Post-guardado** | Redirección a ficha de la máquina creada |

---

## 5. Maquinaria — Ficha (`/maquinaria/$id`)

| Elemento | Descripción |
|---|---|
| **Propósito** | Visualización detallada y control de una máquina específica |
| **Estructura** | Header con código y badge de estado → Tabs (Ficha | Historial) |
| **Tab: Ficha** | Especificaciones técnicas, actualización de horómetro, cambio de estado (Admin/Supervisor) |
| **Tab: Historial** | `TechnicalHistoryTimeline` con órdenes de mantenimiento asociadas |
| **Datos** | `useMachine(id)`, `useOrders()`, `useUpdateHorometer()`, `useChangeMachineStatus()` |
| **Estados** | Cargando (skeleton), no encontrado (mensaje 404), error |

---

## 6. Mantenimiento — Kanban (`/mantenimiento`)

| Elemento | Descripción |
|---|---|
| **Propósito** | Gestión visual de órdenes de trabajo mediante tablero Kanban |
| **Estructura** | Header → Botón "Programar OT" (Admin/Supervisor) → `KanbanBoard` |
| **Columnas Kanban** | PROGRAMADO → EN_EJECUCION → COMPLETADO |
| **Modal creación** | Diálogo con formulario: máquina (solo activas), descripción, mecánico asignado |
| **Datos** | `useOrders()`, `useMachines({status: "ACTIVA"})`, `useCreateOrder()` |
| **Estados** | Cargando (skeleton), vacío (sin órdenes), error |

---

## 7. Mantenimiento — Ejecución (`/mantenimiento/$id`)

| Elemento | Descripción |
|---|---|
| **Propósito** | Panel de ejecución de una orden de mantenimiento |
| **Estructura** | Header → `ExecutionPanel` con detalle de la orden |
| **Acciones** | Iniciar ejecución, registrar horas, agregar repuestos usados, liquidar orden, actualizar horómetro |
| **Datos** | `useOrderDetail(id)` |
| **Estados** | Cargando (skeleton), no encontrado (404), error |

---

## 8. Repuestos (`/repuestos`)

| Elemento | Descripción |
|---|---|
| **Propósito** | Gestión del inventario de repuestos |
| **Estructura** | Header → Buscador → `SparePartsTable` |
| **Acciones** | Registrar repuesto (Admin/Supervisor) mediante diálogo con formulario |
| **Campos formulario** | Código, nombre, categoría, stock actual, stock mínimo, costo unitario |
| **Datos** | `useSpareParts(search)`, `useCreateSparePart()` |
| **RBAC** | Solo Admin/Supervisor puede crear/editar |
| **Estados** | Cargando, vacío, error |

---

## 9. Reportes (`/reportes`)

| Elemento | Descripción |
|---|---|
| **Propósito** | Reportes de costos de mantenimiento |
| **Estructura** | Header → `CostReportPanel` con gráficos y tablas |
| **Métricas** | Costo total de mano de obra, costo total de repuestos, cantidad de órdenes por período |
| **Datos** | `useCostReport()` |
| **RBAC** | Solo Admin/Supervisor (redirección si no autorizado) |
| **Estados** | Cargando, sin datos, error |

---

## 10. Auditoría (`/auditoria`)

| Elemento | Descripción |
|---|---|
| **Propósito** | Bitácora forense de todas las operaciones del sistema |
| **Estructura** | Header → Filtros (entidad, acción) → `AuditLogTable` |
| **Filtros** | Selector de nombre de entidad, selector de tipo de acción |
| **Columnas tabla** | Fecha, entidad, ID de entidad, acción, payload, usuario |
| **Datos** | `useAuditLogs({entity_name, action})` |
| **RBAC** | Solo Admin |
| **Estados** | Cargando, vacío (sin registros), error |
