# AtlasIQ — Project Conventions

## Overview
AtlasIQ is an AI-powered 3D world exploration platform. Users describe travel interests in natural language, upload photos, or use voice input — AI agents identify places, score/rank countries, and display results on an interactive globe.

## Tech Stack
- **Backend**: Python 3.11+, FastAPI, Pydantic, httpx, slowapi (rate limiting)
- **Frontend**: React 18, Vite, react-globe.gl, Three.js, Axios
- **AI**: OpenRouter API (vision + chat models, default: gpt-4o-mini)
- **No TypeScript** — plain JS/JSX for speed
- **PWA**: manifest.json, service worker (network-first caching), offline fallback

## Project Structure
- `backend/` — FastAPI app (`uvicorn main:app --reload` from backend/)
- `frontend/` — Vite React app (`npm run dev` from frontend/)
- `.env` at root — shared secrets (OPENROUTER_API_KEY)

## Conventions
- Backend uses async/await throughout
- Shared httpx.AsyncClient with connection pooling (not per-request)
- Pydantic models for all request/response schemas
- AI agents inherit from `base_agent.py` and implement `run()`
- Country data is static JSON — no database
- In-memory TTL cache — no Redis
- Frontend components each have their own directory with .jsx + .css
- API calls go through `frontend/src/services/api.js` (with sessionStorage caching)
- Search history and bookmarks stored in localStorage
- Mobile-first responsive design (breakpoints: 600px, 380px)

## Running
```bash
# Backend
cd backend && pip install -r requirements.txt && uvicorn main:app --reload

# Frontend
cd frontend && npm install && npm run dev
```

## Deployment
- **Frontend**: Netlify (auto-deploys from `main` branch)
- **Backend**: Render.com (auto-deploys from `main` branch)
- **Env vars**: See DEPLOY.md for full setup guide
- **Branches**: `main` = production, `jhani_dev` = development

## API Endpoints
- `GET /health` — Health check (uptime, version)
- `GET /countries` — List all countries
- `GET /countries/{code}` — Get country by ISO code
- `POST /recommendations` — `{"interests": "..."}` → ranked countries + AI explanations
- `POST /resolve-place` — `{"place": "..."}` → resolve place name to country + coordinates
- `POST /resolve-place-image` — `{"image": "data:image/..."}` → identify place from photo
- `POST /chat` — `{"message": "...", "country_code": "", "country_name": ""}` → AI chat

## Rate Limits
- General AI endpoints: 30 requests/min per IP
- Image analysis: 10 requests/min per IP

## Key Frontend Features
- Unified search bar: `[+] textarea [mic] [send]`
- `+` menu: Take Photo (live webcam) / Upload Image (gallery)
- Voice typing via Web Speech API
- Image + text combo: image resolves place, text auto-sends as chat
- Search history dropdown (localStorage, last 10)
- Country bookmarks (star toggle, localStorage)
- URL sharing via `?place=` query param
- Welcome screen with typing animation (sessionStorage)
- Error boundary + auto-dismiss error toasts
