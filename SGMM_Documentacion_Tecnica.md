# Sistema de Gestión de Mantenimiento de Maquinaria (SGMM)
## Documentación Técnica Exhaustiva — Versión 2.0

> **Audiencia:** Desarrolladores Junior, Evaluadores Universitarios, Equipo de Transferencia de Conocimiento
> **Backend:** HexCore v2.0 sobre FastAPI + Python
> **Base de Datos:** PostgreSQL (gestionada con SQLAlchemy y Drizzle ORM)
> **Autenticación:** Better Auth con JWT (RS256)

---

## Índice

1. [Arquitectura General del Sistema](#1-arquitectura-general-del-sistema)
2. [Modelo y Estructura de la Base de Datos](#2-modelo-y-estructura-de-la-base-de-datos)
3. [Explicación de Módulos Core y Lógica de Negocio](#3-explicación-de-módulos-core-y-lógica-de-negocio)
4. [Guía de Conexión y Consultas en pgAdmin](#4-guía-de-conexión-y-consultas-en-pgadmin)

---

## 1. Arquitectura General del Sistema

### 1.1 Patrón de Arquitectura: Hexagonal + Domain-Driven Design (DDD) con Slices Verticales

El SGMM adopta la **Arquitectura Hexagonal** (también llamada Ports & Adapters), enriquecida con principios de **Diseño Orientado al Dominio (DDD)**. Esta es la decisión de diseño más importante del sistema, y todo el código del backend la refleja directamente.

#### ¿Qué es la Arquitectura Hexagonal?

Imagina el sistema como un hexágono con tres capas concéntricas:

```
┌──────────────────────────────────────────────────────┐
│                  INFRAESTRUCTURA                     │
│  (FastAPI routes, SQLAlchemy models, PostgreSQL)     │
│  ┌────────────────────────────────────────────┐      │
│  │              APLICACIÓN                    │      │
│  │    (Use Cases, DTOs, Commands)             │      │
│  │  ┌──────────────────────────────────┐      │      │
│  │  │           DOMINIO                │      │      │
│  │  │  (Entities, Services, Rules)     │      │      │
│  │  └──────────────────────────────────┘      │      │
│  └────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────┘
```

- **Dominio (núcleo):** La lógica de negocio pura. No sabe nada de bases de datos ni HTTP.
- **Aplicación:** Orquesta los casos de uso. Traduce peticiones de la API a operaciones del dominio.
- **Infraestructura (borde externo):** Todo lo técnico: rutas HTTP, modelos ORM, repositorios de base de datos.

La **regla de oro** es: las capas internas nunca importan las externas. El dominio jamás importa SQLAlchemy.

#### Organización de Carpetas (Slices Verticales)

El código se organiza por **funcionalidad de negocio** — esto se llama Vertical Slicing:

```
apps/backend/src/
├── main.py                    ← Punto de entrada de FastAPI; registra routers
├── features/                  ← Cada subdirectorio es una "rebanada vertical"
│   ├── machine/               ← Todo lo relacionado con Maquinaria
│   │   ├── domain/            ← Entidades, Servicios de Dominio, Excepciones
│   │   │   ├── entities.py
│   │   │   ├── services.py
│   │   │   └── exceptions.py
│   │   ├── application/       ← Casos de Uso y DTOs
│   │   │   ├── dtos.py
│   │   │   └── use_cases/
│   │   └── infrastructure/    ← Rutas HTTP, Modelos ORM, Repositorios
│   │       ├── routes.py
│   │       ├── models.py
│   │       └── repositories.py
│   ├── maintenance/           ← Órdenes de Trabajo
│   ├── inventory/             ← Repuestos e Inventario
│   ├── audit/                 ← Bitácora Forense
│   ├── user/                  ← Metadata de Usuarios y Roles
│   ├── alerts/                ← Sistema de Alertas
│   └── reports/               ← Módulo de Reportes
├── shared/
│   └── infrastructure/database/
│       ├── db.py              ← Fábrica de sesiones async de SQLAlchemy
│       └── user_lookup.py     ← Helper para resolver nombres de usuario
└── alembic/                   ← Migraciones de base de datos (Python)
```

Y en el lado TypeScript (servidor de autenticación):

```
packages/
├── db/src/schema/
│   └── auth.ts                ← Esquema Drizzle: user, session, account, jwks
├── auth/                      ← Configuración de Better Auth
└── api/                       ← Endpoints tRPC

apps/
├── server/                    ← Servidor de autenticación (Hono + Node.js, puerto 3000)
│   └── src/index.ts
└── web/                       ← Frontend React/TanStack Router
    └── src/
        ├── features/          ← Componentes por funcionalidad
        └── routes/            ← Rutas del SPA
```

---

### 1.2 Framework HexCore: Ciclo de Vida de una Petición

HexCore es el framework propietario construido sobre FastAPI. Su aporte principal es proveer las clases base que cada "feature" hereda.

#### Clases Base Principales de HexCore

| Clase Base HexCore | Propósito | Quién la hereda |
|---|---|---|
| `BaseEntity` | Entidad de dominio con `id: UUID`, `is_active: bool`, `created_at`, `updated_at` | `Machine`, `MaintenanceOrder`, `SparePart` |
| `BaseDomainService` | Servicio de dominio que opera sobre entidades | `MachineDomainService`, `MaintenanceDomainService` |
| `UseCase[TCommand, TResponse]` | Caso de uso tipado: recibe un comando, retorna una respuesta | `CreateMachineUseCase`, `LiquidateMaintenanceUseCase` |
| `BaseModel` (ORM) | Modelo SQLAlchemy con UUID como PK y timestamps automáticos | `MachineModel`, `MaintenanceOrderModel` |
| `SQLAlchemyCommonImplementationsRepo` | Repositorio genérico con CRUD implementado por HexCore | `MachineRepository`, `AuditLogRepository` |
| `SqlAlchemyUnitOfWork` | Unidad de Trabajo que envuelve la sesión DB en una transacción | Inyectado en todas las rutas y casos de uso |

#### Ciclo de Vida Completo de una Petición HTTP

Flujo exacto para `POST /api/machines/` (crear una máquina):

```
CLIENTE → POST /api/machines/ + Bearer JWT
    ↓
[1] FastAPI + Middleware CORS (main.py)
    - Valida origen, enruta a machines_router
    ↓
[2] Route Handler: create_machine() en routes.py
    - Depends(get_uow): inyecta la sesión DB
    - Depends(require_roles([ADMIN, SUPERVISOR])): verifica JWT
      → jwt_helper.py decodifica el token (RS256 via JWKS)
      → Extrae rol del claim "role"
      → Si rol no permitido: HTTP 403 Forbidden
    ↓
[3] Use Case: CreateMachineUseCase.execute(command)
    - async with self.uow: (abre transacción)
    - Delega al Domain Service
    - Registra AuditLog en la misma transacción
    - await self.uow.commit()
    ↓
[4] Domain Service: MachineDomainService.create_machine()
    - Instancia Machine(code=..., status=ACTIVA, ...)
    - await self._repo.save(machine)
    ↓
[5] Repository + ORM (SQLAlchemy)
    - HexCore mapea Machine → MachineModel
    - Genera: INSERT INTO machines VALUES (...)
    - INSERT INTO audit_logs VALUES (...)
    ↓
[6] PostgreSQL: COMMIT de la transacción
    ↓
[7] Respuesta: HTTP 201 Created + MachineResponse JSON
```

---

### 1.3 Flujo de Datos Completo: Del Frontend a la Base de Datos

El sistema tiene **tres servicios** que colaboran:

```
[NAVEGADOR] ──HTTPS──► [FRONTEND React SPA]  apps/web/
                               │
                               ▼
              [SERVIDOR AUTH Hono/Node.js]  apps/server/ :3000
              - Login, sesiones, JWT
              - /api/auth/* (Better Auth)
              - /trpc/* (tRPC)
              - /create-admin
                               │ JWT Bearer Token
                               ▼
              [BACKEND API FastAPI/Python]  apps/backend/ :8000
              - Rutas de negocio /api/*
              - Valida JWT via JWKS (RS256)
              - Aplica RBAC por roles
                               │ SQL async (asyncpg)
                               ▼
              [PostgreSQL]  Base de datos compartida
              - machines, maintenance_orders, spare_parts
              - user, session, account (Better Auth)
              - audit_logs, user_metadata (HexCore)
```

> **Punto clave:** El backend Python y el servidor auth TypeScript **comparten la misma base de datos PostgreSQL**. Esto permite que el backend lea directamente la tabla `user` para resolver nombres, sin llamadas HTTP entre servicios.

---

## 2. Modelo y Estructura de la Base de Datos

### 2.1 Diagrama Entidad-Relación General

```
┌──────────┐       ┌──────────────────────┐       ┌───────────────────┐
│   user    │       │    user_metadata      │       │     machines       │
│(BetterAuth│       │   (HexCore/Python)   │       │  (HexCore/Python) │
├──────────┤       ├──────────────────────┤       ├───────────────────┤
│id (PK,txt)│◄──────│better_auth_user_id   │       │id (PK, UUID)      │
│name       │       │role                  │       │code (UNIQUE)      │
│email      │       │hourly_rate           │       │motor_serial       │
│role       │       │id (PK, UUID)         │       │brand / model      │
│banned     │       └──────────┬───────────┘       │status             │
└──────────┘                  │                   │current_horometer  │
                              │ assigned_mechanic_id │is_active         │
                              │                   └─────────┬─────────┘
                              │                             │ machine_id
             ┌────────────────▼─────────────────────────────▼──────────┐
             │                maintenance_orders                        │
             ├────────────────────────────────────────────────────────┤
             │ id (PK, UUID)  │  machine_id (FK)                       │
             │ description    │  assigned_mechanic_id (FK)             │
             │ status         │  next_service_horometer                │
             └────────────────────────┬───────────────────────────────┘
                                      │ maintenance_order_id
             ┌────────────────────────▼───────────────────────────────┐
             │             maintenance_spare_parts                     │
             ├───────────────────────────────────────────────────────┤
             │ id  │  maintenance_order_id (FK)  │  spare_part_id (FK)│
             │ quantity_requested  │  unit_cost_at_time (snapshot)     │
             └───────────────────────────────────────────────────────┘

┌──────────────────────────┐     ┌──────────────────────────────┐
│       spare_parts         │     │         audit_logs            │
├──────────────────────────┤     ├──────────────────────────────┤
│id (PK, UUID)             │     │id (PK, UUID)                 │
│code (UNIQUE)             │     │entity_name                   │
│name                      │     │entity_id                     │
│stock_current             │     │action                        │
│stock_minimum             │     │payload (JSON Text)           │
│unit_cost                 │     │performed_by (Better Auth id) │
│part_number               │     │created_at  │  is_active      │
│unit_of_measure           │     └──────────────────────────────┘
│internal_code             │
│unit_cost_usd             │
└──────────────────────────┘
```

---

### 2.2 Diccionario de Datos

#### Tabla: `user` — Gestionada por Better Auth / Drizzle

Fuente de verdad de identidad. El backend Python la lee en **solo lectura**.

| Campo | Tipo | Restricción | Descripción |
|---|---|---|---|
| `id` | `TEXT` | `PRIMARY KEY` | ID generado por Better Auth (string, no UUID) |
| `name` | `TEXT` | `NOT NULL` | Nombre completo |
| `email` | `TEXT` | `NOT NULL, UNIQUE` | Correo electrónico (login) |
| `email_verified` | `BOOLEAN` | `DEFAULT false` | Verificación de email |
| `image` | `TEXT` | nullable | URL del avatar |
| `role` | `TEXT` | nullable | **Rol de negocio** (`admin`, `supervisor`, `mechanic`) — viaja en el JWT |
| `banned` | `BOOLEAN` | `DEFAULT false` | Usuario baneado del sistema |
| `ban_reason` | `TEXT` | nullable | Razón del baneo |
| `ban_expires` | `TIMESTAMP` | nullable | Expiración del baneo |
| `created_at` | `TIMESTAMP` | `NOT NULL` | Fecha de registro |
| `updated_at` | `TIMESTAMP` | `NOT NULL` | Última modificación |

#### Tabla: `session` — Gestionada por Better Auth / Drizzle

| Campo | Tipo | Restricción | Descripción |
|---|---|---|---|
| `id` | `TEXT` | `PRIMARY KEY` | ID único de la sesión |
| `expires_at` | `TIMESTAMP` | `NOT NULL` | Expiración de la sesión |
| `token` | `TEXT` | `NOT NULL, UNIQUE` | Token de sesión |
| `ip_address` | `TEXT` | nullable | IP del cliente |
| `user_agent` | `TEXT` | nullable | Navegador/SO del cliente |
| `user_id` | `TEXT` | `NOT NULL, FK → user.id CASCADE` | Propietario de la sesión |

#### Tabla: `user_metadata` — Gestionada por HexCore/Python

Extiende el perfil del usuario con datos de negocio (tarifa horaria, rol en español).

| Campo | Tipo | Restricción | Descripción |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY` | Identificador interno de HexCore |
| `better_auth_user_id` | `VARCHAR(255)` | `NOT NULL, UNIQUE, INDEX` | FK lógica al `id` de la tabla `user` |
| `role` | `VARCHAR(50)` | `NOT NULL` | Rol en español: `Administrador`, `Supervisor`, `Mecánico` |
| `hourly_rate` | `FLOAT` | `NOT NULL, DEFAULT 0.0` | Tarifa horaria del mecánico |
| `is_active` | `BOOLEAN` | `NOT NULL` | Borrado lógico de HexCore |
| `created_at` | `TIMESTAMP` | `NOT NULL` | Fecha de creación |
| `updated_at` | `TIMESTAMP` | `NOT NULL` | Última modificación |

#### Tabla: `machines` — Maquinaria

| Campo | Tipo | Restricción | Descripción |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY` | Identificador único |
| `code` | `VARCHAR(50)` | `NOT NULL, UNIQUE, INDEX` | Código alfanumérico (ej. `CAT-320-01`) |
| `motor_serial` | `VARCHAR(100)` | `NOT NULL, UNIQUE, INDEX` | Número de serie del motor. No puede contener `@` (validado en DTO) |
| `brand` | `VARCHAR(100)` | `NOT NULL` | Fabricante (Caterpillar, Komatsu...) |
| `model` | `VARCHAR(100)` | `NOT NULL` | Modelo específico |
| `manufacture_year` | `INTEGER` | `NOT NULL` | Año de fabricación |
| `current_horometer` | `FLOAT` | `NOT NULL, DEFAULT 0.0` | Lectura actual del horómetro. Solo puede incrementar |
| `status` | `VARCHAR(50)` | `NOT NULL, DEFAULT 'ACTIVA'` | `ACTIVA`, `EN_MANTENIMIENTO`, `FUERA_DE_SERVICIO`, `DADA_DE_BAJA` |
| `horometer_unit` | `VARCHAR(20)` | `NOT NULL, DEFAULT 'Horas'` | Unidad: `Horas`, `Kilómetros`, `Millas` |
| `description` | `TEXT` | nullable | Descripción libre |
| `location` | `VARCHAR(255)` | nullable | Ubicación física |
| `is_active` | `BOOLEAN` | `NOT NULL` | **Borrado lógico**: `false` = máquina eliminada |
| `created_at` | `TIMESTAMP` | `NOT NULL` | Fecha de registro |
| `updated_at` | `TIMESTAMP` | `NOT NULL` | Última modificación |

#### Tabla: `spare_parts` — Repuestos

| Campo | Tipo | Restricción | Descripción |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY` | Identificador único |
| `code` | `VARCHAR(50)` | `NOT NULL, UNIQUE, INDEX` | Código del repuesto |
| `name` | `VARCHAR(100)` | `NOT NULL` | Descripción del repuesto |
| `stock_current` | `INTEGER` | `NOT NULL, DEFAULT 0` | Cantidad actual en almacén |
| `stock_minimum` | `INTEGER` | `NOT NULL, DEFAULT 0` | Stock mínimo de alerta |
| `unit_cost` | `FLOAT` | `NOT NULL` | Costo unitario en moneda local |
| `part_number` | `VARCHAR(100)` | nullable, `INDEX` | Número de parte del fabricante |
| `unit_of_measure` | `VARCHAR(50)` | nullable | Unidad (piezas, litros, metros) |
| `internal_code` | `VARCHAR(100)` | nullable, `UNIQUE, INDEX` | Código interno de almacén |
| `unit_cost_usd` | `FLOAT` | nullable | Precio de referencia en USD |
| `is_active` | `BOOLEAN` | `NOT NULL` | Borrado lógico |
| `created_at` | `TIMESTAMP` | `NOT NULL` | Fecha de creación |
| `updated_at` | `TIMESTAMP` | `NOT NULL` | Última modificación |

#### Tabla: `maintenance_orders` — Órdenes de Trabajo

| Campo | Tipo | Restricción | Descripción |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY` | Identificador único de la OT |
| `machine_id` | `UUID` | `NOT NULL, FK → machines.id` | Máquina a mantener |
| `description` | `VARCHAR(255)` | `NOT NULL` | Descripción del trabajo |
| `status` | `VARCHAR(50)` | `NOT NULL, DEFAULT 'PROGRAMADO'` | `PROGRAMADO`, `EN_EJECUCION`, `LIQUIDADO` |
| `assigned_mechanic_id` | `UUID` | `NOT NULL, FK → user_metadata.id` | Mecánico asignado |
| `next_service_horometer` | `FLOAT` | nullable | Próximo servicio calculado al liquidar |
| `is_active` | `BOOLEAN` | `NOT NULL` | Borrado lógico |
| `created_at` | `TIMESTAMP` | `NOT NULL` | Fecha de programación |
| `updated_at` | `TIMESTAMP` | `NOT NULL` | Última modificación |

#### Tabla: `maintenance_spare_parts` — Repuestos por OT

Tabla de unión Many-to-Many entre OTs y Repuestos. Contiene el **precio histórico** del repuesto al momento de la liquidación.

| Campo | Tipo | Restricción | Descripción |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY` | Identificador único |
| `maintenance_order_id` | `UUID` | `NOT NULL, FK → maintenance_orders.id CASCADE` | OT propietaria |
| `spare_part_id` | `UUID` | `NOT NULL, FK → spare_parts.id RESTRICT` | Repuesto utilizado |
| `quantity_requested` | `INTEGER` | `NOT NULL, DEFAULT 1` | Cantidad solicitada |
| `unit_cost_at_time` | `FLOAT` | nullable | **Snapshot del precio** al momento de liquidación. `null` hasta que se liquide la OT |

#### Tabla: `audit_logs` — Bitácora Forense

Registro **inmutable** de operaciones críticas. No permite `UPDATE` ni `DELETE` (reforzado por SQLAlchemy Event Listeners).

| Campo | Tipo | Restricción | Descripción |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY` | Identificador único |
| `entity_name` | `VARCHAR(100)` | `NOT NULL` | Entidad afectada: `Machine`, `MaintenanceOrder`, `SparePart`, `MaintenanceSparePart` |
| `entity_id` | `UUID` | `NOT NULL` | ID del registro específico afectado |
| `action` | `VARCHAR(50)` | `NOT NULL` | Acción: `CREATE`, `SOFT_DELETE`, `START_EXECUTION`, `LIQUIDATE`, `ADD_SPARE_PART` |
| `payload` | `TEXT` | `NOT NULL` | JSON serializado con el estado de la entidad al momento de la acción |
| `performed_by` | `VARCHAR(255)` | `NOT NULL` | ID del usuario de Better Auth que ejecutó la acción |
| `is_active` | `BOOLEAN` | `NOT NULL` | Siempre `true` (nunca se borra) |
| `created_at` | `TIMESTAMP` | `NOT NULL` | Timestamp exacto (generado automáticamente) |

#### Tablas Auxiliares de Better Auth

| Tabla | Propósito |
|---|---|
| `account` | Vincula un `user` con un proveedor OAuth (credenciales email/pass, Google, etc.) |
| `verification` | Tokens temporales para verificación de email o reset de contraseña |
| `jwks` | Par de claves RSA pública/privada para firmar y verificar los JWT (plugin JWT) |

---

### 2.3 Relaciones Detalladas entre Tablas

#### Máquina ↔ Orden de Trabajo (1:N)

```
machines (1) ─────── (*) maintenance_orders
              machine_id FK
```

Al crear una OT, el sistema valida la existencia de la máquina. Al iniciar la OT, la máquina pasa a `EN_MANTENIMIENTO`. Al liquidar, la máquina regresa a `ACTIVA`. Todo dentro de la misma transacción ACID.

#### Mecánico ↔ Orden de Trabajo (1:N)

```
user_metadata (1) ─────── (*) maintenance_orders
              assigned_mechanic_id FK
```

La relación es con `user_metadata` (no con `user`). Better Auth gestiona identidad; `user_metadata` gestiona el negocio (tarifa horaria, rol). Para mostrar el **nombre** del mecánico en la respuesta, el backend ejecuta `resolve_user_names()` que hace un `SELECT` a la tabla `user` de Better Auth.

#### Orden de Trabajo ↔ Repuestos (N:M a través de `maintenance_spare_parts`)

```
maintenance_orders (1) ── (*) maintenance_spare_parts (*) ── (1) spare_parts
```

`maintenance_spare_parts` es la tabla pivot. Almacena `unit_cost_at_time` (precio histórico snapshot) para garantizar que los reportes de costos no cambien aunque el precio del repuesto cambie en el futuro.

---

### 2.4 Borrado Lógico (Soft Delete)

El borrado lógico evita eliminar físicamente los registros. En su lugar, `is_active` se marca como `false`.

#### ¿Por qué es necesario?

- Si se borra físicamente una máquina, las OTs quedarían con FK inválidas.
- El administrador puede auditar el histórico de máquinas que ya no existen.
- Se evita romper la integridad referencial de la base de datos.

#### Implementación en el Dominio

```python
# machine/domain/entities.py
def soft_delete(self) -> None:
    """Aplica la baja lógica."""
    self.is_active = False
```

Y en el caso de uso, dentro de la misma transacción, se registra la auditoría:

```python
# machine/application/use_cases/soft_delete.py
async def execute(self, command):
    async with self.uow:
        machine = await self.service.soft_delete(machine_id=command.machine_id)
        audit_log = AuditLog(
            entity_name="Machine", entity_id=machine.id,
            action="SOFT_DELETE",
            payload={"is_active": machine.is_active},
            performed_by=command.performed_by
        )
        await audit_repo.save(audit_log)
        await self.uow.commit()
```

#### Control de Visibilidad por Rol

```python
# machine/infrastructure/routes.py
# Solo el Administrador puede ver máquinas dadas de baja
if current_user.role != UserRole.ADMINISTRADOR:
    filters.append(FilterConditionDTO(
        field="is_active", operator=FilterOperator.EQ, value=True
    ))
```

| Rol | Máquinas activas | Máquinas con `is_active=False` |
|---|:---:|:---:|
| `Administrador` | ✅ | ✅ |
| `Supervisor` | ✅ | ❌ |
| `Mecánico` | ✅ | ❌ |

---

## 3. Explicación de Módulos Core y Lógica de Negocio

### 3.1 Órdenes de Trabajo (OT): Ciclo de Vida y Cálculo de Costos

#### Máquina de Estados Finita

Una OT solo puede transitar estados en este orden estricto:

```
PROGRAMADO ──── start_execution() ──►  EN_EJECUCION ──── liquidate() ──► LIQUIDADO
    │                                       │
    └── Solo Admins/Supervisores crean      └── Se agregan repuestos (add_spare_part)
        OTs en este estado
```

Cualquier transición inválida lanza `InvalidMaintenanceTransitionException`.

#### Paso 1: Creación de OT (`POST /api/maintenance/`)

`CreateMaintenanceUseCase` → `MaintenanceDomainService.create_order()`:

**Validaciones de dominio antes de persistir:**
1. La máquina debe existir en el repositorio.
2. El usuario asignado debe tener rol `MECANICO`:
   ```python
   if mechanic.role != UserRole.MECANICO:
       raise ValueError("El usuario asignado debe tener el rol de Mecánico.")
   ```

#### Paso 2: Inicio de Ejecución (`POST /api/maintenance/{id}/start`)

`StartMaintenanceUseCase` → `MaintenanceDomainService.start_execution()`:

**Operaciones atómicas en la misma transacción:**
1. OT: `status` = `PROGRAMADO` → `EN_EJECUCION`
2. Máquina vinculada: `status` → `EN_MANTENIMIENTO`

#### Paso 3: Registro de Repuestos (`POST /api/maintenance/{id}/spare-parts`)

`AddSparePartToOrderUseCase` → `MaintenanceDomainService.add_spare_part()`:

La entidad valida que la OT esté `EN_EJECUCION` antes de permitir la operación:
```python
# maintenance/domain/entities.py
if self.status != MaintenanceStatus.EN_EJECUCION:
    raise InvalidMaintenanceOperationException(
        "Solo se pueden registrar repuestos mientras la orden esté EN_EJECUCION."
    )
```

#### Paso 4: Liquidación y Cálculo de Costos (`POST /api/maintenance/{id}/liquidate`)

`LiquidateMaintenanceUseCase` → `MaintenanceDomainService.liquidate_order()`:

```python
# maintenance/domain/services.py — liquidate_order()

# 1. Leer horómetro actual de la máquina
machine = await self._machine_repo.get_by_id(order.machine_id)

# 2. Calcular próximo servicio: horómetro + 250 horas
order.liquidate(current_horometer=machine.current_horometer)
# Internamente: order.next_service_horometer = machine.current_horometer + 250.0

# 3. Para cada repuesto en la OT:
for req in order.spare_parts:
    spare_part = await self._spare_part_repo.get_by_id(req.spare_part_id)

    # 3a. Snapshot de precio histórico (inmutable a futuro)
    req.set_unit_cost(spare_part.unit_cost)

    # 3b. Descontar stock físico (lanza excepción si queda negativo)
    spare_part.decrease_stock(req.quantity_requested)
    await self._spare_part_repo.save(spare_part)

# 4. Máquina regresa a estado ACTIVA
machine.change_status(MachineStatus.ACTIVA)
await self._machine_repo.save(machine)
await self._repo.save(order)
```

**Actualización opcional del horómetro:** La ruta de liquidación acepta `current_horometer` en el payload. Si se provee, actualiza el horómetro de la máquina **antes** de liquidar, usando el valor más reciente.

#### Cálculo del Costo Total de una OT

El sistema **no almacena un total** en la BD. El costo total se calcula en el cliente o en reportes:

```
Costo Total Repuestos  = Σ (quantity_requested × unit_cost_at_time)
Costo Horas-Hombre     = horas_trabajadas × hourly_rate (de user_metadata)
─────────────────────────────────────────────────────────────────────────
Costo Total OT         = Costo Repuestos + Costo Horas-Hombre
```

Donde `unit_cost_at_time` es el precio histórico guardado en `maintenance_spare_parts` al momento de liquidar, y `hourly_rate` está en la tabla `user_metadata` del mecánico.

---

### 3.2 Bitácora de Auditoría Forense: Sistema Inmutable

#### ¿Qué responde y por qué existe?

**"¿Quién hizo qué, y cuándo?"**

La bitácora es un log forense de eventos críticos que:
1. **No puede editarse** (`UPDATE` bloqueado a nivel ORM)
2. **No puede borrarse** (`DELETE` bloqueado a nivel ORM)
3. Solo el rol `Administrador` puede consultarla

#### Inmutabilidad con SQLAlchemy Event Listeners

```python
# audit/infrastructure/models.py

@event.listens_for(AuditLogModel, 'before_update')
def block_audit_log_update(mapper, connection, target):
    raise PermissionError(
        "La bitácora de auditoría es inmutable: no se permiten actualizaciones (UPDATE)."
    )

@event.listens_for(AuditLogModel, 'before_delete')
def block_audit_log_delete(mapper, connection, target):
    raise PermissionError(
        "La bitácora de auditoría es inmutable: no se permiten eliminaciones (DELETE)."
    )
```

Estos listeners interceptan el evento **antes** de que SQLAlchemy genere el SQL, abortando la operación antes de que llegue a PostgreSQL.

#### Patrón de Registro: Dentro de la Misma Transacción

La auditoría no es un proceso separado. Se ejecuta **dentro de la misma transacción ACID** que la operación principal, garantizando que si la operación falla, el log también falla (no quedan logs huérfanos).

```python
# Patrón uniforme en TODOS los Use Cases del sistema
async with self.uow:
    # 1. Operación principal de negocio
    machine = await self.service.create_machine(...)

    # 2. Registro de auditoría (misma transacción)
    audit_log = AuditLog(
        entity_name="Machine",            # ¿Qué entidad?
        entity_id=machine.id,             # ¿Cuál registro?
        action="CREATE",                  # ¿Qué acción?
        payload={                         # ¿Cuál era el estado?
            "code": machine.code,
            "brand": machine.brand,
            "status": machine.status,
            ...
        },
        performed_by=command.performed_by # ¿Quién lo hizo? (ID Better Auth)
    )
    await audit_repo.save(audit_log)

    # 3. COMMIT atómico: ambas inserciones o ninguna
    await self.uow.commit()
```

#### Acciones Auditadas por Entidad

| Entidad | Acciones Registradas |
|---|---|
| `Machine` | `CREATE`, `SOFT_DELETE` |
| `MaintenanceOrder` | `CREATE`, `START_EXECUTION`, `LIQUIDATE` |
| `MaintenanceSparePart` | `ADD_SPARE_PART` |
| `SparePart` | `CREATE` |

#### Resolución de Nombres de Usuario en la API

El campo `performed_by` guarda el ID crudo de Better Auth, no el nombre. Al consultar la bitácora, el sistema resuelve los nombres en tiempo real:

```python
# audit/infrastructure/routes.py
performed_by_ids = {item.performed_by for item in result.items}

# Una sola consulta SQL que resuelve TODOS los IDs de una vez
names = await resolve_user_names(uow.session, performed_by_ids)

return [
    _build_audit_log_response(item, names.get(item.performed_by))
    for item in result.items
]
```

`resolve_user_names()` ejecuta: `SELECT id, name FROM user WHERE id IN (...)`.

---

### 3.3 Gestión de Roles y Permisos (RBAC)

#### Los Tres Roles del Sistema

| Rol en código | Valor en BD | Descripción funcional |
|---|---|---|
| `UserRole.ADMINISTRADOR` | `"Administrador"` | Acceso total. Ve máquinas dadas de baja. Lee bitácora. Gestiona usuarios. |
| `UserRole.SUPERVISOR` | `"Supervisor"` | Crea/gestiona máquinas y OTs. Sin acceso a auditoría ni gestión de usuarios. |
| `UserRole.MECANICO` | `"Mecánico"` | Actualiza horómetros, inicia OTs, registra repuestos, liquida OTs. |

#### Flujo de Verificación del JWT

```
Request: Authorization: Bearer <JWT_TOKEN>
    │
    ▼
jwt_helper.decode_better_auth_jwt(token)
    1. Obtiene clave pública desde JWKS
       (http://auth-server:3000/api/auth/jwks)
    2. Verifica firma RS256
    3. Extrae payload:
       - sub → better_auth_user_id
       - role → "admin" / "supervisor" / "mechanic"
       - name, email
    │
    ▼
_parse_role() en dependencies.py
    Normaliza el rol del JWT:
    "admin"      → UserRole.ADMINISTRADOR
    "supervisor" → UserRole.SUPERVISOR
    "mechanic"   → UserRole.MECANICO
    │
    ▼
require_roles([UserRole.ADMINISTRADOR, UserRole.SUPERVISOR])
    Si user.role NOT IN allowed_roles:
        → HTTP 403 Forbidden
    Si OK → devuelve CurrentUser (inyectado en el handler)
```

#### Matriz de Permisos por Endpoint

| Endpoint | Admin | Supervisor | Mecánico |
|---|:---:|:---:|:---:|
| `POST /api/machines/` — Crear máquina | ✅ | ✅ | ❌ |
| `GET /api/machines/` — Listar máquinas | ✅ (ve inactivas) | ✅ | ✅ |
| `PUT /api/machines/{id}/horometer` | ✅ | ✅ | ✅ |
| `PUT /api/machines/{id}/status` | ✅ | ✅ | ❌ |
| `DELETE /api/machines/{id}` — Soft Delete | ✅ | ✅ | ❌ |
| `POST /api/maintenance/` — Crear OT | ✅ | ✅ | ❌ |
| `POST /api/maintenance/{id}/start` | ✅ | ✅ | ✅ |
| `POST /api/maintenance/{id}/spare-parts` | ✅ | ✅ | ✅ |
| `POST /api/maintenance/{id}/liquidate` | ✅ | ✅ | ✅ |
| `GET /api/audit-logs/` — Ver bitácora | ✅ | ❌ | ❌ |
| `POST /api/user-metadata/` — Gestionar usuarios | ✅ | ❌ | ❌ |
| `GET /api/user-metadata/mechanics` — Listar mecánicos | ✅ | ✅ | ❌ |

---

## 4. Guía de Conexión y Gestión de la Base de Datos (Para el Usuario)

### 4.1 Parámetros de Conexión

Basados en el archivo [`apps/backend/.env.example`](file:///home/indroic/Documentos/mantainer-system/apps/backend/.env.example):

**Entorno de desarrollo local con Docker Compose:**

| Parámetro pgAdmin | Valor |
|---|---|
| **Host name / address** | `localhost` |
| **Port** | `5432` |
| **Maintenance database** | `sgmm_auth_db` |
| **Username** | `postgres` |
| **Password** | `postgres_secure_password` |
| **SSL mode** | `Disable` |

> **Nota para entorno universitario:** Si el sistema ya está desplegado en un servidor Dokploy, el Host será la IP pública del servidor. Consultar con el administrador el `.env` de producción.

---

### 4.2 Pasos para Conectar pgAdmin 4

1. Abrir pgAdmin 4 (navegador en `http://localhost:5050` o desde la app de escritorio).
2. En el panel izquierdo → clic derecho en **Servers** → **Register** → **Server...**.
3. **Pestaña General** → Name: `SGMM Dev`.
4. **Pestaña Connection** → completar con los parámetros de la tabla anterior.
5. Marcar **Save password** → **Save**.
6. Si la conexión es exitosa, navegar:
   `SGMM Dev → Databases → sgmm_auth_db → Schemas → public → Tables`
7. Para ejecutar SQL: clic derecho sobre la BD → **Query Tool**.

---

### 4.3 Consultas SQL Esenciales para Demostración en Vivo

#### Consulta 1: Historial de Auditoría con Nombres de Usuario

Muestra los últimos eventos de la bitácora forense con el nombre real del usuario. Ideal para demostrar trazabilidad.

```sql
SELECT
    al.created_at                AS "Fecha y Hora",
    u.name                       AS "Realizado Por",
    al.entity_name               AS "Entidad",
    al.action                    AS "Acción",
    al.entity_id                 AS "ID del Registro",
    al.payload                   AS "Detalle (JSON)"
FROM
    audit_logs al
    LEFT JOIN "user" u ON al.performed_by = u.id
ORDER BY
    al.created_at DESC
LIMIT 50;
```

**¿Qué muestra?**
- Las 50 acciones más recientes del sistema.
- El nombre del usuario resuelto mediante `JOIN` con la tabla `user` de Better Auth.
- El JSON del campo `payload` muestra el estado exacto de la entidad al momento de la acción.

---

#### Consulta 2: Órdenes de Trabajo Activas con Máquina y Mecánico

Muestra OTs en ejecución o programadas, con datos completos de la máquina y el mecánico asignado.

```sql
SELECT
    mo.created_at                        AS "Fecha OT",
    mo.status                            AS "Estado",
    mo.description                       AS "Descripción",
    m.code                               AS "Código Máquina",
    m.brand || ' ' || m.model            AS "Máquina",
    m.current_horometer                  AS "Horómetro Actual",
    u.name                               AS "Mecánico Asignado",
    mo.next_service_horometer            AS "Próximo Servicio (Hrs)"
FROM
    maintenance_orders mo
    INNER JOIN machines m        ON mo.machine_id = m.id
    INNER JOIN user_metadata um  ON mo.assigned_mechanic_id = um.id
    LEFT JOIN "user" u            ON um.better_auth_user_id = u.id
WHERE
    mo.status IN ('PROGRAMADO', 'EN_EJECUCION')
    AND mo.is_active = TRUE
ORDER BY
    mo.created_at DESC;
```

**¿Qué muestra?**
- Las tres relaciones principales: OT → Máquina → Mecánico.
- El doble JOIN a `user_metadata` y luego a `user` ilustra cómo el sistema separa identidad del negocio.
- `mo.is_active = TRUE` aplica el borrado lógico.

---

#### Consulta 3: Reporte de Costos de Repuestos por OT Liquidada

Calcula el costo total histórico de repuestos por cada OT, usando los precios snapshot de `unit_cost_at_time`.

```sql
SELECT
    mo.id                                    AS "ID OT",
    m.code                                   AS "Máquina",
    m.brand || ' ' || m.model               AS "Descripción Máquina",
    u.name                                   AS "Mecánico",
    mo.created_at                            AS "Fecha de OT",
    COUNT(msp.id)                            AS "Tipos de Repuesto",
    SUM(msp.quantity_requested)              AS "Unidades Totales",
    SUM(
        msp.quantity_requested * msp.unit_cost_at_time
    )                                        AS "Costo Total Repuestos"
FROM
    maintenance_orders mo
    INNER JOIN machines m        ON mo.machine_id = m.id
    INNER JOIN user_metadata um  ON mo.assigned_mechanic_id = um.id
    LEFT JOIN "user" u            ON um.better_auth_user_id = u.id
    LEFT JOIN maintenance_spare_parts msp ON mo.id = msp.maintenance_order_id
WHERE
    mo.status = 'LIQUIDADO'
GROUP BY
    mo.id, m.code, m.brand, m.model, u.name, mo.created_at
ORDER BY
    mo.created_at DESC;
```

**¿Qué muestra?**
- Usa `SUM(quantity × unit_cost_at_time)` para calcular costos históricos correctos.
- `LEFT JOIN` muestra también las OTs sin repuestos (con `0` en los totales).
- Este es el insumo principal para reportes financieros de mantenimiento.

---

## Glosario de Términos Técnicos

| Término | Definición en el contexto del SGMM |
|---|---|
| **Arquitectura Hexagonal** | Patrón que separa el dominio de negocio de los detalles técnicos (BD, HTTP). |
| **DDD** | Domain-Driven Design: metodología donde el modelo de negocio es el centro del software. |
| **HexCore** | Framework propietario del proyecto que implementa la Arquitectura Hexagonal sobre FastAPI. |
| **Entidad de Dominio** | Objeto con identidad (UUID) que encapsula reglas de negocio. Ej: `Machine`, `MaintenanceOrder`. |
| **Caso de Uso** | Clase que orquesta una operación completa de negocio. Ej: `LiquidateMaintenanceUseCase`. |
| **Repositorio** | Abstracción que oculta la complejidad del acceso a la base de datos. |
| **UoW (Unit of Work)** | Patrón que agrupa operaciones en una única transacción ACID. |
| **DTO** | Data Transfer Object: objeto simple para entrada/salida de la API. |
| **JWT** | JSON Web Token: token criptográfico con identidad y rol del usuario. Firmado con RSA. |
| **JWKS** | Conjunto de claves públicas JSON para verificar la firma de los JWT. |
| **RBAC** | Control de Acceso Basado en Roles. |
| **Soft Delete** | Borrado lógico: marcar `is_active=False` en lugar de borrar físicamente. |
| **Horómetro** | Contador de horas de operación de una máquina. Solo puede aumentar. |
| **OT** | Orden de Trabajo de Mantenimiento. |
| **Snapshot de precio** | Guardar el precio de un repuesto al usarlo, para que reportes futuros no sean afectados por cambios de precio. |
| **ACID** | Atomicidad, Consistencia, Isolation, Durabilidad: propiedades de las transacciones de BD. |
| **tRPC** | Protocolo de llamada a procedimientos remotos con tipado end-to-end para TypeScript. |
| **Better Auth** | Librería de autenticación TypeScript para usuarios, sesiones y JWT. |
| **Drizzle ORM** | ORM TypeScript para definir y migrar las tablas de autenticación. |
| **asyncpg** | Driver asíncrono de Python para conectarse a PostgreSQL. |
| **Alembic** | Herramienta de migraciones de BD para SQLAlchemy (lado Python). |

---

*Documento generado el 2026-07-19 — Basado en el estado actual del repositorio `mantainer-system` v2.0*
