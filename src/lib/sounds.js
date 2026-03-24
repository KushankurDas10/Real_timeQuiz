/**
 * Sound effects helper
 * Uses Web Audio API for reliable, low-latency sound playback
 */

const audioCtx = typeof window !== 'undefined' ? new (window.AudioContext || window.webkitAudioContext)() : null;

function playTone(frequency, duration, type = 'sine', volume = 0.15) {
  if (!audioCtx) return;
  try {
    // Resume context if suspended (browser autoplay policy)
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);

    gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + duration);
  } catch (e) {
    // Silently fail — sound is non-critical
  }
}

export function playCorrect() {
  playTone(523.25, 0.15, 'sine', 0.12); // C5
  setTimeout(() => playTone(659.25, 0.15, 'sine', 0.12), 100); // E5
  setTimeout(() => playTone(783.99, 0.25, 'sine', 0.12), 200); // G5
}

export function playWrong() {
  playTone(200, 0.3, 'sawtooth', 0.08);
  setTimeout(() => playTone(150, 0.4, 'sawtooth', 0.08), 150);
}

export function playCountdown() {
  playTone(440, 0.1, 'square', 0.06);
}

export function playGameStart() {
  playTone(261.63, 0.1, 'sine', 0.1);
  setTimeout(() => playTone(329.63, 0.1, 'sine', 0.1), 100);
  setTimeout(() => playTone(392, 0.1, 'sine', 0.1), 200);
  setTimeout(() => playTone(523.25, 0.3, 'sine', 0.15), 300);
}

export function playLeaderboard() {
  playTone(392, 0.15, 'sine', 0.1);
  setTimeout(() => playTone(523.25, 0.15, 'sine', 0.1), 150);
  setTimeout(() => playTone(659.25, 0.3, 'sine', 0.1), 300);
}

export function playTick() {
  playTone(800, 0.05, 'sine', 0.04);
}

export function playJoin() {
  playTone(600, 0.1, 'sine', 0.08);
  setTimeout(() => playTone(800, 0.15, 'sine', 0.08), 80);
}
