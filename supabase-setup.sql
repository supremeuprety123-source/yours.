-- ============================================================
-- YOURS — Personal Life OS  ·  Full Supabase SQL Setup
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- Safe to re-run (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- ============================================================

-- 1. PROFILE
CREATE TABLE IF NOT EXISTS profile (
  id                text PRIMARY KEY,
  name              text,
  ca_level          text,
  pin_enabled       boolean,
  pin               text,
  currency_code     text,
  currency_symbol   text,
  focus_pomodoro    integer,
  focus_short_break integer,
  focus_long_break  integer,
  focus_target      integer,
  notifications     jsonb,
  updated_at        timestamptz
);

-- 2. PAPERS
CREATE TABLE IF NOT EXISTS papers (
  id         text PRIMARY KEY,
  number     integer,
  name       text,
  level      text,
  "group"    text,
  created_at timestamptz,
  updated_at timestamptz
);

-- 3. CHAPTERS (+ CA Foundation confidence / phase tracking)
CREATE TABLE IF NOT EXISTS chapters (
  id             text PRIMARY KEY,
  paper_id       text,
  name           text,
  difficulty     integer,
  status         text,
  completion     integer,
  time_spent     integer,
  revision_count integer,
  last_revised   timestamptz,
  marks_obtained numeric,
  marks_total    numeric,
  notes          text,
  sort_order     integer,
  confidence     text,
  phase1_done    boolean,
  phase2_done    boolean,
  created_at     timestamptz,
  updated_at     timestamptz
);

ALTER TABLE chapters ADD COLUMN IF NOT EXISTS sort_order integer;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS confidence text;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS phase1_done boolean;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS phase2_done boolean;

-- 4. LESSONS
CREATE TABLE IF NOT EXISTS lessons (
  id         text PRIMARY KEY,
  chapter_id text,
  name       text,
  completion integer,
  time_spent integer,
  notes      text,
  sort_order integer,
  created_at timestamptz,
  updated_at timestamptz
);

ALTER TABLE lessons ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS sort_order integer;

-- 5. REVISION HISTORY
CREATE TABLE IF NOT EXISTS revision_history (
  id         text PRIMARY KEY,
  chapter_id text,
  revised_at timestamptz
);

-- 6. ROUTINES (+ plan_tag / notes for CA plan seeding)
CREATE TABLE IF NOT EXISTS routines (
  id                text PRIMARY KEY,
  title             text,
  category          text,
  start_time        text,
  end_time          text,
  linked_subject    text,
  repeat_type       text,
  repeat_days       jsonb,
  repeat_exceptions jsonb,
  repeat_until      timestamptz,
  completed_dates   jsonb,
  date              text,
  notes             text,
  plan_tag          text,
  created_at        timestamptz,
  updated_at        timestamptz
);

ALTER TABLE routines ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE routines ADD COLUMN IF NOT EXISTS plan_tag text;

-- 7. FOCUS SESSIONS
CREATE TABLE IF NOT EXISTS focus_sessions (
  id           text PRIMARY KEY,
  type         text,
  duration     integer,
  subject      text,
  completed_at timestamptz
);

-- 8. CATEGORIES (finance)
CREATE TABLE IF NOT EXISTS categories (
  id     text PRIMARY KEY,
  name   text,
  type   text,
  budget numeric
);

-- 9. TRANSACTIONS
CREATE TABLE IF NOT EXISTS transactions (
  id             text PRIMARY KEY,
  type           text,
  amount         numeric,
  currency       text,
  category       text,
  description    text,
  date           text,
  from_to        text,
  payment_method text,
  notes          text,
  created_at     timestamptz,
  updated_at     timestamptz
);

-- 10. DIARY ENTRIES
CREATE TABLE IF NOT EXISTS diary_entries (
  id                 text PRIMARY KEY,
  date               text,
  mood               integer,
  mental_tags        jsonb,
  performance_rating integer,
  journal_text       text,
  learned            text,
  planned            text,
  updated_at         timestamptz
);

-- 11. LIFE NOTES
CREATE TABLE IF NOT EXISTS life_notes (
  id         text PRIMARY KEY,
  title      text,
  content    text,
  category   text,
  tags       jsonb,
  pinned     boolean,
  created_at timestamptz,
  updated_at timestamptz
);

-- 12. EXAMS (official exam dates for Home countdown)
CREATE TABLE IF NOT EXISTS exams (
  id             text PRIMARY KEY,
  name           text,
  date           text,
  marks_obtained numeric,
  marks_total    numeric
);

ALTER TABLE exams ADD COLUMN IF NOT EXISTS marks_obtained numeric;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS marks_total numeric;

-- 13. MOCK SCORES (Planner Plan + Settings mock log)
CREATE TABLE IF NOT EXISTS mock_scores (
  id                 text PRIMARY KEY,
  date               text,
  paper              text,
  score              numeric,
  max_score          numeric,
  confident_attempts integer,
  guessed_attempts   integer,
  wrong_guesses      integer,
  notes              text,
  created_at         timestamptz,
  updated_at         timestamptz
);

-- 14. DAY LOGS (Planner actual time spent — not planned routines)
CREATE TABLE IF NOT EXISTS day_logs (
  id           text PRIMARY KEY,
  date         text,
  title        text,
  category     text,
  start_time   text,
  end_time     text,
  duration_min integer,
  notes        text,
  created_at   timestamptz,
  updated_at   timestamptz
);

-- ============================================================
-- DISABLE RLS (single-user app; security is PIN on device)
-- ============================================================

ALTER TABLE profile           DISABLE ROW LEVEL SECURITY;
ALTER TABLE papers            DISABLE ROW LEVEL SECURITY;
ALTER TABLE chapters          DISABLE ROW LEVEL SECURITY;
ALTER TABLE lessons           DISABLE ROW LEVEL SECURITY;
ALTER TABLE revision_history  DISABLE ROW LEVEL SECURITY;
ALTER TABLE routines          DISABLE ROW LEVEL SECURITY;
ALTER TABLE focus_sessions    DISABLE ROW LEVEL SECURITY;
ALTER TABLE categories        DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions      DISABLE ROW LEVEL SECURITY;
ALTER TABLE diary_entries     DISABLE ROW LEVEL SECURITY;
ALTER TABLE life_notes        DISABLE ROW LEVEL SECURITY;
ALTER TABLE exams             DISABLE ROW LEVEL SECURITY;
ALTER TABLE mock_scores       DISABLE ROW LEVEL SECURITY;
ALTER TABLE day_logs          DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- DONE — YOURS cloud schema ready
-- ============================================================
