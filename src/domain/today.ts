import type { Occurrence, RealityState, Routine, RoutineCompletionEvent, Todo } from './models';
import { dayWindow, localDate, matchesSchedule } from './schedule';

export function currentOccurrence(routine: Routine, at: string): Occurrence | null {
  if (routine.status !== 'active' || Date.parse(at) < Date.parse(routine.createdAt)) return null;
  const date = localDate(at);
  if (!matchesSchedule(routine.schedule, date)) return null;
  const window = dayWindow(date);
  const effectiveAt = routine.scheduleHistory.at(-1)?.effectiveAt ?? routine.createdAt;
  if (Date.parse(at) < Date.parse(effectiveAt)) return null;
  return { ...window, startsAt: new Date(Math.max(Date.parse(window.startsAt), Date.parse(effectiveAt))).toISOString(), id: `${routine.id}:${date}`, routineId: routine.id };
}
export function completionEvents(state: RealityState): RoutineCompletionEvent[] {
  return [...state.turns.flatMap(turn => turn.events), ...state.pending].filter((event): event is RoutineCompletionEvent => event.type === 'ROUTINE_COMPLETED');
}
// This is a UI projection, not a shared domain Task type.
export type TodayItem =
  | { kind: 'todo'; id: string; subject: Todo; status: Todo['status'] }
  | { kind: 'routine'; id: string; subject: Routine; occurrence: Occurrence; status: 'todo' | 'completed' };
export function todayItems(state: RealityState, at: string): TodayItem[] {
  const items: TodayItem[] = state.todos.filter(todo => !todo.archivedAt).map(todo => ({ kind: 'todo', id: todo.id, subject: todo, status: todo.status }));
  const completed = completionEvents(state);
  for (const routine of state.routines) {
    const occurrence = currentOccurrence(routine, at);
    if (occurrence && !completed.some(event => event.occurrence.id === occurrence.id)) items.push({ kind: 'routine', id: occurrence.id, subject: routine, occurrence, status: 'todo' });
  }
  // Keep unconfirmed completions reviewable, even after their window has expired.
  for (const event of state.pending) if (event.type === 'ROUTINE_COMPLETED') {
    items.push({ kind: 'routine', id: event.occurrence.id, subject: { ...event.subject, position: state.routines.find(routine => routine.id === event.subject.id)?.position ?? event.subject.position }, occurrence: event.occurrence, status: 'completed' });
  }
  return items.sort((a, b) => Number(a.status !== 'todo') - Number(b.status !== 'todo') || a.subject.position - b.subject.position || a.id.localeCompare(b.id));
}
