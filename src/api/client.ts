import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
import { ZodError, z } from "zod";

/**
 * Normalized error categories used across services, React Query caches, and UI.
 * Keeping this closed union lets the global error handler branch exhaustively.
 */
export const ApiErrorCodeSchema = z.enum([
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION_ERROR",
  "SERVER_ERROR",
  "NETWORK_ERROR",
  "TIMEOUT",
  "UNKNOWN",
]);

export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

/**
 * Expected shape of backend JSON error payloads.
 * Validated defensively with safeParse so malformed backend responses never crash error handling.
 */
const ServerErrorBodySchema = z.object({
  message: z.string().min(1).optional(),
  error: z.string().min(1).optional(),
  code: z.string().optional(),
  details: z.unknown().optional(),
});

export class ApiError extends Error {
  public readonly status: number | null;
  public readonly code: ApiErrorCode;
  public readonly details?: unknown;
  public readonly isRetryable: boolean;

  constructor(params: {
    message: string;
    status: number | null;
    code: ApiErrorCode;
    details?: unknown;
    isRetryable: boolean;
  }) {
    super(params.message);
    this.name = "ApiError";
    this.status = params.status;
    this.code = params.code;
    this.details = params.details;
    this.isRetryable = params.isRetryable;

    // Ensures `instanceof ApiError` works reliably across JS engines (Hermes/JSC).
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Auth token provider registered at app bootstrap (e.g., reading from SecureStore).
 * Keeping this as an injected callback prevents circular dependencies and keeps
 * `src/api/client.ts` completely free of React or storage library imports.
 */
export type AuthTokenProvider = () => Promise<string | null> | string | null;

let authTokenProvider: AuthTokenProvider | null = null;

export function setAuthTokenProvider(provider: AuthTokenProvider | null): void {
  authTokenProvider = provider;
}

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000/api";

const REQUEST_TIMEOUT_MS = 15_000;

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

/**
 * Request Interceptor:
 * Injects the Bearer token automatically before every outgoing request.
 */
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    if (authTokenProvider) {
      const token = await authTokenProvider();
      if (token) {
        config.headers.set("Authorization", `Bearer ${token}`);
      }
    }
    return config;
  },
  (error: unknown) => Promise.reject(normalizeError(error)),
);

/**
 * Response Interceptor:
 * Passes successful responses straight through, and converts EVERY failure
 * into a predictable `ApiError` instance.
 */
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(normalizeError(error)),
);

/**
 * Normalizes Axios errors, Zod schema validation failures, and unexpected runtime
 * exceptions into a single `ApiError` contract.
 */
export function normalizeError(error: unknown): ApiError {
  if (isApiError(error)) {
    return error;
  }

  // Catch schema mismatches from service-layer `Schema.parse(...)` calls.
  if (error instanceof ZodError) {
    return new ApiError({
      message: "Received unexpected data format from the server.",
      status: null,
      code: "VALIDATION_ERROR",
      details: error.flatten(),
      isRetryable: false,
    });
  }

  if (axios.isAxiosError(error)) {
    return normalizeAxiosError(error);
  }

  if (error instanceof Error) {
    return new ApiError({
      message: error.message || "An unexpected error occurred.",
      status: null,
      code: "UNKNOWN",
      isRetryable: false,
    });
  }

  return new ApiError({
    message: "An unexpected error occurred.",
    status: null,
    code: "UNKNOWN",
    details: error,
    isRetryable: false,
  });
}

function normalizeAxiosError(error: AxiosError): ApiError {
  // 1. Timeout (Axios sets ECONNABORTED or ETIMEDOUT)
  if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
    return new ApiError({
      message: "The request timed out. Please check your connection and try again.",
      status: null,
      code: "TIMEOUT",
      isRetryable: true,
    });
  }

  // 2. No HTTP response at all (offline, airplane mode, DNS failure, server unreachable)
  if (!error.response) {
    return new ApiError({
      message: "Unable to reach the server. Please check your internet connection.",
      status: null,
      code: "NETWORK_ERROR",
      isRetryable: true,
    });
  }

  const { status, data } = error.response;
  const parsedBody = ServerErrorBodySchema.safeParse(data);
  const serverMessage = parsedBody.success
    ? (parsedBody.data.message ?? parsedBody.data.error)
    : undefined;
  const details = parsedBody.success ? parsedBody.data.details : data;

  if (status === 401) {
    return new ApiError({
      message: serverMessage ?? "Your session has expired. Please sign in again.",
      status,
      code: "UNAUTHORIZED",
      details,
      isRetryable: false,
    });
  }

  if (status === 403) {
    return new ApiError({
      message: serverMessage ?? "You do not have permission to perform this action.",
      status,
      code: "FORBIDDEN",
      details,
      isRetryable: false,
    });
  }

  if (status === 404) {
    return new ApiError({
      message: serverMessage ?? "The requested resource was not found.",
      status,
      code: "NOT_FOUND",
      details,
      isRetryable: false,
    });
  }

  if (status === 400 || status === 422) {
    return new ApiError({
      message: serverMessage ?? "Please check your input and try again.",
      status,
      code: "VALIDATION_ERROR",
      details,
      isRetryable: false,
    });
  }

  if (status >= 500) {
    return new ApiError({
      message: serverMessage ?? "The server encountered an error. Please try again shortly.",
      status,
      code: "SERVER_ERROR",
      details,
      isRetryable: true,
    });
  }

  return new ApiError({
    message: serverMessage ?? `Request failed with status ${status}.`,
    status,
    code: "UNKNOWN",
    details,
    isRetryable: false,
  });
}
