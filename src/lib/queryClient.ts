import NetInfo from "@react-native-community/netinfo";
import {
  MutationCache,
  QueryCache,
  QueryClient,
  focusManager,
  onlineManager,
} from "@tanstack/react-query";
import { AppState, type AppStateStatus, Platform } from "react-native";

import { normalizeError, type ApiError } from "@/api/client";
import { env } from "@/lib/env";

/**
 * Optional per-query / per-mutation metadata for fine-grained global handler control.
 * Example: `useQuery({ ..., meta: { suppressErrorToast: true } })` for silent background polls.
 */
export interface QueryErrorMeta {
  suppressErrorToast?: boolean;
  errorTitle?: string;
}

export interface GlobalToastPayload {
  type: "error" | "info" | "success";
  title: string;
  message: string;
}

export interface GlobalErrorHandlers {
  onUnauthorized?: (error: ApiError) => void | Promise<void>;
  onToast?: (toast: GlobalToastPayload) => void;
}

let registeredHandlers: GlobalErrorHandlers = {};
let isHandlingUnauthorized = false;

/**
 * Registers app-level reactions to global server errors (401 logout redirect & toast UI).
 * Call this once during app startup (e.g., in your root provider) so `queryClient.ts`
 * stays decoupled from navigation and toast component implementations.
 */
export function registerGlobalErrorHandlers(handlers: GlobalErrorHandlers): void {
  registeredHandlers = handlers;
}

/**
 * Single centralized error handler invoked by BOTH QueryCache and MutationCache.
 * Individual UI components never have to duplicate 401 handling or toast logic.
 */
function handleGlobalError(error: unknown, meta?: Record<string, unknown>): void {
  const apiError = normalizeError(error);
  const errorMeta = meta as QueryErrorMeta | undefined;

  // 1. Auth expiry (401): deduplicate concurrent 401 storms across parallel queries.
  if (apiError.status === 401 || apiError.code === "UNAUTHORIZED") {
    if (!isHandlingUnauthorized) {
      isHandlingUnauthorized = true;

      Promise.resolve(registeredHandlers.onUnauthorized?.(apiError))
        .catch(() => {
          // Swallow handler exceptions so they do not become unhandled rejections.
        })
        .finally(() => {
          // Reset guard after a short window so future sessions can handle 401 again.
          setTimeout(() => {
            isHandlingUnauthorized = false;
          }, 2_000);
        });
    }
    return;
  }

  // 2. Global user-facing toast (unless explicitly suppressed by the query/mutation).
  if (errorMeta?.suppressErrorToast) {
    return;
  }

  const toastPayload: GlobalToastPayload = {
    type: "error",
    title: errorMeta?.errorTitle ?? "Something went wrong",
    message: apiError.message,
  };

  if (registeredHandlers.onToast) {
    registeredHandlers.onToast(toastPayload);
  } else if (__DEV__) {
    // Fallback visibility in development before a toast UI library is wired in.
    console.warn(`[QueryClient Error] ${toastPayload.title}: ${toastPayload.message}`, {
      code: apiError.code,
      status: apiError.status,
    });
  }
}

/**
 * Single shared TanStack React Query v5 client for the entire app.
 */
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      handleGlobalError(error, query.meta);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      handleGlobalError(error, mutation.meta);
    },
  }),
  defaultOptions: {
    queries: {
      // Deliberate baseline loaded from environment configuration
      staleTime: env.EXPO_PUBLIC_DEFAULT_STALE_TIME_MS,
      gcTime: 5 * 60_000,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => {
        const apiError = normalizeError(error);
        // Never retry client errors (400/401/403/404) or Zod schema mismatches.
        if (!apiError.isRetryable) {
          return false;
        }
        return failureCount < 2;
      },
    },
    mutations: {
      // Never auto-retry mutations to prevent duplicate side effects (e.g., double status updates).
      retry: false,
    },
  },
});

/**
 * Connects React Native's AppState to TanStack Query's focusManager so stale queries
 * automatically refetch when the driver/customer brings the app back to the foreground.
 */
export function setupAppStateFocusManager(): () => void {
  const onAppStateChange = (status: AppStateStatus): void => {
    if (Platform.OS !== "web") {
      focusManager.setFocused(status === "active");
    }
  };

  const subscription = AppState.addEventListener("change", onAppStateChange);
  return () => {
    subscription.remove();
  };
}

/**
 * Connects NetInfo to TanStack Query's onlineManager so queries pause cleanly in
 * airplane mode / tunnels and resume automatically once connectivity returns.
 *
 * Note: `onlineManager.setEventListener` returns `void` in TanStack Query v5 and
 * internally stores the cleanup function returned by our callback (automatically
 * unsubscribing any previous listener on Fast Refresh).
 */
export function setupNetInfoOnlineManager(): void {
  onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener((state) => {
      const isOnline = Boolean(
        state.isConnected && state.isInternetReachable !== false,
      );
      setOnline(isOnline);
    });
  });
}

/**
 * Convenience helper to initialize both React Native lifecycle listeners in your root component.
 * Returns the AppState cleanup function suitable for `useEffect`.
 */
export function setupQueryClientListeners(): () => void {
  const unsubscribeFocus = setupAppStateFocusManager();
  setupNetInfoOnlineManager();

  return () => {
    unsubscribeFocus();
  };
}
