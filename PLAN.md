# AtlasIQ — Improvement Plan

**Live site**: https://charming-panda-908510.netlify.app
**Repo**: https://github.com/JhaniLive/AtlasIQ
**Status**: Phases 1-6 complete, deployed (Netlify + Render)

---

## Phase 1 — Quick Wins ✅

### 1.1 SEO & Social Sharing
- [x] Add `<meta>` description, keywords in `index.html`
- [x] Add Open Graph tags (`og:title`, `og:description`, `og:image`, `og:url`)
- [x] Add Twitter Card tags (`twitter:card`, `twitter:title`, `twitter:image`)
- [ ] Create a preview image (1200x630) for social shares
- [x] Add `<link rel="canonical">` tag

### 1.2 Error Handling & Retry
- [x] Add dismiss button on error messages
- [x] Add error boundary component to catch React crashes gracefully
- [x] Show friendly offline message when network is down (PWA offline.html)
- [x] Auto-dismiss error toasts after 6 seconds

### 1.3 Minor Bug Fixes
- [ ] Fix globe rotation ref bug (`rotatingRef._enabled` logic in Globe.jsx)
- [ ] Return focus to chat input after sending a message
- [ ] Debounce `reverseGeocode` calls on rapid country clicks
- [x] Remove `frontend/nul` junk file from repo
- [x] Fix gibberish/greeting detection (min 3 chars, blocklist common words)
- [x] Fix country name substring matching (require `startsWith` not `includes`)

### 1.4 Loading UX
- [x] Add skeleton shimmer to CountryPanel photo while loading
- [x] Loading spinner in send button while processing
- [ ] Show "Identifying place..." text during image upload analysis

---

## Phase 2 — Engagement Features ✅

### 2.1 Search History
- [x] Save last 10 searches to `localStorage`
- [x] Show search history dropdown when input is focused (empty)
- [x] Click a history item to re-run that search
- [x] Clear history button

### 2.2 Bookmarks / Favorites
- [x] Star icon on CountryPanel header to bookmark a country
- [x] Save bookmarks to `localStorage`
- [ ] Bookmarks panel (slide-out drawer or tab)
- [ ] Show bookmarked countries with a pin on the globe

### 2.3 Share Results
- [x] Parse `?place=` URL params on load → auto-search the place
- [ ] "Share" button on CountryPanel → copy link with place name as URL param
- [ ] Native share sheet on mobile (`navigator.share` API)

### 2.4 Country Comparison
- [ ] "Compare" button to select 2 countries
- [ ] Side-by-side stat bars, scores, and AI summary
- [ ] Highlight differences (safety, cost, food, etc.)

---

## Phase 3 — UX Polish ✅

### 3.1 Search Bar Redesign
- [x] Unified single-bar design: `[+] textarea [mic] [send]`
- [x] Plus button with popup menu (Take Photo / Upload Image)
- [x] Live camera modal with webcam viewfinder (desktop + mobile)
- [x] Voice typing via Web Speech API with pulse animation
- [x] Send arrow icon (replaces Explore button)
- [x] Auto-grow textarea (expands up to ~5 lines)
- [x] Image + text combo: image resolves place, text auto-sends as chat
- [x] Clear text box on submit

### 3.2 Animations & Transitions
- [x] Panel slide-in animation
- [x] Chat messages fade-in on arrival
- [x] Button press scale effects
- [x] Pill hover lift animation
- [ ] Tab switch crossfade
- [ ] Globe fly-to easing improvements

### 3.3 Accessibility
- [x] ARIA labels on globe button, panel, chat form
- [x] Focus-visible ring for keyboard users (green outline)
- [x] Reduced motion preference (`prefers-reduced-motion`)
- [x] Green border on input focus (state-based for mobile reliability)
- [ ] Full keyboard navigation through country panel and tabs
- [ ] Screen reader announcements for loading states and results
- [ ] WCAG AA color contrast audit

### 3.4 Autocomplete Search
- [ ] As user types, show dropdown with matching country/city names
- [ ] Fuzzy match against countries dataset + common cities
- [ ] Keyboard navigation (arrow keys + enter to select)

### 3.5 Advanced Filters
- [ ] Filter bar above search: continent, climate, budget range
- [ ] Quick filter pills: "Beach", "Adventure", "Budget", "Culture"

---

## Phase 4 — Performance ✅

### 4.1 Frontend Optimization
- [x] Cache Wikipedia photo responses in `sessionStorage` (5-min TTL)
- [x] Cache Nominatim geocode responses in `sessionStorage`
- [x] Compress uploaded images client-side before sending (canvas resize, JPEG 0.7)
- [ ] Lazy load WelcomeScreen component (not needed after first visit)
- [ ] Lazy load CountryPanel and RankingPanel (only when needed)

### 4.2 Backend Optimization
- [x] Use a single shared `httpx.AsyncClient` with connection pooling
- [x] Graceful client cleanup on shutdown
- [ ] Add retry logic (3 attempts) for OpenRouter API calls
- [ ] Add request timeout middleware (30s max)
- [ ] Cache country data endpoint with HTTP `Cache-Control` headers

### 4.3 Bundle Size
- [ ] Analyze bundle with `vite-plugin-visualizer`
- [ ] Tree-shake unused Cesium modules if possible
- [ ] Preload critical fonts and globe textures

---

## Phase 5 — Backend Hardening ✅

### 5.1 Rate Limiting
- [x] Add rate limiting middleware (`slowapi`)
- [x] Limit: 30 requests/min per IP for AI endpoints
- [x] Limit: 10 requests/min for image analysis
- [x] Return `429 Too Many Requests` via slowapi handler

### 5.2 Logging & Monitoring
- [x] Expanded `/health` with uptime and version
- [ ] Add structured JSON logging with request IDs
- [ ] Add Sentry integration for error tracking (free tier)
- [ ] Log response times for AI endpoints

### 5.3 API Improvements
- [x] Connection pooling for httpx client
- [ ] Add API versioning prefix (`/api/v1/...`)
- [ ] Add request validation error details (not just 400)
- [ ] Add fallback model if primary model fails

---

## Phase 6 — Major Features (partial) ✅

### 6.1 PWA Support
- [x] Add `manifest.json` (app name, icons, theme color)
- [x] Add service worker for offline caching (network-first strategy)
- [x] Offline fallback page
- [x] Apple PWA meta tags
- [ ] Create PWA icons (`icon-192.png`, `icon-512.png`)
- [ ] "Install app" prompt on mobile

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
| **High Impact** | ~~SEO tags~~, ~~error handling~~, ~~bug fixes~~, ~~loading UX~~ | ~~Search history~~, ~~bookmarks~~, share button, ~~rate limiting~~ | ~~PWA~~, trip planner, user accounts |
| **Medium Impact** | ~~Auto-dismiss errors~~, ~~focus management~~ | Autocomplete, filters, ~~animations~~ | Country data enrichment, comparison |
| **Low Impact** | ~~Remove junk files~~, rotation fix | ~~Accessibility basics~~, theming | Multi-language, analytics |
