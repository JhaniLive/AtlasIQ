import { useRef, useCallback } from 'react';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function useGeolocation() {
  const cacheRef = useRef({ lat: null, lng: null, ts: 0 });

  const requestLocation = useCallback(() => {
    return new Promise((resolve, reject) => {
      // Return cached position if fresh enough
      const cached = cacheRef.current;
      if (cached.lat !== null && Date.now() - cached.ts < CACHE_TTL) {
        return resolve({ lat: cached.lat, lng: cached.lng });
      }

      if (!navigator.geolocation) {
        return reject(new Error('Geolocation is not supported by your browser'));
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const result = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };
          cacheRef.current = { ...result, ts: Date.now() };
          resolve(result);
        },
        (err) => {
          const messages = {
            1: 'Location access denied. Please enable location permissions.',
            2: 'Could not determine your location. Please try again.',
            3: 'Location request timed out. Please try again.',
          };
          reject(new Error(messages[err.code] || 'Failed to get location'));
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: CACHE_TTL,
        },
      );
    });
  }, []);

  return { requestLocation };
}
