import { useEffect, useState } from 'react';

import { type AlwaysTaskState, alwaysTaskState, type Task } from '@/features/tasks/task';
import { addDays, fromIsoDate, today } from '@/lib/dates';

/** When an always task or a routine can next be done: once its pause is over, or tomorrow once done for today. */
function changesAt(state: AlwaysTaskState): number | null {
  if (state.kind === 'resting') return state.until;
  if (state.kind === 'doneForToday') return fromIsoDate(addDays(today(), 1)).getTime();
  return null;
}

/**
 * Where an always task stands (`alwaysTaskState()`), rendering again when that changes.
 */
export function useAlwaysTaskState(task: Task): AlwaysTaskState {
  const [now, setNow] = useState(() => Date.now());
  const state = alwaysTaskState(task, now, today());
  const until = changesAt(state);
  useEffect(() => {
    if (until === null) return;
    const timer = setTimeout(() => {
      setNow(Date.now());
    }, until - Date.now());
    return () => {
      clearTimeout(timer);
    };
  }, [until]);
  return state;
}
