import axios from 'axios';
import { API_URL } from '../utils/constants';

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
export async function getPlacePhoto(placeName) {
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

// Reverse geocode coordinates to a city/state name (free Nominatim API)
export async function reverseGeocode(lat, lng) {
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

export async function chatAboutCountry(message, countryCode = '', countryName = '') {
  const { data } = await client.post('/chat', {
    message,
    country_code: countryCode,
    country_name: countryName,
  });
  return data;
}
