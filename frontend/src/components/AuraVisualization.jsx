import { useRef, useEffect, useMemo } from 'react';

const AuraVisualization = ({ 
  sentiment = 0, 
  sentimentType = 'neutral', 
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
  const emotionIntensityRef = useRef(0);
  
  // Emotion Aura Palette — Harmonized & Emotionally Tuned
  const emotionColors = {
    joy: {
      primary: [255, 215, 0],       // Bright golden yellow (pure joy)
      secondary: [255, 165, 0],     // Vibrant orange
      tertiary: [255, 239, 150],    // Soft pastel yellow
      glow: [255, 245, 180],        // Radiant sunlit glow
      direction: 'radiant-spiral',
      speed: 1.3,
      particleBehavior: 'sparkle-dance'
    },

    sadness: {
      primary: [0, 120, 255],       // Bright azure blue (balanced brightness)
      secondary: [30, 144, 255],    // Deep sky blue
      tertiary: [135, 206, 250],    // Soft light blue
      glow: [173, 216, 255],        // Gentle glowing blue aura
      direction: 'slow-fall',
      speed: 0.6,
      particleBehavior: 'tear-float'
    },

    anger: {
      primary: [139, 0, 0],         // Crimson red
      secondary: [220, 20, 60],     // Crimson
      tertiary: [255, 99, 71],      // Hot coral
      glow: [255, 140, 105],        // Radiant red-orange glow
      direction: 'volatile-burst',
      speed: 1.7,
      particleBehavior: 'eruption'
    },

    fear: {
      primary: [48, 25, 52],        // Shadow purple
      secondary: [75, 0, 130],      // Deep indigo
      tertiary: [138, 43, 226],     // Blue-violet
      glow: [186, 85, 211],         // Soft orchid glow
      direction: 'imploding-vortex',
      speed: 1.0,
      particleBehavior: 'tremor'
    },

    surprise: {
      primary: [0, 191, 255],       // Deep sky blue
      secondary: [255, 182, 193],   // Light pink
      tertiary: [255, 255, 255],    // White flash
      glow: [224, 255, 255],        // Pale cyan-white
      direction: 'shockwave',
      speed: 1.5,
      particleBehavior: 'pulse-burst'
    },

    disgust: {
      primary: [46, 139, 87],       // Forest green (more distinct from joy)
      secondary: [60, 179, 113],    // Medium sea green
      tertiary: [144, 238, 144],    // Light pastel green
      glow: [173, 255, 47],         // Bright green-yellow glow
      direction: 'repel-swirls',
      speed: 0.7,
      particleBehavior: 'slime-flow'
    },

    neutral: {
      primary: [150, 150, 150],     // Balanced gray
      secondary: [110, 110, 110],   // Shadow gray
      tertiary: [200, 200, 200],    // Light gray
      glow: [220, 220, 220],        // Subtle neutral glow
      direction: 'steady-flow',
      speed: 1.0,
      particleBehavior: 'smooth-wave'
    }
  };



  // Perlin Noise implementation
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

  // Particle class
  class Particle {
    constructor(canvas) {
      this.canvas = canvas;
      this.reset();
      this.history = [];
      this.maxHistory = 25;
      this.currentColor = [150, 150, 150];
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
      this.emotionResponse = Math.random() * 0.5 + 0.5;
    }

    follow(flowField, cols, scale, emotionDirection, emotionIntensity) {
      const x = Math.floor(this.x / scale);
      const y = Math.floor(this.y / scale);
      const index = x + y * cols;
      
      if (flowField[index]) {
        let force = flowField[index];
        
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const dx = this.x - centerX;
        const dy = this.y - centerY;
        const distFromCenter = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        
        // Emotion-specific movement patterns
        switch(emotionDirection) {
          case 'outward-spiral':
            const spiralForce = emotionIntensity * this.emotionResponse * 0.3;
            this.applyForce(
              Math.cos(angle + this.personalPhase) * spiralForce,
              Math.sin(angle + this.personalPhase) * spiralForce
            );
            break;
            
          case 'downward-drift':
            this.applyForce(0, emotionIntensity * 0.2);
            this.vx *= 0.95;
            break;
            
          case 'chaotic-burst':
            const chaos = emotionIntensity * this.emotionResponse;
            this.applyForce(
              (Math.random() - 0.5) * chaos,
              (Math.random() - 0.5) * chaos
            );
            break;
            
          case 'inward-vortex':
            const pullStrength = emotionIntensity * 0.2;
            this.applyForce(
              -dx / distFromCenter * pullStrength,
              -dy / distFromCenter * pullStrength
            );
            this.applyForce(
              (Math.random() - 0.5) * 0.1,
              (Math.random() - 0.5) * 0.1
            );
            break;
            
          case 'radial-burst':
            const burstForce = emotionIntensity * 0.4;
            this.applyForce(
              dx / distFromCenter * burstForce,
              dy / distFromCenter * burstForce
            );
            break;
            
          case 'repelling':
            if (distFromCenter < 200) {
              this.applyForce(
                dx / distFromCenter * emotionIntensity * 0.3,
                dy / distFromCenter * emotionIntensity * 0.3
              );
            }
            break;
            
          default:
            break;
        }
        
        this.applyForce(force.x * (1 - emotionIntensity * 0.5), force.y * (1 - emotionIntensity * 0.5));
      }
    }

    applyForce(fx, fy) {
      this.ax += fx;
      this.ay += fy;
    }

    updateColor(targetColor, transitionSpeed = 0.05) {
      for (let i = 0; i < 3; i++) {
        this.currentColor[i] += (targetColor[i] - this.currentColor[i]) * transitionSpeed;
      }
    }

    update(sentiment, emotionSpeed) {
      this.vx += this.ax;
      this.vy += this.ay;
      
      // Speed based on emotion and sentiment intensity
      this.maxSpeed = emotionSpeed * (1 + Math.abs(sentiment));
      
      const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      if (currentSpeed > this.maxSpeed) {
        this.vx = (this.vx / currentSpeed) * this.maxSpeed;
        this.vy = (this.vy / currentSpeed) * this.maxSpeed;
      }
      
      this.vx *= 0.98;
      this.vy *= 0.98;
      
      this.history.push({ 
        x: this.x, 
        y: this.y,
        color: [...this.currentColor]
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
      
      this.life -= this.lifeDecay;
      
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

    draw(ctx, sentiment, frameCount, globalAlpha = 1) {
      const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      const normalizedSpeed = speed / this.maxSpeed;
      
      // Draw particle trail
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
      
      // Draw main particle
      const r = Math.floor(this.currentColor[0]);
      const g = Math.floor(this.currentColor[1]);
      const b = Math.floor(this.currentColor[2]);
      
      const baseAlpha = 0.2;
      const speedAlpha = normalizedSpeed * 0.4;
      const lifeAlpha = this.life * 0.5;
      const alpha = Math.min(1, (baseAlpha + speedAlpha + lifeAlpha) * globalAlpha);
      
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.lineWidth = this.size * (1 + normalizedSpeed * 0.5);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.prevX, this.prevY);
      ctx.lineTo(this.x, this.y);
      ctx.stroke();
      
      // Glow effect for high sentiment
      if (Math.abs(sentiment) > 0.6 || normalizedSpeed > 0.7) {
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.3})`;
        ctx.lineWidth = this.size * 5;
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

    const particleDensity = 0.0012;
    const particleCount = Math.min(2500, Math.max(800, width * height * particleDensity));
    
    for (let i = 0; i < particleCount; i++) {
      particlesRef.current.push(new Particle(canvas));
    }

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
        
        const emotionPalette = emotionColors[dominantEmotion] || emotionColors.neutral;
        targetColorRef.current = [...emotionPalette.primary];
      }
      
      // Smooth emotion transition
      if (emotionTransitionRef.current < 1) {
        emotionTransitionRef.current += 0.02;
        emotionIntensityRef.current = Math.sin(emotionTransitionRef.current * Math.PI / 2);
      }
      
      // Update global color smoothly
      for (let i = 0; i < 3; i++) {
        currentColorRef.current[i] += (targetColorRef.current[i] - currentColorRef.current[i]) * 0.03;
      }
      
      // Fade effect
      const fadeAlpha = 0.02;
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
          
          const noiseValue = PerlinNoise.octaveNoise(
            x * inc + zoffRef.current * 0.3,
            y * inc + zoffRef.current * 0.3,
            3,
            0.5
          );
          
          let angle = noiseValue * Math.PI * 4;
          angle += Math.sin(zoffRef.current * 2 + x * 0.05) * 0.2;
          angle += Math.cos(zoffRef.current * 2 + y * 0.05) * 0.2;
          
          const magnitude = 0.3 + Math.abs(sentiment) * 0.3;
          
          flowFieldRef.current[index] = {
            x: Math.cos(angle) * magnitude,
            y: Math.sin(angle) * magnitude
          };
        }
      }
      
      zoffRef.current += 0.003 + Math.abs(sentiment) * 0.001;

      const emotionPalette = emotionColors[dominantEmotion] || emotionColors.neutral;
      const emotionDirection = emotionPalette.direction;
      const emotionSpeed = emotionPalette.speed;
      
      // Update and draw particles
      particlesRef.current.forEach(particle => {
        particle.updateColor(currentColorRef.current, 0.02);
        particle.follow(flowFieldRef.current, cols, scale, emotionDirection, emotionIntensityRef.current);
        particle.update(sentiment, emotionSpeed);
        particle.draw(ctx, sentiment, frameCountRef.current, 1);
      });
      
      // Emotion transition effect
      if (emotionTransitionRef.current < 1) {
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
      
      // Keyword visualization
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
  }, [PerlinNoise, emotionColors, dominantEmotion, keywords, sentiment]);

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