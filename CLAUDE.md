# AtlasIQ — Project Conventions

## Overview
AtlasIQ is an AI-powered 3D world exploration platform. Users describe travel interests in natural language, and AI agents score/rank countries displayed on an interactive globe.

## Tech Stack
- **Backend**: Python 3.11+, FastAPI, Pydantic, httpx
- **Frontend**: React 18, Vite, react-globe.gl, Three.js, Axios
- **AI**: OpenRouter API (no OpenAI fallback)
- **No TypeScript** — plain JS/JSX for speed

## Project Structure
- `backend/` — FastAPI app (`uvicorn main:app --reload` from backend/)
- `frontend/` — Vite React app (`npm run dev` from frontend/)
- `.env` at root — shared secrets (OPENROUTER_API_KEY)

## Conventions
- Backend uses async/await throughout
- Pydantic models for all request/response schemas
- AI agents inherit from `base_agent.py` and implement `run()`
- Country data is static JSON — no database
- In-memory TTL cache — no Redis
- Frontend components each have their own directory with .jsx + .css
- API calls go through `frontend/src/services/api.js`

## Running
```bash
# Backend
cd backend && pip install -r requirements.txt && uvicorn main:app --reload

# Frontend
cd frontend && npm install && npm run dev
```

## API Endpoints
- `GET /health` — Health check
- `GET /countries` — List all countries
- `GET /countries/{code}` — Get country by ISO code
- `POST /recommendations` — `{"interests": "..."}` → ranked countries + AI explanations
