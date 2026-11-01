/**
 * Geolocation & Local Environment Service
 * Gives SARA real-time geographic and local environmental awareness.
 */

export interface LocationContext {
  latitude: number;
  longitude: number;
  city?: string;
  region?: string;
  country?: string;
  formattedAddress?: string;
  weatherSummary?: string;
  temperature?: string;
  lastUpdated: number;
  permissionGranted: boolean;
}

const STORAGE_KEY = 'sara_location_context';

export function getCachedLocation(): LocationContext | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

export function saveCachedLocation(loc: LocationContext) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
  } catch (e) {}
}

export function clearCachedLocation() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {}
}

export async function requestUserLocation(): Promise<LocationContext> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new Error('Geolocation is not supported by your browser');
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        let city = '';
        let region = '';
        let country = '';
        let formattedAddress = '';
        let weatherSummary = '';
        let temperature = '';

        // Reverse geocoding via server API endpoint or client fallback
        try {
          const res = await fetch(`/api/reverse-geocode?lat=${latitude}&lon=${longitude}`);
          if (res.ok) {
            const data = await res.json();
            city = data.city || '';
            region = data.region || '';
            country = data.country || '';
            formattedAddress = data.formattedAddress || `${city}, ${region}, ${country}`.replace(/^, |, $/g, '');
            weatherSummary = data.weatherSummary || '';
            temperature = data.temperature || '';
          }
        } catch (err) {
          console.warn('Reverse geocode fetch failed:', err);
        }

        const locationData: LocationContext = {
          latitude,
          longitude,
          city,
          region,
          country,
          formattedAddress: formattedAddress || `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`,
          weatherSummary,
          temperature,
          lastUpdated: Date.now(),
          permissionGranted: true,
        };

        saveCachedLocation(locationData);
        resolve(locationData);
      },
      (err) => {
        console.warn('Geolocation acquisition error:', err.message);
        reject(err);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 min cache
      }
    );
  });
}

export function formatLocationPromptString(loc?: LocationContext | null): string {
  if (!loc || !loc.permissionGranted) return 'User Location: Not shared or unavailable';
  
  let str = `User Location: ${loc.city || ''}${loc.region ? `, ${loc.region}` : ''}${loc.country ? `, ${loc.country}` : ''} (Coordinates: ${loc.latitude.toFixed(2)}°, ${loc.longitude.toFixed(2)}°)`;
  if (loc.temperature || loc.weatherSummary) {
    str += ` | Local Weather: ${loc.temperature || ''} ${loc.weatherSummary || ''}`.trim();
  }
  return str;
}
