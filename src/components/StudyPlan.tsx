import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAll, addRecord, updateRecord, removeRecord } from "../lib/store";
import type { PlanBlock as StorePlanBlock, TimerSession as StoreTimerSession } from "../lib/types";

export type PlannerSubject = {
  id: string | number;
  name: string;
  color?: string | null;
};

export type PlannerChapter = {
  id: string | number;
  subjectId: string | number;
  name: string;
};

type PlanStatus = "planned" | "in_progress" | "completed" | "skipped";

type StudyPlanBlock = {
  id: string;
  study_date: string;
  subject_id: string | null;
  subject_name: string;
  chapter_id: string | null;
  chapter_name: string | null;
  title: string;
  start_time: string;
  end_time: string;
  target_minutes: number;
  status: PlanStatus;
  completion_note: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type TimerSession = {
  id: string;
  block_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  created_at: string;
};

type DaySummary = {
  plannedMinutes: number;
  trackedSeconds: number;
  completedBlocks: number;
  blockCount: number;
};

type BlockForm = {
  id: string | null;
  subjectId: string;
  chapterId: string;
  title: string;
  startTime: string;
  endTime: string;
};

type PlanProps = {
  subjects: PlannerSubject[];
  chapters: PlannerChapter[];
  dailyTargetMinutes?: number;
  examDate?: string;
  examName?: string;
};

function toUiBlock(row: StorePlanBlock): StudyPlanBlock {
  const status = (row.status || "planned") as string;
  const mapped: PlanStatus =
    status === "completed" || status === "full" ? "completed" :
    status === "in_progress" || status === "half" ? "in_progress" :
    status === "skipped" || status === "none" ? "skipped" :
    "planned";
  return {
    id: row.id,
    study_date: row.date,
    subject_id: row.paper_id || null,
    subject_name: row.paper || "Study",
    chapter_id: row.chapter_id || null,
    chapter_name: row.chapter_name || null,
    title: row.title,
    start_time: (row.start_time || "09:00").slice(0, 5),
    end_time: (row.end_time || "10:00").slice(0, 5),
    target_minutes: row.target_min || 60,
    status: mapped,
    completion_note: row.notes || null,
    sort_order: row.sort_order ?? 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toUiSession(row: StoreTimerSession): TimerSession {
  return {
    id: row.id,
    block_id: row.block_id,
    started_at: row.started_at,
    ended_at: row.ended_at,
    duration_seconds: row.duration_seconds || 0,
    created_at: row.created_at,
  };
}

const SUBJECT_COLORS = ["#37a4ff", "#f4c44e", "#4dd7b0", "#b79bff", "#ff8b9b", "#55d6e8"];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function localDateFromTimestamp(timestamp: string): string {
  return dateKey(new Date(timestamp));
}

function dateFromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function formatDay(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function formatMonth(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function parseTime(value: string): number {
  const [hours = "0", minutes = "0"] = value.slice(0, 5).split(":");
  return Number(hours) * 60 + Number(minutes);
}

function minutesBetween(start: string, end: string): number {
  return Math.max(0, parseTime(end) - parseTime(start));
}

function toTimeInput(value: string): string {
  return value.slice(0, 5);
}

function formatTime(value: string): string {
  const total = parseTime(value);
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  const shownHour = hour % 12 || 12;
  return `${shownHour}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

function formatDuration(totalSeconds: number, includeSeconds = false): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  if (hours > 0) return includeSeconds ? `${hours}h ${String(minutes).padStart(2, "0")}m ${String(remainder).padStart(2, "0")}s` : `${hours}h ${minutes}m`;
  if (minutes > 0) return includeSeconds ? `${minutes}m ${String(remainder).padStart(2, "0")}s` : `${minutes}m`;
  return includeSeconds ? `${remainder}s` : "0m";
}

function formatStopwatch(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function sessionSeconds(session: TimerSession, nowMs: number): number {
  if (!session.ended_at) {
    return Math.max(0, Math.floor((nowMs - new Date(session.started_at).getTime()) / 1000));
  }
  return Math.max(0, session.duration_seconds || 0);
}

function getCalendarDays(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const mondayOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

function makeArcPath(startFraction: number, endFraction: number, radius: number): string {
  const start = Math.max(0, Math.min(1, startFraction));
  const end = Math.max(0, Math.min(1, endFraction));
  if (end <= start) return "";
  const point = (fraction: number) => {
    const angle = ((120 + fraction * 360) * Math.PI) / 180;
    return { x: 180 + radius * Math.cos(angle), y: 180 + radius * Math.sin(angle) };
  };
  const p1 = point(start);
  const p2 = point(end);
  if (end - start >= 0.999) {
    const midpoint = point((start + end) / 2);
    return `M ${p1.x} ${p1.y} A ${radius} ${radius} 0 1 1 ${midpoint.x} ${midpoint.y} A ${radius} ${radius} 0 1 1 ${p2.x} ${p2.y}`;
  }
  const largeArc = end - start > 0.5 ? 1 : 0;
  return `M ${p1.x} ${p1.y} A ${radius} ${radius} 0 ${largeArc} 1 ${p2.x} ${p2.y}`;
}

function blockClockArc(block: StudyPlanBlock): { start: number; end: number } | null {
  const windowStart = 7 * 60;
  const windowEnd = 19 * 60;
  const blockStart = parseTime(block.start_time);
  const blockEnd = parseTime(block.end_time);
  const start = Math.max(windowStart, blockStart);
  const end = Math.min(windowEnd, blockEnd);
  if (end <= start) return null;
  return { start: (start - windowStart) / (windowEnd - windowStart), end: (end - windowStart) / (windowEnd - windowStart) };
}

function getClockHandPoint(angleDegrees: number, radius: number) {
  const radians = (angleDegrees * Math.PI) / 180;
  return { x: 180 + radius * Math.cos(radians), y: 180 + radius * Math.sin(radians) };
}

function emptySummary(): DaySummary {
  return { plannedMinutes: 0, trackedSeconds: 0, completedBlocks: 0, blockCount: 0 };
}

export default function StudyPlan({
  subjects,
  chapters,
  dailyTargetMinutes = 600,
  examDate,
  examName,
}: PlanProps) {
  const initialToday = new Date();
  const todayKey = dateKey(initialToday);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [monthAnchor, setMonthAnchor] = useState(new Date(initialToday.getFullYear(), initialToday.getMonth(), 1, 12));
  const [blocks, setBlocks] = useState<StudyPlanBlock[]>([]);
  const [sessions, setSessions] = useState<TimerSession[]>([]);
  const [activeSession, setActiveSession] = useState<TimerSession | null>(null);
  const [monthSummary, setMonthSummary] = useState<Record<string, DaySummary>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [view, setView] = useState<"list" | "clock">("list");
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [showCopyForm, setShowCopyForm] = useState(false);
  const [copyDestination, setCopyDestination] = useState("");
  const [expandedNote, setExpandedNote] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [nowMs, setNowMs] = useState(Date.now());
  const requestNumber = useRef(0);
  const [form, setForm] = useState<BlockForm>({
    id: null,
    subjectId: subjects[0] ? String(subjects[0].id) : "",
    chapterId: "",
    title: "Study session",
    startTime: "09:00",
    endTime: "10:00",
  });

  const isSelectedToday = selectedDate === dateKey(new Date());
  const targetSeconds = Math.max(1, dailyTargetMinutes) * 60;
  const calendarDays = useMemo(() => getCalendarDays(monthAnchor), [monthAnchor]);
  const selectedDateObj = useMemo(() => dateFromKey(selectedDate), [selectedDate]);
  const chaptersForFormSubject = useMemo(
    () => chapters.filter((chapter) => String(chapter.subjectId) === form.subjectId),
    [chapters, form.subjectId],
  );

  const loadDay = useCallback(async (day: string) => {
    const requestId = ++requestNumber.current;
    setLoading(true);
    setError("");
    try {
      const date = dateFromKey(day);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      const startIso = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0).toISOString();
      const endIso = new Date(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate(), 0, 0, 0, 0).toISOString();
      const [allBlocks, allSessions] = await Promise.all([
        getAll<StorePlanBlock>("plan_blocks"),
        getAll<StoreTimerSession>("timer_sessions"),
      ]);
      if (requestId !== requestNumber.current) return;
      const dayBlocks = allBlocks
        .filter((b) => b.date === day)
        .map(toUiBlock)
        .sort((a, b) => a.start_time.localeCompare(b.start_time));
      const daySessions = allSessions
        .filter((s) => s.started_at >= startIso && s.started_at < endIso)
        .map(toUiSession)
        .sort((a, b) => a.started_at.localeCompare(b.started_at));
      const active = allSessions.find((s) => !s.ended_at) || null;
      setBlocks(dayBlocks);
      setSessions(daySessions);
      setActiveSession(active ? toUiSession(active) : null);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not load the planner data.";
      setError(message);
    } finally {
      if (requestId === requestNumber.current) setLoading(false);
    }
  }, []);

  const loadMonthSummary = useCallback(async (month: Date) => {
    try {
      const start = new Date(month.getFullYear(), month.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(month.getFullYear(), month.getMonth() + 1, 1, 0, 0, 0, 0);
      const startKey = dateKey(start);
      const lastDate = new Date(end);
      lastDate.setDate(0);
      const endKey = dateKey(lastDate);
      const [allBlocks, allSessions] = await Promise.all([
        getAll<StorePlanBlock>("plan_blocks"),
        getAll<StoreTimerSession>("timer_sessions"),
      ]);
      const next: Record<string, DaySummary> = {};
      for (const row of allBlocks) {
        if (row.date < startKey || row.date > endKey) continue;
        const ui = toUiBlock(row);
        next[ui.study_date] ??= emptySummary();
        next[ui.study_date].plannedMinutes += ui.target_minutes || 0;
        next[ui.study_date].blockCount += 1;
        if (ui.status === "completed") next[ui.study_date].completedBlocks += 1;
      }
      const now = Date.now();
      for (const row of allSessions) {
        if (row.started_at < start.toISOString() || row.started_at >= end.toISOString()) continue;
        const key = localDateFromTimestamp(row.started_at);
        next[key] ??= emptySummary();
        const secs = row.ended_at ? row.duration_seconds || 0 : Math.max(0, Math.floor((now - new Date(row.started_at).getTime()) / 1000));
        next[key].trackedSeconds += secs;
      }
      setMonthSummary(next);
    } catch {
      // The day planner remains usable if month summary badges cannot be loaded.
    }
  }, []);

  useEffect(() => {
    void loadDay(selectedDate);
  }, [loadDay, selectedDate]);

  useEffect(() => {
    void loadMonthSummary(monthAnchor);
  }, [loadMonthSummary, monthAnchor]);

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const currentActiveSeconds = activeSession ? sessionSeconds(activeSession, nowMs) : 0;
  const trackedSeconds = useMemo(() => sessions.reduce((sum, session) => sum + sessionSeconds(session, nowMs), 0), [sessions, nowMs]);
  const progressPercent = Math.min(100, Math.round((trackedSeconds / targetSeconds) * 100));
  const remainingSeconds = Math.max(0, targetSeconds - trackedSeconds);
  const scheduledMinutes = blocks.reduce((sum, block) => sum + (block.target_minutes || 0), 0);
  const completedCount = blocks.filter((block) => block.status === "completed").length;

  const blockSeconds = useCallback((blockId: string) => {
    return sessions.filter((session) => session.block_id === blockId).reduce((sum, session) => sum + sessionSeconds(session, nowMs), 0);
  }, [sessions, nowMs]);

  const subjectForId = useCallback((id: string | null) => subjects.find((subject) => String(subject.id) === String(id)), [subjects]);
  const chapterForId = useCallback((id: string | null) => chapters.find((chapter) => String(chapter.id) === String(id)), [chapters]);
  const subjectColor = useCallback((id: string | null) => {
    if (!id) return SUBJECT_COLORS[0];
    const index = subjects.findIndex((subject) => String(subject.id) === String(id));
    return subjectForId(id)?.color || SUBJECT_COLORS[(index < 0 ? 0 : index) % SUBJECT_COLORS.length];
  }, [subjects, subjectForId]);

  const refreshSelected = useCallback(async () => {
    await Promise.all([loadDay(selectedDate), loadMonthSummary(monthAnchor)]);
  }, [loadDay, loadMonthSummary, selectedDate, monthAnchor]);

  const moveMonth = (delta: number) => {
    const nextMonth = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + delta, 1, 12);
    setMonthAnchor(nextMonth);
    const currentDay = dateFromKey(selectedDate).getDate();
    const lastDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
    setSelectedDate(dateKey(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), Math.min(currentDay, lastDay), 12)));
  };

  const chooseDate = (day: Date) => {
    setSelectedDate(dateKey(day));
    if (day.getMonth() !== monthAnchor.getMonth() || day.getFullYear() !== monthAnchor.getFullYear()) {
      setMonthAnchor(new Date(day.getFullYear(), day.getMonth(), 1, 12));
    }
    setShowBlockForm(false);
    setShowCopyForm(false);
    setError("");
  };

  const findNextFreeSlot = () => {
    const sorted = [...blocks].sort((a, b) => parseTime(a.start_time) - parseTime(b.start_time));
    for (let start = 7 * 60; start <= 21 * 60; start += 30) {
      const end = start + 60;
      if (end > 23 * 60) break;
      const overlaps = sorted.some((block) => start < parseTime(block.end_time) && end > parseTime(block.start_time));
      if (!overlaps) {
        return {
          startTime: `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`,
          endTime: `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`,
        };
      }
    }
    const fallbackStart = sorted.length ? Math.min(22 * 60, parseTime(sorted[sorted.length - 1].end_time)) : 9 * 60;
    const fallbackEnd = Math.min(23 * 60, fallbackStart + 60);
    return {
      startTime: `${String(Math.floor(fallbackStart / 60)).padStart(2, "0")}:${String(fallbackStart % 60).padStart(2, "0")}`,
      endTime: `${String(Math.floor(fallbackEnd / 60)).padStart(2, "0")}:${String(fallbackEnd % 60).padStart(2, "0")}`,
    };
  };

  const openAddForm = () => {
    const slot = findNextFreeSlot();
    const subjectId = subjects[0] ? String(subjects[0].id) : "";
    setForm({ id: null, subjectId, chapterId: "", title: "Study session", ...slot });
    setShowBlockForm(true);
    setShowCopyForm(false);
    setError("");
  };

  const openEditForm = (block: StudyPlanBlock) => {
    setForm({
      id: block.id,
      subjectId: block.subject_id ? String(block.subject_id) : "",
      chapterId: block.chapter_id ? String(block.chapter_id) : "",
      title: block.title,
      startTime: toTimeInput(block.start_time),
      endTime: toTimeInput(block.end_time),
    });
    setShowBlockForm(true);
    setShowCopyForm(false);
    setError("");
  };

  const saveBlock = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    const subject = subjects.find((s) => String(s.id) === form.subjectId);
    if (!subject) {
      setError("Choose a subject from your Study papers.");
      return;
    }
    if (!form.title.trim()) {
      setError("Give this block a title.");
      return;
    }
    const mins = minutesBetween(form.startTime, form.endTime);
    if (mins <= 0) {
      setError("End time must be after start time.");
      return;
    }
    const overlap = blocks.some((block) => {
      if (form.id && block.id === form.id) return false;
      const a0 = parseTime(form.startTime);
      const a1 = parseTime(form.endTime);
      const b0 = parseTime(block.start_time);
      const b1 = parseTime(block.end_time);
      return a0 < b1 && a1 > b0;
    });
    if (overlap) {
      setError("That time overlaps another block on this day.");
      return;
    }
    const chapter = chapters.find((c) => String(c.id) === form.chapterId);
    setSaving(true);
    try {
      const payload = {
        date: selectedDate,
        start_time: form.startTime,
        end_time: form.endTime,
        title: form.title.trim(),
        paper: subject.name,
        paper_id: String(subject.id),
        chapter_id: chapter ? String(chapter.id) : "",
        chapter_name: chapter ? chapter.name : "",
        target_min: mins,
        completed_min: form.id ? (blocks.find((b) => b.id === form.id)?.status === "completed" ? mins : 0) : 0,
        status: (form.id ? (blocks.find((b) => b.id === form.id)?.status || "planned") : "planned") as PlanStatus,
        notes: form.id ? (blocks.find((b) => b.id === form.id)?.completion_note || "") : "",
        sort_order: form.id ? (blocks.find((b) => b.id === form.id)?.sort_order || 0) : blocks.length,
      };
      if (form.id) {
        await updateRecord("plan_blocks", form.id, payload);
      } else {
        await addRecord("plan_blocks", { ...payload, created_at: new Date().toISOString() });
      }
      setShowBlockForm(false);
      setNotice(form.id ? "Block updated." : "Block added.");
      await refreshSelected();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the block.");
    } finally {
      setSaving(false);
    }
  };

  const stopTimer = async (refresh = true) => {
    if (!activeSession) return true;
    setSaving(true);
    setError("");
    try {
      const ended = new Date().toISOString();
      const duration = Math.max(0, Math.floor((Date.now() - new Date(activeSession.started_at).getTime()) / 1000));
      await updateRecord("timer_sessions", activeSession.id, {
        ended_at: ended,
        duration_seconds: duration,
      });
      if (activeSession.block_id) {
        const block = blocks.find((b) => b.id === activeSession.block_id);
        if (block && block.status === "planned") {
          await updateRecord("plan_blocks", block.id, { status: "in_progress" });
        }
      }
      setActiveSession(null);
      if (refresh) await refreshSelected();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not stop the timer.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const startTimer = async (block: StudyPlanBlock) => {
    if (!isSelectedToday) {
      setError("Select today's date to run a timer.");
      return;
    }
    setError("");
    setNotice("");
    setSaving(true);
    try {
      if (activeSession) {
        const ok = await stopTimer(false);
        if (!ok) return;
      }
      const started = new Date().toISOString();
      const created = await addRecord<StoreTimerSession>("timer_sessions", {
        block_id: block.id,
        started_at: started,
        ended_at: null,
        duration_seconds: 0,
        created_at: started,
      });
      if (block.status === "planned") {
        await updateRecord("plan_blocks", block.id, { status: "in_progress" });
      }
      setActiveSession(toUiSession(created as StoreTimerSession));
      setNotice(`Timer started for “${block.title}”.`);
      await refreshSelected();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start the timer.");
    } finally {
      setSaving(false);
    }
  };

  const completeBlock = async (block: StudyPlanBlock) => {
    setError("");
    setSaving(true);
    try {
      if (activeSession?.block_id === block.id) {
        await stopTimer(false);
      }
      const note = noteDrafts[block.id] ?? block.completion_note ?? "";
      await updateRecord("plan_blocks", block.id, {
        status: "completed",
        notes: note,
        completed_min: block.target_minutes,
      });
      setExpandedNote(null);
      setNotice(`Marked “${block.title}” complete.`);
      await refreshSelected();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not complete the block.");
    } finally {
      setSaving(false);
    }
  };

  const deleteBlock = async (block: StudyPlanBlock) => {
    const confirmed = window.confirm(`Delete “${block.title}”? Timer sessions for this block stay in your daily total.`);
    if (!confirmed) return;
    setError("");
    if (activeSession?.block_id === block.id) {
      const stopped = await stopTimer(false);
      if (!stopped) return;
    }
    setSaving(true);
    try {
      await removeRecord("plan_blocks", block.id);
      setNotice("Block deleted. Previously recorded time has been retained.");
      await refreshSelected();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete the block.");
    } finally {
      setSaving(false);
    }
  };

  const copyPlan = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!copyDestination) {
      setError("Choose a destination date first.");
      return;
    }
    if (copyDestination === selectedDate) {
      setError("Choose a different date to copy this schedule to.");
      return;
    }
    if (blocks.length === 0) {
      setError("There are no blocks on this date to copy yet.");
      return;
    }
    setSaving(true);
    try {
      const allBlocks = await getAll<StorePlanBlock>("plan_blocks");
      if (allBlocks.some((b) => b.date === copyDestination)) {
        setError("That date already has blocks. Choose an empty date.");
        return;
      }
      for (let index = 0; index < blocks.length; index++) {
        const block = blocks[index];
        await addRecord("plan_blocks", {
          date: copyDestination,
          start_time: toTimeInput(block.start_time),
          end_time: toTimeInput(block.end_time),
          title: block.title,
          paper: block.subject_name,
          paper_id: block.subject_id || "",
          chapter_id: block.chapter_id || "",
          chapter_name: block.chapter_name || "",
          target_min: block.target_minutes,
          completed_min: 0,
          status: "planned",
          notes: "",
          sort_order: index,
          created_at: new Date().toISOString(),
        });
      }
      setShowCopyForm(false);
      setNotice(`Copied ${blocks.length} block${blocks.length === 1 ? "" : "s"} to ${formatDay(dateFromKey(copyDestination))}.`);
      await loadMonthSummary(monthAnchor);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not copy the plan.");
    } finally {
      setSaving(false);
    }
  };

  const examDays = examDate ? Math.ceil((dateFromKey(examDate).getTime() - dateFromKey(todayKey).getTime()) / 86400000) : null;
  const activeBlock = activeSession ? blocks.find((block) => block.id === activeSession.block_id) : null;

  return (
    <div className="sp-plan">
      <style>{`
        .sp-plan{--bg:#080f29;--panel:#141e39;--panel2:#1b2744;--panel3:#202d4b;--line:#2b3857;--line2:#3a4969;--text:#f4f7ff;--muted:#9baacc;--blue:#2594ff;--blue2:#1266ce;--green:#20cb83;--amber:#f3b846;--red:#ff6c77;min-height:100%;color:var(--text);font:13px/1.45 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:var(--bg);padding:18px;box-sizing:border-box}
        .sp-plan *{box-sizing:border-box}.sp-plan button,.sp-plan input,.sp-plan select,.sp-plan textarea{font:inherit}.sp-plan button{cursor:pointer}.sp-plan button:disabled{cursor:not-allowed;opacity:.48}
        .sp-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin:0 0 16px}.sp-eyebrow{color:#91a9d5;font-size:10px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:3px}.sp-title{font-size:25px;line-height:1.15;font-weight:800;letter-spacing:-.04em;margin:0}.sp-subtitle{font-size:11px;color:var(--muted);margin-top:5px}.sp-head-right{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}.sp-live-pill{display:flex;align-items:center;gap:8px;max-width:360px;border:1px solid #236b69;background:#103a43;border-radius:8px;padding:8px 10px;color:#b7f7e0;font-size:11px}.sp-live-dot{width:7px;height:7px;flex:none;border-radius:50%;background:#2be09a;box-shadow:0 0 0 4px #2be09a20;animation:spPulse 1.7s infinite}.sp-live-time{font-variant-numeric:tabular-nums;font-weight:800;color:white;white-space:nowrap}.sp-button{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--line2);border-radius:7px;background:#202b49;color:#dce7ff;padding:8px 11px;font-size:11px;font-weight:650;transition:background .15s,border-color .15s}.sp-button:hover{background:#2a385a;border-color:#5a719b}.sp-button.primary{background:var(--blue2);border-color:var(--blue);color:white}.sp-button.primary:hover{background:#2585f0}.sp-button.subtle{background:transparent}.sp-button.success{background:#104534;border-color:#207b60;color:#b4f8da}.sp-button.danger{background:#411e34;border-color:#733b54;color:#ffc5d3}.sp-button.small{padding:5px 8px;font-size:10px}.sp-button.icon{min-width:29px;padding:5px 8px;font-size:13px}.sp-banner{display:flex;gap:9px;align-items:flex-start;border:1px solid #174c86;background:#102b50;border-radius:8px;padding:10px 12px;color:#c7dcff;font-size:11px;margin-bottom:15px}.sp-banner strong{color:#fff}.sp-banner-icon{color:#59b4ff;font-size:15px}.sp-banner button{margin-left:auto;border:0;background:none;color:#adc4e6;font-size:16px;padding:0 3px}
        .sp-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}.sp-stat{border:1px solid var(--line);background:var(--panel);border-radius:9px;padding:12px 14px;min-width:0}.sp-stat-label{color:var(--muted);font-size:10px;margin-bottom:4px}.sp-stat-value{font-size:21px;font-weight:800;letter-spacing:-.035em;line-height:1.15;font-variant-numeric:tabular-nums}.sp-stat-value.blue{color:#66b5ff}.sp-stat-value.green{color:#4bdfa7}.sp-stat-hint{font-size:10px;color:#8597bb;margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sp-layout{display:grid;grid-template-columns:minmax(260px,310px) minmax(0,1fr);gap:14px;align-items:start}.sp-panel{background:var(--panel);border:1px solid var(--line);border-radius:10px;min-width:0;overflow:hidden}.sp-panel-inner{padding:14px}.sp-panel-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}.sp-panel-title{font-size:13px;font-weight:780;margin:0}.sp-panel-subtitle{font-size:10px;color:var(--muted);margin-top:3px}.sp-month-controls{display:flex;align-items:center;gap:6px}.sp-month-label{font-weight:750;font-size:12px;min-width:0}.sp-calendar-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px}.sp-dow{text-align:center;color:#91a1c1;font-size:9px;padding:2px 0 5px}.sp-day{position:relative;display:flex;flex-direction:column;align-items:flex-start;justify-content:space-between;min-width:0;height:42px;padding:6px 6px 5px;border:1px solid #2d3b5c;border-radius:7px;background:#192542;color:#d9e4ff;text-align:left;font-size:11px}.sp-day:hover{border-color:#7295c8}.sp-day.outside{opacity:.34;background:#111a33}.sp-day.selected{border-color:#39a7ff;background:#123f75;box-shadow:inset 0 0 0 1px #39a7ff70}.sp-day.today:not(.selected){border-color:#7d91b6}.sp-day-number{font-weight:700;line-height:1}.sp-day-pct{font-size:8px;line-height:1.05;color:#c7d8fa}.sp-day-dot{position:absolute;right:6px;top:6px;width:5px;height:5px;border-radius:50%;background:#657391}.sp-day-dot.green{background:var(--green)}.sp-day-dot.amber{background:var(--amber)}.sp-day-dot.red{background:var(--red)}.sp-calendar-legend{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;color:#9eafd0;font-size:9px}.sp-legend-item{display:flex;align-items:center;gap:5px}.sp-legend-dot{width:6px;height:6px;border-radius:50%;display:inline-block}.sp-sidebar-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:12px}.sp-mini-stat{padding:10px 9px;border:1px solid var(--line);background:#101a34;border-radius:8px;min-width:0}.sp-mini-value{font-weight:800;font-size:16px;line-height:1.15;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sp-mini-label{font-size:9px;color:var(--muted);margin-top:5px}.sp-side-note{display:flex;align-items:center;gap:7px;margin-top:12px;color:#8ea2c8;font-size:10px}.sp-side-note b{color:#c8d8f8}.sp-side-note .sp-green{color:#3cdaa0}
        .sp-day-head{padding:14px 15px 12px;border-bottom:1px solid var(--line)}.sp-day-head-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.sp-date-label{color:#91a4c9;font-size:10px;font-weight:650}.sp-day-title{font-size:20px;line-height:1.2;letter-spacing:-.035em;margin:2px 0 0;font-weight:800}.sp-day-actions{display:flex;gap:6px;align-items:center;justify-content:flex-end;flex-wrap:wrap}.sp-progress-box{margin-top:12px;background:#202b49;border-radius:8px;padding:10px 11px}.sp-progress-line{display:flex;align-items:center;gap:10px;justify-content:space-between;font-size:10px;color:#c7d6f4}.sp-progress-line strong{color:white;font-size:11px}.sp-progress-bar{height:5px;background:#354363;border-radius:99px;overflow:hidden;margin-top:8px}.sp-progress-fill{height:100%;background:linear-gradient(90deg,#1688f4,#39b8ff);border-radius:99px;transition:width .2s}.sp-success-line{display:flex;align-items:center;gap:7px;margin-top:8px;padding:8px 10px;border-radius:7px;background:#103c3b;border:1px solid #1c5d56;color:#a6f4d6;font-size:10px}.sp-success-line .sp-success-icon{font-size:13px}.sp-toolbar{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 15px 4px}.sp-tabs{display:flex;gap:4px;padding:3px;background:#101a33;border:1px solid #253352;border-radius:8px}.sp-tab{border:0;background:transparent;color:#99aed3;border-radius:5px;padding:6px 12px;font-size:10px;font-weight:700}.sp-tab.active{background:#26395d;color:#fff}.sp-toolbar-note{font-size:10px;color:#8297bc;text-align:right}.sp-block-list{padding:9px 10px 12px;display:flex;flex-direction:column;gap:8px}.sp-block{border:1px solid #344362;background:#1a2542;border-radius:9px;padding:11px;display:grid;grid-template-columns:75px minmax(0,1fr);gap:11px;transition:border-color .15s}.sp-block:hover{border-color:#536b92}.sp-block.active{border-color:#288de7;box-shadow:inset 0 0 0 1px #288de722;background:#192a4b}.sp-block.completed{border-color:#286a58;background:#172c3d}.sp-block-time{border-right:1px solid #344362;padding-right:10px;font-size:10px;color:#b8c7e4;font-variant-numeric:tabular-nums}.sp-block-time strong{display:block;color:#fff;font-size:11px;margin-bottom:2px}.sp-block-time span{display:block;color:#91a2c5}.sp-block-main{min-width:0}.sp-block-topline{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.sp-block-title{font-size:12px;font-weight:780;line-height:1.35;overflow-wrap:anywhere}.sp-block-badges{display:flex;gap:5px;align-items:center;flex-wrap:wrap;margin-top:5px}.sp-chip{display:inline-flex;align-items:center;gap:5px;border:1px solid #3a4864;background:#202d4b;border-radius:5px;padding:3px 6px;font-size:9px;color:#d5e2fc;line-height:1.15}.sp-chip-dot{width:5px;height:5px;border-radius:50%;display:inline-block}.sp-chip.status{color:#cfdbf7}.sp-chip.status.green{background:#123f37;border-color:#246b57;color:#9bf1d0}.sp-chip.status.blue{background:#123b67;border-color:#245a90;color:#a9d7ff}.sp-chip.status.amber{background:#45391f;border-color:#776032;color:#ffdc91}.sp-block-meta{font-size:10px;color:#96a8ca;margin-top:7px}.sp-block-meta strong{font-weight:700;color:#d3dff6}.sp-block-progress{height:4px;background:#2e3b58;border-radius:99px;margin-top:8px;overflow:hidden}.sp-block-progress-fill{height:100%;background:#328eed;border-radius:99px}.sp-block-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:9px}.sp-block-actions{display:flex;gap:5px;align-items:center;flex-wrap:wrap}.sp-block-timer{font-size:12px;font-weight:800;font-variant-numeric:tabular-nums;color:#eaf2ff;white-space:nowrap}.sp-block-timer small{font-size:9px;color:#8fa5cc;font-weight:500;margin-left:4px}.sp-note-editor{display:flex;gap:6px;margin-top:8px}.sp-note-editor input{min-width:0;flex:1}.sp-input,.sp-select,.sp-textarea{width:100%;border:1px solid #354565;background:#0f1932;border-radius:7px;padding:9px 10px;color:#edf3ff;outline:none}.sp-input:focus,.sp-select:focus,.sp-textarea:focus{border-color:#3899f3;box-shadow:0 0 0 2px #258fff20}.sp-input::placeholder,.sp-textarea::placeholder{color:#7589ad}.sp-empty{padding:30px 18px;text-align:center;border:1px dashed #3a4968;border-radius:9px;color:#9db0d2;background:#121c36;margin:8px 4px}.sp-empty-icon{font-size:25px;margin-bottom:8px;color:#67b6ff}.sp-empty strong{display:block;font-size:13px;color:#ebf3ff;margin-bottom:4px}.sp-empty p{max-width:330px;margin:0 auto 12px;font-size:11px;line-height:1.6}
        .sp-clock-wrap{padding:8px 10px 18px;display:flex;flex-direction:column;align-items:center}.sp-clock-svg{width:min(100%,390px);height:auto;overflow:visible}.sp-clock-legend{display:flex;gap:14px;align-items:center;justify-content:center;flex-wrap:wrap;margin-top:8px;font-size:10px;color:#a1b2d2}.sp-clock-legend span{display:inline-flex;align-items:center;gap:5px}.sp-clock-legend i{display:inline-block;width:7px;height:7px;border-radius:50%}.sp-clock-caption{font-size:10px;color:#8296bd;text-align:center;margin-top:9px;max-width:450px}
        .sp-modal-backdrop{position:fixed;inset:0;background:#030817c9;backdrop-filter:blur(5px);z-index:1000;display:flex;align-items:center;justify-content:center;padding:18px}.sp-modal{width:min(100%,510px);max-height:min(90vh,760px);overflow:auto;border:1px solid #3b4d70;background:#151f3b;border-radius:13px;box-shadow:0 24px 90px #0008}.sp-modal-head{padding:16px 18px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.sp-modal-title{font-size:16px;font-weight:800;margin:0}.sp-modal-body{padding:18px}.sp-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.sp-field{display:flex;flex-direction:column;gap:6px;min-width:0}.sp-field.full{grid-column:1/-1}.sp-field label{font-size:10px;font-weight:700;color:#acbfdf}.sp-field-hint{font-size:10px;color:#899fc4}.sp-modal-footer{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:16px}.sp-alert{border:1px solid #774b54;background:#3b202f;color:#ffced4;padding:10px 12px;border-radius:8px;margin-bottom:12px;font-size:11px;white-space:pre-wrap;overflow-wrap:anywhere}.sp-notice{border:1px solid #226950;background:#10392e;color:#b7f6da;padding:9px 11px;border-radius:8px;margin-bottom:12px;font-size:11px}.sp-load-skeleton{height:52px;border-radius:9px;background:linear-gradient(90deg,#1a2542,#223050,#1a2542);background-size:200% 100%;animation:spShimmer 1.4s infinite}.sp-exam{font-size:10px;color:#91a6ca;margin-top:9px}.sp-exam strong{color:#e3edff}.sp-footer-note{padding:10px 14px;border-top:1px solid var(--line);font-size:10px;color:#8498bc;display:flex;gap:8px;align-items:flex-start}.sp-footer-note b{color:#c9daf6}
        @keyframes spPulse{0%,100%{box-shadow:0 0 0 3px #2be09a16}50%{box-shadow:0 0 0 5px #2be09a28}}@keyframes spShimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}
        @media(max-width:980px){.sp-layout{grid-template-columns:minmax(245px,285px) minmax(0,1fr)}.sp-header{align-items:flex-start}.sp-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.sp-title{font-size:23px}}
        @media(max-width:760px){.sp-plan{padding:12px}.sp-layout{grid-template-columns:1fr}.sp-header{flex-direction:column}.sp-head-right{justify-content:flex-start;width:100%}.sp-live-pill{max-width:100%;flex-wrap:wrap}.sp-calendar-panel{order:2}.sp-main-panel{order:1}.sp-day-title{font-size:18px}.sp-day-head-top{flex-direction:column}.sp-day-actions{justify-content:flex-start}.sp-toolbar{padding-left:12px;padding-right:12px}.sp-block{grid-template-columns:64px minmax(0,1fr);gap:9px;padding:9px}.sp-block-time{padding-right:7px}.sp-block-footer{align-items:flex-start}.sp-toolbar-note{display:none}}
        @media(max-width:420px){.sp-summary{gap:7px}.sp-stat{padding:10px}.sp-stat-value{font-size:18px}.sp-sidebar-stats{gap:5px}.sp-mini-stat{padding:8px 6px}.sp-mini-value{font-size:14px}.sp-day{height:38px;padding:5px}.sp-day-pct{font-size:7px}.sp-block{grid-template-columns:1fr}.sp-block-time{display:flex;gap:8px;border-right:0;border-bottom:1px solid #344362;padding:0 0 7px}.sp-block-time strong,.sp-block-time span{display:inline-block}.sp-block-time strong{margin:0}.sp-form-grid{grid-template-columns:1fr}.sp-field.full{grid-column:auto}.sp-modal-footer{align-items:stretch;flex-direction:column-reverse}.sp-modal-footer>div{display:flex;gap:7px}.sp-modal-footer .sp-button{flex:1}}
      `}</style>

      <header className="sp-header">
        <div>
          <div className="sp-eyebrow">Personal study workspace</div>
          <h1 className="sp-title">Your plan</h1>
          <div className="sp-subtitle">Build your day in blocks. Track real study time, one active timer at a time.</div>
        </div>
        <div className="sp-head-right">
          {activeSession && (
            <div className="sp-live-pill" title="This timer keeps running if you refresh the page.">
              <span className="sp-live-dot" />
              <span>NOW STUDYING{activeBlock ? ` · ${activeBlock.title}` : " · Saved timer"}</span>
              <span className="sp-live-time">{formatStopwatch(currentActiveSeconds)}</span>
              <button className="sp-button small success" onClick={() => void stopTimer(true)} disabled={saving}>Pause</button>
            </div>
          )}
        </div>
      </header>

      <div className="sp-banner">
        <span className="sp-banner-icon">ⓘ</span>
        <div><strong>Your planner, your routine.</strong> Add your study blocks once, start the timer when you begin, and mark each block complete with an optional note. The total at the top combines the time tracked across all blocks for the selected day.</div>
      </div>

      {(error || notice) && (
        <div className={error ? "sp-alert" : "sp-notice"} role={error ? "alert" : "status"}>
          {error || notice}
        </div>
      )}

      <section className="sp-summary" aria-label="Selected day study totals">
        <div className="sp-stat">
          <div className="sp-stat-label">{isSelectedToday ? "Tracked today" : "Time tracked on this date"}</div>
          <div className="sp-stat-value blue">{formatDuration(trackedSeconds)}</div>
          <div className="sp-stat-hint">Aggregate from all study-block timers</div>
        </div>
        <div className="sp-stat">
          <div className="sp-stat-label">Daily target</div>
          <div className="sp-stat-value">{formatDuration(targetSeconds)}</div>
          <div className="sp-stat-hint">Your default target is 10 focused hours</div>
        </div>
        <div className="sp-stat">
          <div className="sp-stat-label">Time remaining</div>
          <div className="sp-stat-value">{remainingSeconds > 0 ? formatDuration(remainingSeconds) : "Goal reached"}</div>
          <div className="sp-stat-hint">{remainingSeconds > 0 ? "Left to reach your daily target" : "You have met your target"}</div>
        </div>
        <div className="sp-stat">
          <div className="sp-stat-label">Target progress</div>
          <div className="sp-stat-value green">{progressPercent}%</div>
          <div className="sp-stat-hint">{completedCount} of {blocks.length} blocks marked complete</div>
        </div>
      </section>

      <div className="sp-layout">
        <aside className="sp-panel sp-calendar-panel">
          <div className="sp-panel-inner">
            <div className="sp-panel-heading">
              <div>
                <div className="sp-panel-title">Study calendar</div>
                <div className="sp-panel-subtitle">Choose a day to plan or review it</div>
              </div>
              <div className="sp-month-controls">
                <button className="sp-button small icon" aria-label="Previous month" onClick={() => moveMonth(-1)}>‹</button>
                <button className="sp-button small icon" aria-label="Next month" onClick={() => moveMonth(1)}>›</button>
              </div>
            </div>
            <div className="sp-month-label" style={{ marginBottom: 10 }}>{formatMonth(monthAnchor)}</div>
            <div className="sp-calendar-grid" role="grid" aria-label={formatMonth(monthAnchor)}>
              {DOW.map((day) => <div className="sp-dow" key={day}>{day}</div>)}
              {calendarDays.map((day) => {
                const key = dateKey(day);
                const summary = monthSummary[key];
                const pct = summary ? Math.min(100, Math.round((summary.trackedSeconds / targetSeconds) * 100)) : 0;
                const level = pct >= 90 ? "green" : pct >= 50 ? "amber" : pct > 0 ? "red" : "";
                return (
                  <button
                    type="button"
                    role="gridcell"
                    key={key}
                    aria-label={`${formatDay(day)}${pct ? `, ${pct}% of target tracked` : ""}`}
                    aria-selected={selectedDate === key}
                    className={`sp-day ${day.getMonth() !== monthAnchor.getMonth() ? "outside" : ""} ${selectedDate === key ? "selected" : ""} ${key === todayKey ? "today" : ""}`}
                    onClick={() => chooseDate(day)}
                    title={summary ? `${summary.blockCount} block(s), ${formatDuration(summary.trackedSeconds)} tracked, ${pct}% of target` : "No recorded study time"}
                  >
                    <span className="sp-day-number">{day.getDate()}</span>
                    {summary && summary.trackedSeconds > 0 && <span className={`sp-day-dot ${level}`} />}
                    {pct > 0 && <span className="sp-day-pct">{pct}%</span>}
                  </button>
                );
              })}
            </div>
            <div className="sp-calendar-legend">
              <span className="sp-legend-item"><i className="sp-legend-dot" style={{ background: "var(--green)" }} />90% or more</span>
              <span className="sp-legend-item"><i className="sp-legend-dot" style={{ background: "var(--amber)" }} />50–89%</span>
              <span className="sp-legend-item"><i className="sp-legend-dot" style={{ background: "var(--red)" }} />Under 50%</span>
              <span className="sp-legend-item"><i className="sp-legend-dot" style={{ background: "#657391" }} />No time yet</span>
            </div>

            <div className="sp-sidebar-stats">
              <div className="sp-mini-stat"><div className="sp-mini-value">{blocks.length}</div><div className="sp-mini-label">Planned blocks</div></div>
              <div className="sp-mini-stat"><div className="sp-mini-value" style={{ color: "var(--green)" }}>{completedCount}</div><div className="sp-mini-label">Completed</div></div>
              <div className="sp-mini-stat"><div className="sp-mini-value">{formatDuration(scheduledMinutes * 60)}</div><div className="sp-mini-label">Scheduled time</div></div>
            </div>
            {examDate && examDays !== null && (
              <div className="sp-exam">
                {examName ? <span>{examName} · </span> : null}
                Exam countdown: <strong>{examDays >= 0 ? `${examDays} day${examDays === 1 ? "" : "s"} left` : `${Math.abs(examDays)} day${Math.abs(examDays) === 1 ? "" : "s"} ago`}</strong>
              </div>
            )}
            <div className="sp-side-note"><span className="sp-green">●</span><span><b>Timer rule:</b> only active study timers count toward the aggregate total.</span></div>
          </div>
        </aside>

        <main className="sp-panel sp-main-panel">
          <div className="sp-day-head">
            <div className="sp-day-head-top">
              <div>
                <div className="sp-date-label">{isSelectedToday ? "TODAY" : "SELECTED DAY"}</div>
                <h2 className="sp-day-title">{formatDay(selectedDateObj)}</h2>
              </div>
              <div className="sp-day-actions">
                <button type="button" className="sp-button primary" onClick={openAddForm}>＋ Add block</button>
                <button type="button" className="sp-button" onClick={() => { setShowCopyForm((show) => !show); setShowBlockForm(false); setCopyDestination(""); setError(""); }}>▣ Copy day</button>
              </div>
            </div>
            <div className="sp-progress-box">
              <div className="sp-progress-line">
                <span>Target <strong>{formatDuration(targetSeconds)}</strong> <span style={{ color: "#7f94b9" }}>·</span> Tracked <strong>{formatDuration(trackedSeconds)}</strong></span>
                <strong>{progressPercent}%</strong>
              </div>
              <div className="sp-progress-bar"><div className="sp-progress-fill" style={{ width: `${progressPercent}%` }} /></div>
            </div>
            {activeSession && (
              <div className="sp-success-line"><span className="sp-success-icon">◉</span><span>Timer is running for <strong>{activeBlock?.title || "a saved study block"}</strong>. It continues if you refresh the page. Current block time: <strong>{formatStopwatch(currentActiveSeconds)}</strong>.</span></div>
            )}
          </div>

          {showCopyForm && (
            <form className="sp-modal-body" style={{ padding: "12px 15px 4px" }} onSubmit={copyPlan}>
              <div style={{ display: "flex", alignItems: "end", gap: 8, flexWrap: "wrap", border: "1px solid var(--line)", background: "#101a34", borderRadius: 8, padding: 10 }}>
                <div className="sp-field" style={{ flex: "1 1 180px" }}>
                  <label htmlFor="sp-copy-date">Copy these blocks to an empty date</label>
                  <input id="sp-copy-date" className="sp-input" type="date" value={copyDestination} min={todayKey} onChange={(event) => setCopyDestination(event.target.value)} required />
                </div>
                <button type="submit" className="sp-button primary" disabled={saving || blocks.length === 0}>{saving ? "Copying…" : `Copy ${blocks.length} block${blocks.length === 1 ? "" : "s"}`}</button>
                <button type="button" className="sp-button subtle" onClick={() => setShowCopyForm(false)}>Cancel</button>
              </div>
              <div className="sp-panel-subtitle" style={{ marginTop: 6 }}>Only the schedule is copied. Timer history, completion status, and notes are not copied.</div>
            </form>
          )}

          <div className="sp-toolbar">
            <div className="sp-tabs" role="tablist" aria-label="Planner view">
              <button type="button" role="tab" aria-selected={view === "list"} className={`sp-tab ${view === "list" ? "active" : ""}`} onClick={() => setView("list")}>☷ List</button>
              <button type="button" role="tab" aria-selected={view === "clock"} className={`sp-tab ${view === "clock" ? "active" : ""}`} onClick={() => setView("clock")}>◷ Clock</button>
            </div>
            <div className="sp-toolbar-note">{blocks.length} block{blocks.length === 1 ? "" : "s"} · {formatDuration(scheduledMinutes * 60)} scheduled</div>
          </div>

          {view === "list" ? (
            <div className="sp-block-list">
              {loading && blocks.length === 0 ? (
                <><div className="sp-load-skeleton" /><div className="sp-load-skeleton" /><div className="sp-load-skeleton" /></>
              ) : blocks.length === 0 ? (
                <div className="sp-empty">
                  <div className="sp-empty-icon">＋</div>
                  <strong>No study blocks for this day yet</strong>
                  <p>Break your 10-hour target into specific subject/chapter sessions. When you begin a block, its timer will contribute to the aggregate timer above.</p>
                  <button type="button" className="sp-button primary" onClick={openAddForm}>Create your first block</button>
                </div>
              ) : blocks.map((block) => {
                const actualSeconds = blockSeconds(block.id);
                const isActive = activeSession?.block_id === block.id;
                const target = Math.max(1, block.target_minutes * 60);
                const blockProgress = Math.min(100, Math.round((actualSeconds / target) * 100));
                const color = subjectColor(block.subject_id);
                return (
                  <article className={`sp-block ${isActive ? "active" : ""} ${block.status === "completed" ? "completed" : ""}`} key={block.id}>
                    <div className="sp-block-time">
                      <strong>{formatTime(block.start_time)}</strong>
                      <span>{formatTime(block.end_time)}</span>
                      <span style={{ marginTop: 5, color: "#7288b0" }}>{formatDuration(block.target_minutes * 60)} planned</span>
                    </div>
                    <div className="sp-block-main">
                      <div className="sp-block-topline">
                        <div style={{ minWidth: 0 }}>
                          <div className="sp-block-title">{block.title}</div>
                          <div className="sp-block-badges">
                            <span className="sp-chip"><i className="sp-chip-dot" style={{ background: color }} />{block.subject_name}</span>
                            {block.chapter_name && <span className="sp-chip">{block.chapter_name}</span>}
                            <span className={`sp-chip status ${block.status === "completed" ? "green" : isActive ? "blue" : block.status === "in_progress" ? "amber" : ""}`}>
                              {block.status === "completed" ? "✓ Completed" : isActive ? "● Timer running" : block.status === "in_progress" ? "In progress" : "Planned"}
                            </span>
                          </div>
                        </div>
                        <div className="sp-block-actions">
                          <button type="button" className="sp-button small icon" aria-label={`Edit ${block.title}`} title="Edit block" onClick={() => openEditForm(block)}>✎</button>
                          <button type="button" className="sp-button small icon" aria-label={`Delete ${block.title}`} title="Delete block" onClick={() => void deleteBlock(block)}>×</button>
                        </div>
                      </div>
                      <div className="sp-block-meta"><strong>Tracked:</strong> {formatDuration(actualSeconds)} <span style={{ color: "#7087ad" }}>·</span> <strong>Target:</strong> {formatDuration(target)}</div>
                      <div className="sp-block-progress"><div className="sp-block-progress-fill" style={{ width: `${blockProgress}%`, background: block.status === "completed" ? "var(--green)" : color }} /></div>
                      <div className="sp-block-footer">
                        <div className="sp-block-actions">
                          {block.status !== "completed" && (
                            <button type="button" className={`sp-button small ${isActive ? "success" : "primary"}`} onClick={() => void startTimer(block)} disabled={saving || !isSelectedToday} title={!isSelectedToday ? "Select today's date to run this timer" : undefined}>
                              {isActive ? "Ⅱ Pause timer" : "▶ Start timer"}
                            </button>
                          )}
                          {block.status !== "completed" ? (
                            <button type="button" className="sp-button small" onClick={() => { setExpandedNote(expandedNote === block.id ? null : block.id); setNoteDrafts((current) => ({ ...current, [block.id]: current[block.id] ?? block.completion_note ?? "" })); }}>
                              {expandedNote === block.id ? "Hide note" : "Add note"}
                            </button>
                          ) : <span className="sp-chip status green">✓ Done</span>}
                          {block.status !== "completed" && <button type="button" className="sp-button small success" onClick={() => void completeBlock(block)} disabled={saving}>Complete block</button>}
                        </div>
                        <div className="sp-block-timer" aria-label={`Time tracked ${formatStopwatch(actualSeconds)}`}>
                          {formatStopwatch(actualSeconds)}<small>{isActive ? "LIVE" : "tracked"}</small>
                        </div>
                      </div>
                      {expandedNote === block.id && block.status !== "completed" && (
                        <div className="sp-note-editor">
                          <input className="sp-input" aria-label="Completion note" placeholder="What did you finish? e.g. Read sections 1–3 and made notes" value={noteDrafts[block.id] ?? ""} onChange={(event) => setNoteDrafts((current) => ({ ...current, [block.id]: event.target.value }))} />
                          <button type="button" className="sp-button small success" onClick={() => void completeBlock(block)} disabled={saving}>Save & complete</button>
                        </div>
                      )}
                      {block.status === "completed" && block.completion_note && <div className="sp-block-meta" style={{ color: "#9de8c9", marginTop: 8 }}>Completion note: {block.completion_note}</div>}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="sp-clock-wrap">
              <svg className="sp-clock-svg" viewBox="0 0 360 360" role="img" aria-label={`Circular study schedule. ${formatDuration(trackedSeconds)} tracked out of ${formatDuration(targetSeconds)}. Clock arcs show planned blocks between 7 AM and 7 PM.`}>
                <circle cx="180" cy="180" r="145" fill="none" stroke="#2b3a5a" strokeWidth="9" />
                <circle cx="180" cy="180" r="145" fill="none" stroke="#248ff1" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 145 * Math.min(1, trackedSeconds / targetSeconds)} ${2 * Math.PI * 145}`} transform="rotate(-90 180 180)" />
                <circle cx="180" cy="180" r="124" fill="none" stroke="#334260" strokeWidth="11" />
                {blocks.map((block) => {
                  const arc = blockClockArc(block);
                  if (!arc) return null;
                  return <path key={`planned-${block.id}`} d={makeArcPath(arc.start, arc.end, 124)} fill="none" stroke={subjectColor(block.subject_id)} strokeWidth="10" strokeLinecap="round" opacity=".9" />;
                })}
                <circle cx="180" cy="180" r="103" fill="none" stroke="#263553" strokeWidth="8" />
                {blocks.filter((block) => block.status === "completed").map((block) => {
                  const arc = blockClockArc(block);
                  if (!arc) return null;
                  return <path key={`complete-${block.id}`} d={makeArcPath(arc.start, arc.end, 103)} fill="none" stroke="#20cb83" strokeWidth="8" strokeLinecap="round" />;
                })}
                {Array.from({ length: 60 }, (_, index) => {
                  const angle = ((index / 60) * 360 - 90) * Math.PI / 180;
                  const major = index % 5 === 0;
                  const inner = major ? 137 : 140;
                  const outer = major ? 131 : 137;
                  return <line key={`tick-${index}`} x1={180 + inner * Math.cos(angle)} y1={180 + inner * Math.sin(angle)} x2={180 + outer * Math.cos(angle)} y2={180 + outer * Math.sin(angle)} stroke={major ? "#a9bad9" : "#445675"} strokeWidth={major ? 1.4 : .7} />;
                })}
                {Array.from({ length: 12 }, (_, index) => {
                  const hour = (7 + index) % 12 || 12;
                  const angle = ((120 + index * 30) * Math.PI) / 180;
                  const x = 180 + 158 * Math.cos(angle);
                  const y = 180 + 158 * Math.sin(angle);
                  return <text key={`hour-${index}`} x={x} y={y + 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="#d7e3ff">{hour}</text>;
                })}
                <circle cx="180" cy="180" r="77" fill="#f1f5ff" stroke="#dbe6ff" strokeWidth="1" />
                <text x="180" y="158" textAnchor="middle" fontSize="9" fontWeight="800" letterSpacing="1.2" fill="#667ba4">TOTAL FOCUSED</text>
                <text x="180" y="185" textAnchor="middle" fontSize={trackedSeconds >= 36000 ? "20" : "24"} fontWeight="800" letterSpacing="-.8" fill="#0c1b3d">{formatDuration(trackedSeconds)}</text>
                <text x="180" y="204" textAnchor="middle" fontSize="10" fontWeight="650" fill="#52688f">of {formatDuration(targetSeconds)} target</text>
                <text x="180" y="224" textAnchor="middle" fontSize="10" fontWeight="800" fill={progressPercent >= 100 ? "#0c9b65" : "#1266ce"}>{progressPercent}% complete</text>
                {(() => {
                  const now = new Date(nowMs);
                  const hourAngle = -90 + ((now.getHours() % 12) + now.getMinutes() / 60) * 30;
                  const minuteAngle = -90 + now.getMinutes() * 6;
                  const hourHand = getClockHandPoint(hourAngle, 53);
                  const minuteHand = getClockHandPoint(minuteAngle, 70);
                  return <g>
                    <line x1="180" y1="180" x2={hourHand.x} y2={hourHand.y} stroke="#122457" strokeWidth="4.5" strokeLinecap="round" />
                    <line x1="180" y1="180" x2={minuteHand.x} y2={minuteHand.y} stroke="#ff9d52" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="180" cy="180" r="5" fill="#122457" stroke="#f1f5ff" strokeWidth="1.5" />
                  </g>;
                })()}
              </svg>
              <div className="sp-clock-legend">
                <span><i style={{ background: "#248ff1" }} />Tracked time</span>
                <span><i style={{ background: "#7d91b5" }} />Planned blocks use subject colors</span>
                <span><i style={{ background: "#20cb83" }} />Completed blocks</span>
              </div>
              <div className="sp-clock-caption">Clock view maps the 7:00 AM–7:00 PM window around the dial. Blocks outside that window remain visible in List view. The outer blue ring shows your aggregate time against the daily target.</div>
            </div>
          )}

          <div className="sp-footer-note"><span>ⓘ</span><span><b>How tracking works:</b> the aggregate is the sum of saved timer sessions for this date, including the currently running session. Switching to another block pauses the previous timer and saves its duration. Marking a block complete never invents extra study time.</span></div>
        </main>
      </div>

      {showBlockForm && (
        <div className="sp-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowBlockForm(false); }}>
          <section className="sp-modal" role="dialog" aria-modal="true" aria-labelledby="sp-block-modal-title">
            <div className="sp-modal-head">
              <div><h3 id="sp-block-modal-title" className="sp-modal-title">{form.id ? "Edit study block" : "Add a study block"}</h3><div className="sp-panel-subtitle">{formatDay(selectedDateObj)} · planned time is calculated from the start and end times</div></div>
              <button type="button" className="sp-button small icon" aria-label="Close" onClick={() => setShowBlockForm(false)}>×</button>
            </div>
            <form className="sp-modal-body" onSubmit={saveBlock}>
              <div className="sp-form-grid">
                <div className="sp-field full">
                  <label htmlFor="sp-block-subject">Subject</label>
                  <select id="sp-block-subject" className="sp-select" value={form.subjectId} onChange={(event) => setForm((current) => ({ ...current, subjectId: event.target.value, chapterId: "" }))} required>
                    <option value="">Choose an existing subject…</option>
                    {subjects.map((subject) => <option key={String(subject.id)} value={String(subject.id)}>{subject.name}</option>)}
                  </select>
                </div>
                <div className="sp-field full">
                  <label htmlFor="sp-block-chapter">Chapter / unit (optional)</label>
                  <select id="sp-block-chapter" className="sp-select" value={form.chapterId} onChange={(event) => {
                    const value = event.target.value;
                    const chapter = chaptersForFormSubject.find((candidate) => String(candidate.id) === value);
                    setForm((current) => ({ ...current, chapterId: value, title: chapter && (!current.title || current.title === "Study session") ? chapter.name : current.title }));
                  }}>
                    <option value="">No specific chapter</option>
                    {chaptersForFormSubject.map((chapter) => <option key={String(chapter.id)} value={String(chapter.id)}>{chapter.name}</option>)}
                  </select>
                  {form.subjectId && chaptersForFormSubject.length === 0 && <div className="sp-field-hint">No chapters were passed for this subject. You can still create a subject-level study block.</div>}
                </div>
                <div className="sp-field full">
                  <label htmlFor="sp-block-title">Block title</label>
                  <input id="sp-block-title" className="sp-input" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Read Limited Liability Partnership Act" required maxLength={160} />
                </div>
                <div className="sp-field">
                  <label htmlFor="sp-block-start">Start time</label>
                  <input id="sp-block-start" className="sp-input" type="time" value={form.startTime} onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))} required />
                </div>
                <div className="sp-field">
                  <label htmlFor="sp-block-end">End time</label>
                  <input id="sp-block-end" className="sp-input" type="time" value={form.endTime} onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))} required />
                </div>
                <div className="sp-field full">
                  <div className="sp-field-hint">Scheduled duration: <strong style={{ color: "#e7efff" }}>{minutesBetween(form.startTime, form.endTime) > 0 ? formatDuration(minutesBetween(form.startTime, form.endTime) * 60) : "Choose a valid time range"}</strong>. Overlapping blocks are prevented so your timetable stays usable.</div>
                </div>
              </div>
              <div className="sp-modal-footer">
                <div className="sp-field-hint">Timers count only when you press Start timer.</div>
                <div style={{ display: "flex", gap: 7 }}>
                  <button type="button" className="sp-button" onClick={() => setShowBlockForm(false)}>Cancel</button>
                  <button type="submit" className="sp-button primary" disabled={saving || subjects.length === 0}>{saving ? "Saving…" : form.id ? "Save changes" : "Add block"}</button>
                </div>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
