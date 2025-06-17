from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .core.config import settings
from .core.database import init_db
from .routers import health, photos, measurements, notifications

# Initialize FastAPI app
app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix=settings.API_V1_STR, tags=["health"])
app.include_router(photos.router, prefix=settings.API_V1_STR, tags=["photos"])
app.include_router(measurements.router, prefix=settings.API_V1_STR, tags=["measurements"])
app.include_router(notifications.router, prefix=settings.API_V1_STR, tags=["notifications"])

# Serve uploaded images
app.mount("/static", StaticFiles(directory=settings.UPLOAD_DIR), name="static")

# Initialize database
init_db() 