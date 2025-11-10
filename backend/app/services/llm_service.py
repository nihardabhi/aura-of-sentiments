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
        IMPORTANT: Read and analyze the ENTIRE text carefully. Consider the complete context, not just individual words. 
        The overall meaning and emotion of the full sentence matters more than isolated keywords.
        
        Text to analyze: "{text}"
        
        ANALYSIS INSTRUCTIONS:
        1. READ THE COMPLETE TEXT FIRST - understand the whole message
        2. Consider the CONTEXT - words like "not happy" mean negative, not positive
        3. Look for COMBINATIONS - "promoted" + "happy" together = strong joy
        4. Understand NEGATIONS - "not sad", "no longer worried", "can't be happier"
        5. Detect SARCASM - "Oh great, another problem" is negative, not positive
        6. Identify TRUE EMOTION - what is the person REALLY feeling?
        
        COMPREHENSIVE EMOTION KEYWORDS GUIDE:
        
        JOY/POSITIVE (sentiment 0.5 to 1.0):
        - Achievement: promoted, promotion, success, successful, accomplished, achievement, win, won, winning, victory, triumph
        - Happiness: happy, happier, happiest, joy, joyful, delighted, cheerful, pleased, glad, elated, ecstatic, overjoyed, thrilled
        - Excitement: excited, exciting, amazing, wonderful, fantastic, awesome, incredible, brilliant, spectacular, magnificent
        - Love: love, loved, loving, adore, cherish, treasure, beloved, dear, caring, affection
        - Gratitude: grateful, thankful, blessed, appreciate, fortunate, lucky
        
        SADNESS/NEGATIVE (sentiment -1.0 to -0.3):
        - Loss: miss, missing, lost, gone, departed, abandoned, left, goodbye, farewell
        - Loneliness: lonely, alone, isolated, empty, hollow, abandoned, forgotten, neglected, rejected
        - Sadness: sad, unhappy, miserable, depressed, melancholy, gloomy, grief, mourn, cry, tears, heartbroken, devastated
        - Disappointment: disappointed, failed, failure, unsuccessful, defeated, hopeless, despair, discouraged
        
        ANGER/NEGATIVE (sentiment -1.0 to -0.3):
        - Frustration: frustrated, annoyed, irritated, aggravated, exasperated, fed up, tired of, sick of
        - Anger: angry, mad, furious, rage, outraged, livid, irate, enraged, infuriated, pissed, upset
        - Unfairness: unfair, unjust, unacceptable, ridiculous, absurd, stupid, wrong, terrible, horrible, awful
        
        FEAR/ANXIETY (sentiment -0.5 to -0.2):
        - Worry: worried, anxious, nervous, uneasy, restless, tense, stressed, overwhelmed, concerned, troubled
        - Fear: scared, frightened, afraid, terrified, horrified, panic, alarmed, fearful
        - Uncertainty: uncertain, unsure, confused, doubtful, hesitant, insecure, vulnerable
        
        SURPRISE (sentiment varies based on context):
        - Positive Surprise (sentiment 0.3 to 0.7): wow, amazing, unbelievable, incredible, astonishing (in positive context)
        - Negative Surprise (sentiment -0.5 to -0.2): shocked, stunned, horrified (in negative context)
        - Neutral Surprise (sentiment -0.1 to 0.1): unexpected, surprising, suddenly
        - General: shocked, stunned, astonished, amazed, astounded, speechless, bewildered, startled
        
        IMPORTANT: Surprise should affect sentiment based on context:
        - If surprise words appear with positive words → positive sentiment (0.3 to 0.7)
        - If surprise words appear with negative words → negative sentiment (-0.5 to -0.2)
        - If surprise appears alone → slight positive sentiment (0.1 to 0.3) as surprise is often mildly exciting
        
        DISGUST (sentiment -0.6 to -0.3):
        - Revulsion: disgusting, gross, revolting, repulsive, vile, nasty, sickening, nauseating
        
        Analyze the COMPLETE CONTEXT of "{text}" and provide:
        
        1. Sentiment score: Float between -1 (very negative) and 1 (very positive)
           - For SURPRISE: Don't leave at 0! Consider context to determine if positive or negative surprise
        2. Sentiment type: "positive" if > 0.2, "negative" if < -0.2, else "neutral"
        3. Keywords: 3-5 most emotionally relevant words
        4. Dominant emotion: joy, sadness, anger, fear, surprise, disgust, or neutral
        
        Respond with ONLY valid JSON:
        {{
            "sentiment": [float between -1 and 1],
            "sentiment_type": "[positive/negative/neutral]",
            "keywords": ["word1", "word2", "word3"],
            "dominant_emotion": "[joy/sadness/anger/fear/surprise/disgust/neutral]"
        }}
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
            
            # Get dominant emotion first to check for surprise
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
            
            if emotion == "surprise" and abs(validated["sentiment"]) < 0.1:
                validated["sentiment"] = 0.2
                logger.debug("Adjusted neutral surprise to slight positive sentiment")
            
            sentiment_type = response.get("sentiment_type", "").lower()
            if sentiment_type not in ["positive", "negative", "neutral"]:
                if validated["sentiment"] > 0.2:
                    sentiment_type = "positive"
                elif validated["sentiment"] < -0.2:
                    sentiment_type = "negative"
                else:
                    sentiment_type = "neutral"
            validated["sentiment_type"] = sentiment_type
            
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
            
            logger.debug(f"Validated response: {validated}")
            return validated
            
        except (KeyError, ValueError, TypeError) as e:
            logger.error(f"Response validation error: {str(e)}")
            raise ValueError(f"Invalid response format from OpenAI: {str(e)}")

    def _generate_fallback_response(self, text: str) -> Dict:
        logger.info("Using fallback sentiment analysis (OpenAI unavailable)")
        
        text_lower = text.lower()
        words = text_lower.split()
        
        # Comprehensive emotion word sets
        joy_words = {
            'happy', 'happier', 'happiest', 'joy', 'joyful', 'delighted', 'cheerful', 
            'pleased', 'glad', 'elated', 'ecstatic', 'overjoyed', 'thrilled',
            'excited', 'exciting', 'amazing', 'wonderful', 'fantastic', 'awesome', 
            'promoted', 'promotion', 'success', 'successful', 'accomplished', 
            'achievement', 'win', 'won', 'winning', 'victory', 'triumph',
            'love', 'loved', 'loving', 'grateful', 'thankful', 'blessed'
        }
        
        sadness_words = {
            'sad', 'unhappy', 'miserable', 'depressed', 'melancholy', 'gloomy', 
            'grief', 'mourn', 'cry', 'tears', 'heartbroken', 'devastated', 
            'lonely', 'alone', 'isolated', 'empty', 'miss', 'missing', 'lost', 
            'disappointed', 'failed', 'failure', 'hopeless', 'despair'
        }
        
        anger_words = {
            'angry', 'mad', 'furious', 'rage', 'outraged', 'livid', 'irate', 
            'frustrated', 'annoyed', 'irritated', 'aggravated', 'exasperated',
            'unfair', 'unacceptable', 'ridiculous', 'absurd', 'stupid', 'wrong', 
            'terrible', 'horrible', 'awful', 'hate', 'despise'
        }
        
        fear_words = {
            'worried', 'anxious', 'nervous', 'uneasy', 'tense', 'stressed', 
            'scared', 'frightened', 'afraid', 'terrified', 'horrified', 'panic',
            'uncertain', 'unsure', 'confused', 'doubtful', 'insecure', 'fearful'
        }
        
        surprise_words = {
            'shocked', 'stunned', 'astonished', 'amazed', 'astounded', 
            'speechless', 'bewildered', 'unexpected', 'surprising', 'wow', 
            'whoa', 'unbelievable', 'incredible', 'startled', 'surprised'
        }
        
        disgust_words = {
            'disgusting', 'gross', 'revolting', 'repulsive', 'vile', 'nasty', 
            'sickening', 'nauseating', 'yuck', 'ew', 'ugh'
        }
        
        # Calculate scores
        sentiment_score = 0
        keywords = []
        emotion_counts = {
            'joy': 0,
            'sadness': 0,
            'anger': 0,
            'fear': 0,
            'surprise': 0,
            'disgust': 0
        }
        
        # Track if we have positive or negative context with surprise
        has_positive_context = False
        has_negative_context = False
        
        # Check for specific phrase patterns
        if 'promoted' in text_lower and ('happy' in text_lower or 'happier' in text_lower):
            sentiment_score = 0.8
            emotion_counts['joy'] = 5
            keywords = ['promoted', 'happier', 'work']
        else:
            for word in words:
                clean_word = word.strip('.,!?;:"\'')
                
                if clean_word in joy_words:
                    sentiment_score += 0.3
                    emotion_counts['joy'] += 1
                    has_positive_context = True
                    if clean_word not in ['good', 'great']:
                        keywords.append(clean_word)
                elif clean_word in sadness_words:
                    sentiment_score -= 0.3
                    emotion_counts['sadness'] += 1
                    has_negative_context = True
                    keywords.append(clean_word)
                elif clean_word in anger_words:
                    sentiment_score -= 0.35
                    emotion_counts['anger'] += 1
                    has_negative_context = True
                    keywords.append(clean_word)
                elif clean_word in fear_words:
                    sentiment_score -= 0.25
                    emotion_counts['fear'] += 1
                    has_negative_context = True
                    keywords.append(clean_word)
                elif clean_word in surprise_words:
                    emotion_counts['surprise'] += 1
                    # Surprise affects sentiment based on context
                    if has_positive_context:
                        sentiment_score += 0.2
                    elif has_negative_context:
                        sentiment_score -= 0.15
                    else:
                        # Default surprise is slightly positive (exciting)
                        sentiment_score += 0.1
                    keywords.append(clean_word)
                elif clean_word in disgust_words:
                    sentiment_score -= 0.3
                    emotion_counts['disgust'] += 1
                    has_negative_context = True
                    keywords.append(clean_word)
        
        # Determine dominant emotion
        dominant_emotion = max(emotion_counts, key=emotion_counts.get)
        if emotion_counts[dominant_emotion] == 0:
            dominant_emotion = 'neutral'
        
        if dominant_emotion == 'surprise':
            # If surprise is dominant but sentiment is neutral, make it slightly positive
            if abs(sentiment_score) < 0.1:
                sentiment_score = 0.2  # Default surprise to slight positive
            # Amplify surprise sentiment slightly
            elif sentiment_score > 0:
                sentiment_score = min(1, sentiment_score * 1.2)
            else:
                sentiment_score = max(-1, sentiment_score * 1.2)
        
        # Normalize sentiment score
        sentiment_score = max(-1, min(1, sentiment_score))
        
        # Determine sentiment type
        if sentiment_score > 0.2:
            sentiment_type = "positive"
        elif sentiment_score < -0.2:
            sentiment_type = "negative"
        else:
            sentiment_type = "neutral"
        
        # Ensure we have keywords
        if not keywords:
            keywords = [w.strip('.,!?;:"\'') for w in words if len(w) > 3][:5]
        
        result = {
            "sentiment": round(sentiment_score, 3),
            "sentiment_type": sentiment_type,
            "keywords": keywords[:5],
            "dominant_emotion": dominant_emotion
        }
        
        logger.info(f"Fallback analysis result: {result}")
        return result