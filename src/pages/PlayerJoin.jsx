import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gamepad2, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import ParticleBackground from '../components/ParticleBackground';
import AvatarPicker from '../components/AvatarPicker';
import { playJoin } from '../lib/sounds';

/**
 * Player Join Page — clean join-only screen
 * No create quiz option visible. Students enter code + nickname + avatar.
 */
export default function PlayerJoin() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState('robot');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: code+name, 2: avatar

  const handleJoin = async () => {
    setError('');
    if (!code.trim()) return setError('Enter a quiz code');
    if (!nickname.trim()) return setError('Enter your nickname');
    if (nickname.trim().length > 20) return setError('Nickname too long (max 20)');

    setLoading(true);
    try {
      const upperCode = code.trim().toUpperCase();

      // Find the quiz by code
      const { data: quiz, error: quizErr } = await supabase
        .from('quizzes')
        .select('id, status')
        .eq('code', upperCode)
        .single();

      if (quizErr || !quiz) {
        setError('Quiz not found. Check your code.');
        setLoading(false);
        return;
      }

      if (quiz.status === 'ended') {
        setError('This quiz has already ended.');
        setLoading(false);
        return;
      }

      // Check for duplicate nickname
      const { data: existing } = await supabase
        .from('players')
        .select('id')
        .eq('quiz_id', quiz.id)
        .ilike('nickname', nickname.trim())
        .maybeSingle();

      if (existing) {
        setError('Nickname already taken. Choose another.');
        setLoading(false);
        return;
      }

      // Insert player
      const { data: player, error: playerErr } = await supabase
        .from('players')
        .insert({
          quiz_id: quiz.id,
          nickname: nickname.trim(),
          avatar: avatar,
        })
        .select()
        .single();

      if (playerErr) {
        setError(playerErr.message || 'Failed to join');
        setLoading(false);
        return;
      }

      playJoin();

      // Store player info
      sessionStorage.setItem('gda_player_id', player.id);
      sessionStorage.setItem('gda_quiz_id', quiz.id);
      sessionStorage.setItem('gda_nickname', nickname.trim());
      sessionStorage.setItem('gda_avatar', avatar);
      sessionStorage.setItem('gda_code', upperCode);

      navigate(`/play/${upperCode}`);
    } catch (err) {
      setError('Something went wrong. Try again.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative">
      <ParticleBackground />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center gap-3 mb-3">
            <Gamepad2 className="w-10 h-10 text-arena-cyan" />
            <h1 className="font-display text-3xl sm:text-4xl font-black text-white text-glow-cyan">
              GAME
            </h1>
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-bold bg-gradient-to-r from-arena-cyan to-arena-magenta bg-clip-text text-transparent">
            LIMINALS
          </h2>
          <p className="text-gray-400 mt-2 text-sm">Enter the arena. Prove your knowledge.</p>
        </div>

        {/* Join Card */}
        <div className="glass-card p-6 sm:p-8 animate-slide-up">
          {step === 1 ? (
            <>
              <h3 className="font-display text-lg font-bold text-white mb-6 flex items-center gap-2">
                <Zap className="w-5 h-5 text-arena-cyan" />
                JOIN QUIZ
              </h3>

              {/* Quiz Code */}
              <div className="mb-4">
                <label className="text-sm text-gray-400 mb-1 block font-medium">Quiz Code</label>
                <input
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                  className="w-full bg-arena-bg border-2 border-arena-border rounded-xl px-4 py-3
                             text-white font-display text-xl tracking-[0.3em] text-center uppercase
                             focus:border-arena-cyan focus:outline-none transition-colors placeholder:text-gray-600
                             placeholder:tracking-normal placeholder:text-base placeholder:font-body"
                  maxLength={6}
                  autoFocus
                />
              </div>

              {/* Nickname */}
              <div className="mb-6">
                <label className="text-sm text-gray-400 mb-1 block font-medium">Nickname</label>
                <input
                  type="text"
                  placeholder="Choose your name"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value.slice(0, 20))}
                  className="w-full bg-arena-bg border-2 border-arena-border rounded-xl px-4 py-3
                             text-white font-semibold text-lg
                             focus:border-arena-cyan focus:outline-none transition-colors placeholder:text-gray-600"
                  maxLength={20}
                  onKeyDown={(e) => e.key === 'Enter' && code && nickname && setStep(2)}
                />
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-arena-red/10 border border-arena-red/30 text-arena-red text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={() => {
                  if (!code.trim()) return setError('Enter a quiz code');
                  if (!nickname.trim()) return setError('Enter your nickname');
                  setError('');
                  setStep(2);
                }}
                className="btn-primary w-full text-center"
              >
                Next — Choose Avatar
              </button>
            </>
          ) : (
            <>
              <h3 className="font-display text-lg font-bold text-white mb-4 flex items-center gap-2">
                Choose Your Avatar
              </h3>
              <p className="text-gray-400 text-sm mb-4">Pick a character that represents you in the arena</p>

              <AvatarPicker selected={avatar} onSelect={setAvatar} />

              {error && (
                <div className="mt-4 p-3 rounded-lg bg-arena-red/10 border border-arena-red/30 text-arena-red text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-3 rounded-xl border-2 border-arena-border text-gray-400 
                             font-display font-bold uppercase tracking-wider hover:border-gray-500 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleJoin}
                  disabled={loading}
                  className="btn-primary flex-1 text-center disabled:opacity-50"
                >
                  {loading ? 'Joining...' : 'Enter Arena'}
                </button>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-gray-600 text-xs mt-6 font-display tracking-wider">
          POWERED BY GAMELIMINALS
        </p>
      </div>
    </div>
  );
}
