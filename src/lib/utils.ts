import type { Chapter, Paper, CALevel } from './types';

export function chapterProgressScore(ch: Chapter): number {
  const completion = (ch.completion / 100) * 40;
  const revisions = (Math.min(ch.revision_count, 5) / 5) * 30;
  const time = Math.min(ch.time_spent / 120, 1) * 20;
  const marks = ch.marks_total > 0 ? (ch.marks_obtained / ch.marks_total) * 10 : 0;
  return Math.round((completion + revisions + time + marks) * 10) / 10;
}

export function paperProgressScore(chapters: Chapter[]): number {
  if (chapters.length === 0) return 0;
  const sum = chapters.reduce((acc, ch) => acc + chapterProgressScore(ch), 0);
  return Math.round((sum / chapters.length) * 10) / 10;
}

export function levelProgressScore(papers: Paper[], chapters: Chapter[]): number {
  if (papers.length === 0) return 0;
  let total = 0;
  let count = 0;
  for (const paper of papers) {
    const paperChapters = chapters.filter(c => c.paper_id === paper.id);
    if (paperChapters.length > 0) {
      total += paperProgressScore(paperChapters);
      count++;
    }
  }
  return count > 0 ? Math.round((total / count) * 10) / 10 : 0;
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function todayISO(): string {
  const d = new Date();
  return toLocalISO(d);
}

// Convert a Date to YYYY-MM-DD using LOCAL time (not UTC) — avoids timezone shifts
export function toLocalISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Add days to a YYYY-MM-DD date string — timezone safe (no toISOString)
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function formatTime(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatCurrency(amount: number, symbol: string): string {
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}

export function getCurriculumTree(level: CALevel): { level: CALevel; group: string; label: string; status: 'completed' | 'current' | 'locked' }[] {
  const levels: CALevel[] = ['Foundation', 'Intermediate', 'Final'];
  const currentIdx = levels.indexOf(level);
  const nodes: { level: CALevel; group: string; label: string; status: 'completed' | 'current' | 'locked' }[] = [];
  
  levels.forEach((lvl, idx) => {
    if (lvl === 'Foundation') {
      nodes.push({
        level: lvl,
        group: '',
        label: 'CA Foundation',
        status: idx < currentIdx ? 'completed' : idx === currentIdx ? 'current' : 'locked',
      });
    } else {
      ['G1', 'G2'].forEach(g => {
        nodes.push({
          level: lvl,
          group: g,
          label: `CA ${lvl} ${g}`,
          status: idx < currentIdx ? 'completed' : idx === currentIdx ? 'current' : 'locked',
        });
      });
    }
  });
  return nodes;
}

export function getDayName(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function uid(): string {
  return crypto.randomUUID();
}
