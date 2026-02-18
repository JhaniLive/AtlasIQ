import { useState, useRef, useCallback, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { chatAboutCountry, getPlacePhoto, searchNearbyPlaces } from '../../services/api';
import './CountryPanel.css';

const QUICK_TOPICS = [
  { label: 'Overview', prompt: (name) => `Give me a brief overview of ${name}` },
  { label: 'Culture', prompt: (name) => `Tell me about the culture and traditions of ${name}` },
  { label: 'Cuisine', prompt: (name) => `What are the must-try local dishes and food in ${name}?` },
  { label: 'Safety', prompt: (name) => `How safe is ${name} for tourists? Any tips?` },
  { label: 'Top Places', prompt: (name) => `What are the top places to visit in ${name}?` },
  { label: 'Best Time', prompt: (name) => `When is the best time to visit ${name}?` },
  { label: 'Budget', prompt: (name) => `What is the average travel budget needed for ${name}?` },
  { label: 'Language', prompt: (name) => `What languages are spoken in ${name}? Useful phrases?` },
];

export default function CountryPanel({
  tabs,
  activeTabId,
  onTabChange,
  onTabClose,
  recommendations,
  getScoreForCountry,
  getInsightForCountry,
  onBookmarkToggle,
  isBookmarked,
  onShowLocalPlaces,
  onFlyTo,
  requestLocation,
}) {
  // Per-tab state maps
  const [chatMap, setChatMap] = useState(new Map());
  const [photoMap, setPhotoMap] = useState(new Map());
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [chatFocused, setChatFocused] = useState(false);
  const [position, setPosition] = useState({ x: null, y: null });
  const [size, setSize] = useState({ width: 340, height: null });
  const [photoLoading, setPhotoLoading] = useState(false);
  const dragRef = useRef(null);
  const resizeRef = useRef(null);
  const panelRef = useRef(null);
  const messagesEndRef = useRef(null);
  const prevTabIdRef = useRef(null);

  const activeTab = tabs.find(t => t.id === activeTabId) || null;
  const country = activeTab?.country || null;

  // Get score/insight from the tab object or via helper functions
  const score = activeTab?.score ?? (country ? getScoreForCountry(country.code) : null);
  const insight = activeTab?.insight ?? (country ? getInsightForCountry(country.code) : null);

  // Get messages for current tab
  const messages = (activeTabId && chatMap.get(activeTabId)) || [];
  const photo = (activeTabId && photoMap.get(activeTabId)) || null;

  // Fetch photo when active tab changes to a new country
  useEffect(() => {
    if (!activeTabId || !country) return;
    // Already have photo for this tab
    if (photoMap.has(activeTabId)) return;

    let cancelled = false;
    setPhotoLoading(true);

    const searchName = country._placeName || country.name;
    getPlacePhoto(searchName).then((result) => {
      if (cancelled) return;
      if (result) {
        setPhotoMap(prev => new Map(prev).set(activeTabId, result));
        setPhotoLoading(false);
      } else if (searchName !== country.name) {
        return getPlacePhoto(country.name).then((fallback) => {
          if (!cancelled) {
            if (fallback) setPhotoMap(prev => new Map(prev).set(activeTabId, fallback));
            setPhotoLoading(false);
          }
        });
      } else {
        setPhotoLoading(false);
      }
    }).catch(() => { if (!cancelled) setPhotoLoading(false); });

    return () => { cancelled = true; };
  }, [activeTabId, country?.code, country?.name, country?._placeName]);

  // Reset chat input and chat-focused mode when switching tabs
  useEffect(() => {
    if (activeTabId !== prevTabIdRef.current) {
      setChatInput('');
      setChatFocused(false);
      prevTabIdRef.current = activeTabId;
    }
  }, [activeTabId]);


  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatLoading]);

  // Clean up maps when a tab is closed (called from parent via onTabClose, but we also
  // clean our internal maps by diffing tabs)
  useEffect(() => {
    const tabIds = new Set(tabs.map(t => t.id));
    setChatMap(prev => {
      let changed = false;
      const next = new Map(prev);
      for (const key of next.keys()) {
        if (!tabIds.has(key)) { next.delete(key); changed = true; }
      }
      return changed ? next : prev;
    });
    setPhotoMap(prev => {
      let changed = false;
      const next = new Map(prev);
      for (const key of next.keys()) {
        if (!tabIds.has(key)) { next.delete(key); changed = true; }
      }
      return changed ? next : prev;
    });
  }, [tabs]);

  // Drag logic
  const onMouseDown = useCallback((e) => {
    if (
      e.target.closest('.country-panel__chat-input') ||
      e.target.closest('.country-panel__chat-btn') ||
      e.target.closest('.country-panel__close') ||
      e.target.closest('.country-panel__minimize') ||
      e.target.closest('.country-panel__pill') ||
      e.target.closest('.country-panel__tab') ||
      e.target.closest('.country-panel__resize-r') ||
      e.target.closest('.country-panel__resize-b') ||
      e.target.closest('.country-panel__resize-rb')
    ) return;
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    dragRef.current = { offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top };

    const onMouseMove = (e) => {
      if (!dragRef.current) return;
      setPosition({
        x: Math.max(0, e.clientX - dragRef.current.offsetX),
        y: Math.max(0, e.clientY - dragRef.current.offsetY),
      });
    };
    const onMouseUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  // Resize logic
  const onResizeStart = useCallback((e, direction) => {
    e.preventDefault();
    e.stopPropagation();
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    resizeRef.current = {
      direction,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: rect.width,
      startHeight: rect.height,
    };

    const onMouseMove = (e) => {
      if (!resizeRef.current) return;
      const { direction, startX, startY, startWidth, startHeight } = resizeRef.current;
      let newWidth = size.width;
      let newHeight = size.height || startHeight;

      if (direction === 'r' || direction === 'rb') {
        newWidth = Math.min(600, Math.max(300, startWidth + (e.clientX - startX)));
      }
      if (direction === 'b' || direction === 'rb') {
        newHeight = Math.min(window.innerHeight * 0.9, Math.max(200, startHeight + (e.clientY - startY)));
      }

      setSize({
        width: newWidth,
        height: (direction === 'r') ? size.height : newHeight,
      });
    };
    const onMouseUp = () => {
      resizeRef.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [size]);

  const sendMessage = useCallback(async (msg) => {
    if (!msg || chatLoading || !country || !activeTabId) return;

    // Capture existing messages before adding the new one (for history)
    const existingMessages = chatMap.get(activeTabId) || [];

    // Add user message to this tab's chat
    setChatMap(prev => {
      const next = new Map(prev);
      const existing = next.get(activeTabId) || [];
      next.set(activeTabId, [...existing, { role: 'user', text: msg }]);
      return next;
    });
    setChatInput('');
    setChatLoading(true);

    try {
      const code = country.code?.startsWith('_agent_') ? '' : country.code;
      // Include the specific place name (e.g. "Ohio") with the country name
      // so the agent knows the exact location context
      const placeName = country._placeName;
      const countryName = country.code?.startsWith('_agent_') ? '' : country.name;
      const name = placeName && placeName.toLowerCase() !== countryName.toLowerCase()
        ? `${placeName}, ${countryName}`
        : countryName;

      // Get user location for "near me" queries
      let userLat = null, userLng = null;
      if (/\bnear\s+me\b/i.test(msg) && requestLocation) {
        try {
          const loc = await requestLocation();
          userLat = loc.lat;
          userLng = loc.lng;
        } catch {}
      }

      const res = await chatAboutCountry(msg, code, name, existingMessages, true, userLat, userLng, country.lat || null, country.lng || null);
      setChatMap(prev => {
        const next = new Map(prev);
        const existing = next.get(activeTabId) || [];
        next.set(activeTabId, [...existing, {
          role: 'ai',
          text: res.reply,
          thoughts: res.thoughts,
          iterations: res.iterations,
          places: res.places || null,
        }]);
        return next;
      });

      // Auto-open map with pins when agent returns places
      if (res.places?.length > 0) {
        const first = res.places[0];
        if (first.lat && first.lng) {
          // On mobile: show places inline in chat, just fly globe + show pins
          // On desktop: open the separate PlacesPanel
          if (isMobile) {
            if (onFlyTo) onFlyTo(first.lat, first.lng);
          } else if (onShowLocalPlaces) {
            onShowLocalPlaces({
              places: res.places,
              query: msg,
              center: { lat: first.lat, lng: first.lng },
            });
            if (onFlyTo) onFlyTo(first.lat, first.lng);
          }
        }
      }
    } catch {
      setChatMap(prev => {
        const next = new Map(prev);
        const existing = next.get(activeTabId) || [];
        next.set(activeTabId, [...existing, { role: 'ai', text: 'Sorry, couldn\'t respond. Try again.' }]);
        return next;
      });
    } finally {
      setChatLoading(false);
    }
  }, [chatLoading, country, activeTabId, chatMap, requestLocation, onShowLocalPlaces, onFlyTo]);

  const handleChat = useCallback((e) => {
    e.preventDefault();
    sendMessage(chatInput.trim());
  }, [chatInput, sendMessage]);

  const handlePill = useCallback((prompt) => {
    sendMessage(prompt);
  }, [sendMessage]);

  // Auto-send initial message if tab has one (e.g. image + text combo)
  const sentInitialRef = useRef(new Set());
  useEffect(() => {
    if (!activeTabId || !country?._initialMessage) return;
    if (sentInitialRef.current.has(activeTabId)) return;
    sentInitialRef.current.add(activeTabId);
    const timer = setTimeout(() => {
      sendMessage(country._initialMessage);
    }, 600);
    return () => clearTimeout(timer);
  }, [activeTabId, country?._initialMessage, sendMessage]);

  // Dynamic isMobile — updates on resize/rotation
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 600);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 600);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // iOS keyboard fix — lift panel above software keyboard
  useEffect(() => {
    if (!isMobile) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const onVVResize = () => {
      const keyboardHeight = window.innerHeight - vv.height;
      const panel = panelRef.current;
      if (panel) {
        panel.style.transform = keyboardHeight > 50
          ? `translateY(-${keyboardHeight}px)` : '';
      }
    };
    vv.addEventListener('resize', onVVResize);
    return () => vv.removeEventListener('resize', onVVResize);
  }, [isMobile]);

  // Swipe-down-to-dismiss on mobile
  const touchStartY = useRef(null);
  const onTouchStart = useCallback((e) => {
    if (!isMobile || minimized) return;
    touchStartY.current = e.touches[0].clientY;
  }, [isMobile, minimized]);

  const onTouchEnd = useCallback((e) => {
    if (!isMobile || touchStartY.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    touchStartY.current = null;
    if (deltaY > 80) {
      // Swiped down — if chat-focused, collapse back to normal first
      if (chatFocused) {
        setChatFocused(false);
      } else if (!minimized) {
        setMinimized(true);
      }
    }
  }, [isMobile, minimized, chatFocused]);

  if (tabs.length === 0) return null;

  const posStyle = (!isMobile && position.x !== null)
    ? { left: position.x, top: position.y, right: 'auto' }
    : {};

  const sizeStyle = !isMobile ? {
    width: size.width,
    ...(size.height ? { maxHeight: size.height } : {}),
  } : {};

  return (
    <div
      ref={panelRef}
      className={`country-panel ${minimized ? 'country-panel--minimized' : ''} ${chatFocused && isMobile ? 'country-panel--chat-focused' : ''}`}
      role="complementary"
      aria-label="Country information"
      style={{ ...posStyle, ...sizeStyle }}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Tab bar */}
      {tabs.length > 1 && (
        <div className="country-panel__tabs">
          {tabs.map(tab => (
            <div
              key={tab.id}
              className={`country-panel__tab ${tab.id === activeTabId ? 'country-panel__tab--active' : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              <span className="country-panel__tab-label">
                {tab.country._placeName || tab.country.name}
              </span>
              <button
                className="country-panel__tab-close"
                onClick={(e) => { e.stopPropagation(); onTabClose(tab.id); }}
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Header — always visible */}
      {country && (
        <>
          <div className="country-panel__header">
            <div className="country-panel__title-row">
              <h2 className="country-panel__name">
                {country._placeName && country._placeName.toLowerCase() !== country.name.toLowerCase()
                  ? `${country._placeName}, ${country.name}`
                  : country.name}
              </h2>
              <span className="country-panel__meta">
                <span className="country-panel__code">{country.code}</span>
                <span className="country-panel__climate">{country.climate}</span>
              </span>
            </div>
            <div className="country-panel__actions">
              {chatFocused && isMobile && (
                <button
                  className="country-panel__collapse-btn"
                  onClick={() => setChatFocused(false)}
                  title="Collapse chat"
                >
                  &#x25BD;
                </button>
              )}
              <button
                className={`country-panel__bookmark ${isBookmarked?.(country.code) ? 'country-panel__bookmark--active' : ''}`}
                onClick={() => onBookmarkToggle?.(country)}
                title={isBookmarked?.(country.code) ? 'Remove bookmark' : 'Bookmark'}
              >
                {isBookmarked?.(country.code) ? '\u2605' : '\u2606'}
              </button>
              <button
                className="country-panel__minimize"
                onClick={() => setMinimized((p) => !p)}
                title={minimized ? 'Expand' : 'Minimize'}
              >
                {minimized ? '\u25B3' : '\u25BD'}
              </button>
              <button
                className="country-panel__close"
                onClick={() => onTabClose(activeTabId)}
                title="Close"
              >
                &times;
              </button>
            </div>
          </div>

        </>
      )}

          {/* ── SINGLE SCROLL BODY ── */}
          {country && !minimized && (
            <div className="country-panel__scroll-body">
              {/* Hero photo */}
              {photo && (
                <div className="country-panel__hero">
                  <img
                    className="country-panel__hero-img"
                    src={photo.url}
                    alt={country._placeName || country.name}
                    loading="lazy"
                  />
                  <div className="country-panel__hero-overlay" />
                  {photo.description && (
                    <span className="country-panel__hero-caption">{photo.description}</span>
                  )}
                </div>
              )}
              {photoLoading && !photo && (
                <div className="country-panel__hero country-panel__hero--loading">
                  <div className="country-panel__photo-skeleton" />
                </div>
              )}

              {score !== null && (
                <div className="country-panel__section country-panel__score">
                  <span className="country-panel__score-label">Match Score</span>
                  <strong className="country-panel__score-value">{score}/10</strong>
                </div>
              )}

              {!country._chatOnly && (
                <details className="country-panel__stats-accordion">
                  <summary className="country-panel__stats-toggle">Country Scores</summary>
                  <div className="country-panel__stats">
                    <StatBar label="Safety" value={country.safety_index} />
                    <StatBar label="Beaches" value={country.beach_score} />
                    <StatBar label="Nightlife" value={country.nightlife_score} />
                    <StatBar label="Affordability" value={country.cost_of_living} />
                    <StatBar label="Sightseeing" value={country.sightseeing_score} />
                    <StatBar label="Culture" value={country.cultural_score} />
                    <StatBar label="Adventure" value={country.adventure_score} />
                    <StatBar label="Food" value={country.food_score} />
                    <StatBar label="Infrastructure" value={country.infrastructure_score} />
                  </div>
                </details>
              )}

              {insight && (
                <div className="country-panel__section country-panel__insight">
                  <p>{insight}</p>
                </div>
              )}

              {country._chatOnly && messages.length === 0 && (
                <div className="country-panel__section country-panel__insight">
                  <p>Ask me anything about {country.name} — travel tips, safety, culture, food, and more!</p>
                </div>
              )}

              {/* Quick topic pills */}
              {messages.length === 0 && (
                <div className="country-panel__pills">
                  {QUICK_TOPICS.map((t) => {
                    const displayName = country._placeName && country._placeName.toLowerCase() !== country.name.toLowerCase()
                      ? `${country._placeName}, ${country.name}`
                      : country.name;
                    return (
                      <button
                        key={t.label}
                        className="country-panel__pill"
                        onClick={() => handlePill(t.prompt(displayName))}
                        disabled={chatLoading}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Chat messages — flow naturally in the scroll body */}
              {messages.length > 0 && (
                <div className="country-panel__messages">
                  {messages.map((m, i) => (
                    <div key={i} className={`country-panel__msg country-panel__msg--${m.role}`}>
                      {m.role === 'ai' ? (
                        <ReactMarkdown
                          components={{
                            a: ({ href, children }) => (
                              <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
                            ),
                          }}
                        >
                          {m.text}
                        </ReactMarkdown>
                      ) : (
                        m.text
                      )}
                      {m.thoughts?.length > 0 && (
                        <details className="country-panel__thoughts">
                          <summary>Agent used {m.iterations || m.thoughts.length} step{(m.iterations || m.thoughts.length) !== 1 ? 's' : ''}</summary>
                          <ol>
                            {m.thoughts.map((t, j) => (
                              <li key={j}>{t}</li>
                            ))}
                          </ol>
                        </details>
                      )}
                      {m.places?.length > 0 && (
                        isMobile ? (
                          <div className="country-panel__inline-places">
                            {m.places.map((place, pi) => {
                              const dirUrl = place.maps_url ||
                                (place.lat && place.lng
                                  ? `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`
                                  : null);
                              return (
                                <div key={place.name + pi} className="country-panel__place-card">
                                  <div className="country-panel__place-card-header">
                                    <span className="country-panel__place-card-num">{pi + 1}</span>
                                    <div className="country-panel__place-card-info">
                                      <span className="country-panel__place-card-name">{place.name}</span>
                                      <span className="country-panel__place-card-meta">
                                        {place.rating > 0 && <span className="country-panel__place-card-rating">{'\u2605'} {place.rating.toFixed(1)}</span>}
                                        {place.is_open === true && <span className="country-panel__place-card-open">Open</span>}
                                        {place.is_open === false && <span className="country-panel__place-card-closed">Closed</span>}
                                      </span>
                                    </div>
                                    {dirUrl && (
                                      <a
                                        className="country-panel__place-card-dir"
                                        href={dirUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        &rarr;
                                      </a>
                                    )}
                                  </div>
                                  {place.address && (
                                    <span className="country-panel__place-card-addr">{place.address}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : onShowLocalPlaces ? (
                          <button
                            className="country-panel__view-map-btn"
                            onClick={() => onShowLocalPlaces({ places: m.places })}
                          >
                            View {m.places.length} places on globe
                          </button>
                        ) : null
                      )}
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="country-panel__msg country-panel__msg--ai country-panel__msg--typing">
                      <div className="country-panel__typing-dots">
                        <span className="country-panel__typing-dot" />
                        <span className="country-panel__typing-dot" />
                        <span className="country-panel__typing-dot" />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
              {/* Typing dots when no messages yet */}
              {messages.length === 0 && chatLoading && (
                <div className="country-panel__messages">
                  <div className="country-panel__msg country-panel__msg--ai country-panel__msg--typing">
                    <div className="country-panel__typing-dots">
                      <span className="country-panel__typing-dot" />
                      <span className="country-panel__typing-dot" />
                      <span className="country-panel__typing-dot" />
                    </div>
                  </div>
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          )}

          {/* Chat form — STICKY at bottom */}
          {country && !minimized && (
            <form className="country-panel__chat-form" onSubmit={handleChat} role="search" aria-label="Chat about this country">
              <input
                className="country-panel__chat-input"
                type="text"
                placeholder={`Ask about ${country.name}...`}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onFocus={() => { if (isMobile) setChatFocused(true); }}
                disabled={chatLoading}
              />
              <button
                className="country-panel__chat-btn"
                type="submit"
                disabled={!chatInput.trim() || chatLoading}
              >
                &rarr;
              </button>
            </form>
          )}

      {/* Resize handles */}
      <div
        className="country-panel__resize-r"
        onMouseDown={(e) => onResizeStart(e, 'r')}
      />
      <div
        className="country-panel__resize-b"
        onMouseDown={(e) => onResizeStart(e, 'b')}
      />
      <div
        className="country-panel__resize-rb"
        onMouseDown={(e) => onResizeStart(e, 'rb')}
      />
    </div>
  );
}

function StatBar({ label, value }) {
  return (
    <div className="stat-bar">
      <span className="stat-bar__label">{label}</span>
      <div className="stat-bar__track">
        <div className="stat-bar__fill" style={{ width: `${(value / 10) * 100}%` }} />
      </div>
      <span className="stat-bar__value">{value}</span>
    </div>
  );
}
