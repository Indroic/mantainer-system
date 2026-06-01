import { env } from "@mantainer-system/env/web";
import { authClient } from "./auth-client";

const API_BASE_URL = env.VITE_API_URL;

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
  let url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  // 2. Obtener el token JWT asíncronamente usando el plugin de Better Auth
  const reqHeaders = new Headers(headers);
  try {
    const tokenResult = await authClient.token();
    if (tokenResult?.data?.token) {
      reqHeaders.set("Authorization", `Bearer ${tokenResult.data.token}`);
    }
  } catch (err) {
    console.warn("No se pudo obtener el token JWT de Better Auth, realizando llamada anónima:", err);
  }

  // Inyectar Content-Type por defecto si es una petición con cuerpo
  if (restOptions.body && !reqHeaders.has("Content-Type")) {
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

export const apiClient = {
  get: <T>(endpoint: string, options?: Omit<FetchOptions, "method" | "body">) =>
    request<T>(endpoint, { ...options, method: "GET" }),

  post: <T>(endpoint: string, body?: any, options?: Omit<FetchOptions, "method" | "body">) =>
    request<T>(endpoint, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(endpoint: string, body?: any, options?: Omit<FetchOptions, "method" | "body">) =>
    request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(endpoint: string, options?: Omit<FetchOptions, "method" | "body">) =>
    request<T>(endpoint, { ...options, method: "DELETE" }),
};
