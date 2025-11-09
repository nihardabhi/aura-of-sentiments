import React, { useRef, useEffect, useMemo } from 'react';

const AuraVisualization = ({ 
  sentiment = 0, 
  sentimentType = 'neutral', 
  energy = 0.5, 
  dominantEmotion = 'neutral', 
  keywords = [] 
}) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const particlesRef = useRef([]);
  const flowFieldRef = useRef([]);
  const zoffRef = useRef(0);
  const frameCountRef = useRef(0);
  
  // Smooth transition tracking
  const currentEmotionRef = useRef('neutral');
  const emotionTransitionRef = useRef(0);
  const targetColorRef = useRef([150, 150, 150]);
  const currentColorRef = useRef([150, 150, 150]);
  const lastEmotionChangeRef = useRef(0);
  const directionShiftRef = useRef(0);
  const emotionIntensityRef = useRef(0);
  
    // 🌌 Emotion Aura Palette — Harmonized & Emotionally Tuned
  const emotionColors = {
    joy: {
      primary: [255, 223, 70],       // Warm golden yellow
      secondary: [255, 180, 0],      // Deep sunflower orange
      tertiary: [255, 250, 180],     // Pastel yellow
      glow: [255, 240, 200],         // Soft daylight glow
      direction: 'radiant-spiral',   // Expanding, outward
      speed: 1.3,
      particleBehavior: 'sparkle-dance' // Gentle, playful shimmer
    },

    sadness: {
      primary: [54, 69, 79],         // Slate blue-gray
      secondary: [25, 25, 112],      // Midnight blue
      tertiary: [100, 149, 237],     // Cornflower blue
      glow: [176, 196, 222],         // Soft misty blue
      direction: 'slow-fall',        // Downward drifting
      speed: 0.5,
      particleBehavior: 'tear-float' // Slow, graceful fade
    },

    anger: {
      primary: [139, 0, 0],          // Dark blood red
      secondary: [220, 20, 60],      // Crimson red
      tertiary: [255, 99, 71],       // Hot coral
      glow: [255, 120, 90],          // Warm fiery edge
      direction: 'volatile-burst',   // Explosive outward
      speed: 1.7,
      particleBehavior: 'eruption'   // Chaotic sparks
    },

    fear: {
      primary: [48, 25, 52],         // Shadow purple
      secondary: [75, 0, 130],       // Deep indigo
      tertiary: [138, 43, 226],      // Blue-violet
      glow: [186, 85, 211],          // Soft orchid glow
      direction: 'imploding-vortex', // Inward swirl
      speed: 1.0,
      particleBehavior: 'tremor'     // Subtle shaking flicker
    },

    surprise: {
      primary: [0, 191, 255],        // Deep sky blue
      secondary: [255, 182, 193],    // Light pink
      tertiary: [255, 255, 255],     // White flash
      glow: [224, 255, 255],         // Pale cyan-white
      direction: 'shockwave',        // Sudden outward burst
      speed: 1.5,
      particleBehavior: 'pulse-burst' // Expanding ripple effect
    },

    disgust: {
      primary: [85, 107, 47],        // Dark olive green
      secondary: [107, 142, 35],     // Dull olive
      tertiary: [154, 205, 50],      // Muted yellow-green
      glow: [189, 183, 107],         // Faint earthy glow
      direction: 'repel-swirls',     // Outward avoidance flow
      speed: 0.7,
      particleBehavior: 'slime-flow' // Oozing, irregular motion
    },

    neutral: {
      primary: [150, 150, 150],      // Balanced gray
      secondary: [110, 110, 110],    // Shadow gray
      tertiary: [200, 200, 200],     // Light gray
      glow: [220, 220, 220],         // Subtle neutral glow
      direction: 'steady-flow',      // Calm movement
      speed: 1.0,
      particleBehavior: 'smooth-wave' // Gentle, ambient oscillation
    }
  };


  // Improved Perlin Noise with octaves
  const PerlinNoise = useMemo(() => {
    class PerlinNoiseGenerator {
      constructor() {
        this.perm = new Array(512);
        this.gradP = new Array(512);
        this.grad3 = [
          [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
          [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
          [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
        ];
        
        const p = [];
        for (let i = 0; i < 256; i++) {
          p[i] = Math.floor(Math.random() * 256);
        }
        
        for(let i = 0; i < 512; i++) {
          this.perm[i] = p[i & 255];
          this.gradP[i] = this.grad3[this.perm[i] % 12];
        }
      }

      fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
      }

      lerp(a, b, t) {
        return (1 - t) * a + t * b;
      }

      dot(g, x, y) {
        return g[0] * x + g[1] * y;
      }

      noise2D(x, y) {
        let X = Math.floor(x);
        let Y = Math.floor(y);
        
        x = x - X;
        y = y - Y;
        
        X = X & 255;
        Y = Y & 255;
        
        const n00 = this.dot(this.gradP[X + this.perm[Y]], x, y);
        const n01 = this.dot(this.gradP[X + this.perm[Y + 1]], x, y - 1);
        const n10 = this.dot(this.gradP[X + 1 + this.perm[Y]], x - 1, y);
        const n11 = this.dot(this.gradP[X + 1 + this.perm[Y + 1]], x - 1, y - 1);
        
        const u = this.fade(x);
        const nx0 = this.lerp(n00, n10, u);
        const nx1 = this.lerp(n01, n11, u);
        const v = this.fade(y);
        
        return this.lerp(nx0, nx1, v);
      }

      octaveNoise(x, y, octaves = 4, persistence = 0.5) {
        let total = 0;
        let frequency = 1;
        let amplitude = 1;
        let maxValue = 0;
        
        for(let i = 0; i < octaves; i++) {
          total += this.noise2D(x * frequency, y * frequency) * amplitude;
          maxValue += amplitude;
          amplitude *= persistence;
          frequency *= 2;
        }
        
        return total / maxValue;
      }
    }
    
    return new PerlinNoiseGenerator();
  }, []);

  // Enhanced Particle class with emotion-aware behaviors
  class Particle {
    constructor(canvas) {
      this.canvas = canvas;
      this.reset();
      this.history = [];
      this.maxHistory = 25;
      this.colorTransition = 0;
      this.targetColor = [150, 150, 150];
      this.currentColor = [150, 150, 150];
      this.emotionInfluence = 0;
    }

    reset() {
      this.x = Math.random() * this.canvas.width;
      this.y = Math.random() * this.canvas.height;
      this.prevX = this.x;
      this.prevY = this.y;
      this.vx = 0;
      this.vy = 0;
      this.ax = 0;
      this.ay = 0;
      this.maxSpeed = 2;
      this.life = 1;
      this.lifeDecay = 0.002;
      this.size = Math.random() * 2.5 + 0.5;
      this.history = [];
      this.personalPhase = Math.random() * Math.PI * 2;
      this.emotionResponse = Math.random() * 0.5 + 0.5; // How strongly this particle responds to emotions
    }

    follow(flowField, cols, scale, emotionDirection, emotionIntensity) {
      const x = Math.floor(this.x / scale);
      const y = Math.floor(this.y / scale);
      const index = x + y * cols;
      
      if (flowField[index]) {
        let force = flowField[index];
        
        // Apply emotion-specific directional modifications
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const dx = this.x - centerX;
        const dy = this.y - centerY;
        const distFromCenter = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        
        // Emotion-specific movement patterns
        switch(emotionDirection) {
          case 'outward-spiral':
            // Joy - particles spiral outward energetically
            const spiralForce = emotionIntensity * this.emotionResponse * 0.3;
            this.applyForce(
              Math.cos(angle + this.personalPhase) * spiralForce,
              Math.sin(angle + this.personalPhase) * spiralForce
            );
            break;
            
          case 'downward-drift':
            // Sadness - particles drift downward like tears
            this.applyForce(0, emotionIntensity * 0.2);
            this.vx *= 0.95; // Slow horizontal movement
            break;
            
          case 'chaotic-burst':
            // Anger - erratic, aggressive movement
            const chaos = emotionIntensity * this.emotionResponse;
            this.applyForce(
              (Math.random() - 0.5) * chaos,
              (Math.random() - 0.5) * chaos
            );
            break;
            
          case 'inward-vortex':
            // Fear - particles pulled inward anxiously
            const pullStrength = emotionIntensity * 0.2;
            this.applyForce(
              -dx / distFromCenter * pullStrength,
              -dy / distFromCenter * pullStrength
            );
            // Add jitter
            this.applyForce(
              (Math.random() - 0.5) * 0.1,
              (Math.random() - 0.5) * 0.1
            );
            break;
            
          case 'radial-burst':
            // Surprise - sudden radial explosion
            const burstForce = emotionIntensity * 0.4;
            this.applyForce(
              dx / distFromCenter * burstForce,
              dy / distFromCenter * burstForce
            );
            break;
            
          case 'repelling':
            // Disgust - particles avoid center
            if (distFromCenter < 200) {
              this.applyForce(
                dx / distFromCenter * emotionIntensity * 0.3,
                dy / distFromCenter * emotionIntensity * 0.3
              );
            }
            break;
            
          default:
            // Neutral - follow flow field normally
            break;
        }
        
        // Apply base flow field force
        this.applyForce(force.x * (1 - emotionIntensity * 0.5), force.y * (1 - emotionIntensity * 0.5));
      }
    }

    applyForce(fx, fy) {
      this.ax += fx;
      this.ay += fy;
    }

    updateColor(targetColor, transitionSpeed = 0.05) {
      // Smooth color transition
      for (let i = 0; i < 3; i++) {
        this.currentColor[i] += (targetColor[i] - this.currentColor[i]) * transitionSpeed;
      }
    }

    update(energy, sentiment, emotionSpeed) {
      this.vx += this.ax;
      this.vy += this.ay;
      
      // Dynamic speed based on emotion and energy
      this.maxSpeed = emotionSpeed * (1 + energy * 2);
      
      // Apply speed limit
      const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      if (currentSpeed > this.maxSpeed) {
        this.vx = (this.vx / currentSpeed) * this.maxSpeed;
        this.vy = (this.vy / currentSpeed) * this.maxSpeed;
      }
      
      // Apply friction
      this.vx *= 0.98;
      this.vy *= 0.98;
      
      // Store history for trails
      this.history.push({ 
        x: this.x, 
        y: this.y,
        color: [...this.currentColor] // Store color at this point
      });
      if (this.history.length > this.maxHistory) {
        this.history.shift();
      }
      
      this.prevX = this.x;
      this.prevY = this.y;
      
      this.x += this.vx;
      this.y += this.vy;
      
      this.ax = 0;
      this.ay = 0;
      
      // Life decay influenced by energy
      this.life -= this.lifeDecay * (1 + energy * 0.3);
      
      // Edge wrapping
      if (this.x < 0) {
        this.x = this.canvas.width;
        this.prevX = this.canvas.width;
        this.history = [];
      } else if (this.x > this.canvas.width) {
        this.x = 0;
        this.prevX = 0;
        this.history = [];
      }
      
      if (this.y < 0) {
        this.y = this.canvas.height;
        this.prevY = this.canvas.height;
        this.history = [];
      } else if (this.y > this.canvas.height) {
        this.y = 0;
        this.prevY = 0;
        this.history = [];
      }
      
      if (this.life <= 0) {
        this.reset();
      }
    }

    draw(ctx, energy, frameCount, globalAlpha = 1) {
      const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      const normalizedSpeed = speed / this.maxSpeed;
      
      // Draw particle trail with color history
      if (this.history.length > 1) {
        for (let i = 0; i < this.history.length - 1; i++) {
          const point = this.history[i];
          const nextPoint = this.history[i + 1];
          const alpha = (i / this.history.length) * this.life * 0.4 * globalAlpha;
          
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = `rgba(${Math.floor(point.color[0])}, ${Math.floor(point.color[1])}, ${Math.floor(point.color[2])}, ${alpha})`;
          ctx.lineWidth = this.size * (i / this.history.length) * 1.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(point.x, point.y);
          ctx.lineTo(nextPoint.x, nextPoint.y);
          ctx.stroke();
          ctx.restore();
        }
      }
      
      // Draw main particle with current color
      const r = Math.floor(this.currentColor[0]);
      const g = Math.floor(this.currentColor[1]);
      const b = Math.floor(this.currentColor[2]);
      
      // Calculate alpha
      const baseAlpha = 0.2;
      const speedAlpha = normalizedSpeed * 0.4;
      const lifeAlpha = this.life * 0.5;
      const alpha = Math.min(1, (baseAlpha + speedAlpha + lifeAlpha) * globalAlpha);
      
      // Main particle
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.lineWidth = this.size * (1 + normalizedSpeed * 0.5);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.prevX, this.prevY);
      ctx.lineTo(this.x, this.y);
      ctx.stroke();
      
      // Glow effect
      if (energy > 0.6 || normalizedSpeed > 0.7) {
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.3})`;
        ctx.lineWidth = this.size * 5;
        ctx.beginPath();
        ctx.moveTo(this.prevX, this.prevY);
        ctx.lineTo(this.x, this.y);
        ctx.stroke();
      }
      
      // Bright core for fast particles
      if (normalizedSpeed > 0.8) {
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.6})`;
        ctx.lineWidth = this.size * 0.3;
        ctx.beginPath();
        ctx.moveTo(this.prevX, this.prevY);
        ctx.lineTo(this.x, this.y);
        ctx.stroke();
      }
      
      ctx.restore();
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    let width = window.innerWidth;
    let height = window.innerHeight;
    
    const setupCanvas = () => {
      canvas.width = width;
      canvas.height = height;
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, width, height);
    };
    
    setupCanvas();

    // Create particle system
    const particleDensity = 0.0012;
    const particleCount = Math.min(2500, Math.max(800, width * height * particleDensity));
    
    for (let i = 0; i < particleCount; i++) {
      particlesRef.current.push(new Particle(canvas));
    }

    // Flow field parameters
    const scale = 20;
    let cols = Math.floor(width / scale) + 1;
    let rows = Math.floor(height / scale) + 1;

    const animate = () => {
      frameCountRef.current++;
      
      // Check for emotion change
      if (dominantEmotion !== currentEmotionRef.current) {
        lastEmotionChangeRef.current = frameCountRef.current;
        currentEmotionRef.current = dominantEmotion;
        emotionTransitionRef.current = 0;
        
        // Set target color for new emotion
        const emotionPalette = emotionColors[dominantEmotion] || emotionColors.neutral;
        targetColorRef.current = [...emotionPalette.primary];
      }
      
      // Smooth emotion transition
      if (emotionTransitionRef.current < 1) {
        emotionTransitionRef.current += 0.02; // 50 frames for full transition
        emotionIntensityRef.current = Math.sin(emotionTransitionRef.current * Math.PI / 2); // Ease-in curve
      }
      
      // Update global color smoothly
      for (let i = 0; i < 3; i++) {
        currentColorRef.current[i] += (targetColorRef.current[i] - currentColorRef.current[i]) * 0.03;
      }
      
      // Dynamic fade for trails
      const fadeAlpha = 0.015 + (1 - energy) * 0.02;
      ctx.fillStyle = `rgba(0, 0, 0, ${fadeAlpha})`;
      ctx.fillRect(0, 0, width, height);

      // Update flow field
      cols = Math.floor(width / scale) + 1;
      rows = Math.floor(height / scale) + 1;
      flowFieldRef.current = [];
      
      const baseInc = 0.04;
      const inc = baseInc + Math.abs(sentiment) * 0.02;
      
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const index = x + y * cols;
          
          // Multi-octave noise
          const noiseValue = PerlinNoise.octaveNoise(
            x * inc + zoffRef.current * 0.3,
            y * inc + zoffRef.current * 0.3,
            3,
            0.5
          );
          
          // Base angle from noise
          let angle = noiseValue * Math.PI * 4;
          
          // Add time-based undulation
          angle += Math.sin(zoffRef.current * 2 + x * 0.05) * 0.2;
          angle += Math.cos(zoffRef.current * 2 + y * 0.05) * 0.2;
          
          // Calculate force magnitude
          const magnitude = 0.3 + energy * 0.4;
          
          flowFieldRef.current[index] = {
            x: Math.cos(angle) * magnitude,
            y: Math.sin(angle) * magnitude
          };
        }
      }
      
      zoffRef.current += 0.003 + energy * 0.001;

      // Get current emotion properties
      const emotionPalette = emotionColors[dominantEmotion] || emotionColors.neutral;
      const emotionDirection = emotionPalette.direction;
      const emotionSpeed = emotionPalette.speed;
      
      // Update and draw particles
      particlesRef.current.forEach(particle => {
        // Update particle color smoothly
        particle.updateColor(currentColorRef.current, 0.02);
        
        // Apply emotion-specific movement
        particle.follow(flowFieldRef.current, cols, scale, emotionDirection, emotionIntensityRef.current);
        particle.update(energy, sentiment, emotionSpeed);
        particle.draw(ctx, energy, frameCountRef.current, 1);
      });
      
      // Add emotion transition effects
      if (emotionTransitionRef.current < 1) {
        // Create burst effect during transition
        const burstIntensity = emotionIntensityRef.current;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = 100 * burstIntensity;
        
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
        gradient.addColorStop(0, `rgba(${targetColorRef.current[0]}, ${targetColorRef.current[1]}, ${targetColorRef.current[2]}, ${0.3 * burstIntensity})`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
        ctx.restore();
      }
      
      // Keyword influence visualization
      if (keywords && keywords.length > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        
        keywords.forEach((keyword, i) => {
          const keywordX = (PerlinNoise.noise2D(i * 10, zoffRef.current * 0.5) + 1) * 0.5 * width;
          const keywordY = (PerlinNoise.noise2D(i * 10 + 100, zoffRef.current * 0.5) + 1) * 0.5 * height;
          
          const pulse = Math.sin(frameCountRef.current * 0.05 + i) * 0.5 + 0.5;
          const radius = 30 + pulse * 20;
          
          const gradient = ctx.createRadialGradient(keywordX, keywordY, 0, keywordX, keywordY, radius);
          gradient.addColorStop(0, `rgba(${currentColorRef.current[0]}, ${currentColorRef.current[1]}, ${currentColorRef.current[2]}, ${0.4 * pulse})`);
          gradient.addColorStop(0.5, `rgba(${currentColorRef.current[0]}, ${currentColorRef.current[1]}, ${currentColorRef.current[2]}, ${0.2 * pulse})`);
          gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
          
          ctx.fillStyle = gradient;
          ctx.fillRect(keywordX - radius, keywordY - radius, radius * 2, radius * 2);
        });
        
        ctx.restore();
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      setupCanvas();
    };

    window.addEventListener('resize', handleResize);

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      particlesRef.current = [];
    };
  }, [PerlinNoise, emotionColors, dominantEmotion, keywords, sentiment, energy]);

  return (
    <div className="visualization-container" style={{ 
      position: 'absolute', 
      top: 0, 
      left: 0, 
      width: '100%', 
      height: '100%',
      zIndex: 1
    }}>
      <canvas 
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%'
        }}
      />
    </div>
  );
};

export default AuraVisualization;