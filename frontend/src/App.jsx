import { useRef, useState, useEffect, useCallback } from 'react';
import Header from './components/Header/Header';
import Globe from './components/Globe/Globe';
import InterestInput from './components/InterestInput/InterestInput';
import CountryPanel from './components/CountryPanel/CountryPanel';
import PlacesPanel from './components/PlacesPanel/PlacesPanel';
import WelcomeScreen from './components/WelcomeScreen/WelcomeScreen';
import TripSummaryPanel from './components/TripSummaryPanel/TripSummaryPanel';
import { getCountries, getRecommendations, resolvePlace, resolvePlaceImage, getPlacePhoto, reverseGeocode, searchNearbyPlaces } from './services/api';
import { useGlobe } from './hooks/useGlobe';
import { useSearchHistory } from './hooks/useSearchHistory';
import { useBookmarks } from './hooks/useBookmarks';
import { useGeolocation } from './hooks/useGeolocation';
import { useTripSummary } from './hooks/useTripSummary';
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

// Common greetings / non-place words that the AI might misinterpret
const NON_PLACE_WORDS = new Set([
  'hi', 'hello', 'hey', 'yo', 'sup', 'ok', 'yes', 'no', 'thanks', 'thank',
  'bye', 'help', 'please', 'test', 'lol', 'wow', 'cool', 'nice', 'good',
  'bad', 'what', 'how', 'why', 'who', 'when', 'where', 'the', 'hola', 'ciao',
]);

// Detect if input is a question/command for the agent rather than a place name
const AGENT_PATTERNS = [
  /^(compare|vs\.?|versus)\b/i,
  /\b(compare|vs\.?|versus|compared to)\b.*\b(and|with|to)\b/i,
  /^(which|what|how|why|who|where|when|is|are|do|does|can|should|rank|list|top|best|worst|safest|cheapest)\b/i,
  /\?$/,
  // Topic queries that should go to agent, not place resolution
  /\b(news|weather|forecast|temperature|climate|events?|festivals?|tips?|advice|guide|budget|cost|safety|visa|currency|language|culture|traditions?|history|facts?|trivia)\b/i,
];

// Place-related queries that should go through the agent, not recommendations
const PLACES_PATTERNS = [
  /\b(restaurants?|food|eat|eating|dine|dining|cafe|cafes|coffee|bakery|bakeries|dessert|brunch|breakfast|lunch|dinner|street\s+food)\b/i,
  /\b(hotels?|hostels?|resorts?|stays?|accommodation|lodge|motel|guesthouse)\b/i,
  /\b(shopping|mall|market|bazaar|stores?|boutique|souvenir)\b/i,
  /\b(attractions?|sightseeing|museums?|temples?|church|mosque|monuments?|landmarks?|parks?|gardens?|zoo|aquarium|palace|fort|castle|gallery|galleries)\b/i,
  /\b(nightlife|clubs?|disco|lounge|pubs?|bars?|brewery|breweries|rooftop)\b/i,
  /\b(places?\s+to\s+(visit|go|see|eat|stay|shop|explore))\b/i,
  /\b(things?\s+to\s+do)\b/i,
  /\b(where\s+to\s+(eat|stay|shop|visit|go|drink))\b/i,
  /\b(what\s+to\s+(eat|see|do|visit))\b/i,
];

const NEAR_ME_PATTERN = /\bnear\s+me\b/i;

// Catches all variations of "where am I" / "find my location" / "which place am I in"
function isLocateMeQuery(input) {
  const lower = input.toLowerCase();
  // Direct phrases
  if (/\b(locate\s+me|find\s+me|where\s+am\s+i|where\s+i\s+am|where\s+i'?m\s+at)\b/.test(lower)) return true;
  if (/\b(my\s+(current\s+)?location|my\s+place|my\s+position|current\s+location)\b/.test(lower)) return true;
  if (/\b(show|find|detect|identify|pinpoint|tell)\b.*(my\s+location|where\s+i)/.test(lower)) return true;
  // "which/what place/city/country am I in" or "i'm in"
  if (/\b(which|what)\b.*(place|city|country|location)\b.*(am\s+i|i'?m)\s+in\b/.test(lower)) return true;
  // "find out where I am"
  if (/\bfind\s+(out\s+)?where\s+i\b/.test(lower)) return true;
  // "what is my location"
  if (/\bwhat\s+is\s+my\s+(location|position|place)\b/.test(lower)) return true;
  // "am I in" as a question about current position (e.g. "what country am I in")
  if (/\b(what|which)\b.*\bam\s+i\s+in\b/.test(lower)) return true;
  return false;
}

function isAgentQuery(input) {
  const trimmed = input.trim();
  return AGENT_PATTERNS.some(pattern => pattern.test(trimmed))
    || PLACES_PATTERNS.some(pattern => pattern.test(trimmed));
}

// Basic check: does the input look like it could contain real words?
// Rejects strings with no vowels, excessive consonant clusters, or common non-place words
function looksLikeGibberish(text) {
  const clean = text.toLowerCase().replace(/[^a-z]/g, '');
  if (clean.length < 3) return true;
  // Reject common greetings and non-place words
  if (NON_PLACE_WORDS.has(clean)) return true;
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

  // Check countries (require at least 3 chars for substring match to avoid false positives like "hi" → Philippines)
  for (const c of countries) {
    const name = c.name.toLowerCase();
    if (place === name || place.includes(name) || (place.length >= 3 && name.startsWith(place))) {
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

  const [activePlaces, setActivePlaces] = useState(null);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [chatMap, setChatMap] = useState(new Map());
  const [showSummary, setShowSummary] = useState(false);

  const { history: searchHistory, addSearch, clearHistory } = useSearchHistory();
  const { bookmarks, toggleBookmark, isBookmarked } = useBookmarks();
  const { requestLocation } = useGeolocation();

  const {
    summaryItems, itemCount, userName, setUserName,
    aiConclusion, conclusionLoading, toggleItem, removeItem,
    generateConclusion, getIncludedItems,
  } = useTripSummary({ openTabs, chatMap, bookmarks, searchHistory });

  useEffect(() => {
    getCountries()
      .then(setCountries)
      .catch(() => setError('Failed to load countries'));
  }, []);

  // Handle ?place= URL param for sharing
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const place = params.get('place');
    if (place && countries.length > 0) {
      handleExplore(place);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [countries]);

  // Auto-dismiss errors after 6 seconds
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(timer);
  }, [error]);

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
    (resolved, initialMessage) => {
      const datasetCountry = countries.find(
        (c) => c.code === resolved.code || c.name.toLowerCase() === resolved.name.toLowerCase(),
      );
      if (datasetCountry) {
        const flyLat = resolved.lat || datasetCountry.lat;
        const flyLng = resolved.lng || datasetCountry.lng;
        const countryWithPlace = {
          ...datasetCountry,
          _placeName: resolved.place_name,
          ...(initialMessage ? { _initialMessage: initialMessage } : {}),
        };
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
          ...(initialMessage ? { _initialMessage: initialMessage } : {}),
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

  // Helper: open a generic agent chat tab (no globe navigation)
  const _openAgentTab = useCallback((query) => {
    const shortLabel = query.length > 30 ? query.slice(0, 30) + '...' : query;
    addTab({
      name: 'AtlasIQ Agent',
      code: `_agent_${Date.now()}`,
      lat: 0, lng: 0, climate: '',
      safety_index: 0, beach_score: 0, nightlife_score: 0,
      cost_of_living: 0, sightseeing_score: 0, cultural_score: 0,
      adventure_score: 0, food_score: 0, infrastructure_score: 0,
      _chatOnly: true,
      _placeName: shortLabel,
      _initialMessage: query,
    });
  }, [addTab]);

  const handleExplore = useCallback(
    async (interests) => {
      setError(null);
      addSearch(interests);

      // 0. "Near me" detection: local places search with geolocation
      if (NEAR_ME_PATTERN.test(interests)) {
        setLoading(true);
        try {
          const { lat, lng } = await requestLocation();
          const data = await searchNearbyPlaces(interests, lat, lng);
          if (data.places && data.places.length > 0) {
            globeRef.current?.flyTo(lat, lng);
            globeRef.current?.showPlacePins(data.places);
            setActivePlaces(data.places);
            setSelectedPlace(null);
          } else {
            setError('No places found near your location. Try a different search.');
          }
        } catch (err) {
          setError(err.message || 'Failed to search nearby places');
        } finally {
          setLoading(false);
        }
        return;
      }

      // 0b. "Locate me" / "where am I" detection: fly to user's position
      if (isLocateMeQuery(interests)) {
        setLoading(true);
        try {
          const { lat, lng } = await requestLocation();
          globeRef.current?.flyTo(lat, lng);
          const placeName = await reverseGeocode(lat, lng);
          // Find the country from reverse geocode or just show the location
          const resolved = await resolvePlace(placeName || `${lat},${lng}`);
          if (resolved && resolved.name) {
            navigateToResolved(resolved);
          } else if (placeName) {
            // Couldn't resolve to a country, but we have a place name
            setError(null);
          }
        } catch (err) {
          setError(err.message || 'Failed to get your location. Please enable location permissions.');
        } finally {
          setLoading(false);
        }
        return;
      }

      // ── Step 1: Try to find a location in the query ──
      // This works for ALL query types: "go to London", "best biryani in Hyderabad",
      // "compare Japan and Thailand", "sightseeing in USA", etc.
      const agentQuery = isAgentQuery(interests);

      // 1a. Fast static check: continents + dataset countries (instant)
      const location = detectLocation(interests, countries);
      if (location) {
        if (location.type === 'country') {
          // For agent queries: navigate AND start agent chat
          if (agentQuery) {
            // Agent will handle places search via CountryPanel's auto-send
            // (react_agent pre-calls Google Places with proper location context)
            const countryWithChat = { ...location.country, _initialMessage: interests };
            addTab(countryWithChat);
            if (globeRef.current) globeRef.current.flyTo(location.country.lat, location.country.lng);
            pinPhotoOnGlobe(location.country.lat, location.country.lng, null, location.country.name);
          } else {
            // Simple navigation
            const tabId = addTab(location.country);
            if (globeRef.current) globeRef.current.flyTo(location.country.lat, location.country.lng);
            pinPhotoOnGlobe(location.country.lat, location.country.lng, null, location.country.name, tabId);
          }
        } else {
          // Continent
          if (globeRef.current) globeRef.current.flyTo(location.lat, location.lng, location.alt);
        }
        return;
      }

      // 1b. AI resolution: try to find a place/city/landmark in the query
      const place = extractPlace(interests);
      const gibberish = looksLikeGibberish(place);

      // For agent queries, always try AI resolution (send full sentence so AI
      // can extract "Hyderabad" from "best biryani in Hyderabad")
      if (!gibberish || agentQuery) {
        setLoading(true);
        try {
          const resolved = await resolvePlace(agentQuery ? interests : place);
          if (resolved && resolved.name) {
            // Agent will handle places search via CountryPanel's auto-send
            navigateToResolved(resolved, agentQuery ? interests : null);
            setLoading(false);
            return;
          }
        } catch (err) {
          console.error('[AtlasIQ] resolvePlace failed:', err?.response?.status || err?.message || err);
          // If API key is invalid (401), show clear error and stop
          if (err?.response?.status === 401) {
            setError('API key is invalid or expired. Please update your OpenRouter API key.');
            setLoading(false);
            return;
          }
          // Otherwise fall through
        }
      }

      // ── Step 2: No location found ──

      // Agent query with no resolvable location → agent-only chat
      if (agentQuery) {
        _openAgentTab(interests);
        setLoading(false);
        return;
      }

      // Non-agent gibberish → error
      if (gibberish) {
        setError('That doesn\'t look like a real place. Try a city, country, or landmark name.');
        setLoading(false);
        return;
      }

      // 3. Recommendation flow: treat as interest query
      if (!loading) setLoading(true);
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
      } catch (err) {
        const status = err?.response?.status;
        if (status === 401) {
          setError('API key is invalid or expired. Please update your OpenRouter API key.');
        } else {
          setError('Failed to get recommendations. Check your API key and try again.');
        }
      } finally {
        setLoading(false);
      }
    },
    [countries, pinPhotoOnGlobe, addTab, navigateToResolved, _openAgentTab],
  );

  const handleImageExplore = useCallback(
    async (imageDataUrl, message) => {
      setError(null);
      setLoading(true);
      try {
        const resolved = await resolvePlaceImage(imageDataUrl);
        if (resolved && resolved.name) {
          navigateToResolved(resolved, message || null);
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
    globeRef.current?.clearPlacePins();
    setActivePlaces(null);
    setSelectedPlace(null);
  }, [removeTab]);

  // Allow CountryPanel to fly the globe (e.g. when agent finds places)
  const handleFlyTo = useCallback((lat, lng) => {
    if (globeRef.current && lat && lng) globeRef.current.flyTo(lat, lng);
  }, []);

  // Pin places on the 3D globe + show PlacesPanel
  const handleShowPlacePins = useCallback((data) => {
    if (data?.places?.length > 0) {
      globeRef.current?.showPlacePins(data.places);
      setActivePlaces(data.places);
      setSelectedPlace(null);
    }
  }, []);

  const handleClearPlaces = useCallback(() => {
    globeRef.current?.clearPlacePins();
    setActivePlaces(null);
    setSelectedPlace(null);
  }, []);

  const handlePlaceSelect = useCallback((place) => {
    setSelectedPlace(place);
    if (place) globeRef.current?.highlightPlacePin(place);
  }, []);

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
        onPlaceSelect={handlePlaceSelect}
      />

      <InterestInput
        onSubmit={handleExplore}
        onImageSubmit={handleImageExplore}
        loading={loading}
        searchHistory={searchHistory}
        onClearHistory={clearHistory}
      />

      <CountryPanel
        tabs={openTabs}
        activeTabId={activeTabId}
        onTabChange={setActiveTabId}
        onTabClose={handleTabClose}
        recommendations={recommendations}
        getScoreForCountry={getScoreForCountry}
        getInsightForCountry={getInsightForCountry}
        onBookmarkToggle={toggleBookmark}
        isBookmarked={isBookmarked}
        onShowLocalPlaces={handleShowPlacePins}
        onFlyTo={handleFlyTo}
        requestLocation={requestLocation}
        chatMap={chatMap}
        setChatMap={setChatMap}
      />

      {activePlaces && (
        <PlacesPanel
          places={activePlaces}
          onClose={handleClearPlaces}
          onPlaceSelect={handlePlaceSelect}
          selectedPlace={selectedPlace}
        />
      )}

      {!showSummary && itemCount > 0 && (
        <button className="trip-fab" onClick={() => setShowSummary(true)} title="Trip Summary">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 2H12L15 5V16H3V2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M6 9H12M6 12H10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
          <span>Summary</span>
          <span className="trip-fab__badge">{itemCount}</span>
        </button>
      )}

      {showSummary && (
        <TripSummaryPanel
          items={summaryItems}
          userName={userName}
          onSetUserName={setUserName}
          aiConclusion={aiConclusion}
          conclusionLoading={conclusionLoading}
          onToggleItem={toggleItem}
          onRemoveItem={removeItem}
          onGenerateConclusion={generateConclusion}
          onClose={() => setShowSummary(false)}
          getIncludedItems={getIncludedItems}
        />
      )}

      {loading && (
        <div className="app__loading">
          <div className="app__loading-spinner" />
          <span className="app__loading-text">Analyzing your interests...</span>
        </div>
      )}

      {error && (
        <div className="app__error">
          <span>{error}</span>
          <button className="app__error-close" onClick={() => setError(null)} aria-label="Dismiss">&times;</button>
        </div>
      )}
    </div>
  );
}
