import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Play, Settings, Clock, CheckCircle, XCircle, Gamepad2, LogOut } from 'lucide-react';
import { supabase, generateCode } from '../lib/supabase';
import ParticleBackground from '../components/ParticleBackground';
import { playGameStart } from '../lib/sounds';

/**
 * Admin Dashboard — Create quiz, add questions, start game
 * Protected route — requires Supabase Auth session
 */
export default function AdminDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [showEditor, setShowEditor] = useState(false);
  const [editIndex, setEditIndex] = useState(-1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Editor state
  const [qText, setQText] = useState('');
  const [qType, setQType] = useState('mcq');
  const [qOptions, setQOptions] = useState(['', '', '', '']);
  const [qCorrect, setQCorrect] = useState(0);
  const [qTime, setQTime] = useState(20);

  // Auth check
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/admin');
      } else {
        setUser(session.user);
      }
    });
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin');
  };

  const resetEditor = () => {
    setQText('');
    setQType('mcq');
    setQOptions(['', '', '', '']);
    setQCorrect(0);
    setQTime(20);
    setEditIndex(-1);
    setShowEditor(false);
  };

  const openNewQuestion = () => {
    resetEditor();
    setShowEditor(true);
  };

  const openEditQuestion = (index) => {
    const q = questions[index];
    setQText(q.text);
    setQType(q.type);
    setQOptions([...q.options]);
    setQCorrect(q.correctIndex);
    setQTime(q.timeLimit);
    setEditIndex(index);
    setShowEditor(true);
  };

  const saveQuestion = () => {
    if (!qText.trim()) return setError('Question text is required');
    const opts = qType === 'truefalse' ? ['True', 'False'] : qOptions;
    for (let i = 0; i < opts.length; i++) {
      if (!opts[i].trim()) return setError(`Option ${i + 1} cannot be empty`);
    }

    setError('');
    const newQ = {
      text: qText.trim(),
      type: qType,
      options: opts.map(o => o.trim()),
      correctIndex: qCorrect,
      timeLimit: qTime,
    };

    if (editIndex >= 0) {
      const updated = [...questions];
      updated[editIndex] = newQ;
      setQuestions(updated);
    } else {
      setQuestions([...questions, newQ]);
    }
    resetEditor();
  };

  const deleteQuestion = (index) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleCreateQuiz = async () => {
    if (questions.length === 0) return setError('Add at least one question');
    setError('');
    setLoading(true);

    try {
      const quizCode = generateCode();

      // Create quiz
      const { data: quiz, error: quizErr } = await supabase
        .from('quizzes')
        .insert({
          code: quizCode,
          host_id: user.id,
          status: 'lobby',
        })
        .select()
        .single();

      if (quizErr) throw quizErr;

      // Insert questions
      const questionRows = questions.map((q, i) => ({
        quiz_id: quiz.id,
        question_text: q.text,
        question_type: q.type,
        options: q.options,
        correct_index: q.correctIndex,
        time_limit: q.timeLimit,
        order_num: i,
      }));

      const { error: qErr } = await supabase.from('questions').insert(questionRows);
      if (qErr) throw qErr;

      playGameStart();
      navigate(`/admin/game/${quizCode}`);
    } catch (err) {
      setError(err.message || 'Failed to create quiz');
    }
    setLoading(false);
  };

  const handleTypeChange = (type) => {
    setQType(type);
    if (type === 'truefalse') {
      setQOptions(['True', 'False']);
      setQCorrect(0);
    } else {
      setQOptions(['', '', '', '']);
      setQCorrect(0);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-arena-bg">
        <div className="text-arena-cyan font-display animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <ParticleBackground />

      <div className="relative z-10 max-w-3xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Gamepad2 className="w-8 h-8 text-arena-cyan" />
            <div>
              <h1 className="font-display text-xl sm:text-2xl font-black text-white">ADMIN PANEL</h1>
              <p className="text-xs text-gray-500 font-display tracking-wider">GAMEDEV ARENA</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCreateQuiz}
              disabled={loading || questions.length === 0}
              className="btn-primary flex items-center gap-2 disabled:opacity-30"
            >
              <Play className="w-4 h-4" />
              <span className="hidden sm:inline">Create & Start</span>
              <span className="sm:hidden">Start</span>
            </button>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-gray-500 hover:text-arena-red hover:bg-arena-red/10 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-arena-red/10 border border-arena-red/30 text-arena-red text-sm animate-slide-down">
            {error}
          </div>
        )}

        {/* Question List */}
        <div className="space-y-3 mb-6">
          {questions.map((q, i) => (
            <div
              key={i}
              className="glass-card glass-card-hover p-4 flex items-start gap-3 cursor-pointer group"
              onClick={() => openEditQuestion(i)}
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-arena-cyan/10 flex items-center justify-center font-display text-sm font-bold text-arena-cyan">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{q.text}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    {q.type === 'truefalse' ? (
                      <><CheckCircle className="w-3 h-3" /> True/False</>
                    ) : (
                      <><Settings className="w-3 h-3" /> MCQ ({q.options.length} options)</>
                    )}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {q.timeLimit}s
                  </span>
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); deleteQuestion(i); }}
                className="flex-shrink-0 p-2 rounded-lg text-gray-500 hover:text-arena-red hover:bg-arena-red/10 transition-colors opacity-0 group-hover:opacity-100"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Add Question Button */}
        {!showEditor && (
          <button
            onClick={openNewQuestion}
            className="w-full p-4 rounded-xl border-2 border-dashed border-arena-border hover:border-arena-cyan/40
                       text-gray-400 hover:text-arena-cyan transition-all flex items-center justify-center gap-2 group"
          >
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
            <span className="font-display font-bold uppercase tracking-wider text-sm">Add Question</span>
          </button>
        )}

        {/* Question Editor */}
        {showEditor && (
          <div className="glass-card p-5 sm:p-6 animate-slide-up">
            <h3 className="font-display text-lg font-bold text-white mb-4">
              {editIndex >= 0 ? 'Edit Question' : 'New Question'}
            </h3>

            {/* Question Type */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => handleTypeChange('mcq')}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  qType === 'mcq'
                    ? 'bg-arena-cyan/20 text-arena-cyan border border-arena-cyan/40'
                    : 'bg-arena-card text-gray-400 border border-arena-border hover:border-gray-600'
                }`}
              >
                Multiple Choice
              </button>
              <button
                onClick={() => handleTypeChange('truefalse')}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  qType === 'truefalse'
                    ? 'bg-arena-cyan/20 text-arena-cyan border border-arena-cyan/40'
                    : 'bg-arena-card text-gray-400 border border-arena-border hover:border-gray-600'
                }`}
              >
                True / False
              </button>
            </div>

            {/* Question Text */}
            <div className="mb-4">
              <label className="text-sm text-gray-400 mb-1 block">Question</label>
              <textarea
                value={qText}
                onChange={(e) => setQText(e.target.value)}
                placeholder="Enter your question..."
                className="w-full bg-arena-bg border-2 border-arena-border rounded-xl px-4 py-3
                           text-white focus:border-arena-cyan focus:outline-none transition-colors
                           placeholder:text-gray-600 resize-none"
                rows={2}
                autoFocus
              />
            </div>

            {/* Options */}
            <div className="mb-4">
              <label className="text-sm text-gray-400 mb-2 block">Options (click to mark correct)</label>
              <div className="space-y-2">
                {(qType === 'truefalse' ? ['True', 'False'] : qOptions).map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <button
                      onClick={() => setQCorrect(i)}
                      className={`flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                        qCorrect === i
                          ? 'bg-arena-green/20 border-arena-green text-arena-green'
                          : 'border-arena-border text-gray-600 hover:border-gray-500'
                      }`}
                      title="Mark as correct"
                    >
                      {qCorrect === i ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    </button>
                    {qType === 'truefalse' ? (
                      <div className="flex-1 bg-arena-bg border-2 border-arena-border rounded-xl px-4 py-2.5 text-white">
                        {opt}
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const newOpts = [...qOptions];
                          newOpts[i] = e.target.value;
                          setQOptions(newOpts);
                        }}
                        placeholder={`Option ${i + 1}`}
                        className="flex-1 bg-arena-bg border-2 border-arena-border rounded-xl px-4 py-2.5
                                   text-white focus:border-arena-cyan focus:outline-none transition-colors
                                   placeholder:text-gray-600"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Time Limit */}
            <div className="mb-6">
              <label className="text-sm text-gray-400 mb-1 block">Time Limit: {qTime} seconds</label>
              <input
                type="range"
                min={5}
                max={60}
                step={5}
                value={qTime}
                onChange={(e) => setQTime(Number(e.target.value))}
                className="w-full accent-arena-cyan"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>5s</span><span>30s</span><span>60s</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={resetEditor}
                className="px-6 py-2.5 rounded-xl border-2 border-arena-border text-gray-400
                           font-display font-bold uppercase tracking-wider text-sm hover:border-gray-500 transition-colors"
              >
                Cancel
              </button>
              <button onClick={saveQuestion} className="btn-primary flex-1 text-center text-sm">
                {editIndex >= 0 ? 'Save Changes' : 'Add Question'}
              </button>
            </div>
          </div>
        )}

        {questions.length > 0 && !showEditor && (
          <div className="mt-6 text-center text-gray-500 text-sm">
            <p>{questions.length} question{questions.length !== 1 ? 's' : ''} ready</p>
            <p className="text-xs mt-1">Click "Create & Start" to generate a join code</p>
          </div>
        )}
      </div>
    </div>
  );
}
