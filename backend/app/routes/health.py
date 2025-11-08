from fastapi import APIRouter
from datetime import datetime
import logging

from app.config import config

logger = logging.getLogger(__name__)

router = APIRouter()

start_time = datetime.now()
request_count = 0

@router.get("/health")
async def health_check():
    global request_count
    request_count += 1

    uptime = (datetime.now() - start_time).total_seconds()

    return {
        "status": "healthy",
        "version": "1.0.0",
        "uptime_seconds": round(uptime, 2),
        "total_requests": request_count
    }

@router.get("/status")
async def status():

    return {
        "status": "operational",
        "model": config.OPENAI_MODEL,
        "endpoints":{
            "process_text": "POST /process_text",
            "batch_process": "POST /batch_process",
            "health": "GET /health",
            "status": "GET /status"
        },

        "configuration":{
            "cors_enabled": True,
            "cors_origins": config.CORS_ORIGINS,
            "timeout": f"{config.REQUEST_TIMEOUT} seconds",
            "max_retries": config.MAX_RETRIES,
            "rate_limit": f"{config.RATE_LIMIT_PER_MINUTE} req/min"
        },

        "timestamp": datetime.now().isoformat()
    }

@router.get("/metrics")
async def metrics():
    global request_count
    
    uptime_seconds = (datetime.now() - start_time).total_seconds()
    uptime_hours = round(uptime_seconds / 3600, 2)
    
    return {
        "metrics": {
            "total_requests": request_count,
            "uptime_hours": uptime_hours,
            "uptime_seconds": round(uptime_seconds, 2),
            "start_time": start_time.isoformat(),
            "current_time": datetime.now().isoformat(),
            "requests_per_hour": round(request_count / max(uptime_hours, 0.01), 2)
        }
    }