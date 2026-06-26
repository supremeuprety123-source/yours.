import Dexie, { Table } from 'dexie';
import type {
  Profile, Paper, Chapter, Lesson, RevisionHistory, Routine,
  FocusSession, Category, Transaction, DiaryEntry, LifeNote, Exam, DeletedRecord
} from './types';

export class YoursDB extends Dexie {
  profile!: Table<Profile, string>;
  papers!: Table<Paper, string>;
  chapters!: Table<Chapter, string>;
  lessons!: Table<Lesson, string>;
  revision_history!: Table<RevisionHistory, string>;
  routines!: Table<Routine, string>;
  focus_sessions!: Table<FocusSession, string>;
  categories!: Table<Category, string>;
  transactions!: Table<Transaction, string>;
  diary_entries!: Table<DiaryEntry, string>;
  life_notes!: Table<LifeNote, string>;
  exams!: Table<Exam, string>;
  deleted_records!: Table<DeletedRecord, string>;

  constructor() {
    super('yours_db');
    // Version 1: original schema
    this.version(1).stores({
      profile: 'id',
      papers: 'id, level, group',
      chapters: 'id, paper_id, status',
      lessons: 'id, chapter_id',
      revision_history: 'id, chapter_id, revised_at',
      routines: 'id, date, repeat_type',
      focus_sessions: 'id, completed_at, subject',
      categories: 'id, type',
      transactions: 'id, date, type, category',
      diary_entries: 'id, date',
      life_notes: 'id, category, pinned',
      exams: 'id, date',
      deleted_records: 'id, table, sync_status',
    });

    // Version 2: add sync_status index to ALL tables so sync queries work
    this.version(2).stores({
      profile: 'id, sync_status',
      papers: 'id, level, group, sync_status',
      chapters: 'id, paper_id, status, sync_status',
      lessons: 'id, chapter_id, sync_status',
      revision_history: 'id, chapter_id, revised_at, sync_status',
      routines: 'id, date, repeat_type, sync_status',
      focus_sessions: 'id, completed_at, subject, sync_status',
      categories: 'id, type, sync_status',
      transactions: 'id, date, type, category, sync_status',
      diary_entries: 'id, date, sync_status',
      life_notes: 'id, category, pinned, sync_status',
      exams: 'id, date, sync_status',
      deleted_records: 'id, table, sync_status',
    });
  }
}

export const db = new YoursDB();
