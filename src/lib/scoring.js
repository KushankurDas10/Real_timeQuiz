/**
 * Scoring module for GameDev Arena
 * Base points + time bonus for fast answers
 */

const BASE_POINTS = 1000;
const TIME_BONUS_MAX = 500;

/**
 * Calculate score for a single answer
 * @param {boolean} isCorrect - Whether the answer was correct
 * @param {number} responseTimeMs - How long the player took to answer (ms)
 * @param {number} timeLimitMs - Total time allowed for the question (ms)
 * @returns {number} Score earned
 */
export function calculateScore(isCorrect, responseTimeMs, timeLimitMs) {
  if (!isCorrect) return 0;
  const clampedTime = Math.max(0, Math.min(responseTimeMs, timeLimitMs));
  const timeRatio = 1 - clampedTime / timeLimitMs;
  const timeBonus = Math.round(TIME_BONUS_MAX * timeRatio);
  return BASE_POINTS + timeBonus;
}
