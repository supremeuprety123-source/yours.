export type CALevel = 'Foundation' | 'Intermediate' | 'Final';
export type CAGroup = '' | 'G1' | 'G2';
export type SyncStatus = 'pending' | 'synced';

export interface Profile {
  id: string;
  name: string;
  ca_level: CALevel;
  pin_enabled: boolean;
  pin: string;
  currency_code: string;
  currency_symbol: string;
  focus_pomodoro: number;
  focus_short_break: number;
  focus_long_break: number;
  focus_target: number;
  notifications: {
    morning: boolean;
    streak: boolean;
    routine: boolean;
    budget: boolean;
  };
  updated_at: string;
  sync_status: SyncStatus;
}

export interface Paper {
  id: string;
  number: number;
  name: string;
  level: CALevel;
  group: CAGroup;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
}

export interface Chapter {
  id: string;
  paper_id: string;
  name: string;
  difficulty: number; // 1-5
  status: 'not_started' | 'in_progress' | 'completed';
  completion: number; // 0-100
  time_spent: number; // minutes
  revision_count: number;
  last_revised: string | null;
  marks_obtained: number;
  marks_total: number;
  notes: string;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
}

export interface Lesson {
  id: string;
  chapter_id: string;
  name: string;
  completion: number;
  time_spent: number;
  notes: string;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
}

export interface RevisionHistory {
  id: string;
  chapter_id: string;
  revised_at: string;
  sync_status: SyncStatus;
}

export interface Routine {
  id: string;
  title: string;
  category: string;
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  linked_subject: string;
  repeat_type: 'daily' | 'weekly' | 'monthly' | 'custom' | 'life';
  repeat_days: number[]; // 0-6 for daily
  repeat_exceptions: string[]; // dates to skip
  repeat_until: string | null;
  completed_dates: string[]; // ISO dates where completed
  date: string | null; // specific date for one-time
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
}

export interface FocusSession {
  id: string;
  type: 'stopwatch' | 'countdown' | 'pomodoro';
  duration: number; // minutes
  subject: string;
  completed_at: string;
  sync_status: SyncStatus;
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  budget: number;
  sync_status: SyncStatus;
}

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  currency: string;
  category: string;
  description: string;
  date: string;
  from_to: string;
  payment_method: string;
  notes: string;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
}

export interface DiaryEntry {
  id: string;
  date: string;
  mood: number; // 1-5
  mental_tags: string[];
  performance_rating: number; // 1-5
  journal_text: string;
  learned: string;
  planned: string;
  updated_at: string;
  sync_status: SyncStatus;
}

export interface LifeNote {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  pinned: boolean;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
}

export interface Exam {
  id: string;
  name: string;
  date: string;
  marks_obtained: number;
  marks_total: number;
  sync_status: SyncStatus;
}

export interface DeletedRecord {
  id: string;
  table: string;
  record_id: string;
  deleted_at: string;
  sync_status: SyncStatus;
}

export type TableName =
  | 'profile' | 'papers' | 'chapters' | 'lessons' | 'revision_history'
  | 'routines' | 'focus_sessions' | 'categories' | 'transactions'
  | 'diary_entries' | 'life_notes' | 'exams';
