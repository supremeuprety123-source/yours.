import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { getAll } from '../lib/store';
import type { Chapter, Paper, Exam } from '../lib/types';
import { daysUntil } from '../lib/utils';
import StudyPlan from './StudyPlan';

interface Props {
  routines: unknown[];
  chapters: Chapter[];
  onRoutinesChanged: () => void;
}

/** Plan tab — wires Study papers/chapters/exams into StudyPlan */
export default function RevisionPlanView({ chapters }: Props) {
  const { refreshKey } = useApp();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);

  useEffect(() => {
    (async () => {
      const [p, e] = await Promise.all([
        getAll<Paper>('papers'),
        getAll<Exam>('exams'),
      ]);
      setPapers(p);
      setExams(e);
    })();
  }, [refreshKey]);

  const subjects = useMemo(
    () => papers.map(p => ({ id: p.id, name: p.name, color: null as string | null })),
    [papers]
  );

  const plannerChapters = useMemo(
    () => chapters.map(c => ({ id: c.id, subjectId: c.paper_id, name: c.name })),
    [chapters]
  );

  const nextExam = useMemo(() => {
    const upcoming = exams
      .filter(ex => daysUntil(ex.date) >= 0)
      .sort((a, b) => daysUntil(a.date) - daysUntil(b.date));
    return upcoming[0] || null;
  }, [exams]);

  return (
    <StudyPlan
      subjects={subjects}
      chapters={plannerChapters}
      dailyTargetMinutes={600}
      examDate={nextExam?.date}
      examName={nextExam?.name}
    />
  );
}
