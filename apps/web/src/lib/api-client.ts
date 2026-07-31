import { authClient } from "./auth-client";

// Mismo origen que la web: el backend FastAPI se alcanza vía proxy inverso bajo
// `/api/*` (configurado en nginx). Los routers de FastAPI ya cuelgan de `/api`.
const API_BASE_URL = "https://sgmm.indroic.dev/api";

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean>;
}

export class ApiError extends Error {
  status: number;
  statusText: string;
  data: any;

  constructor(status: number, statusText: string, data: any) {
    super(data?.detail || statusText || `HTTP Error ${status}`);
    this.status = status;
    this.statusText = statusText;
    this.data = data;
    this.name = "ApiError";
  }
}

/**
 * Función centralizada para realizar llamadas seguras a la API REST de FastAPI.
 * Inyecta automáticamente el JWT de Better Auth en la cabecera Authorization.
 */
async function request<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { params, headers, ...restOptions } = options;

  // 1. Construir la URL con parámetros de consulta (query params)
  const url = buildUrl(endpoint, params);

  // 2. Obtener el token JWT asíncronamente usando el plugin de Better Auth
  const reqHeaders = await authHeaders(headers);

  // Inyectar Content-Type por defecto si es una petición con cuerpo JSON.
  // Con FormData NO se fija: el navegador debe generar el `boundary` del
  // multipart, y fijarlo a mano rompe el parseo en el servidor.
  const isFormData =
    typeof FormData !== "undefined" && restOptions.body instanceof FormData;
  if (restOptions.body && !isFormData && !reqHeaders.has("Content-Type")) {
    reqHeaders.set("Content-Type", "application/json");
  }

  // 3. Realizar la llamada HTTP
  const response = await fetch(url, {
    ...restOptions,
    headers: reqHeaders,
  });

  // 4. Procesar la respuesta
  let data: any = null;
  const contentType = response.headers.get("Content-Type");
  if (contentType && contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    throw new ApiError(response.status, response.statusText, data);
  }

  return data as T;
}

/**
 * Construye la URL absoluta del endpoint aplicando los parámetros de consulta.
 * Se comparte entre `request` y las descargas de archivos.
 */
function buildUrl(endpoint: string, params?: FetchOptions["params"]): string {
  let url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) url += `?${queryString}`;
  }
  return url;
}

/** Cabecera Authorization con el JWT de Better Auth, si hay sesión. */
async function authHeaders(base?: HeadersInit): Promise<Headers> {
  const headers = new Headers(base);
  try {
    const tokenResult = await authClient.token();
    if (tokenResult?.data?.token) {
      headers.set("Authorization", `Bearer ${tokenResult.data.token}`);
    }
  } catch (err) {
    console.warn("No se pudo obtener el token JWT de Better Auth:", err);
  }
  return headers;
}

/** Nombre de archivo sugerido por el servidor en `Content-Disposition`. */
function filenameFromDisposition(disposition: string | null): string | null {
  if (!disposition) return null;
  // Se admiten las dos formas habituales: filename="x.pdf" y filename*=UTF-8''x.pdf
  const utf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8?.[1]) return decodeURIComponent(utf8[1].trim());
  const plain = disposition.match(/filename="?([^";]+)"?/i);
  return plain?.[1]?.trim() ?? null;
}

/**
 * Descarga un archivo generado por la API (PDF, XLSX, CSV) respetando el JWT.
 *
 * No se puede usar un `<a href>` directo porque los endpoints exigen la cabecera
 * Authorization: se descarga como blob y se dispara la descarga en el navegador.
 */
export async function downloadFile(
  endpoint: string,
  options?: { params?: FetchOptions["params"]; filename?: string },
): Promise<void> {
  const response = await fetch(buildUrl(endpoint, options?.params), {
    method: "GET",
    headers: await authHeaders(),
  });

  if (!response.ok) {
    // Los errores del backend llegan en JSON incluso en endpoints de descarga.
    let data: any = null;
    try {
      data = await response.json();
    } catch {
      data = await response.text().catch(() => null);
    }
    throw new ApiError(response.status, response.statusText, data);
  }

  const blob = await response.blob();
  const filename =
    options?.filename ||
    filenameFromDisposition(response.headers.get("Content-Disposition")) ||
    "descarga";

  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    // Se libera en el siguiente tick: revocar de inmediato aborta la descarga
    // en algunos navegadores.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
}

export const apiClient = {
  get: <T>(endpoint: string, options?: Omit<FetchOptions, "method" | "body">) =>
    request<T>(endpoint, { ...options, method: "GET" }),

  post: <T>(endpoint: string, body?: any, options?: Omit<FetchOptions, "method" | "body">) =>
    request<T>(endpoint, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),

  /**
   * Envía `multipart/form-data` (importaciones de archivos).
   *
   * No se fija `Content-Type` a propósito: el navegador debe generarlo junto con
   * el `boundary`, y fijarlo a mano rompe el parseo en el servidor.
   */
  postForm: <T>(endpoint: string, form: FormData, options?: Omit<FetchOptions, "method" | "body">) =>
    request<T>(endpoint, { ...options, method: "POST", body: form }),

  put: <T>(endpoint: string, body?: any, options?: Omit<FetchOptions, "method" | "body">) =>
    request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(endpoint: string, options?: Omit<FetchOptions, "method" | "body">) =>
    request<T>(endpoint, { ...options, method: "DELETE" }),
};
