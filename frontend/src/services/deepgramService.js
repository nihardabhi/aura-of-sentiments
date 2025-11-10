export class DeepgramService {
  constructor(apiKey, onTranscript, onStatus, onError) {
    this.apiKey = apiKey;
    this.onTranscript = onTranscript;
    this.onStatus = onStatus;
    this.onError = onError;
    this.socket = null;
    this.stream = null;
    this.audioContext = null;
    this.processor = null;
    this.source = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.isConnecting = false;
    this.keepAliveInterval = null;
  }

  async connect() {
    // Prevent multiple simultaneous connections
    if (this.isConnecting || (this.socket && this.socket.readyState === WebSocket.OPEN)) {
      console.log('Already connected or connecting');
      return;
    }

    this.isConnecting = true;

    try {
      this.onStatus('connecting');
      
      // Get user media with optimized constraints
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000 // Request 16kHz directly
        } 
      }).catch(error => {
        // Fallback to basic audio if advanced constraints fail
        console.log('Advanced audio constraints failed, using basic audio');
        return navigator.mediaDevices.getUserMedia({ audio: true });
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
        vad_events: 'true',
        endpointing: '300' // Add endpointing for better speech detection
      });

      this.socket = new WebSocket(`${url}?${params}`, ['token', this.apiKey]);
      
      // Set binary type for proper audio handling
      this.socket.binaryType = 'arraybuffer';

      this.socket.onopen = () => {
        console.log('Deepgram WebSocket connected');
        this.onStatus('connected');
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        
        // Start audio processing
        this.startRecording();
        
        // Start keep-alive ping
        this.startKeepAlive();
      };

      this.socket.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data);
          
          // Handle different message types
          if (data.type === 'Results') {
            if (data.channel && 
                data.channel.alternatives && 
                data.channel.alternatives[0] && 
                data.channel.alternatives[0].transcript) {
              
              console.log('Transcript:', data.channel.alternatives[0].transcript, 'Final:', data.is_final);
              this.onTranscript(data);
            }
          } else if (data.type === 'Metadata') {
            console.log('Deepgram metadata received:', data);
          }
        } catch (error) {
          console.error('Error parsing Deepgram message:', error);
        }
      };

      this.socket.onerror = (error) => {
        console.error('Deepgram WebSocket error:', error);
        this.onError(new Error('WebSocket connection error'));
        this.onStatus('error');
        this.isConnecting = false;
      };

      this.socket.onclose = (event) => {
        console.log('Deepgram WebSocket closed:', event.code, event.reason);
        
        // Stop keep-alive
        this.stopKeepAlive();
        
        // Check for auth error
        if (event.code === 1008) {
          console.error('Invalid Deepgram API key!');
          this.onError(new Error('Invalid API key'));
        }
        
        this.onStatus('disconnected');
        this.isConnecting = false;
        
        // Cleanup audio on close
        this.cleanupAudio();
        
        // Attempt reconnection if not manually closed
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnect();
        }
      };

    } catch (error) {
      console.error('Error accessing microphone:', error);
      this.onError(error);
      this.onStatus('error');
      this.isConnecting = false;
      throw error;
    }
  }

  startRecording() {
    if (!this.stream) {
      console.error('No stream available');
      return;
    }
    
    try {
      // Use AudioContext with fallback
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContextClass({
        sampleRate: 16000
      });
      
      // Resume audio context if suspended (for Chrome autoplay policy)
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
      
      console.log('Audio context sample rate:', this.audioContext.sampleRate);
      
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      
      // Use ScriptProcessorNode with proper buffer size
      const bufferSize = 4096; // Must be power of 2: 256, 512, 1024, 2048, 4096, 8192, 16384
      this.processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
      
      // Buffer for accumulating audio data
      let audioBuffer = [];
      const sendInterval = 100; // Send audio every 100ms
      
      this.processor.onaudioprocess = (e) => {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
          return;
        }
        
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Convert Float32Array to Int16Array
        const output = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        // Add to buffer
        audioBuffer.push(output);
        
        // Send accumulated audio periodically
        if (audioBuffer.length * bufferSize / this.audioContext.sampleRate * 1000 >= sendInterval) {
          // Combine all buffers
          const totalLength = audioBuffer.reduce((acc, buf) => acc + buf.length, 0);
          const combinedBuffer = new Int16Array(totalLength);
          let offset = 0;
          
          for (const buffer of audioBuffer) {
            combinedBuffer.set(buffer, offset);
            offset += buffer.length;
          }
          
          // Send to Deepgram
          if (this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(combinedBuffer.buffer);
          }
          
          // Clear buffer
          audioBuffer = [];
        }
      };
      
      // Connect audio nodes
      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
      
      console.log('Audio recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      this.onError(error);
    }
  }

  startKeepAlive() {
    // Send a keep-alive message every 10 seconds
    this.keepAliveInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'KeepAlive' }));
      }
    }, 10000);
  }

  stopKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  cleanupAudio() {
    // Properly cleanup audio nodes to prevent issues
    if (this.processor) {
      this.processor.disconnect();
      this.processor.onaudioprocess = null;
      this.processor = null;
    }
    
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    
    if (this.audioContext) {
      // Only close if not already closed
      if (this.audioContext.state !== 'closed') {
        this.audioContext.close().catch(e => console.log('AudioContext close error:', e));
      }
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
    
    // Stop keep-alive
    this.stopKeepAlive();
    
    // Cleanup audio first
    this.cleanupAudio();
    
    // Stop media stream tracks
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
        console.log('Track stopped:', track.kind);
      });
      this.stream = null;
    }
    
    // Close WebSocket
    if (this.socket) {
      if (this.socket.readyState === WebSocket.OPEN) {
        this.socket.close(1000, 'User disconnected');
      }
      this.socket = null;
    }
    
    this.isConnecting = false;
    this.onStatus('disconnected');
  }
  
  // Add method to check if connected
  isConnected() {
    return this.socket && this.socket.readyState === WebSocket.OPEN;
  }
}