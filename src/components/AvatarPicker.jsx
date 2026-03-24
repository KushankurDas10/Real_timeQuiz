/**
 * Avatar definitions — game-dev themed emoji avatars
 */
export const AVATARS = [
  { id: 'robot', emoji: '🤖', label: 'Robot' },
  { id: 'wizard', emoji: '🧙', label: 'Wizard' },
  { id: 'knight', emoji: '⚔️', label: 'Knight' },
  { id: 'ninja', emoji: '🥷', label: 'Ninja' },
  { id: 'alien', emoji: '👾', label: 'Alien' },
  { id: 'dragon', emoji: '🐉', label: 'Dragon' },
  { id: 'astronaut', emoji: '🧑‍🚀', label: 'Astronaut' },
  { id: 'pirate', emoji: '🏴‍☠️', label: 'Pirate' },
  { id: 'zombie', emoji: '🧟', label: 'Zombie' },
  { id: 'phoenix', emoji: '🦅', label: 'Phoenix' },
  { id: 'cyborg', emoji: '🦾', label: 'Cyborg' },
  { id: 'ghost', emoji: '👻', label: 'Ghost' },
];

/**
 * Get avatar emoji by ID
 */
export function getAvatarEmoji(avatarId) {
  return AVATARS.find(a => a.id === avatarId)?.emoji || '🤖';
}

/**
 * Avatar picker grid component
 */
export default function AvatarPicker({ selected, onSelect }) {
  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
      {AVATARS.map((avatar) => (
        <button
          key={avatar.id}
          onClick={() => onSelect(avatar.id)}
          className={`
            flex flex-col items-center gap-1 p-3 rounded-xl transition-all duration-200
            ${selected === avatar.id
              ? 'bg-arena-cyan/20 border-2 border-arena-cyan scale-110 glow-cyan'
              : 'bg-arena-card/50 border-2 border-arena-border hover:border-arena-cyan/40 hover:bg-arena-card'
            }
          `}
          title={avatar.label}
        >
          <span className="text-2xl sm:text-3xl">{avatar.emoji}</span>
          <span className="text-[10px] text-gray-400 font-medium">{avatar.label}</span>
        </button>
      ))}
    </div>
  );
}
