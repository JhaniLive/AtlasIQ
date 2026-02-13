# AtlasIQ — Improvement Plan

**Live site**: https://charming-panda-908510.netlify.app
**Status**: MVP deployed (Netlify + Render)

---

## Phase 1 — Quick Wins (1-2 days)

### 1.1 SEO & Social Sharing
- [ ] Add `<meta>` description, keywords in `index.html`
- [ ] Add Open Graph tags (`og:title`, `og:description`, `og:image`, `og:url`)
- [ ] Add Twitter Card tags (`twitter:card`, `twitter:title`, `twitter:image`)
- [ ] Create a preview image (1200x630) for social shares
- [ ] Add `<link rel="canonical">` tag

### 1.2 Error Handling & Retry
- [ ] Add "Try Again" button on error messages instead of auto-dismiss
- [ ] Add error boundary component to catch React crashes gracefully
- [ ] Show friendly offline message when network is down
- [ ] Auto-dismiss error toasts after 5 seconds

### 1.3 Minor Bug Fixes
- [ ] Fix globe rotation ref bug (`rotatingRef._enabled` logic in Globe.jsx)
- [ ] Return focus to chat input after sending a message
- [ ] Debounce `reverseGeocode` calls on rapid country clicks
- [ ] Remove `frontend/nul` junk file from repo

### 1.4 Loading UX
- [ ] Add skeleton shimmer to CountryPanel while data loads
- [ ] Show "Identifying place..." text during image upload analysis
- [ ] Add subtle pulse animation to Explore button while loading

---

## Phase 2 — Engagement Features (3-5 days)

### 2.1 Search History
- [ ] Save last 10 searches to `localStorage`
- [ ] Show search history dropdown when textarea is focused (empty)
- [ ] Click a history item to re-run that search
- [ ] Clear history button

### 2.2 Bookmarks / Favorites
- [ ] Heart icon on CountryPanel header to bookmark a country
- [ ] Save bookmarks to `localStorage`
- [ ] Bookmarks panel (slide-out drawer or tab)
- [ ] Show bookmarked countries with a pin on the globe

### 2.3 Share Results
- [ ] "Share" button on CountryPanel → copy link with place name as URL param
- [ ] Parse URL params on load → auto-search the place
- [ ] Native share sheet on mobile (`navigator.share` API)

### 2.4 Country Comparison
- [ ] "Compare" button to select 2 countries
- [ ] Side-by-side stat bars, scores, and AI summary
- [ ] Highlight differences (safety, cost, food, etc.)

---

## Phase 3 — UX Polish (3-5 days)

### 3.1 Autocomplete Search
- [ ] As user types, show dropdown with matching country/city names
- [ ] Fuzzy match against countries dataset + common cities
- [ ] Keyboard navigation (arrow keys + enter to select)
- [ ] Highlight matching substring in results

### 3.2 Advanced Filters
- [ ] Filter bar above search: continent, climate, budget range
- [ ] Quick filter pills: "Beach", "Adventure", "Budget", "Culture"
- [ ] Filter results shown as highlighted countries on the globe

### 3.3 Animations & Transitions
- [ ] Smooth panel open/close transitions (slide + fade)
- [ ] Chat messages fade-in on arrival
- [ ] Tab switch crossfade
- [ ] Button press ripple effect
- [ ] Globe fly-to easing improvements

### 3.4 Accessibility
- [ ] ARIA labels on all interactive elements (globe buttons, panels)
- [ ] Full keyboard navigation through country panel and tabs
- [ ] Focus ring indicators on all focusable elements
- [ ] Screen reader announcements for loading states and results
- [ ] WCAG AA color contrast audit (fix #888 text on dark bg)

---

## Phase 4 — Performance (2-3 days)

### 4.1 Frontend Optimization
- [ ] Lazy load WelcomeScreen component (not needed after first visit)
- [ ] Lazy load CountryPanel and RankingPanel (only when needed)
- [ ] Cache Wikipedia photo responses in `sessionStorage`
- [ ] Cache Nominatim geocode responses in `sessionStorage`
- [ ] Compress uploaded images client-side before sending base64

### 4.2 Backend Optimization
- [ ] Use a single shared `httpx.AsyncClient` instead of creating one per request
- [ ] Add retry logic (3 attempts) for OpenRouter API calls
- [ ] Add request timeout middleware (30s max)
- [ ] Cache country data endpoint with HTTP `Cache-Control` headers

### 4.3 Bundle Size
- [ ] Analyze bundle with `vite-plugin-visualizer`
- [ ] Tree-shake unused Cesium modules if possible
- [ ] Preload critical fonts and globe textures

---

## Phase 5 — Backend Hardening (2-3 days)

### 5.1 Rate Limiting
- [ ] Add rate limiting middleware (e.g., `slowapi`)
- [ ] Limit: 30 requests/min per IP for AI endpoints
- [ ] Limit: 5 requests/min for image analysis (expensive)
- [ ] Return `429 Too Many Requests` with retry-after header

### 5.2 Logging & Monitoring
- [ ] Add structured JSON logging with request IDs
- [ ] Add Sentry integration for error tracking (free tier)
- [ ] Expand `/health` to check OpenRouter connectivity
- [ ] Log response times for AI endpoints

### 5.3 API Improvements
- [ ] Add API versioning prefix (`/api/v1/...`)
- [ ] Add request validation error details (not just 400)
- [ ] Add fallback model if primary model fails
- [ ] Connection pooling for httpx client

---

## Phase 6 — Major Features (1-2 weeks)

### 6.1 PWA Support
- [ ] Add `manifest.json` (app name, icons, theme color)
- [ ] Add service worker for offline caching (country data, app shell)
- [ ] "Install app" prompt on mobile
- [ ] Offline fallback page

### 6.2 Trip Planner / Itinerary
- [ ] Multi-country trip builder (add countries in order)
- [ ] Drag-to-reorder itinerary
- [ ] AI-generated day-by-day plan for each country
- [ ] Export itinerary as PDF or shareable link

### 6.3 Enriched Country Data
- [ ] Add visa requirements per country
- [ ] Add currency + exchange rate (live API)
- [ ] Add local language + useful phrases
- [ ] Add health/vaccination recommendations
- [ ] Add best time to visit (month-by-month)

### 6.4 User Accounts (Optional)
- [ ] Sign up / log in (email or Google OAuth)
- [ ] Save bookmarks, search history, and itineraries to cloud
- [ ] Personalized recommendations based on past searches
- [ ] User profile with travel preferences

---

## Phase 7 — Nice to Have

- [ ] Dark / light mode toggle
- [ ] Theming system (centralize colors in CSS variables)
- [ ] Multi-language support (i18n)
- [ ] Integration links (Google Flights, Booking.com, Airbnb)
- [ ] Real-time collaboration (share session with friends)
- [ ] Analytics dashboard (track popular searches)
- [ ] AI travel guide videos (generated summaries)
- [ ] Community reviews and ratings
- [ ] Sustainable / eco-tourism scoring

---

## Tech Debt

- [ ] Add TypeScript (gradual migration, start with new files)
- [ ] Split CountryPanel.jsx into smaller components
- [ ] Split Globe.jsx into setup + interaction modules
- [ ] Move `extractPlace`, `looksLikeGibberish`, `detectLocation` out of App.jsx
- [ ] Add unit tests for backend endpoints
- [ ] Add component tests for frontend (Vitest + React Testing Library)
- [ ] Centralize z-index values and color tokens
- [ ] Document AI agent architecture and scoring methodology

---

## Priority Matrix

| Effort → | Low | Medium | High |
|----------|-----|--------|------|
| **High Impact** | SEO tags, error retry, bug fixes, loading skeletons | Search history, bookmarks, share, rate limiting | PWA, trip planner, user accounts |
| **Medium Impact** | Auto-dismiss errors, focus management | Autocomplete, filters, animations | Country data enrichment, comparison |
| **Low Impact** | Remove junk files, rotation fix | Accessibility audit, theming | Multi-language, analytics |
