export class DeepgramService {
  constructor(apiKey, onTranscript, onStatus, onError) {
    this.apiKey = apiKey;
    this.onTranscript = onTranscript;
    this.onStatus = onStatus;
    this.onError = onError;
    this.socket = null;
    this.stream = null;
    this.audioContext = null;  // ADD THIS
    this.processor = null;      // ADD THIS
    this.source = null;         // ADD THIS
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  async connect() {
    try {
      this.onStatus('connecting');
      
      // Get user media - SIMPLIFIED CONSTRAINTS
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
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
        model: 'nova-2',
        language: 'en-US',
        punctuate: 'true',
        interim_results: 'true',
        utterance_end_ms: '1000',
        vad_events: 'true'
      });

      this.socket = new WebSocket(`${url}?${params}`, ['token', this.apiKey]);

      this.socket.onopen = () => {
        console.log('✅ Deepgram WebSocket connected');
        this.onStatus('connected');
        this.reconnectAttempts = 0;
        this.startRecording();
      };

      this.socket.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data);
          console.log('Deepgram message:', data); // ADD THIS FOR DEBUGGING
          
          // Check for transcript
          if (data.channel && 
              data.channel.alternatives && 
              data.channel.alternatives[0] && 
              data.channel.alternatives[0].transcript) {
            console.log('Transcript:', data.channel.alternatives[0].transcript);
            this.onTranscript(data);
          }
        } catch (error) {
          console.error('Error parsing Deepgram message:', error);
        }
      };

      this.socket.onerror = (error) => {
        console.error('❌ Deepgram WebSocket error:', error);
        this.onError(new Error('WebSocket connection error'));
        this.onStatus('error');
      };

      this.socket.onclose = (event) => {
        console.log('Deepgram WebSocket closed:', event.code, event.reason);
        
        // Check for auth error
        if (event.code === 1008) {
          console.error('❌ Invalid Deepgram API key!');
          this.onError(new Error('Invalid API key'));
        }
        
        this.onStatus('disconnected');
        
        // Cleanup audio on close
        this.cleanupAudio();
        
        // Attempt reconnection if not manually closed
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnect();
        }
      };

    } catch (error) {
      console.error('❌ Error accessing microphone:', error);
      this.onError(error);
      this.onStatus('error');
      throw error;
    }
  }

  startRecording() {
    if (!this.stream) {
      console.error('No stream available');
      return;
    }
    
    try {
      // Create audio context with specific sample rate
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
      });
      
      console.log('Audio context sample rate:', this.audioContext.sampleRate);
      
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      this.processor.onaudioprocess = (e) => {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          
          // Convert Float32Array to Int16Array for Deepgram
          const output = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          
          this.socket.send(output.buffer);
        }
      };
      
      // Connect audio nodes
      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
      
      console.log('✅ Audio recording started');
    } catch (error) {
      console.error('❌ Error starting recording:', error);
      this.onError(error);
    }
  }

  cleanupAudio() {
    // IMPORTANT: Properly cleanup audio nodes
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  async reconnect() {
    this.reconnectAttempts++;
    console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
    
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      await this.connect();
    } catch (error) {
      console.error('Reconnection failed:', error);
    }
  }

  disconnect() {
    console.log('Disconnecting Deepgram service...');
    
    // Cleanup audio first
    this.cleanupAudio();
    
    // Stop media stream
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    // Close WebSocket
    if (this.socket) {
      this.socket.close(1000, 'User disconnected');
      this.socket = null;
    }
    
    this.onStatus('disconnected');
  }
}