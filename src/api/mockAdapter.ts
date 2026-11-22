import axios, {
  AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";

import { env } from "@/lib/env";
import type { Delivery } from "@/features/deliveries/schemas";
import type { LocationPoint } from "@/features/tracking/schemas";
import type { NotificationSettings } from "@/features/notifications/schemas";

const INITIAL_DELIVERIES: Delivery[] = [
  {
    id: "del-101",
    orderNumber: "ORD-9481",
    status: "pending",
    customerName: "Alex Rivera",
    address: "742 Evergreen Terrace, Springfield",
    latitude: 37.7749,
    longitude: -122.4194,
    items: ["2x Gourmet Pizza", "1x Sparkling Water"],
    notes: "Please leave on porch if no answer.",
    updatedAt: new Date().toLocaleTimeString(),
  },
  {
    id: "del-102",
    orderNumber: "ORD-9482",
    status: "started",
    customerName: "Samantha Chen",
    address: "1088 Point Lobos Ave, San Francisco",
    latitude: 37.7785,
    longitude: -122.514,
    items: ["1x Thai Iced Tea", "1x Pad Thai"],
    notes: "Ring bell twice.",
    updatedAt: new Date().toLocaleTimeString(),
  },
  {
    id: "del-103",
    orderNumber: "ORD-9483",
    status: "completed",
    customerName: "David Miller",
    address: "55 Music Concourse Dr, San Francisco",
    latitude: 37.7715,
    longitude: -122.4687,
    items: ["1x Family Meal Deal"],
    notes: "Delivered to reception desk.",
    recipientName: "David M.",
    updatedAt: new Date().toLocaleTimeString(),
  },
];

let mockDeliveries: Delivery[] = JSON.parse(JSON.stringify(INITIAL_DELIVERIES));
const mockTrackingLocations = new Map<string, LocationPoint>();

let mockNotificationSettings: NotificationSettings = {
  orderUpdates: true,
  deliveryAlerts: true,
  soundEnabled: true,
  promotional: false,
};

// Simulating network delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Resetting mock store data
export function resetMockData(): void {
  mockDeliveries = JSON.parse(JSON.stringify(INITIAL_DELIVERIES));
  mockTrackingLocations.clear();
  mockNotificationSettings = {
    orderUpdates: true,
    deliveryAlerts: true,
    soundEnabled: true,
    promotional: false,
  };
}

// Parsing request body safely
function parseRequestBody(data: unknown): Record<string, any> {
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return {};
    }
  }
  return (data as Record<string, any>) || {};
}

// Handling mock HTTP request
export async function handleMockRequest(
  config: InternalAxiosRequestConfig,
): Promise<AxiosResponse> {
  await delay(200);

  const url = (config.url || "").replace(/^https?:\/\/[^/]+(\/api)?/, "").replace(/^\/api/, "");
  const method = (config.method || "get").toLowerCase();

  const isSimulatedError =
    config.headers?.["x-mock-error"] === "500" ||
    (typeof config.headers?.get === "function" && config.headers.get("x-mock-error") === "500");

  if (isSimulatedError) {
    throw new AxiosError(
      "Simulated Internal Server Error (500) to test React Query optimistic rollback.",
      "ERR_BAD_RESPONSE",
      config,
      null,
      {
        data: {
          message: "Simulated Internal Server Error (500) to test React Query optimistic rollback.",
          code: "SERVER_ERROR",
        },
        status: 500,
        statusText: "Internal Server Error",
        headers: {},
        config,
      },
    );
  }

  // 1. Deliveries List
  if (method === "get" && (url === "/deliveries" || url === "deliveries")) {
    return {
      data: JSON.parse(JSON.stringify(mockDeliveries)),
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    };
  }

  // 2. Delivery Detail
  const detailMatch = url.match(/^\/?deliveries\/([^/]+)$/);
  if (method === "get" && detailMatch && detailMatch[1]) {
    const id = detailMatch[1];
    const delivery = mockDeliveries.find((d) => d.id === id);
    if (!delivery) {
      throw new AxiosError(
        `Delivery '${id}' not found`,
        "ERR_BAD_REQUEST",
        config,
        null,
        {
          data: { message: `Delivery '${id}' not found`, code: "NOT_FOUND" },
          status: 404,
          statusText: "Not Found",
          headers: {},
          config,
        },
      );
    }
    return {
      data: JSON.parse(JSON.stringify(delivery)),
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    };
  }

  // 3. Update Delivery Status
  const statusMatch = url.match(/^\/?deliveries\/([^/]+)\/status$/);
  if (method === "patch" && statusMatch && statusMatch[1]) {
    const id = statusMatch[1];
    const body = parseRequestBody(config.data);
    const delivery = mockDeliveries.find((d) => d.id === id);
    if (!delivery) {
      throw new AxiosError(
        `Delivery '${id}' not found`,
        "ERR_BAD_REQUEST",
        config,
        null,
        {
          data: { message: `Delivery '${id}' not found`, code: "NOT_FOUND" },
          status: 404,
          statusText: "Not Found",
          headers: {},
          config,
        },
      );
    }
    delivery.status = body.status;
    delivery.updatedAt = new Date().toLocaleTimeString();
    return {
      data: JSON.parse(JSON.stringify(delivery)),
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    };
  }

  // 4. Complete Delivery
  const completeMatch = url.match(/^\/?deliveries\/([^/]+)\/complete$/);
  if (method === "post" && completeMatch && completeMatch[1]) {
    const id = completeMatch[1];
    const body = parseRequestBody(config.data);
    const delivery = mockDeliveries.find((d) => d.id === id);
    if (!delivery) {
      throw new AxiosError(
        `Delivery '${id}' not found`,
        "ERR_BAD_REQUEST",
        config,
        null,
        {
          data: { message: `Delivery '${id}' not found`, code: "NOT_FOUND" },
          status: 404,
          statusText: "Not Found",
          headers: {},
          config,
        },
      );
    }
    delivery.status = "completed";
    delivery.recipientName = body.recipientName || "Customer";
    delivery.notes = body.notes || "";
    delivery.updatedAt = new Date().toLocaleTimeString();
    return {
      data: JSON.parse(JSON.stringify(delivery)),
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    };
  }

  // 5. Notifications Token
  if (method === "post" && (url === "/notifications/token" || url === "notifications/token")) {
    return {
      data: { success: true, message: "Token registered successfully" },
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    };
  }

  // 6. Notification Settings
  if (method === "get" && (url === "/notifications/settings" || url === "notifications/settings")) {
    return {
      data: JSON.parse(JSON.stringify(mockNotificationSettings)),
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    };
  }

  if (method === "put" && (url === "/notifications/settings" || url === "notifications/settings")) {
    const body = parseRequestBody(config.data);
    mockNotificationSettings = {
      ...mockNotificationSettings,
      ...body,
    };
    return {
      data: JSON.parse(JSON.stringify(mockNotificationSettings)),
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    };
  }

  // 7. Tracking Batch
  if (method === "post" && (url === "/tracking/batch" || url === "tracking/batch")) {
    const body = parseRequestBody(config.data);
    const locations: LocationPoint[] = body.locations || [];
    for (const loc of locations) {
      if (loc.deliveryId) {
        mockTrackingLocations.set(loc.deliveryId, loc);
      }
    }
    return {
      data: { success: true, processed: locations.length },
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    };
  }

  // 8. Latest Location for Delivery
  const latestLocMatch = url.match(/^\/?tracking\/([^/]+)\/latest$/);
  if (method === "get" && latestLocMatch && latestLocMatch[1]) {
    const deliveryId = latestLocMatch[1];
    const loc = mockTrackingLocations.get(deliveryId);
    if (loc) {
      return {
        data: JSON.parse(JSON.stringify(loc)),
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    }

    const delivery = mockDeliveries.find((d) => d.id === deliveryId);
    if (delivery && delivery.latitude && delivery.longitude) {
      const fallbackLoc: LocationPoint = {
        latitude: delivery.latitude - 0.003,
        longitude: delivery.longitude - 0.003,
        accuracy: 12,
        speed: 7.2,
        heading: 90,
        timestamp: Date.now(),
        deliveryId: delivery.id,
      };
      return {
        data: fallbackLoc,
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    }

    return {
      data: null,
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    };
  }

  throw new AxiosError(
    `Unhandled mock endpoint: ${method.toUpperCase()} ${url}`,
    "ERR_NOT_FOUND",
    config,
    null,
    {
      data: { message: `Unhandled mock endpoint: ${method.toUpperCase()} ${url}`, code: "NOT_FOUND" },
      status: 404,
      statusText: "Not Found",
      headers: {},
      config,
    },
  );
}

// Creating in-app mock Axios adapter
export function createInAppMockAdapter() {
  const defaultAdapter = axios.getAdapter(axios.defaults.adapter);

  return async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    if (env.EXPO_PUBLIC_USE_IN_APP_MOCK) {
      return handleMockRequest(config);
    }

    try {
      return await defaultAdapter(config);
    } catch (networkError: unknown) {
      if (
        axios.isAxiosError(networkError) &&
        (!networkError.response || networkError.code === "ERR_NETWORK" || networkError.code === "ECONNABORTED")
      ) {
        console.warn("[API] Network unreachable. Falling back to in-app mock handler:", config.url);
        return handleMockRequest(config);
      }
      throw networkError;
    }
  };
}
