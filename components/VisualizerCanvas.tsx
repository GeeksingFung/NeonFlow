
import React, { useRef, useEffect, useState } from 'react';
import { VisualizerMode } from '../types';

interface VisualizerCanvasProps {
  analyser: AnalyserNode;
  mode: VisualizerMode;
  onPiPRequest: (videoElement: HTMLVideoElement) => void;
  colorShift: number; // 0-360
}

// --- Particle Interfaces ---
interface NeuralNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  originalX: number; // for shake
  originalY: number;
}

interface WatercolorBlob {
  x: number;
  y: number;
  radius: number;
  colorH: number; // Hue
  vx: number;
  vy: number;
  phase: number;
}

interface NebulaStar {
  x: number;
  y: number;
  size: number;
  baseAlpha: number;
  twinklePhase: number;
}

interface PaperShard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  // Relative coordinates for the triangle vertices
  p1: { dx: number; dy: number };
  p2: { dx: number; dy: number };
  size: number;
  isLight: boolean; // true = white gradient, false = black gradient
  opacity: number;
  isHighlight: boolean; // Trigger for beat glow
}

const VisualizerCanvas: React.FC<VisualizerCanvasProps> = ({ analyser, mode, onPiPRequest, colorShift }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hiddenVideoRef = useRef<HTMLVideoElement>(null);
  const animationRef = useRef<number>();
  const [streamInitialized, setStreamInitialized] = useState(false);

  // --- State Refs for Artistic Modes ---
  const neuralNodesRef = useRef<NeuralNode[]>([]);
  const watercolorBlobsRef = useRef<WatercolorBlob[]>([]);
  const nebulaStarsRef = useRef<NebulaStar[]>([]);
  
  // Water Circle Refs
  const paperShardsRef = useRef<PaperShard[]>([]);
  const noiseCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const modeRef = useRef<VisualizerMode>(mode);
  const colorShiftRef = useRef<number>(colorShift);
  const rotationRef = useRef<number>(0);

  // Sync refs
  useEffect(() => {
    modeRef.current = mode;
    // Reset or initialize particles when mode changes
    if (mode === VisualizerMode.NEURAL && neuralNodesRef.current.length === 0) {
      initNeuralNodes();
    } else if (mode === VisualizerMode.WATERCOLOR && watercolorBlobsRef.current.length === 0) {
      initWatercolorBlobs();
    } else if (mode === VisualizerMode.NEBULA && nebulaStarsRef.current.length === 0) {
      initNebulaStars();
    } else if (mode === VisualizerMode.WATER_CIRCLE && paperShardsRef.current.length === 0) {
      initPaperShards();
    }

    // Initialize shards for Neural mode if not present (reuses the geometry engine)
    if (mode === VisualizerMode.NEURAL && paperShardsRef.current.length === 0) {
      initPaperShards();
    }
  }, [mode]);

  useEffect(() => {
    colorShiftRef.current = colorShift;
  }, [colorShift]);

  // --- Initialization Helpers ---
  const initNeuralNodes = () => {
    const nodes: NeuralNode[] = [];
    const count = 50; 
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (let i = 0; i < count; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      nodes.push({
        x: x,
        y: y,
        originalX: x,
        originalY: y,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: Math.random() * 2.0 + 1.0
      });
    }
    neuralNodesRef.current = nodes;
  };

  const initWatercolorBlobs = () => {
    const blobs: WatercolorBlob[] = [];
    const count = 7; 
    for (let i = 0; i < count; i++) {
      blobs.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        radius: 180 + Math.random() * 200,
        colorH: 200 + Math.random() * 60, // Blues and Purples base
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        phase: Math.random() * Math.PI * 2
      });
    }
    watercolorBlobsRef.current = blobs;
  };

  const initNebulaStars = () => {
    const stars: NebulaStar[] = [];
    const count = 150; 
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        size: Math.random() * 3.0 + 1.0,
        baseAlpha: Math.random() * 0.8 + 0.1,
        twinklePhase: Math.random() * Math.PI * 2
      });
    }
    nebulaStarsRef.current = stars;
  };

  const initPaperShards = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;

    // 1. Generate Static Noise Layer (Optimization)
    // We only generate noise once because putting imageData is slow
    const noiseCanvas = document.createElement('canvas');
    noiseCanvas.width = w;
    noiseCanvas.height = h;
    const nCtx = noiseCanvas.getContext('2d');
    if (nCtx) {
      const imageData = nCtx.createImageData(w, h);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        // Subtle grey noise
        const val = Math.random() * 15; 
        data[i] = val;     // R
        data[i + 1] = val; // G
        data[i + 2] = val; // B
        data[i + 3] = Math.random() * 15; // Alpha (very low)
      }
      nCtx.putImageData(imageData, 0, 0);
      noiseCanvasRef.current = noiseCanvas;
    }

    // 2. Generate Moving Shards
    const shards: PaperShard[] = [];
    const count = 150; 

    for (let i = 0; i < count; i++) {
      const size = Math.random() * 300 + 100;
      // Pre-calculate relative vertices so shape stays constant while moving
      const p1dx = (Math.random() - 0.5) * size;
      const p1dy = (Math.random() - 0.5) * size;
      const p2dx = (Math.random() - 0.5) * size;
      const p2dy = (Math.random() - 0.5) * size;

      const isLight = Math.random() > 0.5;

      shards.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.2, // Very slow movement
        vy: (Math.random() - 0.5) * 0.2,
        size,
        p1: { dx: p1dx, dy: p1dy },
        p2: { dx: p2dx, dy: p2dy },
        isLight,
        opacity: isLight ? Math.random() * 0.1 : Math.random() * 0.05,
        isHighlight: Math.random() > 0.95 // 5% chance to be a shiny spot
      });
    }
    paperShardsRef.current = shards;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d', { alpha: false }); 
    if (!ctx) return;

    if (mode === VisualizerMode.NEURAL) initNeuralNodes();
    if (mode === VisualizerMode.WATERCOLOR) initWatercolorBlobs();
    if (mode === VisualizerMode.NEBULA) initNebulaStars();
    if ((mode === VisualizerMode.WATER_CIRCLE || mode === VisualizerMode.NEURAL) && paperShardsRef.current.length === 0) {
      initPaperShards();
    }

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    // Time variable for oscillation
    let startTime = Date.now();

    const render = () => {
      analyser.getByteFrequencyData(dataArray);

      // Handle Resize
      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        // Re-init texture on resize
        if (modeRef.current === VisualizerMode.WATER_CIRCLE || modeRef.current === VisualizerMode.NEURAL) {
             initPaperShards(); 
        }
      }

      const WIDTH = canvas.width;
      const HEIGHT = canvas.height;
      const centerX = WIDTH / 2;
      const centerY = HEIGHT / 2;
      const globalHueShift = colorShiftRef.current;

      // --- Color Oscillation Logic ---
      const time = (Date.now() - startTime) * 0.001; // Seconds
      const hueWobble = Math.sin(time * 0.5) * 54; 

      // --- Intense Audio Metrics ---
      let bassTotal = 0;
      let lowMidTotal = 0; // Vocal range
      let highTotal = 0;
      
      for (let i = 0; i < bufferLength; i++) {
        const val = dataArray[i];
        if (i < 5) bassTotal += val; // Deep sub
        else if (i < 20) bassTotal += val * 0.8; // Kick area
        else if (i < 100) lowMidTotal += val;
        else highTotal += val;
      }
      
      const bassAvg = bassTotal / 20; 
      const lowMidAvg = lowMidTotal / 80;
      const highAvg = highTotal / (bufferLength - 100);

      // Non-linear bass boost
      const bassLevel = Math.pow(bassAvg / 255, 2) * 2; 
      const midLevel = lowMidAvg / 255;
      const highLevel = highAvg / 255;

      rotationRef.current += 0.002 + (bassLevel * 0.005); 

      const currentMode = modeRef.current;

      // --- RENDER LOGIC ---

      if (currentMode === VisualizerMode.NEURAL) {
        // STYLE: Neural Network (Dark Mode) with Animated Dark Shards
        const baseHue = (220 + globalHueShift + hueWobble) % 360;
        
        // 1. Dark Base Background
        // Use a very deep, almost black blue
        ctx.fillStyle = `hsl(${baseHue}, 30%, 4%)`; 
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        // 2. Draw Moving Dark Shards (Background Animation)
        const shards = paperShardsRef.current;
        shards.forEach(shard => {
            // Move
            shard.x += shard.vx;
            shard.y += shard.vy;
            
            // Wrap
            if (shard.x < -150) shard.x = WIDTH + 150;
            if (shard.x > WIDTH + 150) shard.x = -150;
            if (shard.y < -150) shard.y = HEIGHT + 150;
            if (shard.y > HEIGHT + 150) shard.y = -150;

            // Draw Triangle
            ctx.beginPath();
            ctx.moveTo(shard.x, shard.y);
            ctx.lineTo(shard.x + shard.p1.dx, shard.y + shard.p1.dy);
            ctx.lineTo(shard.x + shard.p2.dx, shard.y + shard.p2.dy);
            
            // Dark Mode Shard Gradients
            const grad = ctx.createLinearGradient(shard.x, shard.y, shard.x + 50, shard.y + 50);
            if (shard.isLight) {
                 // Slightly lighter "highlight" shards (subtle deep blue/grey)
                 grad.addColorStop(0, `hsla(${baseHue}, 40%, 15%, 0.15)`);
                 grad.addColorStop(1, `hsla(${baseHue}, 40%, 15%, 0)`);
            } else {
                 // Darker "shadow" shards
                 grad.addColorStop(0, `hsla(${baseHue}, 40%, 0%, 0.4)`);
                 grad.addColorStop(1, `hsla(${baseHue}, 40%, 0%, 0)`);
            }
            ctx.fillStyle = grad;
            ctx.fill();
        });

        const nodes = neuralNodesRef.current;
        const connectionDistance = 120 + (bassLevel * 350); 
        
        const shake = bassLevel * 2; 
        ctx.save();
        ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

        // Update and Draw Nodes
        nodes.forEach((node, i) => {
          node.x += node.vx * (1 + bassLevel * 0.5); 
          node.y += node.vy * (1 + bassLevel * 0.5);

          // Wrap
          if (node.x < 0) node.x = WIDTH;
          if (node.x > WIDTH) node.x = 0;
          if (node.y < 0) node.y = HEIGHT;
          if (node.y > HEIGHT) node.y = 0;

          // Node size
          const r = node.radius + (bassLevel * 6) + (midLevel * 3);
          
          // Lighter, glowing nodes for contrast on dark bg
          ctx.fillStyle = `hsl(${baseHue}, 90%, 75%)`;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
          ctx.fill();

          // Connections
          for (let j = i + 1; j < nodes.length; j++) {
            const other = nodes[j];
            const dx = node.x - other.x;
            const dy = node.y - other.y;
            const dist = Math.sqrt(dx*dx + dy*dy);

            if (dist < connectionDistance) {
              const opacity = (1 - (dist / connectionDistance)) * (0.3 + bassLevel * 0.8);
              // Lighter lines
              ctx.strokeStyle = `hsla(${baseHue}, 80%, 75%, ${opacity})`; 
              ctx.lineWidth = (0.5 + (bassLevel * 1.5)) * 0.5; // Reduced by 50%
              ctx.beginPath();
              ctx.moveTo(node.x, node.y);
              ctx.lineTo(other.x, other.y);
              ctx.stroke();
            }
          }
        });
        ctx.restore();
      }
      else if (currentMode === VisualizerMode.WATERCOLOR) {
        // STYLE: Watercolor
        ctx.fillStyle = '#ffffff';
        ctx.fillStyle = `rgba(255, 255, 255, ${0.1 + (1-bassLevel)*0.2})`;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        ctx.globalCompositeOperation = 'multiply';

        const blobs = watercolorBlobsRef.current;
        
        blobs.forEach((blob, i) => {
          const speedMult = 1 + (bassLevel * 5);
          blob.x += blob.vx * speedMult;
          blob.y += blob.vy * speedMult;

          if (blob.x < -100 || blob.x > WIDTH + 100) blob.vx *= -1;
          if (blob.y < -100 || blob.y > HEIGHT + 100) blob.vy *= -1;

          let react = 0;
          if (i % 3 === 0) react = bassLevel;
          else if (i % 3 === 1) react = midLevel;
          else react = highLevel;

          const currentRadius = blob.radius * (0.5 + react * 2.5);

          const gradient = ctx.createRadialGradient(
            blob.x, blob.y, 0,
            blob.x, blob.y, currentRadius
          );

          const h = (blob.colorH + globalHueShift + hueWobble) % 360;
          const sat = 60 + (react * 40); 
          const alpha = 0.3 + (react * 0.5);

          gradient.addColorStop(0, `hsla(${h}, ${sat}%, 60%, ${alpha})`);
          gradient.addColorStop(0.6, `hsla(${h}, ${sat}%, 70%, ${alpha * 0.5})`);
          gradient.addColorStop(1, `hsla(${h}, ${sat}%, 90%, 0)`);

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(blob.x, blob.y, currentRadius, 0, Math.PI * 2);
          ctx.fill();
        });

        ctx.globalCompositeOperation = 'source-over';
      }
      else if (currentMode === VisualizerMode.WATER_CIRCLE) {
        // STYLE: Water Circle (Hybrid) with Animated Crumpled Paper + Beat Glow
        
        // 1. Base Tone
        ctx.fillStyle = '#e8ecf0';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        // 2. Draw Moving Shards (Background Animation)
        const shards = paperShardsRef.current;
        shards.forEach(shard => {
            // Move
            shard.x += shard.vx;
            shard.y += shard.vy;
            
            // Wrap
            if (shard.x < -150) shard.x = WIDTH + 150;
            if (shard.x > WIDTH + 150) shard.x = -150;
            if (shard.y < -150) shard.y = HEIGHT + 150;
            if (shard.y > HEIGHT + 150) shard.y = -150;

            // Draw Triangle
            ctx.beginPath();
            ctx.moveTo(shard.x, shard.y);
            ctx.lineTo(shard.x + shard.p1.dx, shard.y + shard.p1.dy);
            ctx.lineTo(shard.x + shard.p2.dx, shard.y + shard.p2.dy);
            
            const grad = ctx.createLinearGradient(shard.x, shard.y, shard.x + 50, shard.y + 50);
            if (shard.isLight) {
                 grad.addColorStop(0, `rgba(255, 255, 255, ${shard.opacity})`);
                 grad.addColorStop(1, `rgba(255, 255, 255, 0)`);
            } else {
                 grad.addColorStop(0, `rgba(0, 0, 0, ${shard.opacity})`);
                 grad.addColorStop(1, `rgba(0, 0, 0, 0)`);
            }
            ctx.fillStyle = grad;
            ctx.fill();
        });

        // 3. Draw Static Noise Overlay (Cheap)
        if (noiseCanvasRef.current) {
            ctx.globalAlpha = 0.5;
            ctx.drawImage(noiseCanvasRef.current, 0, 0);
            ctx.globalAlpha = 1.0;
        }

        // 4. Audio Reactive Glow (Attached to highlight shards)
        ctx.globalCompositeOperation = 'overlay';
        const glowOpacity = Math.min(1, bassLevel * 0.8);

        if (glowOpacity > 0.05) {
            shards.forEach((shard, i) => {
                if (shard.isHighlight) {
                    const trigger = (i % 2 === 0) ? bassLevel : midLevel;
                    const activeOpacity = trigger * 0.6;

                    if (activeOpacity > 0.1) {
                        const radius = (shard.size * 0.5) * (1 + trigger);
                        const g = ctx.createRadialGradient(shard.x, shard.y, 0, shard.x, shard.y, radius);
                        g.addColorStop(0, `rgba(255, 255, 255, ${activeOpacity})`);
                        g.addColorStop(0.5, `rgba(220, 230, 255, ${activeOpacity * 0.5})`);
                        g.addColorStop(1, `rgba(255, 255, 255, 0)`);
                        
                        ctx.fillStyle = g;
                        ctx.beginPath();
                        ctx.arc(shard.x, shard.y, radius, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            });
        }

        // 5. Ink Visualizer (Multiply blending)
        ctx.globalCompositeOperation = 'multiply';

        const radiusBase = Math.min(WIDTH, HEIGHT) / 4.5;
        
        const bars = 120; 
        
        // Changed: Use a wider spectrum range (82%) to include more high frequencies
        const usefulFreqRange = Math.floor(bufferLength * 0.82);
        const step = usefulFreqRange / bars; 

        // Max extension: 1/5 of height
        const maxExtend = HEIGHT * (1 / 5);

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(rotationRef.current);

        // Pool Color
        const poolHue = (200 + globalHueShift + hueWobble - bassLevel * 30) % 360;
        
        // Pool size with dynamics
        const poolSize = (radiusBase * 0.5) * (0.8 + bassLevel * 0.6);
        
        // Draw central pool
        const poolGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, poolSize);
        poolGrad.addColorStop(0, `hsla(${poolHue}, 70%, 50%, ${0.5 + bassLevel * 0.3})`);
        poolGrad.addColorStop(1, `hsla(${poolHue}, 70%, 90%, 0)`);
        
        ctx.fillStyle = poolGrad;
        ctx.beginPath();
        ctx.arc(0, 0, poolSize, 0, Math.PI * 2);
        ctx.fill();

        const circum = 2 * Math.PI * radiusBase;
        const slotWidth = circum / bars;
        const barWidth = slotWidth * 0.5;

        const centerGap = 10; 
        const safeInnerRadius = poolSize + centerGap;
        
        const startRadiusBase = radiusBase * 0.9;
        const beatPulse = bassLevel * (radiusBase * 0.2); 
        const startRadius = startRadiusBase + beatPulse;

        // Draw radial ink splashes
        for (let i = 0; i < bars; i++) {
          const index = Math.floor(i * step);
          const rawVal = dataArray[index] / 255;
          
          // Changed: REMOVED minimum bar height (Math.max(0, ...)) to allow for true silence/gaps
          const smoothedVal = Math.max(0, rawVal * rawVal); 
          
          const angle = (i / bars) * Math.PI * 2;
          const length = smoothedVal * maxExtend * (1 + bassLevel);
          
          const barHue = (180 + (i / bars) * 60 + globalHueShift + hueWobble) % 360;
          
          ctx.save();
          ctx.rotate(angle);
          
          // --- Outward Bar ---
          if (length > 0) {
            const strokeGrad = ctx.createLinearGradient(0, startRadius, 0, startRadius + length);
            strokeGrad.addColorStop(0, `hsla(${barHue}, 80%, 40%, 0.6)`);
            strokeGrad.addColorStop(1, `hsla(${barHue}, 80%, 90%, 0)`);
            
            ctx.fillStyle = strokeGrad;
            ctx.beginPath();
            ctx.rect(-barWidth / 2, startRadius, barWidth, length);
            ctx.fill();
          }
          
          // --- Inward Bar (Mirrored effect with fade) ---
          const maxInwardLen = Math.max(0, startRadius - safeInnerRadius);
          const inwardLen = Math.min(length, maxInwardLen);
          
          if (inwardLen > 0) {
            const inwardGrad = ctx.createLinearGradient(0, startRadius, 0, startRadius - inwardLen);
            inwardGrad.addColorStop(0, `hsla(${barHue}, 80%, 40%, 0.6)`);
            inwardGrad.addColorStop(1, `hsla(${barHue}, 80%, 90%, 0)`);
            ctx.fillStyle = inwardGrad;
            
            ctx.beginPath();
            ctx.rect(-barWidth / 2, startRadius, barWidth, -inwardLen);
            ctx.fill();
          }
          
          ctx.restore();
        }

        ctx.restore();
        ctx.globalCompositeOperation = 'source-over';
      }
      else if (currentMode === VisualizerMode.NEBULA) {
        // STYLE: Nebula
        ctx.fillStyle = '#020205'; 
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        ctx.globalCompositeOperation = 'screen'; 

        const drawCloud = (x: number, y: number, r: number, h: number, s: number, l: number, a: number) => {
          const g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, `hsla(${h}, ${s}%, ${l}%, ${a})`);
          g.addColorStop(1, 'transparent');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        };

        const t = Date.now() * 0.001;
        const centerSize = HEIGHT * (0.4 + bassLevel * 0.8);
        const centerLight = 50 + (bassLevel * 40); 
        
        const hPurple = (270 + globalHueShift + hueWobble) % 360;
        drawCloud(centerX, centerY, centerSize, hPurple, 80, centerLight, 0.3 + bassLevel * 0.5);

        // ... Clouds ...
        const hPink = (320 + globalHueShift + hueWobble) % 360;
        const orb1X = centerX + Math.sin(t) * (WIDTH * 0.3);
        const orb1Y = centerY + Math.cos(t * 0.7) * (HEIGHT * 0.3);
        drawCloud(orb1X, orb1Y, HEIGHT * (0.3 + midLevel * 0.5), hPink, 70, 60, 0.2 + midLevel * 0.4);

        const hBlue = (230 + globalHueShift + hueWobble) % 360;
        const orb2X = centerX + Math.cos(t * 1.3) * (WIDTH * 0.35);
        const orb2Y = centerY + Math.sin(t * 1.1) * (HEIGHT * 0.25);
        drawCloud(orb2X, orb2Y, HEIGHT * (0.3 + highLevel * 0.5), hBlue, 90, 60, 0.2 + highLevel * 0.4);

        ctx.globalCompositeOperation = 'source-over';
        
        const stars = nebulaStarsRef.current;
        
        stars.forEach(star => {
          const twinkle = Math.sin(Date.now() * 0.01 + star.twinklePhase);
          const sizeMult = 1 + (highLevel * 3);
          const alpha = Math.min(1, star.baseAlpha + twinkle * 0.2 + highLevel * 1.5);
          
          const renderSize = star.size * sizeMult * 3; 

          const g = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, renderSize);
          g.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
          g.addColorStop(0.3, `rgba(255, 255, 255, ${alpha * 0.3})`);
          g.addColorStop(1, `rgba(255, 255, 255, 0)`);
          
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(star.x, star.y, renderSize, 0, Math.PI * 2);
          ctx.fill();
        });
        
        ctx.globalAlpha = 1.0;
      }
      else {
        // --- CLASSIC MODES (Circular, Bars, Wave) ---
        
        if (currentMode === VisualizerMode.WAVE) {
           ctx.fillStyle = 'rgba(0, 0, 0, 0.03)'; 
        } else {
           ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; 
        }
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        const dynamicHue = (globalHueShift + hueWobble) % 360;
        const colorPrimary = `hsl(${dynamicHue}, 100%, 50%)`;

        if (currentMode === VisualizerMode.CIRCULAR) {
          const radius = Math.min(WIDTH, HEIGHT) / 4;
          const bassScale = 1 + bassLevel * 0.8; 

          ctx.beginPath();
          ctx.arc(centerX, centerY, radius * bassScale * 0.8, 0, 2 * Math.PI);
          const gradient = ctx.createRadialGradient(centerX, centerY, radius * 0.1, centerX, centerY, radius * bassScale);
          gradient.addColorStop(0, '#ffffff');
          gradient.addColorStop(0.5, colorPrimary);
          gradient.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = gradient;
          ctx.fill();

          const bars = 120;
          const step = Math.floor(bufferLength / bars);
          const maxBarHeight = Math.min(WIDTH, HEIGHT) / 2;

          for (let i = 0; i < bars; i++) {
            const val = dataArray[i * step] / 255;
            const barHeight = val * val * maxBarHeight * 1.5; 
            
            const angle = (i / bars) * Math.PI * 2;
            const xStart = centerX + Math.cos(angle) * (radius * bassScale);
            const yStart = centerY + Math.sin(angle) * (radius * bassScale);
            const xEnd = centerX + Math.cos(angle) * (radius * bassScale + barHeight);
            const yEnd = centerY + Math.sin(angle) * (radius * bassScale + barHeight);

            ctx.beginPath();
            ctx.moveTo(xStart, yStart);
            ctx.lineTo(xEnd, yEnd);
            const barHue = (dynamicHue + (i / bars) * 60) % 360;
            ctx.strokeStyle = `hsl(${barHue}, 80%, 60%)`;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.stroke();
          }
        } 
        else if (currentMode === VisualizerMode.BARS) {
          const barWidth = (WIDTH / bufferLength) * 1.25;
          let x = 0;
          
          for (let i = 0; i < bufferLength; i++) {
            const val = dataArray[i] / 255;
            const barHeight = (val * val) * (HEIGHT * 0.4); 
            
            const barHue = (dynamicHue + (i / bufferLength) * 60) % 360;
            ctx.fillStyle = `hsl(${barHue}, 80%, 50%)`;
            
            ctx.fillRect(x, centerY - barHeight, barWidth, barHeight);
            ctx.fillRect(x, centerY, barWidth, barHeight);
            
            x += barWidth + 1;
            if(x > WIDTH) break;
          }
        }
        else if (currentMode === VisualizerMode.WAVE) {
           analyser.getByteTimeDomainData(dataArray);
           
           ctx.lineWidth = 1.5; 
           ctx.strokeStyle = colorPrimary;
           
           ctx.beginPath();
           const sliceWidth = WIDTH * 1.0 / bufferLength;
           let x = 0;
           for(let i = 0; i < bufferLength; i++) {
             const v = dataArray[i] / 128.0;
             const y = v * HEIGHT / 2;
             if(i === 0) ctx.moveTo(x, y);
             else ctx.lineTo(x, y);
             x += sliceWidth;
           }
           ctx.lineTo(WIDTH, HEIGHT/2);
           ctx.stroke();
        }
      }

      // --- Watermark (Visible in PiP) ---
      // We draw this at the very end so it's on top of everything in the stream
      ctx.save();
      // Changed: Neural is now a Dark Mode, so we remove it from the isLightMode check
      const isLightMode = [
        VisualizerMode.WATERCOLOR, 
        VisualizerMode.WATER_CIRCLE
      ].includes(currentMode);
      
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      // Use contrasting color with some transparency
      ctx.fillStyle = isLightMode ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.4)';
      ctx.fillText("Idea by Geeksing", WIDTH - 20, HEIGHT - 20);
      ctx.restore();

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    if (!streamInitialized && hiddenVideoRef.current && canvas) {
      try {
        const stream = canvas.captureStream(60); 
        hiddenVideoRef.current.srcObject = stream;
        hiddenVideoRef.current.play().catch(() => {});
        setStreamInitialized(true);
      } catch (e) {
        console.error("Failed to capture canvas stream", e);
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyser, streamInitialized]); 

  // Re-sync mode/color when they change
  useEffect(() => {
    modeRef.current = mode;
    colorShiftRef.current = colorShift;
  }, [mode, colorShift]);

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center">
      <canvas 
        ref={canvasRef} 
        className="w-full h-full absolute inset-0 block"
      />
      <video 
        ref={hiddenVideoRef} 
        className="invisible absolute w-1 h-1 pointer-events-none" 
        muted 
        playsInline
      />
    </div>
  );
};

export default VisualizerCanvas;
