export interface LatLngPoint {
  latitude: number;
  longitude: number;
}

// Generating route coordinates
export function buildRouteCoordinates(
  start: LatLngPoint,
  destination: LatLngPoint,
): LatLngPoint[] {
  const dLat = destination.latitude - start.latitude;
  const dLon = destination.longitude - start.longitude;

  return [
    { latitude: start.latitude, longitude: start.longitude },
    { latitude: start.latitude + dLat * 0.2, longitude: start.longitude + dLon * 0.05 },
    { latitude: start.latitude + dLat * 0.4, longitude: start.longitude + dLon * 0.3 },
    { latitude: start.latitude + dLat * 0.65, longitude: start.longitude + dLon * 0.55 },
    { latitude: start.latitude + dLat * 0.85, longitude: start.longitude + dLon * 0.85 },
    { latitude: destination.latitude, longitude: destination.longitude },
  ];
}
