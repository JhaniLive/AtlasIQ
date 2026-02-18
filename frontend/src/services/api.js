import axios from 'axios';
import { API_URL } from '../utils/constants';

function withCache(fn, prefix, ttlMs = 300000) {
  return async (...args) => {
    const key = `atlasiq_${prefix}_${JSON.stringify(args)}`;
    try {
      const cached = sessionStorage.getItem(key);
      if (cached) {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < ttlMs) return data;
      }
    } catch {}
    const result = await fn(...args);
    try {
      sessionStorage.setItem(key, JSON.stringify({ data: result, ts: Date.now() }));
    } catch {}
    return result;
  };
}

const client = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 120000,
});

export async function getCountries() {
  const { data } = await client.get('/countries');
  return data;
}

export async function getCountryByCode(code) {
  const { data } = await client.get(`/countries/${code}`);
  return data;
}

export async function getRecommendations(interests) {
  const { data } = await client.post('/recommendations', { interests });
  return data;
}

export async function resolvePlace(place) {
  const { data } = await client.post('/resolve-place', { place });
  return data;
}

export async function resolvePlaceImage(imageDataUrl) {
  const { data } = await client.post('/resolve-place-image', { image: imageDataUrl });
  return data;
}

// Fetch a photo for a place from Wikipedia (free, no key needed)
async function _getPlacePhoto(placeName) {
  if (!placeName) return null;
  try {
    const encoded = encodeURIComponent(placeName);
    const res = await axios.get(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`,
      { timeout: 8000 },
    );
    const original = res.data?.originalimage;
    const thumb = res.data?.thumbnail;
    const img = original || thumb;
    if (img?.source) {
      return {
        url: img.source,
        thumbUrl: thumb?.source || img.source,
        width: img.width,
        height: img.height,
        description: res.data?.description || '',
      };
    }
    return null;
  } catch {
    return null;
  }
}
export const getPlacePhoto = withCache(_getPlacePhoto, 'photo');

// Reverse geocode coordinates to a city/state name (free Nominatim API)
async function _reverseGeocode(lat, lng) {
  try {
    const res = await axios.get(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10&addressdetails=1`,
      { timeout: 6000, headers: { 'User-Agent': 'AtlasIQ/1.0' } },
    );
    const addr = res.data?.address;
    if (!addr) return null;
    const placeName = addr.city || addr.town || addr.village || addr.state || addr.county || null;
    return placeName;
  } catch {
    return null;
  }
}
export const reverseGeocode = withCache(_reverseGeocode, 'geo');

export async function searchNearbyPlaces(query, lat, lng, radius = 5000, maxResults = 10) {
  const { data } = await client.post('/places/nearby', {
    query,
    latitude: lat,
    longitude: lng,
    radius,
    max_results: maxResults,
  });
  return data;
}

export async function chatAboutCountry(message, countryCode = '', countryName = '', history = [], useAgent = true, userLat = null, userLng = null, placeLat = null, placeLng = null) {
  const body = {
    message,
    country_code: countryCode,
    country_name: countryName,
    history,
    use_agent: useAgent,
  };
  if (userLat != null && userLng != null) {
    body.user_lat = userLat;
    body.user_lng = userLng;
  }
  if (placeLat != null && placeLng != null) {
    body.place_lat = placeLat;
    body.place_lng = placeLng;
  }
  const { data } = await client.post('/chat', body);
  return data;
}

export async function generateTripSummary(tripData) {
  const { data } = await client.post('/trip-summary', tripData);
  return data;
}
