import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Users, Play, SkipForward, Square, RotateCcw,
  Trophy, Copy, Check, Wifi, BarChart3, Gamepad2, LogOut
} from 'lucide-react';
import { supabase, getQuizChannel } from '../lib/supabase';
import Timer from '../components/Timer';
import LeaderboardRow from '../components/LeaderboardRow';
import ParticleBackground from '../components/ParticleBackground';
import { getAvatarEmoji } from '../components/AvatarPicker';
import { playGameStart, playLeaderboard, playJoin } from '../lib/sounds';

/**
 * Admin Game — Live host control panel using Supabase Realtime Broadcast
 */
export default function AdminGame() {
  const { code } = useParams();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [gameState, setGameState] = useState('lobby');
  const [players, setPlayers] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [answerStats, setAnswerStats] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const channelRef = useRef(null);
  const pollRef = useRef(null);

  // Load quiz data and set up realtime
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Auth check
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate('/admin'); return; }

      // Fetch quiz
      const { data: quizData, error: qErr } = await supabase
        .from('quizzes')
        .select('*')
        .eq('code', code)
        .single();

      if (qErr || !quizData) { setError('Quiz not found'); setLoading(false); return; }
      if (cancelled) return;
      setQuiz(quizData);

      // Fetch questions
      const { data: qList } = await supabase
        .from('questions')
        .select('*')
        .eq('quiz_id', quizData.id)
        .order('order_num');

      if (cancelled) return;
      setQuestions(qList || []);

      // Fetch existing players
      const { data: pList } = await supabase
        .from('players')
        .select('*')
        .eq('quiz_id', quizData.id)
        .order('joined_at');

      if (cancelled) return;
      setPlayers(pList || []);
      setLoading(false);

      // Subscribe to new player joins via DB changes
      const playerChannel = supabase
        .channel(`players-${code}`)
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'players', filter: `quiz_id=eq.${quizData.id}` },
          (payload) => {
            setPlayers(prev => {
              if (prev.find(p => p.id === payload.new.id)) return prev;
              playJoin();
              return [...prev, payload.new];
            });
          }
        )
        .subscribe();

      // Subscribe to answer inserts to track count
      const answerChannel = supabase
        .channel(`answers-${code}`)
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'answers', filter: `quiz_id=eq.${quizData.id}` },
          () => {
            setAnsweredCount(prev => prev + 1);
          }
        )
        .subscribe();

      // Broadcast channel for sending events to players
      const broadcastChannel = getQuizChannel(code);
      broadcastChannel.subscribe();
      channelRef.current = broadcastChannel;

      return () => {
        supabase.removeChannel(playerChannel);
        supabase.removeChannel(answerChannel);
        supabase.removeChannel(broadcastChannel);
      };
    }

    const cleanup = init();
    return () => {
      cancelled = true;
      cleanup.then(fn => fn && fn());
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [code, navigate]);

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const broadcastEvent = (event, payload) => {
    if (channelRef.current) {
      channelRef.current.send({ type: 'broadcast', event, payload });
    }
  };

  // Start Quiz
  const startQuiz = async () => {
    if (players.length === 0) return setError('Wait for players to join');
    if (questions.length === 0) return setError('No questions found');
    setError('');

    const qi = 0;
    const q = questions[qi];
    const startedAt = new Date().toISOString();

    await supabase
      .from('quizzes')
      .update({ status: 'active', current_question_index: qi, question_started_at: startedAt })
      .eq('id', quiz.id);

    setCurrentQuestionIndex(qi);
    setCurrentQuestion(q);
    setAnsweredCount(0);
    setGameState('question');
    playGameStart();

    broadcastEvent('question-started', {
      questionId: q.id,
      text: q.question_text,
      type: q.question_type,
      options: q.options,
      correctIndex: q.correct_index,
      timeLimit: q.time_limit,
      questionNumber: qi + 1,
      totalQuestions: questions.length,
      startedAt,
    });
  };

  // Show Leaderboard
  const showLeaderboard = async () => {
    // Fetch current player scores
    const { data: playerData } = await supabase
      .from('players')
      .select('*')
      .eq('quiz_id', quiz.id)
      .order('score', { ascending: false });

    const lb = (playerData || []).map((p, i) => ({
      nickname: p.nickname,
      avatar: p.avatar,
      score: p.score,
      streak: p.streak,
      rank: i + 1,
    }));

    // Get answer stats for current question
    let stats = null;
    if (currentQuestion) {
      const { data: ansData } = await supabase
        .from('answers')
        .select('answer_index, is_correct')
        .eq('question_id', currentQuestion.id);

      const distribution = new Array(currentQuestion.options.length).fill(0);
      (ansData || []).forEach(a => { distribution[a.answer_index] = (distribution[a.answer_index] || 0) + 1; });

      stats = {
        stats: distribution,
        totalAnswered: ansData?.length || 0,
        totalPlayers: players.length,
        correctIndex: currentQuestion.correct_index,
      };
    }

    setLeaderboard(lb);
    setAnswerStats(stats);
    setGameState('leaderboard');

    await supabase
      .from('quizzes')
      .update({ status: 'showing_leaderboard' })
      .eq('id', quiz.id);

    broadcastEvent('leaderboard-update', { leaderboard: lb, answerStats: stats });
    playLeaderboard();
  };

  // Next Question
  const nextQuestion = async () => {
    const nextIdx = currentQuestionIndex + 1;
    if (nextIdx >= questions.length) {
      return endQuiz();
    }

    const q = questions[nextIdx];
    const startedAt = new Date().toISOString();

    await supabase
      .from('quizzes')
      .update({ status: 'active', current_question_index: nextIdx, question_started_at: startedAt })
      .eq('id', quiz.id);

    setCurrentQuestionIndex(nextIdx);
    setCurrentQuestion(q);
    setAnsweredCount(0);
    setAnswerStats(null);
    setGameState('question');
    playGameStart();

    broadcastEvent('question-started', {
      questionId: q.id,
      text: q.question_text,
      type: q.question_type,
      options: q.options,
      correctIndex: q.correct_index,
      timeLimit: q.time_limit,
      questionNumber: nextIdx + 1,
      totalQuestions: questions.length,
      startedAt,
    });
  };

  // End Quiz
  const endQuiz = async () => {
    const { data: playerData } = await supabase
      .from('players')
      .select('*')
      .eq('quiz_id', quiz.id)
      .order('score', { ascending: false });

    const lb = (playerData || []).map((p, i) => ({
      nickname: p.nickname,
      avatar: p.avatar,
      score: p.score,
      streak: p.streak,
      rank: i + 1,
    }));

    await supabase
      .from('quizzes')
      .update({ status: 'ended' })
      .eq('id', quiz.id);

    setLeaderboard(lb);
    setGameState('ended');

    broadcastEvent('quiz-ended', { leaderboard: lb });
    playLeaderboard();
  };

  // Restart Quiz
  const restartQuiz = async () => {
    // Reset player scores
    await supabase
      .from('players')
      .update({ score: 0, streak: 0 })
      .eq('quiz_id', quiz.id);

    // Delete all answers
    await supabase
      .from('answers')
      .delete()
      .eq('quiz_id', quiz.id);

    // Reset quiz state
    await supabase
      .from('quizzes')
      .update({ status: 'lobby', current_question_index: -1, question_started_at: null })
      .eq('id', quiz.id);

    setGameState('lobby');
    setCurrentQuestion(null);
    setCurrentQuestionIndex(-1);
    setAnsweredCount(0);
    setLeaderboard([]);
    setAnswerStats(null);

    broadcastEvent('quiz-restarted', {});
  };

  const ANSWER_COLORS_BG = ['bg-red-500', 'bg-blue-500', 'bg-amber-500', 'bg-green-500'];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-arena-bg">
        <div className="text-arena-cyan font-display animate-pulse">Loading quiz...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <ParticleBackground />

      <div className="relative z-10 max-w-4xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Gamepad2 className="w-7 h-7 text-arena-cyan" />
            <div>
              <h1 className="font-display text-lg font-bold text-white">HOST CONTROL</h1>
              <p className="text-xs text-gray-500">GameDev Arena</p>
            </div>
          </div>

          <button
            onClick={copyCode}
            className="glass-card px-4 py-2 flex items-center gap-3 hover:border-arena-cyan/40 transition-all group"
          >
            <span className="text-xs text-gray-400 font-medium">CODE</span>
            <span className="font-display text-2xl font-black text-arena-cyan tracking-[0.2em] text-glow-cyan">
              {code}
            </span>
            {copied ? (
              <Check className="w-4 h-4 text-arena-green" />
            ) : (
              <Copy className="w-4 h-4 text-gray-500 group-hover:text-arena-cyan transition-colors" />
            )}
          </button>
        </header>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-arena-red/10 border border-arena-red/30 text-arena-red text-sm animate-slide-down">
            {error}
          </div>
        )}

        {/* LOBBY */}
        {gameState === 'lobby' && (
          <div className="animate-fade-in">
            <div className="glass-card p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-arena-cyan" />
                  Players ({players.length})
                </h2>
                <div className="flex items-center gap-2 text-sm text-arena-green">
                  <Wifi className="w-4 h-4" />
                  <span>Live</span>
                </div>
              </div>

              {players.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Share the code above with your players</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {players.map((p, i) => (
                    <div
                      key={p.id}
                      className="bg-arena-bg/50 rounded-xl p-3 flex items-center gap-2 animate-scale-in border border-arena-border/30"
                      style={{ animationDelay: `${i * 50}ms` }}
                    >
                      <span className="text-2xl">{getAvatarEmoji(p.avatar)}</span>
                      <span className="text-sm font-medium text-white truncate">{p.nickname}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={startQuiz}
              disabled={players.length === 0}
              className="btn-primary w-full text-center text-lg py-4 flex items-center justify-center gap-3 disabled:opacity-30"
            >
              <Play className="w-6 h-6" />
              START QUIZ
            </button>
          </div>
        )}

        {/* QUESTION */}
        {gameState === 'question' && currentQuestion && (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <span className="font-display text-sm text-gray-400 uppercase tracking-wider">
                Question {currentQuestionIndex + 1} / {questions.length}
              </span>
              <Timer duration={currentQuestion.time_limit} onTimeUp={showLeaderboard} size={64} />
            </div>

            <div className="glass-card p-6 mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-white leading-relaxed">
                {currentQuestion.question_text}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
                {currentQuestion.options.map((opt, i) => (
                  <div key={i} className={`p-4 rounded-xl border-2 border-arena-border/30 ${ANSWER_COLORS_BG[i]}/10`}>
                    <span className="text-white font-medium">{opt}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-arena-cyan" />
                <span className="text-white font-medium">Responses</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-display text-2xl font-bold text-arena-cyan">{answeredCount}</span>
                <span className="text-gray-500">/ {players.length}</span>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={showLeaderboard} className="btn-secondary flex-1 text-center flex items-center justify-center gap-2 text-sm">
                <Trophy className="w-4 h-4" />
                Show Results
              </button>
              <button onClick={endQuiz} className="px-4 py-3 rounded-xl border-2 border-arena-red/40 text-arena-red hover:bg-arena-red/10 transition-colors font-display font-bold text-sm">
                <Square className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* LEADERBOARD */}
        {gameState === 'leaderboard' && (
          <div className="animate-fade-in">
            {answerStats && (
              <div className="glass-card p-5 mb-6">
                <h3 className="font-display text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Answer Distribution</h3>
                <div className="space-y-2">
                  {answerStats.stats.map((count, i) => {
                    const pct = answerStats.totalAnswered > 0 ? (count / answerStats.totalAnswered) * 100 : 0;
                    const isCorrect = i === answerStats.correctIndex;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isCorrect ? 'bg-arena-green' : 'bg-gray-500'}`} />
                        <div className="flex-1">
                          <div className="h-8 bg-arena-bg rounded-lg overflow-hidden relative">
                            <div
                              className={`h-full rounded-lg transition-all duration-1000 ease-out ${isCorrect ? 'bg-arena-green/30' : 'bg-gray-700/30'}`}
                              style={{ width: `${Math.max(pct, 2)}%` }}
                            />
                            <span className="absolute inset-0 flex items-center px-3 text-sm text-white font-medium">
                              {count} {isCorrect && '✓'}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs text-gray-500 w-10 text-right">{Math.round(pct)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mb-6">
              <h2 className="font-display text-xl font-bold text-white flex items-center gap-2 mb-4">
                <Trophy className="w-6 h-6 text-yellow-400" />
                LEADERBOARD
              </h2>
              <div className="space-y-2">
                {leaderboard.map((player) => (
                  <LeaderboardRow
                    key={player.nickname}
                    rank={player.rank}
                    nickname={player.nickname}
                    avatar={player.avatar}
                    score={player.score}
                    streak={player.streak}
                    isNew
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={nextQuestion} className="btn-primary flex-1 text-center flex items-center justify-center gap-2">
                <SkipForward className="w-5 h-5" />
                {currentQuestionIndex + 1 >= questions.length ? 'End Quiz' : 'Next Question'}
              </button>
              <button onClick={endQuiz} className="px-6 py-3 rounded-xl border-2 border-arena-red/40 text-arena-red hover:bg-arena-red/10 transition-colors font-display font-bold text-sm uppercase">
                End
              </button>
            </div>
          </div>
        )}

        {/* ENDED */}
        {gameState === 'ended' && (
          <div className="animate-fade-in">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">🏆</div>
              <h2 className="font-display text-3xl font-black text-white mb-2">QUIZ COMPLETE</h2>
              <p className="text-gray-400">{players.length} players participated</p>
            </div>

            {leaderboard.length > 0 && (
              <div className="mb-8">
                <h3 className="font-display text-lg font-bold text-white mb-3">Final Rankings</h3>
                <div className="space-y-2">
                  {leaderboard.map((player) => (
                    <LeaderboardRow
                      key={player.nickname}
                      rank={player.rank}
                      nickname={player.nickname}
                      avatar={player.avatar}
                      score={player.score}
                      streak={player.streak}
                      isNew
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={restartQuiz} className="btn-primary flex-1 text-center flex items-center justify-center gap-2">
                <RotateCcw className="w-5 h-5" />
                Restart Quiz
              </button>
              <button onClick={() => navigate('/admin/dashboard')} className="btn-secondary flex-1 text-center">
                New Quiz
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
