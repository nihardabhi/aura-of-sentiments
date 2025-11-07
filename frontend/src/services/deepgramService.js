export class DeepgramService {
  constructor(apiKey, onTranscript, onStatus, onError) {
    this.apiKey = apiKey;
    this.onTranscript = onTranscript;
    this.onStatus = onStatus;
    this.onError = onError;
    this.socket = null;
    this.mediaRecorder = null;
    this.stream = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  async connect() {
    try {
      this.onStatus('connecting');
      
      // Get user media
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          sampleSize: 16,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });

      // Create WebSocket connection to Deepgram
      const url = 'wss://api.deepgram.com/v1/listen';
      const params = new URLSearchParams({
        encoding: 'linear16',
        sample_rate: '16000',
        channels: '1',
        interim_results: 'true',
        punctuate: 'true',
        endpointing: 'true',
        language: 'en-US',
        model: 'nova-2'
      });

      this.socket = new WebSocket(`${url}?${params}`, ['token', this.apiKey]);

      this.socket.onopen = () => {
        console.log('Deepgram WebSocket connected');
        this.onStatus('connected');
        this.reconnectAttempts = 0;
        this.startRecording();
      };

      this.socket.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data);
          if (data.channel && this.onTranscript) {
            this.onTranscript(data);
          }
        } catch (error) {
          console.error('Error parsing Deepgram message:', error);
        }
      };

      this.socket.onerror = (error) => {
        console.error('Deepgram WebSocket error:', error);
        this.onError(new Error('WebSocket connection error'));
        this.onStatus('error');
      };

      this.socket.onclose = (event) => {
        console.log('Deepgram WebSocket closed:', event.code, event.reason);
        this.onStatus('disconnected');
        
        // Attempt reconnection if not manually closed
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnect();
        }
      };

    } catch (error) {
      console.error('Error accessing microphone:', error);
      this.onError(error);
      this.onStatus('error');
      throw error;
    }
  }

  startRecording() {
    if (!this.stream) return;

    // Use MediaRecorder for better browser compatibility
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
      ? 'audio/webm;codecs=opus' 
      : 'audio/webm';

    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType: mimeType,
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(event.data);
      }
    };

    this.mediaRecorder.onerror = (error) => {
      console.error('MediaRecorder error:', error);
      this.onError(error);
    };

    this.mediaRecorder.start(100); // Send data every 100ms
  }

  async reconnect() {
    this.reconnectAttempts++;
    console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
    
    // Exponential backoff
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      await this.connect();
    } catch (error) {
      console.error('Reconnection failed:', error);
    }
  }

  disconnect() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    if (this.socket) {
      this.socket.close(1000, 'User disconnected');
      this.socket = null;
    }
    
    this.onStatus('disconnected');
  }
}