import React, { useRef, useEffect } from 'react';
import Sketch from 'react-p5';

const AuraVisualization = ({ sentiment, sentimentType, energy, dominantEmotion, keywords = [] }) => {
  const particlesRef = useRef([]);
  const flowFieldRef = useRef([]);
  const timeRef = useRef(0);
  const targetColorRef = useRef([150, 150, 150]);
  const currentColorRef = useRef([150, 150, 150]);
  
  // Enhanced emotion color palette with gradients
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

  const setup = (p5, canvasParentRef) => {
    const canvas = p5.createCanvas(window.innerWidth, window.innerHeight);
    canvas.parent(canvasParentRef);
    p5.colorMode(p5.RGB, 255, 255, 255, 100);
    p5.blendMode(p5.ADD);
    
    // Initialize enhanced particle system
    const particleCount = 2000; // Increased for more fluid effect
    for (let i = 0; i < particleCount; i++) {
      particlesRef.current.push({
        x: p5.random(p5.width),
        y: p5.random(p5.height),
        prevX: p5.random(p5.width),
        prevY: p5.random(p5.height),
        vel: p5.createVector(0, 0),
        acc: p5.createVector(0, 0),
        maxSpeed: p5.random(0.5, 2),
        size: p5.random(0.5, 2),
        lifespan: 255,
        hue: 0
      });
    }
    
    // Initialize flow field grid
    const cols = Math.floor(p5.width / 20);
    const rows = Math.floor(p5.height / 20);
    flowFieldRef.current = new Array(cols * rows);
  };

  const draw = (p5) => {
    // Dynamic background fade based on energy
    const bgAlpha = p5.map(energy, 0, 1, 40, 10); // More energy = more trails
    p5.fill(0, bgAlpha);
    p5.noStroke();
    p5.rect(0, 0, p5.width, p5.height);
    
    // Update time for noise evolution
    timeRef.current += 0.003 + (energy * 0.007);
    
    // Smooth color transitions
    const emotionColor = emotionColors[dominantEmotion] || emotionColors.neutral;
    targetColorRef.current = emotionColor.primary;
    
    // Lerp current color to target
    for (let i = 0; i < 3; i++) {
      currentColorRef.current[i] = p5.lerp(
        currentColorRef.current[i],
        targetColorRef.current[i],
        0.05
      );
    }
    
    // Update flow field based on Perlin noise
    const cols = Math.floor(p5.width / 20);
    const rows = Math.floor(p5.height / 20);
    const noiseScale = 0.001 + (energy * 0.002); // Dynamic noise scale
    
    for (let x = 0; x < cols; x++) {
      for (let y = 0; y < rows; y++) {
        const index = x + y * cols;
        
        // Multi-octave Perlin noise for more organic movement
        const noise1 = p5.noise(x * noiseScale, y * noiseScale, timeRef.current);
        const noise2 = p5.noise(x * noiseScale * 2, y * noiseScale * 2, timeRef.current * 1.5);
        const noise3 = p5.noise(x * noiseScale * 4, y * noiseScale * 4, timeRef.current * 2);
        
        // Combine octaves with sentiment influence
        const combinedNoise = (noise1 * 0.6 + noise2 * 0.3 + noise3 * 0.1);
        const angle = combinedNoise * p5.TWO_PI * 2 + (sentiment * p5.PI * 0.5);
        
        flowFieldRef.current[index] = p5.createVector(p5.cos(angle), p5.sin(angle));
      }
    }
    
    // Draw particles with enhanced effects
    particlesRef.current.forEach((particle, index) => {
      // Apply flow field forces
      const x = Math.floor(particle.x / 20);
      const y = Math.floor(particle.y / 20);
      const index2d = x + y * cols;
      
      if (flowFieldRef.current[index2d]) {
        const force = flowFieldRef.current[index2d].copy();
        force.mult(0.1 + energy * 0.3); // Energy affects force strength
        particle.acc.add(force);
        
        // Add spiral motion for positive sentiment
        if (sentiment > 0.3) {
          const spiralForce = p5.createVector(
            p5.cos(timeRef.current * 2 + index * 0.01) * sentiment,
            p5.sin(timeRef.current * 2 + index * 0.01) * sentiment
          );
          particle.acc.add(spiralForce.mult(0.05));
        }
        
        // Add turbulence for negative sentiment
        if (sentiment < -0.3) {
          const turbulence = p5.createVector(
            p5.random(-1, 1) * Math.abs(sentiment),
            p5.random(-1, 1) * Math.abs(sentiment)
          );
          particle.acc.add(turbulence.mult(0.1));
        }
      }
      
      // Update physics
      particle.vel.add(particle.acc);
      particle.vel.limit(particle.maxSpeed * (1 + energy * 2));
      particle.prevX = particle.x;
      particle.prevY = particle.y;
      particle.x += particle.vel.x;
      particle.y += particle.vel.y;
      particle.acc.mult(0);
      
      // Wrap around edges with smooth transition
      if (particle.x < 0) {
        particle.x = p5.width;
        particle.prevX = p5.width;
      }
      if (particle.x > p5.width) {
        particle.x = 0;
        particle.prevX = 0;
      }
      if (particle.y < 0) {
        particle.y = p5.height;
        particle.prevY = p5.height;
      }
      if (particle.y > p5.height) {
        particle.y = 0;
        particle.prevY = 0;
      }
      
      // Calculate color based on multiple factors
      const velocityMag = particle.vel.mag();
      const colorIntensity = p5.map(velocityMag, 0, particle.maxSpeed * 2, 0, 1);
      
      // Base color with emotion influence
      let r = currentColorRef.current[0];
      let g = currentColorRef.current[1];
      let b = currentColorRef.current[2];
      
      // Sentiment modulation
      r = r + (sentiment * 50) + (colorIntensity * 30);
      g = g + (sentiment * 30) - (Math.abs(sentiment) * 20);
      b = b - (sentiment * 30) + (energy * 50);
      
      // Constrain colors
      r = p5.constrain(r, 0, 255);
      g = p5.constrain(g, 0, 255);
      b = p5.constrain(b, 0, 255);
      
      // Draw particle trail with glow effect
      const alpha = p5.map(energy, 0, 1, 20, 80) * (particle.lifespan / 255);
      
      // Main trail
      p5.strokeWeight(particle.size * (1 + energy * 0.5));
      p5.stroke(r, g, b, alpha);
      p5.line(particle.prevX, particle.prevY, particle.x, particle.y);
      
      // Glow effect for high energy
      if (energy > 0.6) {
        p5.strokeWeight(particle.size * 3);
        p5.stroke(r, g, b, alpha * 0.3);
        p5.line(particle.prevX, particle.prevY, particle.x, particle.y);
      }
      
      // Regenerate dead particles
      particle.lifespan -= 0.5;
      if (particle.lifespan <= 0) {
        particle.x = p5.random(p5.width);
        particle.y = p5.random(p5.height);
        particle.lifespan = 255;
        particle.vel.mult(0);
      }
    });
    
    // Draw keyword influence zones (subtle ripples)
    keywords.forEach((keyword, i) => {
      const x = p5.noise(i * 100, timeRef.current * 0.5) * p5.width;
      const y = p5.noise(i * 100 + 1000, timeRef.current * 0.5) * p5.height;
      const radius = 50 + p5.sin(timeRef.current * 2 + i) * 20;
      
      p5.push();
      p5.noFill();
      p5.strokeWeight(1);
      for (let r = radius; r > 0; r -= 10) {
        const alpha = p5.map(r, 0, radius, 10, 0);
        p5.stroke(currentColorRef.current[0], currentColorRef.current[1], currentColorRef.current[2], alpha);
        p5.circle(x, y, r * 2);
      }
      p5.pop();
    });
  };

  const windowResized = (p5) => {
    p5.resizeCanvas(window.innerWidth, window.innerHeight);
    // Recalculate flow field dimensions
    const cols = Math.floor(p5.width / 20);
    const rows = Math.floor(p5.height / 20);
    flowFieldRef.current = new Array(cols * rows);
  };

  return (
    <div className="visualization-container">
      <Sketch setup={setup} draw={draw} windowResized={windowResized} />
      <div className="visualization-info">
        <div className="sentiment-indicator">
          <span className="label">Sentiment</span>
          <div className="bar">
            <div 
              className="fill" 
              style={{
                width: `${((sentiment + 1) / 2) * 100}%`,
                background: sentiment > 0 ? 
                  'linear-gradient(90deg, #4ade80, #22c55e)' : 
                  'linear-gradient(90deg, #f87171, #ef4444)'
              }}
            />
          </div>
        </div>
        <div className="energy-indicator">
          <span className="label">Energy</span>
          <div className="bar">
            <div 
              className="fill"
              style={{
                width: `${energy * 100}%`,
                background: 'linear-gradient(90deg, #60a5fa, #3b82f6)'
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuraVisualization;