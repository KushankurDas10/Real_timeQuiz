-- ============================================================
-- GameDev Arena — Supabase Schema
-- Run this entire file in Supabase SQL Editor (supabase.com → your project → SQL Editor)
-- ============================================================

-- 1. Quizzes table
CREATE TABLE quizzes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  host_id UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'active', 'showing_leaderboard', 'ended')),
  current_question_index INTEGER DEFAULT -1,
  question_started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Questions table
CREATE TABLE questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'mcq' CHECK (question_type IN ('mcq', 'truefalse')),
  options JSONB NOT NULL DEFAULT '[]',
  correct_index INTEGER NOT NULL DEFAULT 0,
  time_limit INTEGER NOT NULL DEFAULT 20,
  order_num INTEGER NOT NULL DEFAULT 0
);

-- 3. Players table
CREATE TABLE players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  avatar TEXT NOT NULL DEFAULT 'robot',
  score INTEGER DEFAULT 0,
  streak INTEGER DEFAULT 0,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(quiz_id, nickname)
);

-- 4. Answers table
CREATE TABLE answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  answer_index INTEGER NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  points INTEGER NOT NULL DEFAULT 0,
  response_time_ms INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(question_id, player_id)
);

-- ============================================================
-- Row Level Security (RLS) Policies
-- ============================================================

ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;

-- Quizzes: anyone can read (players need to find by code), auth users can create/update
CREATE POLICY "Anyone can read quizzes" ON quizzes FOR SELECT USING (true);
CREATE POLICY "Auth users can create quizzes" ON quizzes FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Hosts can update their quizzes" ON quizzes FOR UPDATE USING (auth.uid() = host_id);
CREATE POLICY "Hosts can delete their quizzes" ON quizzes FOR DELETE USING (auth.uid() = host_id);

-- Questions: anyone can read (players see them), host can manage
CREATE POLICY "Anyone can read questions" ON questions FOR SELECT USING (true);
CREATE POLICY "Auth users can create questions" ON questions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM quizzes WHERE quizzes.id = quiz_id AND quizzes.host_id = auth.uid())
);
CREATE POLICY "Auth users can update questions" ON questions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM quizzes WHERE quizzes.id = quiz_id AND quizzes.host_id = auth.uid())
);
CREATE POLICY "Auth users can delete questions" ON questions FOR DELETE USING (
  EXISTS (SELECT 1 FROM quizzes WHERE quizzes.id = quiz_id AND quizzes.host_id = auth.uid())
);

-- Players: anyone can read and insert (join), only host can update scores
CREATE POLICY "Anyone can read players" ON players FOR SELECT USING (true);
CREATE POLICY "Anyone can join as player" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update players" ON players FOR UPDATE USING (true);

-- Answers: anyone can read and insert
CREATE POLICY "Anyone can read answers" ON answers FOR SELECT USING (true);
CREATE POLICY "Anyone can insert answers" ON answers FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update answers" ON answers FOR UPDATE USING (true);

-- ============================================================
-- Enable Realtime on tables that need live subscriptions
-- ============================================================

ALTER publication supabase_realtime ADD TABLE quizzes;
ALTER publication supabase_realtime ADD TABLE players;
ALTER publication supabase_realtime ADD TABLE answers;

-- ============================================================
-- Indexes for performance
-- ============================================================

CREATE INDEX idx_quizzes_code ON quizzes(code);
CREATE INDEX idx_questions_quiz ON questions(quiz_id, order_num);
CREATE INDEX idx_players_quiz ON players(quiz_id);
CREATE INDEX idx_answers_question ON answers(question_id);
CREATE INDEX idx_answers_player ON answers(player_id);
