from sqlalchemy import Column, MetaData, String, Table

# Definición de solo lectura de la tabla `user` que administra Better Auth
# (vía Drizzle, en packages/db/src/schema/auth.ts). Backend y Better Auth
# comparten la misma base de datos Postgres, por lo que podemos leerla
# directamente sin llamadas HTTP entre servicios. No usamos un modelo
# declarativo propio porque esta tabla no pertenece a este bounded context:
# solo la consultamos, nunca la migramos ni la escribimos desde aquí.
better_auth_metadata = MetaData()

user_table = Table(
    "user",
    better_auth_metadata,
    Column("id", String, primary_key=True),
    Column("name", String, nullable=False),
)
