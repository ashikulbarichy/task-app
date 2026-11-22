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

// Registering global error handlers
export function registerGlobalErrorHandlers(handlers: GlobalErrorHandlers): void {
  registeredHandlers = handlers;
}

// Handling global query/mutation error
function handleGlobalError(error: unknown, meta?: Record<string, unknown>): void {
  const apiError = normalizeError(error);
  const errorMeta = meta as QueryErrorMeta | undefined;

  if (apiError.status === 401 || apiError.code === "UNAUTHORIZED") {
    if (!isHandlingUnauthorized) {
      isHandlingUnauthorized = true;

      Promise.resolve(registeredHandlers.onUnauthorized?.(apiError))
        .catch(() => {
        })
        .finally(() => {
          setTimeout(() => {
            isHandlingUnauthorized = false;
          }, 2_000);
        });
    }
    return;
  }

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
    console.warn(`[QueryClient Error] ${toastPayload.title}: ${toastPayload.message}`, {
      code: apiError.code,
      status: apiError.status,
    });
  }
}

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
      staleTime: env.EXPO_PUBLIC_DEFAULT_STALE_TIME_MS,
      gcTime: 5 * 60_000,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => {
        const apiError = normalizeError(error);
        if (!apiError.isRetryable) {
          return false;
        }
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

// Setting up AppState focus manager
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

// Setting up NetInfo online manager
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

// Setting up query client lifecycle listeners
export function setupQueryClientListeners(): () => void {
  const unsubscribeFocus = setupAppStateFocusManager();
  setupNetInfoOnlineManager();

  return () => {
    unsubscribeFocus();
  };
}
