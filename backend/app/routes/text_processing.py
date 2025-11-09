from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, validator
from typing import List
import logging
import time

from app.config import config

logger = logging.getLogger(__name__)

router = APIRouter()

class TextRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)

    @validator("text")
    def validate_text(cls, v):
        if not v.strip():
            raise ValueError("Text cannot be empty or just whitespace")
        return v.strip()

class SentimentResponse(BaseModel):
    sentiment: float = Field(..., ge=-1, le=1)
    sentiment_type: str = Field(..., pattern="^(positive|negative|neutral)$")
    keywords: List[str] = Field(..., max_items=5)
    dominant_emotion: str = Field(..., pattern="^(joy|sadness|anger|fear|surprise|disgust|neutral)$")

@router.post("/process_text", response_model=SentimentResponse)
async def process_text(request: TextRequest, req: Request):
    try:
        start_time = time.time()
        logger.info(f"Processing text: {request.text[:50]}...")

        llm_service = req.app.state.llm_service

        result = await llm_service.analyze_text(request.text)

        processing_time = time.time() - start_time
        logger.info(f"Analysis complete in {processing_time:.2f}s")

        return result
    
    except Exception as e:
        logger.error(f"Error processing text: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
@router.post("/batch_process")
async def batch_process(texts: List[str], req: Request):
    if(len(texts) > 10):
        raise HTTPException(status_code=400, detail="Maximum 10 texts allowed per batch")
    
    try:
        logger.info(f"Processing batch of {len(texts)} texts")

        llm_service = req.app.state.llm_service
        results = []

        for text in texts:
            if text.strip():
                result = await llm_service.analyze_text(text.strip())
                results.append({
                    "text": text[:50] + "..." if len(text) > 50 else text,
                    "analysis": result 
                })
            
        return{
            "results": results,
            "count": len(results),
            "status": "completed"
        }
    
    except Exception as e:
        logger.error(f"Batch processing error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))