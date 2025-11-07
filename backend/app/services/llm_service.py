import json
import logging
import asyncio
from typing import Dict, List
from openai import OpenAI
from app.config import config

logger = logging.getLogger(__name__)

class LLMService:
    
    def __init__(self):
        if not config.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY not configured")
        
        self.client = OpenAI(api_key=config.OPENAI_API_KEY)
        self.model = config.OPENAI_MODEL
        self.timeout = config.REQUEST_TIMEOUT
        self.max_retries = config.MAX_RETRIES
        
        logger.info(f"Initialized OpenAI client with model: {self.model}")

    async def analyze_text(self, text: str) -> Dict:
        prompt = self._create_prompt(text)
        retries = 0
        
        while retries < self.max_retries:
            try:
                result = await asyncio.wait_for(
                    self._call_openai(prompt),
                    timeout=self.timeout
                )
                
                validated_result = self._validate_response(result)
                logger.info(f"Successfully analyzed text: sentiment={validated_result['sentiment']}")
                return validated_result
                
            except asyncio.TimeoutError:
                logger.warning(f"OpenAI API timeout (attempt {retries + 1}/{self.max_retries})")
                retries += 1
                if retries >= self.max_retries:
                    logger.error("Max retries reached, using fallback")
                    return self._generate_fallback_response(text)
                await asyncio.sleep(2 ** retries)
                
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON response from OpenAI: {str(e)}")
                retries += 1
                if retries >= self.max_retries:
                    return self._generate_fallback_response(text)
                await asyncio.sleep(2 ** retries)
                
            except Exception as e:
                logger.error(f"OpenAI API error (attempt {retries + 1}): {str(e)}")
                retries += 1
                if retries >= self.max_retries:
                    logger.error("Max retries reached, using fallback")
                    return self._generate_fallback_response(text)
                await asyncio.sleep(2 ** retries)

    def _create_prompt(self, text: str) -> str:
        return f"""
        Analyze the following text for emotional content and provide sentiment analysis.
        
        Text to analyze: "{text}"
        
        Provide the following information:
        1. Sentiment score: A precise float between -1 (very negative) and 1 (very positive)
        2. Sentiment type: Exactly one of: "positive", "negative", or "neutral"
        3. Energy level: A float between 0 (calm/low energy) and 1 (excited/high energy)
        4. Keywords: Extract 3-5 most important keywords or short phrases that capture the essence
        5. Dominant emotion: Exactly one of: joy, sadness, anger, fear, surprise, disgust, or neutral
        
        Consider:
        - Overall tone and mood
        - Emotional intensity
        - Context and nuance
        - Word choice and phrasing
        - Punctuation (exclamation marks indicate higher energy)
        
        Respond ONLY with valid JSON in this exact format:
        {{
            "sentiment": -0.5,
            "sentiment_type": "negative",
            "energy": 0.7,
            "keywords": ["keyword1", "keyword2", "keyword3"],
            "dominant_emotion": "sadness"
        }}
        
        Ensure all values are within specified ranges and the JSON is valid.
        Do not include any explanation or text outside the JSON object.
        """

    async def _call_openai(self, prompt: str) -> Dict:
        try:
            response = await asyncio.to_thread(
                self.client.chat.completions.create,
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a sentiment analysis expert. Always respond with valid JSON only, no additional text."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                response_format={"type": "json_object"},
                temperature=0.3,
                max_tokens=200,
                n=1,
                stop=None
            )
            
            content = response.choices[0].message.content
            logger.debug(f"OpenAI raw response: {content}")
            
            return json.loads(content)
            
        except Exception as e:
            logger.error(f"OpenAI API call failed: {str(e)}")
            raise

    def _validate_response(self, response: Dict) -> Dict:
        try:
            validated = {}
            
            sentiment = float(response.get("sentiment", 0))
            validated["sentiment"] = max(-1, min(1, sentiment))
            
            sentiment_type = response.get("sentiment_type", "").lower()
            if sentiment_type not in ["positive", "negative", "neutral"]:
                if validated["sentiment"] > 0.2:
                    sentiment_type = "positive"
                elif validated["sentiment"] < -0.2:
                    sentiment_type = "negative"
                else:
                    sentiment_type = "neutral"
            validated["sentiment_type"] = sentiment_type
            
            energy = float(response.get("energy", 0.5))
            validated["energy"] = max(0, min(1, energy))
            
            keywords = response.get("keywords", [])
            if isinstance(keywords, list):
                validated["keywords"] = [
                    str(k).strip() for k in keywords 
                    if k and str(k).strip()
                ][:config.MAX_KEYWORDS]
            else:
                validated["keywords"] = []
            
            if not validated["keywords"]:
                validated["keywords"] = ["general"]
            
            emotion = response.get("dominant_emotion", "").lower()
            valid_emotions = ["joy", "sadness", "anger", "fear", "surprise", "disgust", "neutral"]
            
            if emotion not in valid_emotions:
                if validated["sentiment"] > 0.5:
                    emotion = "joy"
                elif validated["sentiment"] > 0:
                    emotion = "surprise"
                elif validated["sentiment"] < -0.5:
                    emotion = "anger"
                elif validated["sentiment"] < 0:
                    emotion = "sadness"
                else:
                    emotion = "neutral"
            validated["dominant_emotion"] = emotion
            
            logger.debug(f"Validated response: {validated}")
            return validated
            
        except (KeyError, ValueError, TypeError) as e:
            logger.error(f"Response validation error: {str(e)}")
            raise ValueError(f"Invalid response format from OpenAI: {str(e)}")

    def _generate_fallback_response(self, text: str) -> Dict:
        logger.info("Using fallback sentiment analysis (OpenAI unavailable)")
        
        text_lower = text.lower()
        words = text_lower.split()
        
        positive_words = {
            'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic',
            'happy', 'joy', 'love', 'loved', 'loving', 'best', 'awesome',
            'beautiful', 'perfect', 'excited', 'exciting', 'pleased', 'glad',
            'delighted', 'cheerful', 'thankful', 'grateful', 'blessed'
        }
        
        negative_words = {
            'bad', 'terrible', 'awful', 'horrible', 'worst', 'hate', 'hated',
            'sad', 'angry', 'upset', 'disappointed', 'frustrating', 'annoyed',
            'disgusting', 'ugly', 'nasty', 'miserable', 'depressed', 'worried',
            'anxious', 'scared', 'afraid', 'unhappy', 'unfortunate'
        }
        
        high_energy_words = {
            'very', 'extremely', 'absolutely', 'totally', 'completely',
            'amazing', 'incredible', 'unbelievable', 'urgent', 'immediately',
            'wow', 'omg', 'shocked', 'excited', 'thrilled'
        }
        
        sentiment_score = 0
        energy_score = 0.3
        keywords = []
        
        for word in words:
            clean_word = word.strip('.,!?;:')
            
            if clean_word in positive_words:
                sentiment_score += 0.3
                keywords.append(clean_word)
            elif clean_word in negative_words:
                sentiment_score -= 0.3
                keywords.append(clean_word)
            
            if clean_word in high_energy_words:
                energy_score = min(1.0, energy_score + 0.2)
        
        exclamation_count = text.count('!')
        energy_score = min(1.0, energy_score + (exclamation_count * 0.15))
        
        question_count = text.count('?')
        if question_count > 0:
            energy_score = min(1.0, energy_score + 0.1)
        
        caps_words = [w for w in words if w.isupper() and len(w) > 1]
        if caps_words:
            energy_score = min(1.0, energy_score + 0.3)
            if sentiment_score < 0:
                sentiment_score -= 0.2
        
        if not keywords:
            stop_words = {
                'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'as', 'are',
                'was', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does',
                'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
                'shall', 'can', 'need', 'to', 'of', 'in', 'for', 'with', 'by',
                'from', 'about', 'into', 'through', 'during', 'before', 'after'
            }
            
            keywords = [
                w.strip('.,!?;:') for w in words 
                if len(w) > 3 and w.lower() not in stop_words
            ][:5]
        
        keywords = keywords[:5]
        if not keywords:
            keywords = ["general", "text"]
        
        sentiment_score = max(-1, min(1, sentiment_score))
        
        if sentiment_score > 0.2:
            sentiment_type = "positive"
            emotion = "joy" if sentiment_score > 0.5 else "surprise"
        elif sentiment_score < -0.2:
            sentiment_type = "negative"
            emotion = "anger" if sentiment_score < -0.5 else "sadness"
        else:
            sentiment_type = "neutral"
            emotion = "neutral"
        
        energy_score = max(0.1, min(1.0, energy_score))
        
        result = {
            "sentiment": round(sentiment_score, 3),
            "sentiment_type": sentiment_type,
            "energy": round(energy_score, 3),
            "keywords": keywords,
            "dominant_emotion": emotion
        }
        
        logger.info(f"Fallback analysis result: {result}")
        return result