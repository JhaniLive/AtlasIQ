import { useState, useCallback, useRef } from 'react';

export function useGlobe() {
  const [countries, setCountries] = useState([]);
  const [hoveredCountry, setHoveredCountry] = useState(null);
  const [openTabs, setOpenTabs] = useState([]);
  const openTabsRef = useRef([]);
  // Each tab: { id, country, score, insight }
  const [activeTabId, setActiveTabId] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const addTab = useCallback((country, score = null, insight = null) => {
    // Read synchronously from ref to avoid React batching issues
    const current = openTabsRef.current;
    const existing = current.find(
      t => t.country.code === country.code && t.country._placeName === country._placeName
    );
    if (existing) {
      setActiveTabId(existing.id);
      return existing.id;
    }
    const id = `${country.code || country.name}_${Date.now()}`;
    const newTab = { id, country, score, insight };
    openTabsRef.current = [...current, newTab];
    setOpenTabs(openTabsRef.current);
    setActiveTabId(id);
    return id;
  }, []);

  const removeTab = useCallback((tabId) => {
    const next = openTabsRef.current.filter(t => t.id !== tabId);
    openTabsRef.current = next;
    setOpenTabs(next);
    setActiveTabId(current => {
      if (current === tabId && next.length > 0) {
        return next[next.length - 1].id;
      } else if (next.length === 0) {
        return null;
      }
      return current;
    });
  }, []);

  const activeTab = openTabs.find(t => t.id === activeTabId) || null;

  const getScoreForCountry = useCallback(
    (code) => {
      if (!recommendations) return null;
      const match = recommendations.rankings.find((r) => r.code === code);
      return match ? match.score : null;
    },
    [recommendations],
  );

  const getInsightForCountry = useCallback(
    (code) => {
      if (!recommendations) return null;
      const match = recommendations.rankings.find((r) => r.code === code);
      return match ? match.insight : null;
    },
    [recommendations],
  );

  return {
    countries,
    setCountries,
    hoveredCountry,
    setHoveredCountry,
    openTabs,
    activeTabId,
    activeTab,
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
  };
}
