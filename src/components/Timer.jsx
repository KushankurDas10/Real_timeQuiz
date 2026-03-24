import { useEffect, useState, useRef } from 'react';
import { playTick } from '../lib/sounds';

/**
 * Circular countdown timer with SVG ring animation
 */
export default function Timer({ duration, onTimeUp, isActive = true, size = 80 }) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const intervalRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    setTimeLeft(duration);
    startTimeRef.current = Date.now();

    if (!isActive) return;

    intervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const remaining = Math.max(0, duration - elapsed);
      setTimeLeft(remaining);

      // Play tick sound in last 5 seconds
      if (remaining <= 5 && remaining > 0 && Math.ceil(remaining) !== Math.ceil(remaining + 0.1)) {
        playTick();
      }

      if (remaining <= 0) {
        clearInterval(intervalRef.current);
        onTimeUp?.();
      }
    }, 100);

    return () => clearInterval(intervalRef.current);
  }, [duration, isActive]);

  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = timeLeft / duration;
  const offset = circumference * (1 - progress);

  // Color transitions: green → yellow → red
  const getColor = () => {
    if (progress > 0.5) return '#00ff88';
    if (progress > 0.25) return '#ffaa00';
    return '#ff3366';
  };

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(42, 48, 80, 0.5)"
          strokeWidth="4"
          fill="none"
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getColor()}
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="timer-ring"
          style={{ filter: `drop-shadow(0 0 6px ${getColor()})` }}
        />
      </svg>
      <span
        className="absolute font-display font-bold"
        style={{
          fontSize: size * 0.3,
          color: getColor(),
          textShadow: `0 0 10px ${getColor()}`,
        }}
      >
        {Math.ceil(timeLeft)}
      </span>
    </div>
  );
}
