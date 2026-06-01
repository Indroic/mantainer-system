import jwt
import pytest
from fastapi import HTTPException
from src.features.auth.jwt_helper import decode_better_auth_jwt


def test_decode_jwt_success():
    """Valida que un token JWT decodificado con fallback de desarrollo funcione correctamente."""
    payload = {
        "sub": "user-auth-123",
        "email": "test@example.com",
        "name": "Juan Perez",
        "role": "MECANICO",
    }
    # Creamos un token sin firma
    token = jwt.encode(payload, key="", algorithm="none")

    result = decode_better_auth_jwt(token)

    assert result["better_auth_user_id"] == "user-auth-123"
    assert result["email"] == "test@example.com"
    assert result["name"] == "Juan Perez"
    assert result["role"] == "MECANICO"


def test_decode_jwt_missing_user_id():
    """Valida que falle si el token no tiene sub ni id."""
    payload = {
        "email": "test@example.com",
        "name": "Juan Perez",
    }
    token = jwt.encode(payload, key="", algorithm="none")

    with pytest.raises(HTTPException) as exc:
        decode_better_auth_jwt(token)

    assert exc.value.status_code == 401
    assert "Falta el ID del usuario" in exc.value.detail


def test_decode_jwt_invalid_format():
    """Valida que falle con un token mal formado."""
    with pytest.raises(HTTPException) as exc:
        decode_better_auth_jwt("token-invalido-mal-formado")

    assert exc.value.status_code == 401
    assert "Token JWT inválido" in exc.value.detail
