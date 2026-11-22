/**
 * Type stubs for react-native-background-geolocation (Transistorsoft).
 *
 * This file exists so transistorsoftTask.ts can be typechecked without
 * installing the commercial library. It models only the subset of the API
 * used in the evaluation implementation.
 *
 * Replace this file with the real package once a commercial licence is purchased:
 *   npm install react-native-background-geolocation
 */
declare module "react-native-background-geolocation" {
  export interface Coords {
    latitude: number;
    longitude: number;
    accuracy: number;
    speed: number | null;
    heading: number | null;
    altitude: number | null;
    altitudeAccuracy: number | null;
  }

  export interface Location {
    coords: Coords;
    /** ISO-8601 timestamp string, e.g. "2026-11-22T11:30:00.000Z" */
    timestamp: string;
    extras?: Record<string, unknown>;
    uuid?: string;
    is_moving?: boolean;
    odometer?: number;
    activity?: { type: string; confidence: number };
    battery?: { level: number; is_charging: boolean };
  }

  export interface LocationError {
    code: number;
    message: string;
  }

  export interface State {
    enabled: boolean;
    isMoving: boolean;
    trackingMode?: number;
    schedulerEnabled?: boolean;
  }

  export interface ForegroundServiceNotification {
    title?: string;
    text?: string;
    color?: string;
    channelName?: string;
    channelId?: string;
    smallIcon?: string;
    largeIcon?: string;
  }

  export interface Config {
    transistorAuthorizationToken?: string;
    url?: string;
    autoSync?: boolean;
    batchSync?: boolean;
    maxBatchSize?: number;
    autoSyncThreshold?: number;
    maxRecordsToPersist?: number;
    maxDaysToPersist?: number;
    desiredAccuracy?: number;
    distanceFilter?: number;
    locationTimeout?: number;
    locationUpdateInterval?: number;
    fastestLocationUpdateInterval?: number;
    isMoving?: boolean;
    stationaryRadius?: number;
    foregroundService?: boolean;
    notification?: ForegroundServiceNotification;
    enableHeadless?: boolean;
    startOnBoot?: boolean;
    showsBackgroundLocationIndicator?: boolean;
    activityType?: number;
    stopOnTerminate?: boolean;
    debug?: boolean;
    extras?: Record<string, unknown>;
    pausesUpdatesAutomatically?: boolean;
  }

  export interface Subscription {
    remove(): void;
  }

  const BackgroundGeolocation: {
    // Constants
    readonly DESIRED_ACCURACY_HIGH: number;
    readonly DESIRED_ACCURACY_MEDIUM: number;
    readonly DESIRED_ACCURACY_LOW: number;
    readonly ACTIVITY_TYPE_AUTOMOTIVE_NAVIGATION: number;
    readonly ACTIVITY_TYPE_OTHER_NAVIGATION: number;
    readonly ACTIVITY_TYPE_FITNESS: number;
    readonly ACTIVITY_TYPE_OTHER: number;

    // Lifecycle
    ready(config: Config): Promise<State>;
    start(): Promise<State>;
    stop(): Promise<State>;
    getState(): Promise<State>;
    setConfig(config: Partial<Config>): Promise<State>;

    // Location events
    onLocation(
      success: (location: Location) => void,
      failure?: (error: LocationError) => void,
    ): Subscription;

    // SQLite queue management
    getCount(): Promise<number>;
    sync(): Promise<Location[]>;
    destroyLocations(): Promise<boolean>;

    // Logging
    getLog(options?: { limit?: number }): Promise<string>;
  };

  export default BackgroundGeolocation;
}
