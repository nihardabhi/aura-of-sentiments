import React, { useRef, useEffect, useMemo } from 'react';

const AuraVisualization = ({ sentiment = 0, sentimentType = 'neutral', energy = 0.5, dominantEmotion = 'neutral', keywords = [] }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const particlesRef = useRef([]);
  const flowFieldRef = useRef([]);
  const zoffRef = useRef(0);
  const currentColorRef = useRef([150, 150, 150]);
  
  // Emotion color palette with gradients
  const emotionColors = {
    joy: {
      primary: [255, 223, 0],
      secondary: [255, 191, 0],
      glow: [255, 239, 153]
    },
    sadness: {
      primary: [70, 130, 180],
      secondary: [100, 149, 237],
      glow: [176, 196, 222]
    },
    anger: {
      primary: [255, 69, 0],
      secondary: [220, 20, 60],
      glow: [255, 99, 71]
    },
    fear: {
      primary: [128, 0, 128],
      secondary: [75, 0, 130],
      glow: [186, 85, 211]
    },
    surprise: {
      primary: [255, 182, 193],
      secondary: [255, 105, 180],
      glow: [255, 192, 203]
    },
    disgust: {
      primary: [128, 128, 0],
      secondary: [85, 107, 47],
      glow: [154, 205, 50]
    },
    neutral: {
      primary: [150, 150, 150],
      secondary: [128, 128, 128],
      glow: [192, 192, 192]
    }
  };

  // Improved Perlin Noise implementation
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
        
        // Initialize permutation table
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
        // Find unit grid cell containing point
        let X = Math.floor(x);
        let Y = Math.floor(y);
        
        // Get relative xy coordinates of point within that cell
        x = x - X;
        y = y - Y;
        
        // Wrap the integer cells at 255
        X = X & 255;
        Y = Y & 255;
        
        // Calculate noise contributions from each of the four corners
        const n00 = this.dot(this.gradP[X + this.perm[Y]], x, y);
        const n01 = this.dot(this.gradP[X + this.perm[Y + 1]], x, y - 1);
        const n10 = this.dot(this.gradP[X + 1 + this.perm[Y]], x - 1, y);
        const n11 = this.dot(this.gradP[X + 1 + this.perm[Y + 1]], x - 1, y - 1);
        
        // Compute the fade curve value for x
        const u = this.fade(x);
        
        // Interpolate the four results
        const nx0 = this.lerp(n00, n10, u);
        const nx1 = this.lerp(n01, n11, u);
        
        // Compute the fade curve value for y
        const v = this.fade(y);
        
        // Interpolate the two last results
        return this.lerp(nx0, nx1, v);
      }

      // Multi-octave Perlin noise for more organic patterns
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

  // Particle class with enhanced properties
  class Particle {
    constructor(canvas) {
      this.canvas = canvas;
      this.reset();
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
      this.maxLife = 1;
      this.size = Math.random() * 1.5 + 0.5;
      this.hue = Math.random() * 30 - 15;
    }

    follow(flowField, cols, scale) {
      const x = Math.floor(this.x / scale);
      const y = Math.floor(this.y / scale);
      const index = x + y * cols;
      
      if (flowField[index]) {
        const force = flowField[index];
        this.applyForce(force.x, force.y);
      }
    }

    applyForce(fx, fy) {
      this.ax += fx;
      this.ay += fy;
    }

    update(energy, sentiment) {
      // Update velocity
      this.vx += this.ax;
      this.vy += this.ay;
      
      // Dynamic max speed based on energy and sentiment
      this.maxSpeed = 2 + energy * 4 + Math.abs(sentiment) * 2;
      
      // Limit velocity
      const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      if (currentSpeed > this.maxSpeed) {
        this.vx = (this.vx / currentSpeed) * this.maxSpeed;
        this.vy = (this.vy / currentSpeed) * this.maxSpeed;
      }
      
      // Store previous position for trail
      this.prevX = this.x;
      this.prevY = this.y;
      
      // Update position
      this.x += this.vx;
      this.y += this.vy;
      
      // Reset acceleration
      this.ax = 0;
      this.ay = 0;
      
      // Update life
      this.life -= 0.002 * (1 + energy * 0.5);
      
      // Handle edges (wrap around)
      if (this.x < 0) {
        this.x = this.canvas.width;
        this.prevX = this.canvas.width;
      } else if (this.x > this.canvas.width) {
        this.x = 0;
        this.prevX = 0;
      }
      
      if (this.y < 0) {
        this.y = this.canvas.height;
        this.prevY = this.canvas.height;
      } else if (this.y > this.canvas.height) {
        this.y = 0;
        this.prevY = 0;
      }
      
      // Reset if dead
      if (this.life <= 0) {
        this.reset();
      }
    }

    draw(ctx, baseColor, sentiment, energy) {
      const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      const normalizedSpeed = speed / this.maxSpeed;
      
      // Calculate dynamic color
      let r = baseColor[0];
      let g = baseColor[1];
      let b = baseColor[2];
      
      // Apply sentiment color shift
      if (sentiment > 0) {
        // Warm colors for positive sentiment
        r = Math.min(255, r + sentiment * 150 * normalizedSpeed);
        g = Math.min(255, g + sentiment * 100);
        b = Math.max(0, b - sentiment * 50);
      } else if (sentiment < 0) {
        // Cool colors for negative sentiment
        r = Math.max(0, r - Math.abs(sentiment) * 100);
        g = Math.max(0, g - Math.abs(sentiment) * 50);
        b = Math.min(255, b + Math.abs(sentiment) * 150 * normalizedSpeed);
      }
      
      // Add energy brightness
      const energyBoost = energy * 80 * normalizedSpeed;
      r = Math.min(255, r + energyBoost);
      g = Math.min(255, g + energyBoost);
      b = Math.min(255, b + energyBoost);
      
      // Add individual particle hue variation
      r = Math.min(255, Math.max(0, r + this.hue));
      g = Math.min(255, Math.max(0, g + this.hue));
      b = Math.min(255, Math.max(0, b + this.hue));
      
      // Calculate alpha based on life and speed
      const baseAlpha = 0.05;
      const speedAlpha = normalizedSpeed * 0.3;
      const lifeAlpha = this.life * 0.5;
      const energyAlpha = energy * 0.2;
      const alpha = Math.min(1, baseAlpha + speedAlpha + lifeAlpha + energyAlpha);
      
      // Draw particle trail
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)}, ${alpha})`;
      ctx.lineWidth = this.size * (1 + normalizedSpeed * 0.5);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.prevX, this.prevY);
      ctx.lineTo(this.x, this.y);
      ctx.stroke();
      
      // Add glow effect for high energy or strong sentiment
      if (energy > 0.7 || Math.abs(sentiment) > 0.7) {
        ctx.strokeStyle = `rgba(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)}, ${alpha * 0.3})`;
        ctx.lineWidth = this.size * 4;
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
    
    // Setup canvas
    const setupCanvas = () => {
      canvas.width = width;
      canvas.height = height;
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, width, height);
    };
    
    setupCanvas();

    // Initialize particles
    const particleCount = 2500; // More particles for denser effect
    for (let i = 0; i < particleCount; i++) {
      particlesRef.current.push(new Particle(canvas));
    }

    // Flow field parameters
    const scale = 20;
    let cols = Math.floor(width / scale) + 1;
    let rows = Math.floor(height / scale) + 1;

    // Animation loop
    const animate = () => {
      // Create trail effect with adjustable fade
      const fadeAlpha = 0.02 + (1 - energy) * 0.03;
      ctx.fillStyle = `rgba(0, 0, 0, ${fadeAlpha})`;
      ctx.fillRect(0, 0, width, height);

      // Update flow field
      cols = Math.floor(width / scale) + 1;
      rows = Math.floor(height / scale) + 1;
      flowFieldRef.current = [];
      
      // Adjust noise increment based on energy and sentiment
      const inc = 0.05 + Math.abs(sentiment) * 0.03 + energy * 0.02;
      
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const index = x + y * cols;
          
          // Use Perlin noise for organic flow
          const noiseValue = PerlinNoise.octaveNoise(
            x * inc,
            y * inc + zoffRef.current,
            4,
            0.5
          );
          
          // Base angle from noise
          let angle = noiseValue * Math.PI * 4;
          
          // Add sentiment-based flow modifications
          const centerX = cols / 2;
          const centerY = rows / 2;
          const dx = x - centerX;
          const dy = y - centerY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);
          const normalizedDistance = distance / maxDistance;
          
          if (sentiment > 0) {
            // Positive sentiment: outward spiral
            const spiralAngle = Math.atan2(dy, dx);
            angle += spiralAngle * sentiment * 0.5;
            angle += normalizedDistance * sentiment * Math.PI * 0.5;
          } else if (sentiment < 0) {
            // Negative sentiment: inward vortex with turbulence
            const vortexAngle = Math.atan2(dy, dx);
            angle -= vortexAngle * Math.abs(sentiment) * 0.5;
            angle += Math.sin(zoffRef.current * 5 + normalizedDistance * 10) * Math.abs(sentiment) * 0.5;
          }
          
          // Add energy-based pulsation
          if (energy > 0.5) {
            angle += Math.sin(zoffRef.current * 3 + distance * 0.1) * energy * 0.3;
          }
          
          // Create force vector
          const magnitude = 0.5 + energy * 0.5 + Math.abs(sentiment) * 0.3;
          flowFieldRef.current[index] = {
            x: Math.cos(angle) * magnitude,
            y: Math.sin(angle) * magnitude
          };
        }
      }
      
      // Update z offset for animation
      zoffRef.current += 0.003 + energy * 0.002 + Math.abs(sentiment) * 0.001;

      // Update target color based on emotion
      const targetColor = emotionColors[dominantEmotion]?.primary || emotionColors.neutral.primary;
      
      // Smooth color transition
      for (let i = 0; i < 3; i++) {
        currentColorRef.current[i] += (targetColor[i] - currentColorRef.current[i]) * 0.05;
      }

      // Update and draw particles
      particlesRef.current.forEach(particle => {
        particle.follow(flowFieldRef.current, cols, scale);
        particle.update(energy, sentiment);
        particle.draw(ctx, currentColorRef.current, sentiment, energy);
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    // Handle resize
    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      setupCanvas();
    };

    window.addEventListener('resize', handleResize);

    // Start animation
    animate();

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      particlesRef.current = [];
    };
  }, [PerlinNoise, emotionColors, dominantEmotion]);

  return (
    <div className="visualization-container" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
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