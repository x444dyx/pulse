/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Share2, RotateCcw, Trophy, Copy, Check, Zap } from 'lucide-react';

// --- Constants ---
const TARGET_RADIUS = 120;
const TOLERANCE = 20;
const INITIAL_GROWTH_RATE = 2.5;
const GROWTH_ACCELERATION = 8; // Pixels per second squared

type Shape = 'circle' | 'square' | 'triangle' | 'star';
type GameState = 'START' | 'COUNTDOWN' | 'PLAYING' | 'GAMEOVER';

const SHAPE_PATHS: Record<Shape, string> = {
  circle: 'circle(50% at 50% 50%)',
  square: 'inset(0%)',
  triangle: 'polygon(50% 0%, 0% 100%, 100% 100%)',
  star: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)'
};

export default function App() {
  const [gameState, setGameState] = useState<GameState>('START');
  const [shape, setShape] = useState<Shape>(() => {
    const saved = localStorage.getItem('pulse-shape');
    return (saved as Shape) || 'circle';
  });
  const [countdown, setCountdown] = useState(3);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(() => {
    const saved = localStorage.getItem('pulse-best-score');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [showToast, setShowToast] = useState(false);
  const [isPerfect, setIsPerfect] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const requestRef = useRef<number>(null);
  const lastTimeRef = useRef<number>(0);
  const growthRateRef = useRef(120); // Pixels per second (1 second to reach target)
  const pulseRadiusRef = useRef(0);
  const pulseElementRef = useRef<HTMLDivElement>(null);
  const targetRingRef = useRef<HTMLDivElement>(null);
  const targetOuterRef = useRef<HTMLDivElement>(null);

  // --- Game Logic ---

  const update = useCallback((time: number) => {
    if (gameStateRef.current !== 'PLAYING') return;

    if (!lastTimeRef.current) {
      lastTimeRef.current = time;
      requestRef.current = requestAnimationFrame(update);
      return;
    }

    const deltaTime = (time - lastTimeRef.current) / 1000; // Seconds
    lastTimeRef.current = time;

    pulseRadiusRef.current += growthRateRef.current * deltaTime;
    
    // Direct DOM update for performance
    if (pulseElementRef.current) {
      const scale = (pulseRadiusRef.current * 2) / 300; // Relative to container size
      pulseElementRef.current.style.transform = `scale(${scale})`;
      pulseElementRef.current.style.opacity = Math.max(0.2, 1 - pulseRadiusRef.current / (TARGET_RADIUS + TOLERANCE + 60)).toString();
    }

    if (pulseRadiusRef.current > TARGET_RADIUS + TOLERANCE + 40) {
      setGameState('GAMEOVER');
      return;
    }

    requestRef.current = requestAnimationFrame(update);
  }, []);

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
    if (gameState === 'PLAYING') {
      lastTimeRef.current = 0;
      requestRef.current = requestAnimationFrame(update);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
  }, [gameState, update]);

  const startGame = () => {
    setScore(0);
    pulseRadiusRef.current = 0;
    growthRateRef.current = 120;
    setGameState('COUNTDOWN');
    setCountdown(3);
  };

  useEffect(() => {
    if (gameState === 'COUNTDOWN') {
      if (countdown > 0) {
        const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        return () => clearTimeout(timer);
      } else {
        setGameState('PLAYING');
      }
    }
  }, [gameState, countdown]);

  useEffect(() => {
    localStorage.setItem('pulse-shape', shape);
  }, [shape]);

  const handleTap = useCallback((e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
    // Use a ref for gameState to avoid stale closure and unnecessary re-renders
    if (gameStateRef.current !== 'PLAYING') return;
    
    // Prevent simulated mouse events on mobile
    if (e.type === 'touchstart') {
      // We don't preventDefault here to allow the event to be handled, 
      // but we should be careful about double firing.
      // Actually, using only onPointerDown is often better for cross-platform.
    }

    const currentRadius = pulseRadiusRef.current;
    const diff = Math.abs(currentRadius - TARGET_RADIUS);

    if (diff <= TOLERANCE) {
      // Success!
      const perfect = diff < 8;
      
      // Direct DOM update for success feedback
      if (targetRingRef.current && targetOuterRef.current) {
        targetRingRef.current.style.transform = 'scale(1.05) translateZ(0)';
        targetOuterRef.current.style.opacity = '1';
        targetOuterRef.current.style.backgroundColor = 'white';
        
        // Use appropriate glow method based on shape
        if (shape === 'circle' || shape === 'square') {
          targetOuterRef.current.style.boxShadow = '0 0 20px rgba(255,255,255,0.6)';
        } else {
          // clip-path doesn't support box-shadow, use drop-shadow filter instead
          targetOuterRef.current.style.filter = 'drop-shadow(0 0 10px rgba(255,255,255,0.8))';
        }
      }
      
      setIsPerfect(perfect);
      
      // Reset pulse and increase speed
      pulseRadiusRef.current = 0;
      if (pulseElementRef.current) {
        pulseElementRef.current.style.transform = 'scale(0) translateZ(0)';
      }
      growthRateRef.current += GROWTH_ACCELERATION;

      setScore(prev => prev + (perfect ? 2 : 1));

      setTimeout(() => {
        setIsPerfect(false);
        if (targetRingRef.current && targetOuterRef.current) {
          targetRingRef.current.style.transform = '';
          targetRingRef.current.style.opacity = '';
          targetOuterRef.current.style.backgroundColor = '';
          targetOuterRef.current.style.boxShadow = '';
          targetOuterRef.current.style.filter = '';
        }
      }, 200);
    } else {
      setGameState('GAMEOVER');
    }
  }, []);

  useEffect(() => {
    if (score > bestScore) {
      setBestScore(score);
      localStorage.setItem('pulse-best-score', score.toString());
    }
  }, [score, bestScore]);

  useEffect(() => {
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // --- Actions ---

  const isSharingRef = useRef(false);

  const getShapeStyle = (s: Shape, size: number) => {
    const style: React.CSSProperties = {
      width: size,
      height: size,
    };
    
    if (s === 'circle') {
      style.borderRadius = '50%';
    } else if (s === 'square') {
      style.borderRadius = '0%';
    } else {
      style.clipPath = SHAPE_PATHS[s];
      // @ts-ignore
      style.WebkitClipPath = SHAPE_PATHS[s];
    }
    
    return style;
  };

  const copyToClipboard = async (plainText: string, htmlText: string) => {
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const textBlob = new Blob([plainText], { type: 'text/plain' });
        const htmlBlob = new Blob([htmlText], { type: 'text/html' });
        const item = new ClipboardItem({
          'text/plain': textBlob,
          'text/html': htmlBlob,
        });
        await navigator.clipboard.write([item]);
      } else {
        await navigator.clipboard.writeText(plainText);
      }
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      // Fallback to simple text copy
      navigator.clipboard.writeText(plainText).then(() => {
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
      });
    }
  };

  const shareScore = async () => {
    if (isSharingRef.current) return;
    
    const url = window.location.href;
    const shareTitle = 'Pulse ⚡️';
    const shareText = `I just scored ${score} on Pulse! \n\nCan you beat my score? \n\nPlay here:`;
    
    const plainText = `${shareTitle}\n${shareText}\n${url}`;
    const htmlText = `
      <div style="font-family: sans-serif;">
        <p><strong>Pulse ⚡️</strong></p>
        <p>I just scored ${score} on Pulse!</p>
        <p>Can you beat my score?</p>
        <p><a href="${url}">Play here</a></p>
      </div>
    `;

    if (navigator.share) {
      isSharingRef.current = true;
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: url,
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Error sharing:', err);
          copyToClipboard(plainText, htmlText);
        }
      } finally {
        isSharingRef.current = false;
      }
    } else {
      copyToClipboard(plainText, htmlText);
    }
  };

  // --- Components ---

  return (
    <div 
      className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-[#050505] select-none touch-none"
      onPointerDown={handleTap}
    >
      {/* Background Ambient Glow - Removed blur for mobile performance */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white/[0.02] md:bg-white/5 md:blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-white/[0.02] md:bg-white/5 md:blur-[120px] rounded-full" />
      </div>

      {/* Shape Selector - Floating at top */}
      <AnimatePresence>
        {(gameState === 'START' || gameState === 'GAMEOVER') && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-12 flex items-center gap-4 bg-white/5 p-2 rounded-2xl backdrop-blur-md border border-white/10 z-50"
          >
            {(['circle', 'square', 'triangle', 'star'] as Shape[]).map((s) => (
              <button
                key={s}
                onClick={(e) => { e.stopPropagation(); setShape(s); }}
                className={`w-12 h-12 flex flex-col items-center justify-center rounded-xl transition-all gap-1 ${
                  shape === s ? 'bg-white text-black scale-105 shadow-lg' : 'text-white/40 hover:text-white hover:bg-white/10'
                }`}
              >
                <div 
                  className="w-4 h-4"
                  style={{ 
                    ...getShapeStyle(s, 16),
                    backgroundColor: shape === s ? 'black' : 'currentColor'
                  }}
                />
                <span className="text-[8px] uppercase font-bold tracking-tighter">{s}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Game Area */}
      <div className="relative flex flex-col items-center justify-center w-full max-w-md px-6">
        
        {/* Score Display */}
        <AnimatePresence mode="wait">
          {gameState === 'PLAYING' && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-[-120px] flex flex-col items-center"
            >
              <span className="text-6xl font-light tracking-tighter tabular-nums">
                {score}
              </span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/40 mt-2">
                Current Score
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Game Visuals */}
        <div className="relative w-[300px] h-[300px] flex items-center justify-center">
          {/* Target Ring Container */}
          <div 
            ref={targetRingRef}
            className={`absolute transition-all duration-150 will-change-transform flex items-center justify-center ${
              gameState === 'PLAYING' ? 'opacity-100' : 'opacity-20'
            }`}
            style={{ 
              width: TARGET_RADIUS * 2, 
              height: TARGET_RADIUS * 2,
            }}
          >
            {/* Outer Shape (Border) */}
            <div 
              ref={targetOuterRef}
              className="absolute inset-0 bg-white/20 transition-colors duration-150"
              style={getShapeStyle(shape, TARGET_RADIUS * 2)}
            />
            {/* Inner Shape (Hole) */}
            <div 
              className="absolute bg-[#050505]"
              style={{ 
                ...getShapeStyle(shape, TARGET_RADIUS * 2 - 4),
                width: TARGET_RADIUS * 2 - 4,
                height: TARGET_RADIUS * 2 - 4,
              }}
            />
          </div>
          
          {/* Pulse Circle */}
          {gameState === 'PLAYING' && (
            <div 
              ref={pulseElementRef}
              className={`absolute will-change-transform translate-z-0 ${
                isPerfect 
                  ? 'bg-white shadow-[0_0_40px_rgba(255,255,255,0.6)]' 
                  : 'bg-white/10 shadow-[0_0_20px_rgba(255,255,255,0.1)]'
              }`}
              style={{ 
                ...getShapeStyle(shape, 300),
                transform: 'scale(0) translateZ(0)',
                opacity: 0.2,
                backfaceVisibility: 'hidden',
              }}
            />
          )}

          {/* Countdown Overlay - Now inside the relative container for perfect centering */}
          <AnimatePresence>
            {gameState === 'COUNTDOWN' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 2 }}
                key={countdown}
                className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none"
              >
                <span className="text-9xl font-light tracking-tighter tabular-nums text-white">
                  {countdown > 0 ? countdown : 'GO!'}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Perfect Hit Indicator */}
          <AnimatePresence>
            {isPerfect && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1.2, opacity: 1 }}
                exit={{ scale: 1.5, opacity: 0 }}
                className="absolute text-white font-medium tracking-widest text-xs uppercase"
              >
                Perfect
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Start Screen */}
        <AnimatePresence>
          {gameState === 'START' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute inset-0 flex flex-col items-center justify-center z-10"
            >
              <h1 className="text-7xl font-light tracking-tighter mb-2">Pulse</h1>
              <p className="text-white/40 text-sm tracking-wide mb-12">Tap when shape aligns with outer shape.</p>
              
              <button 
                onClick={(e) => { e.stopPropagation(); startGame(); }}
                className="spring-button glass px-12 py-4 rounded-full text-lg font-medium tracking-wide flex items-center gap-3"
              >
                <Zap size={20} className="fill-white" />
                Start Game
              </button>

              <div className="mt-12 flex items-center gap-2 text-white/40">
                <Trophy size={14} />
                <span className="text-xs uppercase tracking-widest">Best: {bestScore}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Game Over Screen */}
        <AnimatePresence>
          {gameState === 'GAMEOVER' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute inset-0 flex flex-col items-center justify-center z-20 glass rounded-[40px] p-8 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-white/40 text-xs uppercase tracking-[0.3em] mb-4">Game Over</span>
              <div className="text-8xl font-light tracking-tighter mb-2">{score}</div>
              <div className="flex items-center gap-2 text-white/40 mb-12">
                <Trophy size={14} />
                <span className="text-xs uppercase tracking-widest">Best: {bestScore}</span>
              </div>

              <div className="grid grid-cols-2 gap-4 w-full">
                <button 
                  onClick={startGame}
                  className="spring-button bg-white text-black px-6 py-4 rounded-2xl font-semibold flex flex-col items-center justify-center gap-2"
                >
                  <RotateCcw size={20} />
                  <span className="text-[10px] uppercase tracking-widest">Try Again</span>
                </button>
                <button 
                  onClick={shareScore}
                  className="spring-button glass px-6 py-4 rounded-2xl font-semibold flex flex-col items-center justify-center gap-2"
                >
                  <Share2 size={20} />
                  <span className="text-[10px] uppercase tracking-widest">Share</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Branding */}
      <div className="absolute bottom-24 left-0 right-0 flex flex-col items-center opacity-40 px-4 pb-[env(safe-area-inset-bottom)]">
        <span className="text-[10px] uppercase tracking-[0.3em] font-medium text-center">
          Created by{' '}
          <a 
            href="https://www.ayteelabs.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:underline transition-all"
          >
            AyTee Labs
          </a>
        </span>
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-24 glass px-6 py-3 rounded-full flex items-center gap-3 z-50"
          >
            <Check size={16} className="text-emerald-400" />
            <span className="text-sm font-medium">Copied to clipboard</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
