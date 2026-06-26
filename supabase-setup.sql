-- ============================================================
-- YOURS — Personal Life OS  ·  Supabase SQL Setup
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- Project: crukkzfwqnmsauvhyhdc
-- ============================================================

-- 1. PROFILE TABLE
CREATE TABLE IF NOT EXISTS profile (
  id              text PRIMARY KEY,
  name            text,
  ca_level        text,
  pin_enabled     boolean,
  pin             text,
  currency_code   text,
  currency_symbol text,
  focus_pomodoro  integer,
  focus_short_break integer,
  focus_long_break  integer,
  focus_target    integer,
  notifications   jsonb,
  updated_at      timestamptz
);

-- 2. PAPERS TABLE
CREATE TABLE IF NOT EXISTS papers (
  id         text PRIMARY KEY,
  number     integer,
  name       text,
  level      text,
  "group"    text,
  created_at timestamptz,
  updated_at timestamptz
);

-- 3. CHAPTERS TABLE
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
  created_at     timestamptz,
  updated_at     timestamptz
);

-- 4. LESSONS TABLE
CREATE TABLE IF NOT EXISTS lessons (
  id         text PRIMARY KEY,
  chapter_id text,
  name       text,
  completion integer,
  time_spent integer,
  created_at timestamptz,
  updated_at timestamptz
);

-- 5. REVISION HISTORY TABLE
CREATE TABLE IF NOT EXISTS revision_history (
  id         text PRIMARY KEY,
  chapter_id text,
  revised_at timestamptz
);

-- 6. ROUTINES TABLE
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
  created_at        timestamptz,
  updated_at        timestamptz
);

-- 7. FOCUS SESSIONS TABLE
CREATE TABLE IF NOT EXISTS focus_sessions (
  id           text PRIMARY KEY,
  type         text,
  duration     integer,
  subject      text,
  completed_at timestamptz
);

-- 8. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS categories (
  id     text PRIMARY KEY,
  name   text,
  type   text,
  budget numeric
);

-- 9. TRANSACTIONS TABLE
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

-- 10. DIARY ENTRIES TABLE
CREATE TABLE IF NOT EXISTS diary_entries (
  id                text PRIMARY KEY,
  date              text,
  mood              integer,
  mental_tags       jsonb,
  performance_rating integer,
  journal_text      text,
  learned           text,
  planned           text,
  updated_at        timestamptz
);

-- 11. LIFE NOTES TABLE
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

-- 12. EXAMS TABLE
CREATE TABLE IF NOT EXISTS exams (
  id   text PRIMARY KEY,
  name text,
  date text
);

-- ============================================================
-- DISABLE ROW LEVEL SECURITY ON ALL TABLES
-- This is a single-user, PIN-protected app (no Supabase Auth).
-- RLS is disabled so the anon key can read/write freely.
-- All security is handled client-side via the PIN lock screen.
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

-- ============================================================
-- DONE — Your YOURS database is ready.
-- ============================================================
