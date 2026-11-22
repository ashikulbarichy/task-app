---
name: dnp-app-architecture
description: >-
  Strict architecture, ground rules, folder structure, React Query discipline, and staged
  roadmap for the DNP Expo React Native app (Push Notifications + Live/Background Delivery
  Tracking). Activate this skill for EVERY task, code change, review, or planning step in
  this workspace.
---

# DNP App — Strict Architecture & Trainee Task Brief

This skill is the authoritative source of truth derived from the **React Native Trainee Task Brief: Push Notifications and Delivery Tracking**. Never violate any rule below.

---

## 1. Overview & Tech Stack

- **Framework**: React Native with Expo Development Builds (`expo-dev-client`).
- **Language**: TypeScript with `strict: true`.
- **Validation & Types**: Zod (`z.infer<typeof Schema>` is the single source of truth).
- **Forms**: React Hook Form (`react-hook-form`) + `@hookform/resolvers/zod`.
- **Server State**: TanStack React Query v5 (`@tanstack/react-query`).
- **HTTP Client**: Axios (`axios`).
- **Native Modules**:
  - Push Notifications: `@react-native-firebase/app`, `@react-native-firebase/messaging`, `expo-notifications`.
  - Tracking & Maps: `expo-location`, `expo-task-manager`, `react-native-maps` (plus later evaluation of `react-native-background-geolocation` by Transistorsoft).
  - Connectivity & Offline Storage: `@react-native-community/netinfo`, `@react-native-async-storage/async-storage`.

### Two Core Features
1. **Push Notifications** with Firebase (FCM) and Expo (`expo-notifications`).
2. **Delivery App** with live tracking and background tracking (Driver app + Customer view).

---

## 2. Non-Negotiable Ground Rules

1. **Expo Development Builds only (`expo-dev-client`)**. Expo Go cannot run native Firebase or background location modules.
2. **TypeScript `strict: true`** must remain enabled. Never use `any` to silence type errors.
3. **Zod is the single source of truth** for API payloads, notification payloads, location points, delivery status transitions, and form values. All domain types MUST come from `z.infer<typeof Schema>`.
4. **Config plugins only in `app.json`**. Never manually edit generated `android/` or `ios/` folders.
5. **Physical device testing** (Android or iOS) is mandatory — do not rely solely on simulators/emulators.
6. **Staged mentorship workflow**: Build one stage at a time, explain the "why" behind each file, and wait for user review at each checkpoint before advancing.

---

## 3. Architecture Rules

### 3.1 One-Way Layering (Strictly Enforced)

```text
UI Component -> Hook (React Query) -> Service (Plain TS, zero React imports) -> API Client (Axios + Zod)
```

- **UI Components**:
  - NEVER call `fetch` or `axios` directly.
  - NEVER copy or mirror server data into `useState`, Redux, or Zustand.
  - Only consume React Query hooks and render state (`isPending`, `error`, `data`).
- **Hooks (`queries.ts`)**:
  - Wrap services with TanStack React Query (`useQuery`, `useMutation`).
  - This is the ONLY layer where UI touches the data layer.
- **Services (`service.ts`)**:
  - Plain TypeScript functions with **zero React imports**.
  - Each function calls the shared API client, validates responses with Zod (`.parse()` / `.safeParse()`), and returns strongly typed data.
  - **Explicit exception**: Background tasks (`backgroundTask.ts` via `expo-task-manager`) run outside the React tree and cannot use hooks — they call services (and `locationQueue.ts`) directly.
- **API Client (`src/api/client.ts`)**:
  - Single shared Axios instance handling `baseURL`, auth headers, timeouts, and normalized error mapping.

### 3.2 Required Folder Structure

```text
src/
  api/
    client.ts                  # Single shared Axios instance, interceptors, error normalization
  lib/
    queryClient.ts             # QueryClient, focusManager, onlineManager, global QueryCache/MutationCache onError
  features/
    deliveries/
      schemas.ts               # Zod schemas + z.infer types (deliveries, status transitions, POD form)
      service.ts               # Plain TS API calls + Zod validation (getDeliveries, updateStatus, ...)
      queries.ts               # Query key factory + React Query hooks (optimistic updates)
      components/
    notifications/
      schemas.ts               # Zod schemas for notification payloads & settings
      service.ts               # Plain TS FCM token registration & notification settings API
      handlers.ts              # Foreground, background, killed-state handlers + Android channels + deep linking
      queries.ts               # Query key factory + React Query hooks for notification settings/token
      components/
    tracking/
      schemas.ts               # Zod schemas for location points & tracking batches
      service.ts               # Plain TS location sync API calls
      queries.ts               # Query key factory + hooks (driver & customer live tracking)
      locationQueue.ts         # Offline queue with its own persistent storage layer
      backgroundTask.ts        # expo-task-manager background location task (calls services directly)
      components/
```

### 3.3 Canonical Code Pattern

```ts
// service.ts (Zero React imports)
export async function getDeliveries(): Promise<Delivery[]> {
  const res = await api.get("/deliveries");
  return z.array(DeliverySchema).parse(res.data);
}

// queries.ts
export const deliveryKeys = {
  all: ["deliveries"] as const,
  detail: (id: string) => ["deliveries", id] as const,
};

export const useDeliveries = () =>
  useQuery({
    queryKey: deliveryKeys.all,
    queryFn: getDeliveries,
    staleTime: 30_000,
  });

export const useCompleteDelivery = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: completeDelivery,
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: deliveryKeys.all });
      qc.invalidateQueries({ queryKey: deliveryKeys.detail(vars.id) });
    },
  });
};
```

---

## 4. React Query Rules

1. **Key factories per feature**: All query keys come from a feature key factory (e.g., `deliveryKeys`). No scattered inline string arrays.
2. **Invalidation on mutation**: Mutations invalidate affected queries in `onSuccess`. No manual refetching and no copying server data into `useState`.
3. **Server state lives in React Query only**: Do not mirror server state in Redux, Zustand, or local React state.
4. **Deliberate `staleTime`**: Set `staleTime` consciously per query (e.g., delivery list ~30 seconds, static config much longer).
5. **Optimistic updates**: Required for delivery status transitions (`start`, `arrived`, `completed`), with snapshot + rollback in `onError` and invalidation in `onSettled`.
6. **Centralized global error handling**: Handled in one place (`QueryCache` + `MutationCache` `onError` in `src/lib/queryClient.ts`) for auth expiry (`401`) and toast notifications. Individual components must not reinvent global error handling.
7. **Live tracking cache discipline (Customer view)**: Use either polling with `refetchInterval` as the baseline OR push WebSocket updates into the cache via `queryClient.setQueryData`. **Never mix both on the same query.**

---

## 5. Staged Implementation Roadmap

### Stage 0 — Foundation
- `package.json`, `tsconfig.json` (`strict: true`), `app.json` (all config plugins & native permissions).
- `src/api/client.ts` (Axios + normalized `ApiError`).
- `src/lib/queryClient.ts` (`QueryClient`, `focusManager` with `AppState`, `onlineManager` with `NetInfo`, global `QueryCache` & `MutationCache` `onError`).

### Feature 1 — Push Notifications (Firebase + Expo)
- **Stage 1 (Setup)**: Expo dev build for Android/iOS; Firebase project with `google-services.json` and `GoogleService-Info.plist` (plus APNs key uploaded to Firebase for iOS).
- **Stage 2 (Permissions & Token)**:
  - Proper Android 13+ (`POST_NOTIFICATIONS`) permission flow.
  - Fetch FCM token, persist to backend via service layer, handle token refresh (`onTokenRefresh`).
  - Notification preferences loaded and saved via React Query hooks (never directly in components).
- **Stage 3 (Receiving Notifications)**:
  - Handle all 3 app states: **foreground**, **background**, and **killed** (cold-start from notification tap).
  - Deep link from notification tap to the target screen.
  - Configure Android notification channels.
  - On `order_update` payload, validate with Zod and invalidate matching delivery queries.
- **Stage 4 (Send Side)**:
  - Small script or endpoint using the Firebase Admin SDK to send test notifications independently.
- **Acceptance Criteria (Feature 1)**:
  - Works on a physical Android or iOS device.
  - Tap-to-navigate works from the killed state.
  - Malformed payloads NEVER crash the app (defensive Zod parsing).
  - Receiving an `order_update` notification refreshes the visible screen's data.

### Feature 2 — Delivery App with Live & Background Tracking
Start with the **Driver app** (sends location), then build the **Customer view** (watches it).

- **Stage 1 (Foreground Location)**:
  - `expo-location` with a permission flow and a rationale screen explaining why location is needed.
  - Map screen displaying current position using `react-native-maps`.
- **Stage 2 (Background Tracking)**:
  - `expo-task-manager` + `Location.startLocationUpdatesAsync`.
  - Android: Foreground service with a persistent notification.
  - iOS: `"Always"` permission + background location capability.
  - Handle battery optimization and permission denial gracefully.
  - Background task calls services (and `locationQueue.ts`) directly — never React hooks.
  - **Native Library Evaluation**: After Expo's APIs work, evaluate `react-native-background-geolocation` (Transistorsoft) and write up findings comparing battery usage, reliability, and features.
- **Stage 3 (Delivery Flow)**:
  - Delivery list -> Delivery detail -> `"start delivery"`, `"arrived"`, `"completed"` states.
  - Proof-of-delivery (POD) form (`recipientName`, `notes`) built with `react-hook-form` + `zod`.
  - Zod schemas for location points and delivery status transitions (invalid state transitions must be rejected).
  - All data access via service layer + React Query hooks with optimistic status updates.
- **Stage 4 (Live Sync)**:
  - Send location updates to backend via WebSocket or throttled HTTP batch (draining `locationQueue.ts`).
  - Customer tracking screen with a marker that animates/moves smoothly in real time.
- **Stage 5 (Hardening)**:
  - Throttling (distance filter + time interval), accuracy filtering (drop noisy GPS fixes), and automatically stopping background tracking when delivery completes.
  - Mandatory test scenarios on physical devices:
    1. App backgrounded for 30+ minutes.
    2. App killed and restarted.
    3. Airplane mode toggled off and back on (verifying offline queue persistence and drain).
