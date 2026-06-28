FROM python:3.12-slim AS runner

WORKDIR /app

# Instalar dependencias del sistema y utilidades de red
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libssl-dev \
    libffi-dev \
    libpq-dev \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Instalar uv para instalación ultra-veloz de dependencias
RUN pip install --no-cache-dir uv

# Copiar configuración de dependencias de Python
COPY pyproject.toml ./

# Instalar dependencias de producción definidas en pyproject.toml
RUN uv pip install --system --no-cache .

# Copiar el código fuente de la aplicación
COPY src/ ./src/
COPY alembic/ ./alembic/
COPY alembic.ini config.py ./

# Configuración por defecto. DATABASE_URL es obligatorio y debe inyectarse en
# tiempo de ejecución (docker-compose / Dokploy); config.py deriva de él las
# URLs síncrona y asíncrona de SQLAlchemy.
ENV PORT=8000

EXPOSE 8000

# Healthcheck apuntando a la ruta raíz del backend FastAPI
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/ || exit 1

# Comando para correr las migraciones de Alembic y levantar la API en producción
CMD ["sh", "-c", "alembic upgrade head && uvicorn src.main:app --host 0.0.0.0 --port 8000"]
