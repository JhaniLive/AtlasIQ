# AtlasIQ — Deployment Guide

## Architecture

| Part | Service | Tier |
|------|---------|------|
| Frontend (React/Vite) | Netlify | Free |
| Backend (FastAPI) | Render.com | Free |

---

## 1. Push to GitHub

Make sure your repo is on GitHub with this structure:

```
02_AtlasIQ/
├── backend/
│   ├── main.py
│   ├── config.py
│   ├── requirements.txt
│   └── ...
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   └── ...
├── .env              ← DO NOT commit this
└── CLAUDE.md
```

Add `.env` to `.gitignore` if not already there.

---

## 2. Deploy Backend (Render.com)

1. Go to https://render.com → Sign up / Log in
2. Click **New** → **Web Service**
3. Connect your GitHub repo
4. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `atlasiq-api` (or anything) |
| **Root Directory** | `backend` |
| **Runtime** | `Python 3` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn main:app --host 0.0.0.0 --port $PORT` |

5. Add **Environment Variables** in Render dashboard:

| Key | Value |
|-----|-------|
| `OPENROUTER_API_KEY` | Your OpenRouter API key |
| `CORS_ORIGINS` | `["https://YOUR-SITE.netlify.app"]` |

6. Click **Deploy**
7. Wait for build to finish — note your URL (e.g. `https://atlasiq-api.onrender.com`)
8. Test: visit `https://atlasiq-api.onrender.com/health` — should return `{"status": "ok"}`

---

## 3. Deploy Frontend (Netlify)

1. Go to https://netlify.com → Sign up / Log in
2. Click **Add new site** → **Import an existing project** → select your GitHub repo
3. Configure:

| Setting | Value |
|---------|-------|
| **Base directory** | `frontend` |
| **Build command** | `npm run build` |
| **Publish directory** | `frontend/dist` |

4. Add **Environment Variable** in Netlify dashboard (Site settings → Environment variables):

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://atlasiq-api.onrender.com` (your Render URL) |

5. Click **Deploy site**
6. Note your Netlify URL (e.g. `https://atlasiq.netlify.app`)

---

## 4. Update CORS on Backend

Go back to Render → your service → Environment:

Update `CORS_ORIGINS` with your actual Netlify URL:

```
["https://atlasiq.netlify.app"]
```

Render will auto-redeploy after the env var change.

---

## 5. Verify Everything Works

1. Open your Netlify URL
2. Welcome screen should appear with typing animation
3. Click "Start Exploring" → globe loads
4. Type "Eiffel Tower" → should fly to Paris
5. Click camera icon → upload a photo → should identify the place

---

## Custom Domain (Optional)

**Netlify**: Site settings → Domain management → Add custom domain

**Render**: Settings → Custom Domains

Update `CORS_ORIGINS` on Render to include your custom domain:
```
["https://atlasiq.netlify.app", "https://yourdomain.com"]
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Frontend shows but API calls fail | Check `VITE_API_URL` is set correctly in Netlify, redeploy |
| CORS errors in browser console | Update `CORS_ORIGINS` on Render to match your Netlify URL exactly |
| Backend takes ~30s on first request | Render free tier sleeps after 15 min idle — upgrade to paid ($7/mo) to keep alive |
| `OPENROUTER_API_KEY` not working | Make sure the key is set in Render env vars (not in a .env file) |
| Build fails on Netlify | Check base directory is `frontend`, not root |
| Build fails on Render | Check root directory is `backend`, not root |

---

## Environment Variables Summary

### Render (Backend)
- `OPENROUTER_API_KEY` — required
- `CORS_ORIGINS` — required, JSON array of allowed frontend URLs

### Netlify (Frontend)
- `VITE_API_URL` — required, your Render backend URL (no trailing slash)
