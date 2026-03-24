import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Trophy, Zap, Wifi, WifiOff } from 'lucide-react';
import { supabase, getQuizChannel } from '../lib/supabase';
import { calculateScore } from '../lib/scoring';
import Timer from '../components/Timer';
import LeaderboardRow from '../components/LeaderboardRow';
import ParticleBackground from '../components/ParticleBackground';
import { getAvatarEmoji } from '../components/AvatarPicker';
import { playCorrect, playWrong, playGameStart, playLeaderboard } from '../lib/sounds';

const ANSWER_COLORS = [
  'answer-btn answer-btn-0',
  'answer-btn answer-btn-1',
  'answer-btn answer-btn-2',
  'answer-btn answer-btn-3',
];
const ANSWER_SHAPES = ['▲', '◆', '●', '■'];

/**
 * Player Game Screen — real-time quiz experience using Supabase Realtime Broadcast
 */
export default function PlayerGame() {
  const { code } = useParams();
  const [gameState, setGameState] = useState('waiting');
  const [question, setQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [result, setResult] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [totalScore, setTotalScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [connected, setConnected] = useState(true);
  const channelRef = useRef(null);

  const playerId = sessionStorage.getItem('gda_player_id');
  const quizId = sessionStorage.getItem('gda_quiz_id');
  const nickname = sessionStorage.getItem('gda_nickname') || 'Player';
  const avatar = sessionStorage.getItem('gda_avatar') || 'robot';

  // Subscribe to Supabase Realtime Broadcast channel
  useEffect(() => {
    if (!code) return;

    const channel = getQuizChannel(code);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'question-started' }, ({ payload }) => {
        setQuestion(payload);
        setSelectedAnswer(null);
        setResult(null);
        setGameState('question');
        playGameStart();
      })
      .on('broadcast', { event: 'leaderboard-update' }, ({ payload }) => {
        setLeaderboard(payload.leaderboard || []);
        setGameState('leaderboard');
        playLeaderboard();
      })
      .on('broadcast', { event: 'quiz-ended' }, ({ payload }) => {
        setLeaderboard(payload.leaderboard || []);
        setGameState('ended');
        playLeaderboard();
      })
      .on('broadcast', { event: 'quiz-restarted' }, () => {
        setGameState('waiting');
        setQuestion(null);
        setSelectedAnswer(null);
        setResult(null);
        setLeaderboard([]);
        setTotalScore(0);
        setStreak(0);
      })
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [code]);

  const handleAnswer = useCallback(async (answerIndex) => {
    if (selectedAnswer !== null || gameState !== 'question' || !question) return;
    setSelectedAnswer(answerIndex);

    try {
      const isCorrect = answerIndex === question.correctIndex;
      const responseTime = Date.now() - new Date(question.startedAt).getTime();
      const points = calculateScore(isCorrect, responseTime, question.timeLimit * 1000);

      const newStreak = isCorrect ? streak + 1 : 0;
      const newTotal = totalScore + points;

      // Insert answer into DB
      await supabase.from('answers').insert({
        quiz_id: quizId,
        question_id: question.questionId,
        player_id: playerId,
        answer_index: answerIndex,
        is_correct: isCorrect,
        points: points,
        response_time_ms: responseTime,
      });

      // Update player score in DB
      await supabase
        .from('players')
        .update({ score: newTotal, streak: newStreak })
        .eq('id', playerId);

      setStreak(newStreak);
      setTotalScore(newTotal);
      setResult({ isCorrect, points, totalScore: newTotal, streak: newStreak, correctIndex: question.correctIndex });
      setGameState('answered');

      if (isCorrect) playCorrect();
      else playWrong();
    } catch (err) {
      console.error('Submit answer error:', err);
    }
  }, [selectedAnswer, gameState, question, streak, totalScore, quizId, playerId]);

  const handleTimeUp = useCallback(() => {
    if (gameState === 'question' && selectedAnswer === null) {
      setGameState('answered');
      setResult({ isCorrect: false, points: 0, totalScore, streak: 0 });
      setStreak(0);
      playWrong();
    }
  }, [gameState, selectedAnswer, totalScore]);

  const myRank = leaderboard.findIndex(p => p.nickname === nickname) + 1;

  return (
    <div className="min-h-screen flex flex-col relative">
      <ParticleBackground />

      {/* Header */}
      <header className="relative z-10 p-3 flex items-center justify-between border-b border-arena-border/30">
        <div className="flex items-center gap-2">
          <span className="text-xl">{getAvatarEmoji(avatar)}</span>
          <span className="font-semibold text-white text-sm truncate max-w-[120px]">{nickname}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-arena-cyan font-display text-sm font-bold">
            <Zap className="w-4 h-4" />
            {totalScore.toLocaleString()} XP
          </div>
          {connected ? (
            <Wifi className="w-4 h-4 text-arena-green" />
          ) : (
            <WifiOff className="w-4 h-4 text-arena-red animate-pulse" />
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-4">
        {/* Waiting */}
        {gameState === 'waiting' && (
          <div className="text-center animate-fade-in">
            <div className="text-6xl mb-4 animate-float">{getAvatarEmoji(avatar)}</div>
            <h2 className="font-display text-2xl font-bold text-white mb-2">You're In!</h2>
            <p className="text-gray-400 mb-4">Waiting for the host to start the quiz...</p>
            <div className="flex items-center justify-center gap-2 text-arena-cyan">
              <div className="w-2 h-2 bg-arena-cyan rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-arena-cyan rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-arena-cyan rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        {/* Question */}
        {gameState === 'question' && question && (
          <div className="w-full max-w-lg animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-display text-gray-400 uppercase tracking-wider">
                Question {question.questionNumber}/{question.totalQuestions}
              </span>
              <Timer duration={question.timeLimit} onTimeUp={handleTimeUp} size={56} />
            </div>

            <div className="glass-card p-5 mb-6">
              <h2 className="font-semibold text-lg sm:text-xl text-white leading-relaxed">
                {question.text}
              </h2>
            </div>

            <div className="space-y-3">
              {question.options.map((option, i) => (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  disabled={selectedAnswer !== null}
                  className={`${ANSWER_COLORS[i]} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <span className="inline-flex items-center gap-3">
                    <span className="text-lg opacity-60">{ANSWER_SHAPES[i]}</span>
                    <span>{option}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Answered / Feedback */}
        {gameState === 'answered' && result && (
          <div className="text-center animate-bounce-in w-full max-w-sm">
            <div className={`text-8xl mb-4 ${result.isCorrect ? 'animate-bounce' : ''}`}>
              {result.isCorrect ? '🎉' : '😔'}
            </div>
            <h2 className={`font-display text-3xl font-black mb-2 ${
              result.isCorrect ? 'text-arena-green text-glow-cyan' : 'text-arena-red'
            }`}>
              {result.isCorrect ? 'CORRECT!' : 'WRONG!'}
            </h2>
            {result.points > 0 && (
              <p className="text-arena-cyan font-display text-xl font-bold mb-1">+{result.points} XP</p>
            )}
            {result.streak >= 2 && (
              <p className="text-arena-orange text-sm font-semibold">🔥 {result.streak} answer streak!</p>
            )}
            <p className="text-gray-400 text-sm mt-4">Waiting for next question...</p>
          </div>
        )}

        {/* Leaderboard */}
        {gameState === 'leaderboard' && (
          <div className="w-full max-w-lg animate-fade-in">
            <div className="text-center mb-6">
              <Trophy className="w-10 h-10 text-yellow-400 mx-auto mb-2" />
              <h2 className="font-display text-2xl font-bold text-white">LEADERBOARD</h2>
            </div>
            <div className="space-y-2">
              {leaderboard.slice(0, 10).map((player) => (
                <LeaderboardRow
                  key={player.nickname}
                  rank={player.rank}
                  nickname={player.nickname}
                  avatar={player.avatar}
                  score={player.score}
                  streak={player.streak}
                  highlight={player.nickname === nickname}
                  isNew
                />
              ))}
            </div>
            {myRank > 10 && (
              <div className="mt-4 text-center">
                <p className="text-gray-400 text-sm">Your rank: <span className="text-arena-cyan font-display font-bold">#{myRank}</span></p>
              </div>
            )}
          </div>
        )}

        {/* Game Ended */}
        {gameState === 'ended' && (
          <div className="w-full max-w-lg animate-fade-in">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">🏆</div>
              <h2 className="font-display text-3xl font-black text-white mb-2">GAME OVER</h2>
              <p className="text-arena-cyan font-display text-xl font-bold">
                Your Score: {totalScore.toLocaleString()} XP
              </p>
              {myRank > 0 && <p className="text-gray-400 mt-1">Final Rank: #{myRank}</p>}
            </div>

            {leaderboard.length > 0 && (
              <>
                <h3 className="font-display text-lg font-bold text-white mb-3 text-center">Final Rankings</h3>
                <div className="space-y-2">
                  {leaderboard.slice(0, 10).map((player) => (
                    <LeaderboardRow
                      key={player.nickname}
                      rank={player.rank}
                      nickname={player.nickname}
                      avatar={player.avatar}
                      score={player.score}
                      streak={player.streak}
                      highlight={player.nickname === nickname}
                      isNew
                    />
                  ))}
                </div>
              </>
            )}

            <button
              onClick={() => window.location.href = '/'}
              className="btn-secondary w-full text-center mt-8"
            >
              Back to Home
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
