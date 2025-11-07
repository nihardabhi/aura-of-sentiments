from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.config import config
from app.services.llm_service import LLMService
from app.routes import text_processing, health

# Setup logging
logging.basicConfig(level=getattr(logging, config.LOG_LEVEL))
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):

    # Startup
    logger.info(f"Starting Sentiment Aura Backend v1.0.0")
    logger.info(f"Using OpenAI Model: {config.OPENAI_MODEL}")
    
    # Validate configuration
    try:
        config.validate()
        logger.info("Configuration validated successfully")
    except ValueError as e:
        logger.error(f"Configuration error: {e}")
        raise
    
    # Initialize services
    app.state.llm_service = LLMService()
    logger.info("OpenAI service initialized")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Sentiment Aura Backend")

# Create FastAPI app
app = FastAPI(
    title="Sentiment Aura Backend",
    description="Real-time sentiment analysis API using OpenAI",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(text_processing.router, tags=["Analysis"])
app.include_router(health.router, tags=["Monitoring"])

# Root endpoint
@app.get("/", tags=["General"])
async def root():
    return {
        "message": "Sentiment Aura Backend API",
        "version": "1.0.0",
        "documentation": "/docs",
        "status": "ready"
    }