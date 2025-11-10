import { useState, useEffect, useCallback, useRef } from 'react';
import AuraVisualization from './components/AuraVisualization';
import TranscriptDisplay from './components/TranscriptDisplay';
import KeywordsDisplay from './components/KeywordsDisplay';
import Controls from './components/Controls';
import ErrorBoundary from './components/ErrorBoundary';
import { DeepgramService } from './services/deepgramService';
import { processText } from './services/apiService';
import './styles/App.css';

function App() {
  // State management
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [sentiment, setSentiment] = useState(0);
  const [sentimentType, setSentimentType] = useState('neutral');
  const [keywords, setKeywords] = useState([]);
  const [dominantEmotion, setDominantEmotion] = useState('neutral');
  const [showInterface, setShowInterface] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  
  // Refs
  const deepgramServiceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const apiQueueRef = useRef([]);
  const processingRef = useRef(false);
  const currentUtteranceRef = useRef('');
  const utteranceIdRef = useRef(0);
  
  // Initialize and show interface with animation
  useEffect(() => {
    setTimeout(() => setShowInterface(true), 100);
  }, []);
  
  // Initialize Deepgram service
  useEffect(() => {
    const initDeepgram = () => {
      const service = new DeepgramService(
        process.env.REACT_APP_DEEPGRAM_API_KEY,
        handleTranscript,
        setConnectionStatus,
        (error) => console.error('Deepgram error:', error)
      );
      deepgramServiceRef.current = service;
    };
    
    initDeepgram();
    
    return () => {
      if (deepgramServiceRef.current) {
        deepgramServiceRef.current.disconnect();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);
  
  // Process API queue
  const processApiQueue = useCallback(async () => {
    if (processingRef.current || apiQueueRef.current.length === 0) return;
    
    processingRef.current = true;
    
    while (apiQueueRef.current.length > 0) {
      const text = apiQueueRef.current.shift();
      
      try {
        const response = await processText(text);
        console.log('Backend response:', response);
        animateStateUpdate(response);
      } catch (error) {
        console.error('API error:', error);
        const fallbackResponse = generateFallbackSentiment(text);
        animateStateUpdate(fallbackResponse);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    processingRef.current = false;
  }, []);
  
  // Animate state updates
  const animateStateUpdate = useCallback((response) => {
    requestAnimationFrame(() => {
      const steps = 30;
      const currentSentiment = sentiment;
      const sentimentDiff = response.sentiment - currentSentiment;
      
      let step = 0;
      const animateStep = () => {
        if (step < steps) {
          setSentiment(prev => prev + sentimentDiff / steps);
          step++;
          requestAnimationFrame(animateStep);
        } else {
          setSentiment(response.sentiment);
          setSentimentType(response.sentiment_type);
          setDominantEmotion(response.dominant_emotion);
        }
      };
      animateStep();
      
      setKeywords([]);
      response.keywords.forEach((keyword, index) => {
        setTimeout(() => {
          setKeywords(prev => {
            if (!prev.includes(keyword)) {
              return [...prev, keyword].slice(-10);
            }
            return prev;
          });
        }, index * 150);
      });
    });
  }, [sentiment]);
  
  // Generate fallback sentiment
  const generateFallbackSentiment = useCallback((text) => {
    const positiveWords = ['good', 'great', 'happy', 'love', 'excellent', 'wonderful', 'amazing', 'fantastic', 'beautiful', 'perfect'];
    const negativeWords = ['bad', 'sad', 'angry', 'hate', 'terrible', 'awful', 'horrible', 'disgusting', 'frustrating', 'disappointing'];
    const words = text.toLowerCase().split(' ');
    
    let sentimentScore = 0;
    const foundKeywords = [];
    
    words.forEach(word => {
      if (positiveWords.includes(word)) {
        sentimentScore += 0.3;
        foundKeywords.push(word);
      } else if (negativeWords.includes(word)) {
        sentimentScore -= 0.3;
        foundKeywords.push(word);
      }
    });
    
    if (foundKeywords.length === 0) {
      const filteredWords = words.filter(w => w.length > 3);
      foundKeywords.push(...filteredWords.slice(0, 3));
    }
    
    return {
      sentiment: Math.max(-1, Math.min(1, sentimentScore)),
      sentiment_type: sentimentScore > 0 ? 'positive' : sentimentScore < 0 ? 'negative' : 'neutral',
      keywords: foundKeywords.slice(0, 5),
      dominant_emotion: sentimentScore > 0.5 ? 'joy' : 
                       sentimentScore > 0 ? 'surprise' :
                       sentimentScore < -0.5 ? 'anger' :
                       sentimentScore < 0 ? 'sadness' : 'neutral'
    };
  }, []);
  
  // Handle transcript
  const handleTranscript = useCallback(async (transcriptData) => {
    try {
      if (transcriptData.channel && 
          transcriptData.channel.alternatives && 
          transcriptData.channel.alternatives[0]) {
        
        const transcript = transcriptData.channel.alternatives[0].transcript;
        const isFinal = transcriptData.is_final;
        
        if (transcript && transcript.trim()) {
          if (isFinal) {
            if (transcript !== currentUtteranceRef.current || currentUtteranceRef.current === '') {
              setTranscript(prev => {
                const newTranscript = {
                  text: transcript,
                  timestamp: Date.now(),
                  id: utteranceIdRef.current++
                };
                return [...prev, newTranscript].slice(-50);
              });
              
              apiQueueRef.current.push(transcript);
              processApiQueue();
              currentUtteranceRef.current = '';
            }
          } else {
            currentUtteranceRef.current = transcript;
          }
        }
      }
      
      if (transcriptData.type === 'UtteranceEnd') {
        currentUtteranceRef.current = '';
      }
    } catch (error) {
      console.error('Error handling transcript:', error);
    }
  }, [processApiQueue]);
  
  // Start/Stop recording
  const handleStartStop = useCallback(async () => {
    if (!isRecording && deepgramServiceRef.current) {
      try {
        if (!process.env.REACT_APP_DEEPGRAM_API_KEY) {
          throw new Error('Deepgram API key not configured');
        }
        
        await deepgramServiceRef.current.connect();
        setIsRecording(true);
        
        setTranscript([]);
        setKeywords([]);
        setSentiment(0);
        setSentimentType('neutral');
        setDominantEmotion('neutral');
        currentUtteranceRef.current = '';
        utteranceIdRef.current = 0;
        
      } catch (error) {
        console.error('Failed to start recording:', error);
        setConnectionStatus('error');
      }
    } else if (deepgramServiceRef.current) {
      deepgramServiceRef.current.disconnect();
      setIsRecording(false);
      apiQueueRef.current = [];
      currentUtteranceRef.current = '';
    }
  }, [isRecording]);

  // Get emotion icon
  const getEmotionIcon = () => {
    const icons = {
      joy: '😊',
      sadness: '😢',
      anger: '😠',
      fear: '😨',
      surprise: '😮',
      disgust: '🤢',
      neutral: '😐'
    };
    return icons[dominantEmotion] || '😐';
  };

  // Calculate energy from sentiment magnitude
  const energy = Math.abs(sentiment);

  return (
    <ErrorBoundary>
      <div className="app">
        {/* Background Visualization */}
        <AuraVisualization 
          sentiment={sentiment}
          sentimentType={sentimentType}
          dominantEmotion={dominantEmotion}
          keywords={keywords}
        />
        
        {/* Animated Grid Background */}
        <div className="grid-background"></div>
        
        {/* Main Interface */}
        <div className={`interface-wrapper ${showInterface ? 'visible' : ''}`}>
          
          {/* Header with Title */}
          <header className="app-header">
            <div className="title-wrapper">
              <h1 className="app-title">
                <span className="title-main">SENTIMENT</span>
                <span className="title-sub">AURA</span>
              </h1>
              <p className="title-tagline">Real-time Emotional Intelligence Visualization</p>
            </div>
          </header>
          
          {/* Main Dashboard */}
          <div className="dashboard">
            
            {/* Metrics Cards - Now only 2 cards */}
            <div className="metrics-row-two">
              <div className={`metric-card sentiment-card ${sentimentType}`}>
                <div className="metric-header">
                  <span className="metric-label">Sentiment Analysis</span>
                  <span className="metric-icon">{getEmotionIcon()}</span>
                </div>
                <div className="metric-value-wrapper">
                  <div className="metric-value">
                    {sentiment >= 0 ? '+' : ''}{(sentiment * 100).toFixed(0)}%
                  </div>
                  <div className="metric-subtext">{sentimentType.toUpperCase()}</div>
                </div>
                <div className="metric-bar">
                  <div 
                    className="metric-bar-fill"
                    style={{
                      width: `${((sentiment + 1) / 2) * 100}%`,
                      background: sentiment > 0 
                        ? 'linear-gradient(90deg, #10b981, #34d399)' 
                        : sentiment < 0
                        ? 'linear-gradient(90deg, #ef4444, #f87171)'
                        : 'linear-gradient(90deg, #6b7280, #9ca3af)'
                    }}
                  />
                </div>
              </div>
              
              <div className="metric-card emotion-card">
                <div className="metric-header">
                  <span className="metric-label">Dominant Emotion</span>
                  <span className="metric-icon">🎭</span>
                </div>
                <div className="emotion-display">
                  <div className="emotion-icon-large">{getEmotionIcon()}</div>
                  <div className="emotion-name">{dominantEmotion.toUpperCase()}</div>
                </div>
              </div>
            </div>
            
            {/* Main Content Area - NOW USING COMPONENTS */}
            <div className="content-grid">
              
              {/* Live Transcript Panel - Using Component */}
              <div className="panel transcript-panel">
                <TranscriptDisplay 
                  transcript={transcript}
                  isProcessing={processingRef.current}
                />
              </div>
              
              {/* Keywords Cloud Panel - Using Component */}
              <div className="panel keywords-panel">
                <KeywordsDisplay 
                  keywords={keywords}
                  sentiment={sentiment}
                  energy={energy}
                />
              </div>
              
              {/* Control Center - Using Component */}
              <div className="panel control-panel">
                <div className="panel-header">
                  <div className="panel-title">
                    <span className="panel-icon">🎙️</span>
                    <h3>Voice Control</h3>
                  </div>
                </div>
                <div className="panel-body control-body">
                  <Controls 
                    isRecording={isRecording}
                    onStartStop={handleStartStop}
                    disabled={connectionStatus === 'connecting'}
                  />
                </div>
              </div>
              
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default App;