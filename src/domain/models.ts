import type { Schedule } from './schedule';
export type Difficulty = 1 | 2 | 3 | 4;
export type Details = { title: string; description: string; difficulty: Difficulty | null };
type Entity = Details & { id: string; position: number; createdAt: string; updatedAt: string };
export type Todo = Entity & {
  kind: 'todo'; dueAt: string | null; status: 'todo' | 'completed' | 'cancelled';
  completedAt: string | null; archivedAt: string | null;
};
export type ScheduleRevision = { effectiveAt: string; schedule: Schedule | null };
export type Routine = Entity & {
  kind: 'routine'; schedule: Schedule; status: 'active' | 'stopped';
  scheduleHistory: ScheduleRevision[];
};
export type Occurrence = { id: string; routineId: string; date: string; startsAt: string; endsAt: string };
type EventBase = { id: string; key: string; recordedAt: string };
export type TodoEvent = EventBase & {
  type: 'TODO_PLANNED' | 'TODO_UPDATED' | 'TODO_COMPLETED' | 'TODO_CANCELLED'; subject: Todo;
};
export type RoutineChangeEvent = EventBase & {
  type: 'ROUTINE_PLANNED' | 'ROUTINE_UPDATED' | 'ROUTINE_STOPPED'; subject: Routine;
};
export type RoutineCompletionEvent = EventBase & {
  type: 'ROUTINE_COMPLETED'; subject: Routine; occurrence: Occurrence; completedAt: string;
};
export type RealityEvent = TodoEvent | RoutineChangeEvent | RoutineCompletionEvent;
export type RealityTurn = { id: string; number: number; submittedAt: string; events: RealityEvent[] };
export type RealityState = { version: 4; todos: Todo[]; routines: Routine[]; pending: RealityEvent[]; turns: RealityTurn[] };
export type TodoInput = Details & { dueAt: string | null };
export type RoutineInput = Details & { schedule: Schedule };
export type EditorInput = ({ kind: 'todo' } & TodoInput) | ({ kind: 'routine' } & RoutineInput);
export const emptyState = (): RealityState => ({ version: 4, todos: [], routines: [], pending: [], turns: [] });
export function isCompletion(event: RealityEvent): event is RoutineCompletionEvent | (TodoEvent & { type: 'TODO_COMPLETED' }) {
  return event.type === 'TODO_COMPLETED' || event.type === 'ROUTINE_COMPLETED';
}

// Persisted domain values contain JSON data only; usable on Web and Hermes.
export function copy<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
