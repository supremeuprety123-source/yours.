/** CA Foundation Revision Calendar — Aug 25 → Oct 17, 2026 */

export interface PlanDay {
  date: string; // YYYY-MM-DD
  day: string;
  paper: string;
  phase: 1 | 2;
  title: string;
  focus: string;
  isMock?: boolean;
}

export const PLAN_START = '2026-08-25';
export const PLAN_END = '2026-10-17';
export const EXAM_DATE = '2027-01-20';

export const PHASE1_END = '2026-09-24';
export const PHASE2_START = '2026-09-25';

export const REVISION_PLAN: PlanDay[] = [
  // Paper 1 — Accounting | Aug 25–Sep 4
  { date: '2026-08-25', day: 'Mon', paper: 'P1 Accounting', phase: 1, title: 'Ch.1 Theoretical Framework (all 7 units)', focus: 'Write all AS names + their scope from memory' },
  { date: '2026-08-26', day: 'Tue', paper: 'P1 Accounting', phase: 1, title: 'Ch.2 Units 1–3: Journal, Ledger, Trial Balance', focus: 'Do 30+ journal entries — don\'t just read' },
  { date: '2026-08-27', day: 'Wed', paper: 'P1 Accounting', phase: 1, title: 'Ch.2 Units 4–6 + Ch.3 BRS', focus: '5 BRS problems, all starting points' },
  { date: '2026-08-28', day: 'Thu', paper: 'P1 Accounting', phase: 1, title: 'Ch.4 Inventories + Ch.5 Depreciation', focus: '5 depreciation problems including change of method' },
  { date: '2026-08-29', day: 'Fri', paper: 'P1 Accounting', phase: 1, title: 'Ch.6 Bills of Exchange & Promissory Notes', focus: 'Accommodation bills — journal entries for all 3 parties' },
  { date: '2026-08-30', day: 'Sat', paper: 'P1 Accounting', phase: 1, title: 'Ch.7 Unit 1: Final Accounts (Non-Manufacturing)', focus: 'Full problem with 10+ adjustments — exam-standard format' },
  { date: '2026-08-31', day: 'Sun', paper: 'P1 Accounting', phase: 1, title: 'Ch.7 Unit 2 Manufacturing + Ch.8 NPO', focus: 'Manufacturing A/c → Trading A/c link; NPO special items' },
  { date: '2026-09-01', day: 'Mon', paper: 'P1 Accounting', phase: 1, title: 'Ch.9 Incomplete Records + Ch.10 Units 1–2 Partnership', focus: 'Statement of Affairs; all 3 goodwill valuation formulas' },
  { date: '2026-09-02', day: 'Tue', paper: 'P1 Accounting', phase: 1, title: 'Ch.10 Units 3–4: Admission + Retirement', focus: 'Sacrificing/Gaining ratio, Revaluation A/c — 3 full problems each' },
  { date: '2026-09-03', day: 'Wed', paper: 'P1 Accounting', phase: 1, title: 'Ch.10 Units 5–6: Death + Dissolution + LLP', focus: 'Executor\'s account; Realisation A/c format' },
  { date: '2026-09-04', day: 'Thu', paper: 'P1 Accounting', phase: 1, title: 'Ch.11 Company Accounts (all 6 units)', focus: 'Share forfeiture + reissue; Debenture redemption via Sinking Fund' },

  // Paper 2 — Business Laws | Sep 5–11
  { date: '2026-09-05', day: 'Fri', paper: 'P2 Business Laws', phase: 1, title: 'Ch.1 Regulatory Framework + Ch.2 Units 1–3 Contract', focus: 'Section numbers for offer/acceptance; types of consent' },
  { date: '2026-09-06', day: 'Sat', paper: 'P2 Business Laws', phase: 1, title: 'Ch.2 Units 4–6: Performance, Breach, Quasi', focus: 'Types of damages; Sections 68–72 each individually' },
  { date: '2026-09-07', day: 'Sun', paper: 'P2 Business Laws', phase: 1, title: 'Ch.2 Units 7–9 + Ch.3 Units 1–2 Sale of Goods', focus: 'Surety\'s rights; Condition vs Warranty distinction' },
  { date: '2026-09-08', day: 'Mon', paper: 'P2 Business Laws', phase: 1, title: 'Ch.3 Units 3–4 + Ch.4 Partnership + Ch.5 LLP', focus: 'Section 69; Unpaid Seller\'s rights sequence' },
  { date: '2026-09-09', day: 'Tue', paper: 'P2 Business Laws', phase: 1, title: 'Ch.6 Companies Act 2013', focus: 'MOA clauses; MOA vs AOA; doctrine of indoor management' },
  { date: '2026-09-10', day: 'Wed', paper: 'P2 Business Laws', phase: 1, title: 'Ch.7 Negotiable Instruments Act', focus: '7 privileges of Holder in Due Course; PN vs BOE vs Cheque' },
  { date: '2026-09-11', day: 'Thu', paper: 'P2 Business Laws', phase: 1, title: 'Full Paper 2 Rapid Recall', focus: 'Key definitions, section numbers, case principles from memory' },

  // Paper 3 — Quant | Sep 12–18
  { date: '2026-09-12', day: 'Fri', paper: 'P3 Quant Aptitude', phase: 1, title: 'Ch.1 Ratio/Indices/Logs + Ch.2 Equations', focus: 'Log laws; 10 quadratic by formula and factorisation' },
  { date: '2026-09-13', day: 'Sat', paper: 'P3 Quant Aptitude', phase: 1, title: 'Ch.3 Inequalities + Ch.4 Maths of Finance', focus: 'Annuity — Sinking Fund & Loan Amortisation; ICAI tables' },
  { date: '2026-09-14', day: 'Sun', paper: 'P3 Quant Aptitude', phase: 1, title: 'Ch.5 P&C + Ch.6 Sequence & Series', focus: '15+ P&C with restrictions; AP/GP nth term + sum' },
  { date: '2026-09-15', day: 'Mon', paper: 'P3 Quant Aptitude', phase: 1, title: 'Ch.7 Sets + Limits + Ch.8 Calculus', focus: '10 Venn diagrams; MC=MR differentiation' },
  { date: '2026-09-16', day: 'Tue', paper: 'P3 Quant Aptitude', phase: 1, title: 'Ch.9–12 ALL Logical Reasoning', focus: 'Time each Q — target under 90 seconds per LR MCQ' },
  { date: '2026-09-17', day: 'Wed', paper: 'P3 Quant Aptitude', phase: 1, title: 'Ch.13 Stats Description + Ch.14 Central Tendency', focus: 'SD for grouped frequency — full calc 3 times' },
  { date: '2026-09-18', day: 'Thu', paper: 'P3 Quant Aptitude', phase: 1, title: 'Ch.15–18 Probability, Distributions, Correlation, Index', focus: 'Bayes 3 problems; Fisher\'s Index + reversal tests' },

  // Paper 4 — Economics | Sep 19–24
  { date: '2026-09-19', day: 'Fri', paper: 'P4 Business Economics', phase: 1, title: 'Ch.1 Nature & Scope + Ch.2 Unit 1 Demand', focus: 'Price elasticity — 3 methods; Income/Cross sign interpretations' },
  { date: '2026-09-20', day: 'Sat', paper: 'P4 Business Economics', phase: 1, title: 'Ch.2 Units 2–3 + Ch.3 Production & Cost', focus: 'IC curve properties; TP-MP-AP diagram; AC-MC from memory' },
  { date: '2026-09-21', day: 'Sun', paper: 'P4 Business Economics', phase: 1, title: 'Ch.4 Markets + Ch.5 Business Cycles', focus: 'Demand curve each market; Kinked demand; 4 cycle phases' },
  { date: '2026-09-22', day: 'Mon', paper: 'P4 Business Economics', phase: 1, title: 'Ch.6 National Income (both units)', focus: '3 NI methods; Multiplier k=1/MPS; APC vs MPC' },
  { date: '2026-09-23', day: 'Tue', paper: 'P4 Business Economics', phase: 1, title: 'Ch.7 Public Finance + Ch.8 Money Market', focus: '3 fiscal deficit types; RBI tools direction' },
  { date: '2026-09-24', day: 'Wed', paper: 'P4 Business Economics', phase: 1, title: 'Ch.9 International Trade + Ch.10 Indian Economy', focus: 'Ricardo 2-country example; Marshall-Lerner; LPG 1991' },

  // Phase 2 — Paper 1 second pass
  { date: '2026-09-25', day: 'Thu', paper: 'P1 Accounting', phase: 2, title: 'Ch.1–3 Second Pass: Framework + Journal + BRS', focus: 'Solve 3 BRS problems cold (no notes)' },
  { date: '2026-09-26', day: 'Fri', paper: 'P1 Accounting', phase: 2, title: 'Ch.4–6: Inventories + Depreciation + Bills', focus: 'All ICAI past exam questions for Bills chapter' },
  { date: '2026-09-27', day: 'Sat', paper: 'P1 Accounting', phase: 2, title: 'Ch.7–8: Final Accounts + NPO', focus: 'One full FA with 12 adjustments under 45 min' },
  { date: '2026-09-28', day: 'Sun', paper: 'P1 Accounting', phase: 2, title: 'Ch.9–10: Incomplete Records + Full Partnership', focus: 'One admission + one retirement problem cold' },
  { date: '2026-09-29', day: 'Mon', paper: 'P1 Accounting', phase: 2, title: 'Ch.11 Company Accounts — Debentures', focus: 'Redemption of Debentures (Sinking Fund) 3 problems' },
  { date: '2026-09-30', day: 'Tue', paper: 'P1 Accounting', phase: 2, title: 'Full Paper 1 Mock (3-hour timed)', focus: 'ICAI MTP/RTP. No cheating.', isMock: true },
  { date: '2026-10-01', day: 'Wed', paper: 'P1 Accounting', phase: 2, title: 'Paper 1 Mock Review', focus: 'Log every wrong answer by chapter. Fix weak spots.' },

  // Phase 2 — Paper 2
  { date: '2026-10-02', day: 'Thu', paper: 'P2 Business Laws', phase: 2, title: 'Ch.1–3 Contract Act second pass', focus: 'Write 5 full answer-format responses' },
  { date: '2026-10-03', day: 'Fri', paper: 'P2 Business Laws', phase: 2, title: 'Ch.4–6 Partnership + LLP + Companies', focus: 'MOA alteration; types of winding up' },
  { date: '2026-10-04', day: 'Sat', paper: 'P2 Business Laws', phase: 2, title: 'Ch.7 NI Act second pass', focus: '7 HiDC privileges from memory; dishonour + noting + protesting' },
  { date: '2026-10-05', day: 'Sun', paper: 'P2 Business Laws', phase: 2, title: 'Full Paper 2 Mock (3-hour timed)', focus: 'Check section numbers + ICAI model answer format', isMock: true },

  // Phase 2 — Paper 3
  { date: '2026-10-06', day: 'Mon', paper: 'P3 Quant Aptitude', phase: 2, title: 'Ch.1–4 Business Maths MCQs', focus: '20 mixed MCQs — mark certain vs guessed' },
  { date: '2026-10-07', day: 'Tue', paper: 'P3 Quant Aptitude', phase: 2, title: 'Ch.5–8 P&C + Sequence + Sets + Calculus', focus: '20 mixed MCQs' },
  { date: '2026-10-08', day: 'Wed', paper: 'P3 Quant Aptitude', phase: 2, title: 'Ch.9–12 Logical Reasoning timed', focus: '20 LR MCQs under 90 sec each' },
  { date: '2026-10-09', day: 'Thu', paper: 'P3 Quant Aptitude', phase: 2, title: 'Ch.13–18 Full Statistics MCQs', focus: 'SD, Bayes, Index Numbers — 20 MCQs' },
  { date: '2026-10-10', day: 'Fri', paper: 'P3 Quant Aptitude', phase: 2, title: 'Full Paper 3 Mock (2-hour timed)', focus: 'Track confident vs guessed. Negative marking training.', isMock: true },

  // Phase 2 — Paper 4
  { date: '2026-10-11', day: 'Sat', paper: 'P4 Business Economics', phase: 2, title: 'Ch.1–5 Micro Economics MCQs', focus: '20 MCQs — demand, elasticity, IC, cost, markets' },
  { date: '2026-10-12', day: 'Sun', paper: 'P4 Business Economics', phase: 2, title: 'Ch.6–8 NI + Public Finance + Money', focus: '20 MCQs; fiscal/monetary policy direction' },
  { date: '2026-10-13', day: 'Mon', paper: 'P4 Business Economics', phase: 2, title: 'Ch.9–10 International Trade + Indian Economy', focus: 'Ricardo numerical, WTO, LPG reforms' },
  { date: '2026-10-14', day: 'Tue', paper: 'P4 Business Economics', phase: 2, title: 'Full Paper 4 Mock (2-hour timed)', focus: 'Cross-check against ICAI answer key', isMock: true },

  // Final consolidation
  { date: '2026-10-15', day: 'Wed', paper: 'All Papers', phase: 2, title: 'Formula / Section / Definition rapid-fire', focus: '5 min per chapter — write everything from memory' },
  { date: '2026-10-16', day: 'Thu', paper: 'All Papers', phase: 2, title: 'Weakest 8 chapters targeted re-revision', focus: 'From mock results + red/yellow confidence' },
  { date: '2026-10-17', day: 'Fri', paper: 'All Papers', phase: 2, title: 'LAST DAY — ICAI Quick Revision summaries', focus: 'All 4 papers. Sleep by 10:30 PM.' },
];

export const DAILY_FIXED_SLOTS = [
  { title: "Yesterday's topic recall", start_time: '05:00', end_time: '06:00', category: 'Study', notes: 'Write formulas/sections from memory without looking' },
  { title: 'Consolidation — formulas & definitions', start_time: '21:00', end_time: '23:00', category: 'Study', notes: 'Night block — always present regardless of class timing' },
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
