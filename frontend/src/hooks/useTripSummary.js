import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { generateTripSummary } from '../services/api';

const USERNAME_KEY = 'atlasiq_summary_username';

function loadUserName() {
  try { return localStorage.getItem(USERNAME_KEY) || ''; }
  catch { return ''; }
}

/**
 * Builds a flat array of summary items from live session data.
 * Each item: { id, type, data, included }
 */
function buildItems(openTabs, chatMap, bookmarks, searchHistory, excludedIds, removedIds) {
  const items = [];

  // Countries from open tabs
  for (const tab of openTabs) {
    const id = `country_${tab.id}`;
    if (removedIds.has(id)) continue;
    items.push({
      id,
      type: 'country',
      data: {
        name: tab.country.name,
        code: tab.country.code,
        placeName: tab.country._placeName || '',
      },
      included: !excludedIds.has(id),
    });
  }

  // Searches
  for (const term of searchHistory) {
    const id = `search_${term.toLowerCase().replace(/\s+/g, '_')}`;
    if (removedIds.has(id)) continue;
    items.push({
      id,
      type: 'search',
      data: { term },
      included: !excludedIds.has(id),
    });
  }

  // Chat Q&A pairs + places from chat messages
  for (const [tabId, messages] of chatMap.entries()) {
    const tab = openTabs.find(t => t.id === tabId);
    const countryName = tab
      ? (tab.country._placeName && tab.country._placeName.toLowerCase() !== tab.country.name.toLowerCase()
        ? `${tab.country._placeName}, ${tab.country.name}`
        : tab.country.name)
      : 'Unknown';

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];

      // Chat Q&A: pair user question with next AI answer
      if (msg.role === 'user') {
        const answer = messages[i + 1];
        const chatId = `chat_${tabId}_${i}`;
        if (removedIds.has(chatId)) continue;
        items.push({
          id: chatId,
          type: 'chat',
          data: {
            question: msg.text,
            answer: answer?.role === 'ai' ? answer.text : '',
            countryName,
          },
          included: !excludedIds.has(chatId),
        });
      }

      // Places from AI messages
      if (msg.role === 'ai' && msg.places?.length > 0) {
        const placesId = `places_${tabId}_${i}`;
        if (removedIds.has(placesId)) continue;
        items.push({
          id: placesId,
          type: 'places',
          data: {
            places: msg.places,
            countryName,
          },
          included: !excludedIds.has(placesId),
        });
      }
    }
  }

  // Bookmarks
  for (const bm of bookmarks) {
    const id = `bookmark_${bm.code}`;
    if (removedIds.has(id)) continue;
    items.push({
      id,
      type: 'bookmark',
      data: { name: bm.name, code: bm.code, placeName: bm.placeName || '' },
      included: !excludedIds.has(id),
    });
  }

  return items;
}

export function useTripSummary({ openTabs, chatMap, bookmarks, searchHistory }) {
  const [excludedIds, setExcludedIds] = useState(new Set());
  const [removedIds, setRemovedIds] = useState(new Set());
  const [userName, _setUserName] = useState(loadUserName);
  const [aiConclusion, setAiConclusion] = useState(null);
  const [conclusionLoading, setConclusionLoading] = useState(false);

  const summaryItems = useMemo(
    () => buildItems(openTabs, chatMap, bookmarks, searchHistory, excludedIds, removedIds),
    [openTabs, chatMap, bookmarks, searchHistory, excludedIds, removedIds],
  );

  const itemCount = useMemo(
    () => summaryItems.filter(i => i.included).length,
    [summaryItems],
  );

  // Auto-clear AI conclusion when underlying data changes (new searches/chats/places)
  // so user is prompted to regenerate with fresh data
  const prevItemIdsRef = useRef('');
  useEffect(() => {
    const currentIds = summaryItems.map(i => i.id).join(',');
    if (prevItemIdsRef.current && currentIds !== prevItemIdsRef.current) {
      setAiConclusion(null);
    }
    prevItemIdsRef.current = currentIds;
  }, [summaryItems]);

  const toggleItem = useCallback((id) => {
    setExcludedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const removeItem = useCallback((id) => {
    setRemovedIds(prev => new Set(prev).add(id));
  }, []);

  const setUserName = useCallback((name) => {
    _setUserName(name);
    try { localStorage.setItem(USERNAME_KEY, name); } catch {}
  }, []);

  const getIncludedItems = useCallback(() => {
    return summaryItems.filter(i => i.included);
  }, [summaryItems]);

  const generateConclusion = useCallback(async () => {
    const included = summaryItems.filter(i => i.included);
    if (included.length === 0) return;

    const countries = included.filter(i => i.type === 'country').map(i => i.data);
    const searches = included.filter(i => i.type === 'search').map(i => i.data.term);
    const chatHighlights = included.filter(i => i.type === 'chat').map(i => ({
      question: i.data.question,
      answer: i.data.answer?.slice(0, 500) || '',
      country: i.data.countryName,
    }));
    const places = included.filter(i => i.type === 'places').flatMap(i =>
      i.data.places.map(p => ({
        name: p.name,
        rating: p.rating || 0,
        country: i.data.countryName,
      })),
    );
    const bms = included.filter(i => i.type === 'bookmark').map(i => i.data);

    setConclusionLoading(true);
    try {
      const res = await generateTripSummary({
        countries,
        searches,
        chat_highlights: chatHighlights,
        places,
        bookmarks: bms,
        user_name: userName || undefined,
      });
      setAiConclusion(res.conclusion);
    } catch {
      setAiConclusion('Failed to generate conclusion. Please try again.');
    } finally {
      setConclusionLoading(false);
    }
  }, [summaryItems, userName]);

  const clearSummary = useCallback(() => {
    setExcludedIds(new Set());
    setRemovedIds(new Set());
    setAiConclusion(null);
  }, []);

  return {
    summaryItems,
    itemCount,
    userName,
    setUserName,
    aiConclusion,
    conclusionLoading,
    toggleItem,
    removeItem,
    generateConclusion,
    getIncludedItems,
    clearSummary,
  };
}
