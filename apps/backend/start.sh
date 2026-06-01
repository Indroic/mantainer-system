#!/bin/bash
# Activa el entorno virtual local
source .venv/bin/activate

# Inicia uvicorn apuntando a src/main.py
echo "Iniciando servidor de desarrollo SGMM REST API..."
uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
