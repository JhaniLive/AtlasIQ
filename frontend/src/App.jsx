import { useRef, useState, useEffect, useCallback } from 'react';
import Header from './components/Header/Header';
import Globe from './components/Globe/Globe';
import InterestInput from './components/InterestInput/InterestInput';
import CountryPanel from './components/CountryPanel/CountryPanel';
import WelcomeScreen from './components/WelcomeScreen/WelcomeScreen';
import { getCountries, getRecommendations, resolvePlace, resolvePlaceImage, getPlacePhoto, reverseGeocode } from './services/api';
import { useGlobe } from './hooks/useGlobe';
import './App.css';

// Continents with center coordinates
const CONTINENTS = {
  africa: { lat: 2.0, lng: 21.0, alt: 8000000 },
  europe: { lat: 50.0, lng: 10.0, alt: 5000000 },
  asia: { lat: 35.0, lng: 90.0, alt: 8000000 },
  'north america': { lat: 40.0, lng: -100.0, alt: 8000000 },
  'south america': { lat: -15.0, lng: -60.0, alt: 8000000 },
  oceania: { lat: -25.0, lng: 135.0, alt: 8000000 },
  australia: { lat: -25.0, lng: 135.0, alt: 5000000 },
  antarctica: { lat: -82.0, lng: 0.0, alt: 8000000 },
  'middle east': { lat: 28.0, lng: 45.0, alt: 5000000 },
  'southeast asia': { lat: 5.0, lng: 110.0, alt: 5000000 },
};

// Extract place name from natural language input
function extractPlace(input) {
  const lower = input.toLowerCase().trim();
  // Strip common prefixes
  const prefixes = [
    "let's go to ", "lets go to ", "go to ", "fly to ", "take me to ",
    "show me ", "show ", "where is ", "tell me about ", "about ",
    "i want to visit ", "visit ", "explore ",
  ];
  let place = lower;
  for (const p of prefixes) {
    if (place.startsWith(p)) {
      place = place.slice(p.length).trim();
      break;
    }
  }
  return place;
}

// Basic check: does the input look like it could contain real words?
// Rejects strings with no vowels or excessive consonant clusters
function looksLikeGibberish(text) {
  const clean = text.toLowerCase().replace(/[^a-z]/g, '');
  if (clean.length < 2) return true;
  // Must contain at least one vowel
  if (!/[aeiouy]/.test(clean)) return true;
  // Reject if >5 consonants in a row (no real English/place name does this)
  if (/[^aeiouy]{6,}/.test(clean)) return true;
  return false;
}

// Match input against countries and continents
function detectLocation(input, countries) {
  const place = extractPlace(input);
  if (!place) return null;

  // Check continents first
  for (const [name, coords] of Object.entries(CONTINENTS)) {
    if (place === name || place.includes(name)) {
      return { type: 'continent', name, ...coords };
    }
  }

  // Check countries
  for (const c of countries) {
    const name = c.name.toLowerCase();
    if (place === name || place.includes(name) || name.includes(place)) {
      return { type: 'country', country: c };
    }
  }

  return null;
}

export default function App() {
  const [showWelcome, setShowWelcome] = useState(() => {
    return !sessionStorage.getItem('atlasiq_welcomed');
  });
  const globeRef = useRef();
  const {
    countries,
    setCountries,
    setHoveredCountry,
    openTabs,
    activeTabId,
    addTab,
    removeTab,
    setActiveTabId,
    recommendations,
    setRecommendations,
    loading,
    setLoading,
    error,
    setError,
    getScoreForCountry,
    getInsightForCountry,
  } = useGlobe();

  useEffect(() => {
    getCountries()
      .then(setCountries)
      .catch(() => setError('Failed to load countries'));
  }, []);

  // Fetch photo and pin it on the globe, keyed by tabId
  const pinPhotoOnGlobe = useCallback((lat, lng, placeName, countryName, tabId) => {
    const searchName = placeName || countryName;
    if (!searchName || !globeRef.current) return;
    getPlacePhoto(searchName).then((photo) => {
      if (photo && globeRef.current) {
        const label = placeName && placeName.toLowerCase() !== countryName?.toLowerCase()
          ? `${placeName}, ${countryName}`
          : (countryName || placeName);
        globeRef.current.showPhotoAt(lat, lng, photo.thumbUrl, label, tabId);
      } else if (placeName !== countryName && countryName) {
        // Fallback: try country name
        getPlacePhoto(countryName).then((fallback) => {
          if (fallback && globeRef.current) {
            globeRef.current.showPhotoAt(lat, lng, fallback.thumbUrl, countryName, tabId);
          }
        });
      }
    });
  }, []);

  const navigateToResolved = useCallback(
    (resolved) => {
      const datasetCountry = countries.find(
        (c) => c.code === resolved.code || c.name.toLowerCase() === resolved.name.toLowerCase(),
      );
      if (datasetCountry) {
        const flyLat = resolved.lat || datasetCountry.lat;
        const flyLng = resolved.lng || datasetCountry.lng;
        const countryWithPlace = { ...datasetCountry, _placeName: resolved.place_name };
        const tabId = addTab(countryWithPlace);
        if (globeRef.current) {
          globeRef.current.flyTo(flyLat, flyLng);
        }
        pinPhotoOnGlobe(flyLat, flyLng, resolved.place_name, resolved.name, tabId);
      } else {
        const chatOnlyCountry = {
          name: resolved.name,
          code: resolved.code,
          lat: resolved.lat,
          lng: resolved.lng,
          climate: '',
          safety_index: 0, beach_score: 0, nightlife_score: 0,
          cost_of_living: 0, sightseeing_score: 0, cultural_score: 0,
          adventure_score: 0, food_score: 0, infrastructure_score: 0,
          _chatOnly: true,
          _placeName: resolved.place_name,
        };
        const tabId = addTab(chatOnlyCountry);
        if (resolved.lat && resolved.lng) {
          globeRef.current?.flyTo(resolved.lat, resolved.lng);
          pinPhotoOnGlobe(resolved.lat, resolved.lng, resolved.place_name, resolved.name, tabId);
        }
      }
    },
    [countries, pinPhotoOnGlobe, addTab],
  );

  const handleExplore = useCallback(
    async (interests) => {
      setError(null);

      // 1. Fast static check: continents + dataset countries (instant, no API call)
      const location = detectLocation(interests, countries);
      if (location) {
        if (location.type === 'country') {
          const tabId = addTab(location.country);
          if (globeRef.current) {
            globeRef.current.flyTo(location.country.lat, location.country.lng);
          }
          pinPhotoOnGlobe(location.country.lat, location.country.lng, null, location.country.name, tabId);
        } else {
          if (globeRef.current) {
            globeRef.current.flyTo(location.lat, location.lng, location.alt);
          }
        }
        return;
      }

      // 2. AI resolution: let the AI figure out if this is a place (city, landmark, country, region)
      const place = extractPlace(interests);
      if (looksLikeGibberish(place)) {
        setError('That doesn\'t look like a real place. Try a city, country, or landmark name.');
        return;
      }
      setLoading(true);
      try {
        const resolved = await resolvePlace(place);
        if (resolved && resolved.name) {
          navigateToResolved(resolved);
          setLoading(false);
          return;
        }
      } catch {
        // AI resolution failed — fall through to recommendations
      }

      // 3. Recommendation flow: AI didn't recognize a specific place, treat as interest query
      try {
        const data = await getRecommendations(interests);
        setRecommendations(data);
        if (data.rankings.length > 0) {
          const topCode = data.rankings[0].code;
          const topCountry = countries.find((c) => c.code === topCode);
          if (topCountry) {
            const score = data.rankings[0].score;
            const insight = data.rankings[0].insight;
            const tabId = addTab(topCountry, score, insight);
            if (globeRef.current) {
              globeRef.current.flyTo(topCountry.lat, topCountry.lng, 3000000);
            }
            pinPhotoOnGlobe(topCountry.lat, topCountry.lng, null, topCountry.name, tabId);
          }
        }
      } catch {
        setError('Failed to get recommendations. Check your API key and try again.');
      } finally {
        setLoading(false);
      }
    },
    [countries, pinPhotoOnGlobe, addTab, navigateToResolved],
  );

  const handleImageExplore = useCallback(
    async (imageDataUrl) => {
      setError(null);
      setLoading(true);
      try {
        const resolved = await resolvePlaceImage(imageDataUrl);
        if (resolved && resolved.name) {
          navigateToResolved(resolved);
        } else {
          setError('Could not identify a place in this image');
        }
      } catch {
        setError('Failed to analyze the image. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [navigateToResolved],
  );

  const handleCountryClick = useCallback(
    (country, clickLat, clickLng) => {
      if (!country) return;
      const lat = clickLat || country.lat;
      const lng = clickLng || country.lng;

      // Reverse-geocode the click point to get city/state name
      reverseGeocode(lat, lng).then((placeName) => {
        const enriched = placeName
          ? { ...country, _placeName: placeName, lat, lng }
          : { ...country, lat, lng };
        const tabId = addTab(enriched);
        if (globeRef.current) {
          globeRef.current.flyTo(lat, lng);
        }
        pinPhotoOnGlobe(lat, lng, placeName, country.name, tabId);
      });
    },
    [pinPhotoOnGlobe, addTab],
  );

  const handleTabClose = useCallback((tabId) => {
    removeTab(tabId);
    globeRef.current?.removePhotoMarker(tabId);
  }, [removeTab]);

  const handleWelcomeDone = useCallback(() => {
    sessionStorage.setItem('atlasiq_welcomed', '1');
    setShowWelcome(false);
  }, []);

  return (
    <div className="app">
      {showWelcome && <WelcomeScreen onStart={handleWelcomeDone} />}

      <Header />

      <Globe
        ref={globeRef}
        countries={countries}
        recommendations={recommendations}
        onCountryHover={setHoveredCountry}
        onCountryClick={handleCountryClick}
      />

      <InterestInput onSubmit={handleExplore} onImageSubmit={handleImageExplore} loading={loading} />

      <CountryPanel
        tabs={openTabs}
        activeTabId={activeTabId}
        onTabChange={setActiveTabId}
        onTabClose={handleTabClose}
        recommendations={recommendations}
        getScoreForCountry={getScoreForCountry}
        getInsightForCountry={getInsightForCountry}
      />

      {loading && (
        <div className="app__loading">
          <div className="app__loading-spinner" />
          <span className="app__loading-text">Analyzing your interests...</span>
        </div>
      )}

      {error && <div className="app__error">{error}</div>}
    </div>
  );
}
