import { useState, useCallback } from 'react';

const STORAGE_KEY = 'atlasiq_search_history';
const MAX_ITEMS = 10;

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

export function useSearchHistory() {
  const [history, setHistory] = useState(load);

  const addSearch = useCallback((term) => {
    setHistory((prev) => {
      const filtered = prev.filter((h) => h.toLowerCase() !== term.toLowerCase());
      const next = [term, ...filtered].slice(0, MAX_ITEMS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setHistory([]);
  }, []);

  return { history, addSearch, clearHistory };
}
