# aura-of-sentiments

**Real-time Emotional Intelligence Visualization System**

## ✨ Features

### 🎤 **Real-time Speech Recognition**
- Live transcription using Deepgram's Nova-2 model
- WebSocket streaming for instant feedback

### 🧠 **Advanced Sentiment Analysis**
- OpenAI-powered emotion detection
- Six emotion categories: Joy, Sadness, Anger, Fear, Surprise, Disgust
- Context-aware sentiment scoring (-1 to +1 scale)
- Intelligent keyword extraction

### 🌌 **Dynamic Visual Experience**
- Particle-based flow field visualization
- Emotion-specific color palettes and movement patterns
- Real-time aura that responds to emotional intensity
- Smooth transitions between emotional states
- 3D keyword cloud animations

### 📊 **Comprehensive Analytics Dashboard**
- Live sentiment percentage tracking
- Dominant emotion display with visual feedback
- Real-time transcript with timestamps
- Keyword analysis and trending topics

## 🛠️ Technology Stack

### Frontend
- **React 18** - UI framework
- **Framer Motion** - Smooth animations
- **WebSocket API** - Real-time communication
- **Web Audio API** - Audio processing
- **Canvas API** - Particle visualization
- **Perlin Noise** - Organic flow field generation

### Backend
- **FastAPI** - High-performance Python framework
- **OpenAI API** - GPT-3.5/4 for sentiment analysis
- **Pydantic** - Data validation
- **asyncio** - Asynchronous processing
- **CORS** - Cross-origin support

## 📦 Dependencies

### Frontend Dependencies
```json
{
  "dependencies": {
    "@emotion/react": "11.14.0",
    "@emotion/styled": "11.14.1",
    "axios": "1.13.2",
    "framer-motion": "10.18.0",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "react-p5": "1.4.1",
    "react-scripts": "5.0.1",
    "web-vitals": "3.5.2"
  }
}
```

### Backend Requirements
```txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
python-dotenv==1.2.1
openai==1.3.0
anthropic==0.7.0
google-generativeai==0.3.0
pydantic==2.5.0
python-multipart==0.0.6
httpx==0.25.1
websockets==12.0
aiofiles==23.2.1
```
