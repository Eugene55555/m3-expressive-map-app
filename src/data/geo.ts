export interface GeoPosition {
  lat: number;
  lng: number;
  /** Accuracy in metres, when the browser reports it. */
  accuracy: number;
}

export function isGeolocationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator && navigator.geolocation != null;
}

function messageForError(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Location permission was denied. You can still enter coordinates manually.';
    case error.POSITION_UNAVAILABLE:
      return 'Your location is currently unavailable. Try again or enter coordinates manually.';
    case error.TIMEOUT:
      return 'Finding your location took too long. Try again or enter coordinates manually.';
    default:
      return 'Could not determine your location. Enter coordinates manually.';
  }
}

/**
 * Request the user's position once. Only ever called in response to an explicit
 * user action, so the browser permission prompt is always user-initiated.
 */
export function getCurrentPosition(): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (!isGeolocationSupported()) {
      reject(new Error('Location is not supported in this browser. Enter coordinates manually.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: typeof position.coords.accuracy === 'number' ? position.coords.accuracy : 0,
        });
      },
      (error) => reject(new Error(messageForError(error))),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60_000 },
    );
  });
}
