from fastapi import FastAPI  # Groq LLM provider
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from config import settings
from routers import health, countries, recommendations, chat, places, summary

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="AtlasIQ", version="0.1.0")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(countries.router)
app.include_router(recommendations.router)
app.include_router(chat.router)
app.include_router(places.router)
app.include_router(summary.router)


@app.get("/")
async def root():
    return {
        "name": "AtlasIQ API",
        "version": "0.1.0",
        "endpoints": ["/health", "/countries", "/recommendations"],
    }


@app.on_event("startup")
async def startup():
    print("AtlasIQ API is running")


@app.on_event("shutdown")
async def shutdown():
    from utils.llm_client import close_client
    await close_client()
