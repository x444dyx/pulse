/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Share2, RotateCcw, Trophy, Check, Zap } from 'lucide-react';
import { fetchTopScores, submitScore, type LeaderboardEntry } from './lib/leaderboard';

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

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [playerName, setPlayerName] = useState('');
  const [isSubmittingScore, setIsSubmittingScore] = useState(false);
  const [scoreSubmitted, setScoreSubmitted] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState('');

  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const growthRateRef = useRef(120); // Pixels per second (1 second to reach target)
  const pulseRadiusRef = useRef(0);
  const pulseElementRef = useRef<HTMLDivElement | null>(null);
  const targetRingRef = useRef<HTMLDivElement | null>(null);
  const targetOuterRef = useRef<HTMLDivElement | null>(null);

  const gameStateRef = useRef(gameState);

  // --- Game Logic ---

  const loadLeaderboard = useCallback(async () => {
    try {
      const data = await fetchTopScores();
      setLeaderboard(data);
      setLeaderboardError('');
    } catch (err) {
      console.error(err);
      setLeaderboardError('Could not load leaderboard');
    }
  }, []);

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

    if (pulseElementRef.current) {
      const scale = (pulseRadiusRef.current * 2) / 300;
      pulseElementRef.current.style.transform = `scale(${scale})`;
      pulseElementRef.current.style.opacity = Math.max(
        0.2,
        1 - pulseRadiusRef.current / (TARGET_RADIUS + TOLERANCE + 60)
      ).toString();
    }

    if (pulseRadiusRef.current > TARGET_RADIUS + TOLERANCE + 40) {
      setGameState('GAMEOVER');
      return;
    }

    requestRef.current = requestAnimationFrame(update);
  }, []);

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
    setPlayerName('');
    setScoreSubmitted(false);
    setLeaderboardError('');
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

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  useEffect(() => {
    if (gameState === 'GAMEOVER') {
      loadLeaderboard();
      setScoreSubmitted(false);
      setPlayerName('');
    }
  }, [gameState, loadLeaderboard]);

  const handleTap = useCallback((e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
    if (gameStateRef.current !== 'PLAYING') return;

    if (e.type === 'touchstart') {
      // Intentionally left blank
    }

    const currentRadius = pulseRadiusRef.current;
    const diff = Math.abs(currentRadius - TARGET_RADIUS);

    if (diff <= TOLERANCE) {
      const perfect = diff < 8;

      if (targetRingRef.current && targetOuterRef.current) {
        targetRingRef.current.style.transform = 'scale(1.05) translateZ(0)';
        targetOuterRef.current.style.opacity = '1';
        targetOuterRef.current.style.backgroundColor = 'white';

        if (shape === 'circle' || shape === 'square') {
          targetOuterRef.current.style.boxShadow = '0 0 20px rgba(255,255,255,0.6)';
        } else {
          targetOuterRef.current.style.filter = 'drop-shadow(0 0 10px rgba(255,255,255,0.8))';
        }
      }

      setIsPerfect(perfect);

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
  }, [shape]);

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
      navigator.clipboard.writeText(plainText).then(() => {
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
      });
    }
  };

  const shareScore = async () => {
    if (isSharingRef.current) return;

    const url = 'https://pulse.ayteelabs.com';
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

  const handleSubmitScore = async () => {
    if (isSubmittingScore || scoreSubmitted) return;

    try {
      setIsSubmittingScore(true);
      setLeaderboardError('');
      await submitScore(playerName, score);
      setScoreSubmitted(true);
      await loadLeaderboard();
    } catch (err) {
      console.error(err);
      setLeaderboardError(err instanceof Error ? err.message : 'Failed to submit score');
    } finally {
      setIsSubmittingScore(false);
    }
  };

  // --- Components ---

  return (
    <div
      className="relative min-h-screen w-full flex flex-col items-center justify-center bg-[#050505] select-none touch-none"
      onPointerDown={handleTap}
    >
      {/* Background Ambient Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white/[0.02] md:bg-white/5 md:blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-white/[0.02] md:bg-white/5 md:blur-[120px] rounded-full" />
      </div>

      {/* Shape Selector */}
      <AnimatePresence>
        {(gameState === 'START' || gameState === 'GAMEOVER') && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 sm:gap-4 bg-white/5 p-2 rounded-2xl backdrop-blur-md border border-white/10 z-50"
          >
            {(['circle', 'square', 'triangle', 'star'] as Shape[]).map((s) => (
              <button
                key={s}
                onClick={(e) => {
                  e.stopPropagation();
                  setShape(s);
                }}
                className={`w-10 h-10 sm:w-12 sm:h-12 flex flex-col items-center justify-center rounded-xl transition-all gap-1 ${
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
                <span className="text-[7px] sm:text-[8px] uppercase font-bold tracking-tighter">{s}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Game Area */}
      <div className="relative flex flex-col items-center justify-center w-full max-w-md px-4 sm:px-6 min-h-[760px] sm:min-h-[820px] pt-28 sm:pt-24">
        {/* Score Display */}
        <AnimatePresence mode="wait">
          {gameState === 'PLAYING' && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute left-1/2 -translate-x-1/2 top-6 sm:top-10 flex flex-col items-center z-30"
            >
              <span className="text-5xl sm:text-6xl font-light tracking-tighter tabular-nums">
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
            <div
              ref={targetOuterRef}
              className="absolute inset-0 bg-white/20 transition-colors duration-150"
              style={getShapeStyle(shape, TARGET_RADIUS * 2)}
            />
            <div
              className="absolute bg-[#050505]"
              style={{
                ...getShapeStyle(shape, TARGET_RADIUS * 2 - 4),
                width: TARGET_RADIUS * 2 - 4,
                height: TARGET_RADIUS * 2 - 4,
              }}
            />
          </div>

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
              <h1 className="text-6xl sm:text-7xl font-light tracking-tighter mb-2">Pulse</h1>
              <p className="text-white/40 text-sm tracking-wide mb-12">Tap when circles align.</p>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startGame();
                }}
                className="spring-button glass px-10 sm:px-12 py-4 rounded-full text-lg font-medium tracking-wide flex items-center gap-3"
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
              className="absolute inset-x-0 top-20 bottom-0 sm:inset-0 z-20 glass rounded-[32px] sm:rounded-[40px] p-4 sm:p-6 shadow-2xl overflow-y-auto flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col items-center">
                <span className="text-white/40 text-xs uppercase tracking-[0.3em] mb-4">Game Over</span>
                <div className="text-7xl sm:text-8xl font-light tracking-tighter mb-2">{score}</div>
                <div className="flex items-center gap-2 text-white/40 mb-8">
                  <Trophy size={14} />
                  <span className="text-xs uppercase tracking-widest">Best: {bestScore}</span>
                </div>

                <div className="w-full max-w-sm mb-6">
                  <div className="text-[10px] uppercase tracking-[0.25em] text-white/40 mb-3 text-center">
                    Submit your score
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      maxLength={12}
                      placeholder="Your name"
                      className="flex-1 bg-white/10 border border-white/10 rounded-2xl px-4 py-3 outline-none text-white placeholder:text-white/30"
                      disabled={isSubmittingScore || scoreSubmitted}
                    />
                    <button
                      onClick={handleSubmitScore}
                      disabled={isSubmittingScore || scoreSubmitted || playerName.trim().length < 2}
                      className="spring-button bg-white text-black px-5 py-3 rounded-2xl font-semibold disabled:opacity-50 w-full sm:w-auto"
                    >
                      {scoreSubmitted ? 'Done' : isSubmittingScore ? 'Saving...' : 'Submit'}
                    </button>
                  </div>

                  {leaderboardError && (
                    <p className="text-red-300 text-xs mt-3 text-center">{leaderboardError}</p>
                  )}
                </div>

                <div className="w-full max-w-sm mb-8">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] uppercase tracking-[0.25em] text-white/40">
                      Global Top 100
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.25em] text-white/25">
                      Name / Score
                    </span>
                  </div>

                  <div className="max-h-56 sm:max-h-80 overflow-y-auto rounded-3xl border border-white/10 bg-white/5">
                    {leaderboard.length === 0 ? (
                      <div className="p-6 text-center text-white/40 text-sm">
                        No scores yet
                      </div>
                    ) : (
                      <div className="divide-y divide-white/5">
                        {leaderboard.map((entry, index) => (
                          <div
                            key={entry.id}
                            className="grid grid-cols-[56px_1fr_auto] items-center gap-3 px-4 py-3"
                          >
                            <span className="text-sm text-white/40 tabular-nums">
                              #{index + 1}
                            </span>
                            <span className="text-sm font-medium truncate">
                              {entry.name}
                            </span>
                            <span className="text-sm tabular-nums text-white/80">
                              {entry.score}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-sm">
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
