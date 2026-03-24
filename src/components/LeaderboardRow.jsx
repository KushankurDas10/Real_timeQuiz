import { getAvatarEmoji } from './AvatarPicker';

/**
 * Single leaderboard row with rank, avatar, nickname, and score
 */
export default function LeaderboardRow({ rank, nickname, avatar, score, streak, isNew = false, highlight = false }) {
  const getRankStyle = () => {
    switch (rank) {
      case 1: return 'podium-gold';
      case 2: return 'podium-silver';
      case 3: return 'podium-bronze';
      default: return 'bg-arena-card/50 border-arena-border';
    }
  };

  const getRankIcon = () => {
    switch (rank) {
      case 1: return '👑';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  return (
    <div
      className={`
        leaderboard-row flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border-2
        ${getRankStyle()}
        ${highlight ? 'ring-2 ring-arena-cyan' : ''}
        ${isNew ? 'animate-slide-up' : ''}
      `}
      style={{
        animationDelay: `${rank * 0.08}s`,
        animationFillMode: 'both',
      }}
    >
      {/* Rank */}
      <div className="flex-shrink-0 w-10 text-center">
        <span className={`font-display font-bold ${rank <= 3 ? 'text-xl' : 'text-sm text-gray-400'}`}>
          {getRankIcon()}
        </span>
      </div>

      {/* Avatar */}
      <span className="text-2xl sm:text-3xl flex-shrink-0">{getAvatarEmoji(avatar)}</span>

      {/* Name + Streak */}
      <div className="flex-1 min-w-0">
        <p className={`font-semibold truncate ${rank <= 3 ? 'text-white text-lg' : 'text-gray-300'}`}>
          {nickname}
        </p>
        {streak >= 2 && (
          <p className="text-xs text-arena-orange flex items-center gap-1">
            🔥 {streak} streak
          </p>
        )}
      </div>

      {/* Score */}
      <div className="flex-shrink-0 text-right">
        <p className={`font-display font-bold ${rank <= 3 ? 'text-lg text-arena-cyan text-glow-cyan' : 'text-gray-300'}`}>
          {score.toLocaleString()}
        </p>
        <p className="text-[10px] text-gray-500 uppercase tracking-wider">XP</p>
      </div>
    </div>
  );
}
