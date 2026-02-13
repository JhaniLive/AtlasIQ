from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers import health, countries, recommendations, chat

app = FastAPI(title="AtlasIQ", version="0.1.0")

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
