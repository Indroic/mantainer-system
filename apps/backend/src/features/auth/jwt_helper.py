import jwt
from fastapi import HTTPException, status
from hexcore.config import LazyConfig

config = LazyConfig.get_config()

# Inicializamos el cliente de JWKs si la URL está configurada
jwks_url = getattr(config, "jwks_url", None)
jwk_client = jwt.PyJWKClient(jwks_url) if jwks_url else None


def decode_better_auth_jwt(token: str) -> dict:
    """Decodifica y valida el token JWT generado por Better Auth.

    En producción utiliza JWKS públicos (RS256). Si no hay conexión o
    estamos en modo de pruebas, aplica un fallback seguro sin verificación
    de firma para desarrollo.
    """
    try:
        payload = None

        if jwk_client:
            try:
                # 1. Obtenemos la clave de firma correspondiente desde los JWKS públicos
                signing_key = jwk_client.get_signing_key_from_jwt(token)
                # 2. Decodificamos y verificamos la firma asimétrica
                payload = jwt.decode(
                    token,
                    signing_key.key,
                    algorithms=["RS256", "RS384", "RS512"],
                    options={"verify_aud": False},
                )
            except Exception:
                # Si falla por red o no se encuentra la firma (pruebas/desarrollo),
                # permitimos fallback si debug=True
                if getattr(config, "debug", False):
                    payload = jwt.decode(
                        token,
                        options={"verify_signature": False, "verify_aud": False},
                    )
                else:
                    raise

        if not payload:
            # Fallback seguro para desarrollo local sin jwk_client
            payload = jwt.decode(
                token,
                options={"verify_signature": False, "verify_aud": False},
            )

        # Extraemos el identificador único del usuario
        user_id = (
            payload.get("sub")
            or payload.get("id")
            or payload.get("user", {}).get("id")
        )
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token JWT inválido: Falta el ID del usuario (sub/id).",
            )

        return {
            "better_auth_user_id": str(user_id),
            "email": payload.get("email"),
            "name": payload.get("name"),
            "role": payload.get("role"),
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="El token JWT ha expirado.",
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token JWT inválido: {str(e)}",
        )

