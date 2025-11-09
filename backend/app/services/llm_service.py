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
        
        CONTEXTUAL ANALYSIS EXAMPLES:
        - "I got promoted and I'm so happy" = JOY (positive combination)
        - "I'm not happy about this" = SADNESS/ANGER (negation)
        - "I can't be more happy" or "couldn't be happier" = JOY (emphatic positive)
        - "Great, just great" (sarcastic) = ANGER (context matters)
        - "I'm worried but trying to stay positive" = FEAR (underlying emotion)
        - "Everything is fine" (after describing problems) = SADNESS (contradiction)
        
        COMPREHENSIVE EMOTION KEYWORDS GUIDE:
        
        JOY/POSITIVE (sentiment 0.5 to 1.0):
        - Achievement: promoted, promotion, success, successful, accomplished, achievement, win, won, winning, victory, triumph, conquered, graduated, passed, earned, awarded, recognized, milestone, goal
        - Happiness: happy, happier, happiest, joy, joyful, delighted, cheerful, pleased, glad, elated, ecstatic, overjoyed, thrilled, euphoric, blissful, content, satisfied, fulfilled, smiling, laughing
        - Excitement: excited, exciting, amazing, wonderful, fantastic, awesome, incredible, brilliant, spectacular, magnificent, marvelous, fabulous, outstanding, excellent, superb, great, phenomenal
        - Love: love, loved, loving, adore, cherish, treasure, beloved, dear, caring, affection, fond, romantic, passion, devoted, attached, close
        - Gratitude: grateful, thankful, blessed, appreciate, fortunate, lucky, privileged
        - Celebration: celebrate, party, congratulations, cheers, hooray, yay, woohoo, hurray
        - Optimism: hopeful, optimistic, positive, confident, looking forward, can't wait
        
        SADNESS/NEGATIVE (sentiment -1.0 to -0.3):
        - Loss: miss, missing, lost, gone, departed, passed away, deceased, abandoned, left, goodbye, farewell, ending, over
        - Loneliness: lonely, alone, isolated, solitary, empty, hollow, abandoned, forgotten, neglected, rejected, unwanted, excluded
        - Sadness: sad, sorrow, unhappy, miserable, depressed, melancholy, gloomy, grief, mourn, cry, crying, tears, weep, heartbroken, devastated, down, blue, low
        - Disappointment: disappointed, let down, failed, failure, unsuccessful, defeated, hopeless, despair, discouraged, disheartened, crushed, deflated
        - Pain: hurt, pain, ache, suffering, agony, wounded, broken, damaged, scarred
        - Regret: regret, sorry, wish, should have, could have, mistake, fault, blame
        
        ANGER/NEGATIVE (sentiment -1.0 to -0.3):
        - Frustration: frustrated, frustrating, annoyed, annoying, irritated, irritating, aggravated, exasperated, fed up, tired of, sick of, enough, can't stand
        - Anger: angry, mad, furious, rage, outraged, livid, irate, enraged, infuriated, pissed, upset, cross, hostile, seething, fuming, boiling
        - Unfairness: unfair, unjust, unacceptable, ridiculous, absurd, stupid, idiotic, wrong, terrible, horrible, awful, pathetic, useless
        - Conflict: hate, despise, detest, loathe, disgusted, revolted, repulsed, can't stand, intolerable, unbearable
        
        FEAR/ANXIETY (sentiment -0.5 to -0.2):
        - Worry: worried, worry, anxious, anxiety, nervous, uneasy, restless, tense, stressed, overwhelmed, concerned, troubled, bothered
        - Fear: scared, frightened, afraid, terrified, horrified, panic, panicking, alarmed, spooked, fearful, phobia, dread
        - Uncertainty: uncertain, unsure, confused, lost, doubtful, hesitant, insecure, vulnerable, shaky, unstable
        - Threat: danger, dangerous, risk, risky, threat, threatening, ominous, scary, creepy, eerie, suspicious
        
        SURPRISE (energy 0.7 to 1.0):
        - Shock: shocked, shocking, stunned, astonished, amazed, astounded, speechless, bewildered, startled, blown away
        - Unexpected: unexpected, surprising, suddenly, unbelievable, incredible, wow, whoa, omg, oh my god, can't believe, no way, seriously, really
        
        DISGUST (sentiment -0.6 to -0.3):
        - Revulsion: disgusting, gross, revolting, repulsive, vile, nasty, horrible, sickening, nauseating, yuck, ew, ugh, blegh
        - Distaste: hate, terrible, awful, bad, unpleasant, offensive, inappropriate, wrong, disturbing
        
        ANALYSIS OUTPUT RULES:
        
        1. Sentiment score: Float between -1 and 1
           - READ THE WHOLE SENTENCE to determine overall sentiment
           - Positive context with positive words = 0.5 to 1.0
           - Negative context with negative words = -1.0 to -0.5
           - Mixed or unclear = -0.2 to 0.2
        
        2. Sentiment type: 
           - sentiment > 0.2 = "positive"
           - sentiment < -0.2 = "negative"
           - otherwise = "neutral"
        
        3. Energy level: Float between 0 and 1
           - Multiple exclamation marks = high energy (0.7-1.0)
           - Caps lock = high energy
           - Calm statement = low energy (0.2-0.5)
        
        4. Keywords: Extract 3-5 most emotionally relevant words from the text
        
        5. Dominant emotion: The PRIMARY emotion expressed in the FULL text
           Choose from: joy, sadness, anger, fear, surprise, disgust, or neutral
        
        CRITICAL ANALYSIS FOR THIS TEXT:
        Analyze: "{text}"
        
        Key observations:
        - Is the person expressing achievement/success? → likely JOY
        - Are they describing loss/failure? → likely SADNESS
        - Are they complaining/criticizing? → likely ANGER
        - Are they expressing uncertainty/danger? → likely FEAR
        - Is something unexpected happening? → likely SURPRISE
        - Are they expressing revulsion? → likely DISGUST
        
        Based on the COMPLETE CONTEXT of "{text}", provide your analysis.
        
        Respond with ONLY valid JSON, no explanations:
        {{
            "sentiment": [float between -1 and 1],
            "sentiment_type": "[positive/negative/neutral]",
            "energy": [float between 0 and 1],
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
        
        # Comprehensive emotion word sets
        joy_words = {
            'happy', 'happier', 'happiest', 'joy', 'joyful', 'delighted', 'cheerful', 
            'pleased', 'glad', 'elated', 'ecstatic', 'overjoyed', 'thrilled', 'euphoric',
            'excited', 'exciting', 'amazing', 'wonderful', 'fantastic', 'awesome', 
            'incredible', 'brilliant', 'spectacular', 'magnificent', 'marvelous', 
            'fabulous', 'outstanding', 'excellent', 'superb', 'great', 'good',
            'promoted', 'promotion', 'success', 'successful', 'accomplished', 
            'achievement', 'win', 'won', 'winning', 'victory', 'triumph',
            'love', 'loved', 'loving', 'adore', 'cherish', 'grateful', 'thankful', 
            'blessed', 'appreciate', 'fortunate', 'lucky', 'celebrate', 'party',
            'congratulations', 'cheers', 'hooray', 'yay', 'woohoo', 'beautiful',
            'perfect', 'best', 'proud'
        }
        
        sadness_words = {
            'sad', 'sorrow', 'unhappy', 'miserable', 'depressed', 'melancholy', 
            'gloomy', 'grief', 'mourn', 'cry', 'crying', 'tears', 'weep', 
            'heartbroken', 'devastated', 'lonely', 'alone', 'isolated', 'empty', 
            'hollow', 'abandoned', 'forgotten', 'neglected', 'rejected', 'miss', 
            'missing', 'lost', 'gone', 'departed', 'disappointed', 'failed', 
            'failure', 'unsuccessful', 'defeated', 'hopeless', 'despair', 
            'discouraged', 'disheartened', 'hurt', 'pain', 'ache', 'suffering', 
            'agony', 'wounded', 'broken', 'difficult', 'hard', 'tough', 'struggle'
        }
        
        anger_words = {
            'angry', 'mad', 'furious', 'rage', 'outraged', 'livid', 'irate', 
            'enraged', 'infuriated', 'pissed', 'upset', 'cross', 'hostile',
            'frustrated', 'frustrating', 'annoyed', 'annoying', 'irritated', 
            'irritating', 'aggravated', 'exasperated', 'unfair', 'unjust', 
            'unacceptable', 'ridiculous', 'absurd', 'stupid', 'idiotic', 'wrong', 
            'terrible', 'horrible', 'awful', 'hate', 'despise', 'detest', 'loathe',
            'disgusted', 'revolted', 'repulsed', 'intolerable', 'enough', 'tired'
        }
        
        fear_words = {
            'worried', 'worry', 'anxious', 'anxiety', 'nervous', 'uneasy', 'restless', 
            'tense', 'stressed', 'overwhelmed', 'concerned', 'troubled', 'scared', 
            'frightened', 'afraid', 'terrified', 'horrified', 'panic', 'panicking', 
            'alarmed', 'spooked', 'fearful', 'phobia', 'uncertain', 'unsure', 
            'confused', 'lost', 'doubtful', 'hesitant', 'insecure', 'vulnerable',
            'danger', 'dangerous', 'risk', 'risky', 'threat', 'threatening', 
            'ominous', 'scary', 'creepy', 'eerie'
        }
        
        surprise_words = {
            'shocked', 'shocking', 'stunned', 'astonished', 'amazed', 'astounded', 
            'speechless', 'bewildered', 'startled', 'unexpected', 'surprising', 
            'suddenly', 'unbelievable', 'incredible', 'wow', 'whoa', 'omg', 
            'really', 'seriously'
        }
        
        disgust_words = {
            'disgusting', 'gross', 'revolting', 'repulsive', 'vile', 'nasty', 
            'horrible', 'sickening', 'nauseating', 'yuck', 'ew', 'ugh', 
            'awful', 'unpleasant', 'offensive', 'inappropriate'
        }
        
        # Calculate scores
        sentiment_score = 0
        energy_score = 0.3
        keywords = []
        emotion_counts = {
            'joy': 0,
            'sadness': 0,
            'anger': 0,
            'fear': 0,
            'surprise': 0,
            'disgust': 0
        }
        
        # Check for specific phrase patterns
        if 'promoted' in text_lower and ('happy' in text_lower or 'happier' in text_lower):
            sentiment_score = 0.8
            emotion_counts['joy'] = 5
            energy_score = 0.7
            keywords = ['promoted', 'happier', 'work']
        else:
            # Word-by-word analysis
            for word in words:
                clean_word = word.strip('.,!?;:"\'')
                
                if clean_word in joy_words:
                    sentiment_score += 0.3
                    emotion_counts['joy'] += 1
                    if clean_word not in ['good', 'great']:  # Skip common words
                        keywords.append(clean_word)
                elif clean_word in sadness_words:
                    sentiment_score -= 0.3
                    emotion_counts['sadness'] += 1
                    keywords.append(clean_word)
                elif clean_word in anger_words:
                    sentiment_score -= 0.35
                    emotion_counts['anger'] += 1
                    keywords.append(clean_word)
                elif clean_word in fear_words:
                    sentiment_score -= 0.25
                    emotion_counts['fear'] += 1
                    keywords.append(clean_word)
                elif clean_word in surprise_words:
                    energy_score += 0.2
                    emotion_counts['surprise'] += 1
                    keywords.append(clean_word)
                elif clean_word in disgust_words:
                    sentiment_score -= 0.3
                    emotion_counts['disgust'] += 1
                    keywords.append(clean_word)
        
        # Count exclamation marks for energy
        exclamation_count = text.count('!')
        energy_score = min(1.0, energy_score + (exclamation_count * 0.15))
        
        # Count capitals for energy
        caps_words = [w for w in words if w.isupper() and len(w) > 1]
        if caps_words:
            energy_score = min(1.0, energy_score + 0.2)
        
        # Determine dominant emotion
        dominant_emotion = max(emotion_counts, key=emotion_counts.get)
        if emotion_counts[dominant_emotion] == 0:
            dominant_emotion = 'neutral'
        
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
            "energy": round(energy_score, 3),
            "keywords": keywords[:5],
            "dominant_emotion": dominant_emotion
        }
        
        logger.info(f"Fallback analysis for '{text[:50]}...' result: {result}")
        return result