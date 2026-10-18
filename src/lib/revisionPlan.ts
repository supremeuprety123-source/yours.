/** Study plan calendar — cleared for rebuild (Oct 2026) */

export interface PlanDay {
  date: string; // YYYY-MM-DD
  day: string;
  paper: string;
  phase: 1 | 2;
  title: string;
  focus: string;
  isMock?: boolean;
}

/** Plan window — set when you define the new plan */
export const PLAN_START = '';
export const PLAN_END = '';
export const EXAM_DATE = '2027-01-20';

export const PHASE1_END = '';
export const PHASE2_START = '';

/** Chapter / revision day plan — empty until the new plan is added */
export const REVISION_PLAN: PlanDay[] = [];

/** Current daily timetable — CA Foundation + Gym (from Sep 2026) */
export const DAILY_ROUTINE_NAME = 'Daily - CA Foundation + Gym';
export const DAILY_ROUTINE_TAG = 'daily-ca-gym';
export const GYM_PLAN_TAG = 'gym-weekly-split';

/**
 * Gym 05:20–06:15 every day except Saturday (rest).
 * JS weekday: 0=Sun … 6=Sat
 */
export const GYM_WEEKLY_PLAN: {
  day: number;
  dayName: string;
  title: string;
  focus: string;
  notes: string;
}[] = [
  {
    day: 0,
    dayName: 'Sunday',
    title: 'Gym — Chest',
    focus: 'Chest',
    notes: 'Bench press · Incline DB press · Cable fly · Dips · Push-ups finisher',
  },
  {
    day: 1,
    dayName: 'Monday',
    title: 'Gym — Back',
    focus: 'Back',
    notes: 'Pull-ups / lat pulldown · Barbell row · Seated row · Face pulls · Deadlift variation (light)',
  },
  {
    day: 2,
    dayName: 'Tuesday',
    title: 'Gym — Legs',
    focus: 'Legs',
    notes: 'Squat · Romanian deadlift · Leg press · Lunges · Calf raises · Core (plank)',
  },
  {
    day: 3,
    dayName: 'Wednesday',
    title: 'Gym — Shoulders',
    focus: 'Shoulders',
    notes: 'OHP · Lateral raises · Rear delt fly · Front raise · Shrugs · Light rotator work',
  },
  {
    day: 4,
    dayName: 'Thursday',
    title: 'Gym — Arms',
    focus: 'Arms',
    notes: 'Barbell curl · Hammer curl · Tricep pushdown · Skull crushers · Close-grip bench',
  },
  {
    day: 5,
    dayName: 'Friday',
    title: 'Gym — Full body / weak points',
    focus: 'Full body',
    notes: 'Compound mix · Extra work on weak muscles · Core · Optional light cardio 10 min',
  },
  // Saturday = rest (no gym entry)
];

/** Shared day slots. Gym muscle-group is separate (GYM_WEEKLY_PLAN). */
export const DAILY_FIXED_SLOTS: {
  title: string;
  start_time: string;
  end_time: string;
  category: string;
  notes: string;
  /** If set, only these weekdays (0=Sun … 6=Sat). Omit = every day. */
  repeat_days?: number[];
}[] = [
  { title: 'Wake', start_time: '04:30', end_time: '04:30', category: 'Personal', notes: 'Start of day' },
  { title: 'Prep (freshen up, snack, pack bag)', start_time: '04:30', end_time: '04:50', category: 'Personal', notes: '' },
  // Gym days only (not Saturday)
  {
    title: 'Running (commute to gym)',
    start_time: '04:50',
    end_time: '05:20',
    category: 'Exercise',
    notes: 'Sun–Fri only',
    repeat_days: [0, 1, 2, 3, 4, 5],
  },
  // Gym block itself comes from GYM_WEEKLY_PLAN (muscle group by day)
  { title: 'Commute to coaching', start_time: '06:15', end_time: '06:25', category: 'Travel', notes: '' },
  { title: 'Coaching + self-study', start_time: '06:30', end_time: '16:00', category: 'Coaching', notes: 'Full coaching day + self-study blocks' },
  { title: 'Commute home', start_time: '16:00', end_time: '16:30', category: 'Travel', notes: '' },
  { title: 'Break (shower, food)', start_time: '16:30', end_time: '17:15', category: 'Personal', notes: '' },
  { title: 'Evening study (revision + practice)', start_time: '17:15', end_time: '19:00', category: 'Study', notes: 'Revision + practice' },
  { title: 'Dinner', start_time: '19:00', end_time: '20:00', category: 'Meals', notes: '' },
  { title: 'Light review / next-day prep', start_time: '20:00', end_time: '21:00', category: 'Study', notes: '' },
  { title: 'Plan tomorrow', start_time: '21:00', end_time: '21:30', category: 'Personal', notes: '' },
  { title: 'Sleep', start_time: '21:30', end_time: '22:00', category: 'Sleep', notes: 'Wind down / sleep' },
  // Saturday rest reminder (morning free instead of gym)
  {
    title: 'Rest morning (no gym)',
    start_time: '04:50',
    end_time: '06:15',
    category: 'Personal',
    notes: 'Saturday rest — recovery, light stretch, or extra study',
    repeat_days: [6],
  },
];

export function getPlanDay(date: string): PlanDay | undefined {
  return REVISION_PLAN.find(d => d.date === date);
}

export function getTodayPlanDay(): PlanDay | undefined {
  const d = new Date();
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return getPlanDay(iso);
}

export function planProgress(): { total: number; phase1: number; phase2: number; mocks: number } {
  return {
    total: REVISION_PLAN.length,
    phase1: REVISION_PLAN.filter(d => d.phase === 1).length,
    phase2: REVISION_PLAN.filter(d => d.phase === 2).length,
    mocks: REVISION_PLAN.filter(d => d.isMock).length,
  };
}

/** localStorage key — bump when daily/gym timetable needs to re-run */
export const DAILY_ROUTINE_MIGRATION_KEY = 'yours_daily_routine_v4_gym_split';
