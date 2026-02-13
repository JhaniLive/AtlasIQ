import { useState, useCallback } from 'react';

const STORAGE_KEY = 'atlasiq_bookmarks';

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState(load);

  const toggleBookmark = useCallback((country) => {
    setBookmarks((prev) => {
      const exists = prev.find((b) => b.code === country.code);
      const next = exists
        ? prev.filter((b) => b.code !== country.code)
        : [...prev, { code: country.code, name: country.name, placeName: country._placeName || '' }];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isBookmarked = useCallback((code) => {
    return bookmarks.some((b) => b.code === code);
  }, [bookmarks]);

  return { bookmarks, toggleBookmark, isBookmarked };
}
