import { checkedDate, validateSchedule } from './schedule';
import { currentOccurrence, completionEvents, todayItems } from './today';
import { copy, emptyState, type Details, type RealityEvent, type RealityState, type Routine, type RoutineInput, type Todo, type TodoInput } from './models';
export * from './models';
export type Action =
  | { type: 'createTodo'; input: TodoInput } | { type: 'editTodo'; id: string; input: TodoInput }
  | { type: 'todoStatus'; id: string; status: Todo['status'] }
  | { type: 'createRoutine'; input: RoutineInput } | { type: 'editRoutine'; id: string; input: RoutineInput }
  | { type: 'routineStatus'; id: string; status: Routine['status'] }
  | { type: 'completeRoutine'; id: string; occurrenceId: string }
  | { type: 'undoRoutineCompletion'; occurrenceId: string }
  | { type: 'reset' }
  | { type: 'move'; id: string; direction: 'up' | 'down' } | { type: 'submit' };
export type Command = { id: string; at: string; action: Action };
function details(input: Details): Details {
  const title = input.title.trim(), description = input.description.trim();
  if (!title || title.length > 200) throw new Error('标题须为 1–200 字。');
  if (description.length > 4000) throw new Error('描述不能超过 4000 字。');
  if (input.difficulty !== null && ![1, 2, 3, 4].includes(input.difficulty)) throw new Error('难度须为 1–4 级。');
  return { title, description, difficulty: input.difficulty };
}
// Coalesce final facts awaiting confirmation; this is not an operation audit log.
function pending(state: RealityState, event: RealityEvent) {
  return [...state.pending.filter(item => item.key !== event.key), event];
}
export function applyCommand(state: RealityState, command: Command): RealityState {
  const { id, at, action } = command;
  if (!Number.isFinite(Date.parse(at))) throw new Error('时间无效。');
  if (action.type === 'reset') return emptyState();
  if (state.turns.some(turn => turn.id === id)) return state;
  if (action.type === 'submit') {
    if (!state.pending.length) return state;
    const ending = new Set(state.pending.filter(event => event.type === 'TODO_COMPLETED' || event.type === 'TODO_CANCELLED').map(event => event.subject.id));
    return { ...state, todos: state.todos.map(todo => ending.has(todo.id) ? { ...todo, archivedAt: at } : todo), pending: [],
      turns: [...state.turns, { id, number: state.turns.length + 1, submittedAt: at, events: copy(state.pending) }] };
  }
  if (action.type === 'move') {
    const items = todayItems(state, at);
    const item = items.find(item => item.id === action.id);
    if (!item) throw new Error('此事项已不在 Today 中。');
    const group = items.filter(other => (other.status === 'todo') === (item.status === 'todo'));
    const neighbor = group[group.indexOf(item) + (action.direction === 'up' ? -1 : 1)];
    if (!neighbor || neighbor.subject.id === item.subject.id) return state;
    const move = <T extends { id: string; position: number }>(entity: T): T => ({ ...entity, position: entity.id === item.subject.id ? neighbor.subject.position : entity.id === neighbor.subject.id ? item.subject.position : entity.position });
    return { ...state, todos: state.todos.map(move), routines: state.routines.map(move) };
  }
  if (action.type === 'undoRoutineCompletion') {
    const key = `occurrence:${action.occurrenceId}`;
    if (!state.pending.some(event => event.key === key)) throw new Error('此完成记录已确认，不能撤回。');
    return { ...state, pending: state.pending.filter(event => event.key !== key) };
  }
  const position = Math.min(0, ...state.todos.map(x => x.position), ...state.routines.map(x => x.position)) - 1;
  if (action.type === 'createTodo' || action.type === 'editTodo' || action.type === 'todoStatus') {
    const existing = action.type === 'createTodo' ? undefined : state.todos.find(todo => todo.id === action.id);
    if (action.type === 'createTodo' && state.todos.some(todo => todo.id === id)) return state;
    if (action.type !== 'createTodo' && !existing) throw new Error('事项不存在。');
    if (existing?.archivedAt) throw new Error('事项已确认，不能修改。');
    let todo: Todo;
    if (action.type === 'todoStatus') {
      if (!['todo', 'completed', 'cancelled'].includes(action.status)) throw new Error('状态无效。');
      todo = { ...existing!, status: action.status, completedAt: action.status === 'completed' ? existing!.completedAt ?? at : null, updatedAt: at };
    } else {
      todo = { kind: 'todo', id, position, createdAt: at, status: 'todo', completedAt: null, archivedAt: null, ...existing,
        ...details(action.input), dueAt: action.input.dueAt ? checkedDate(action.input.dueAt) : null, updatedAt: at };
    }
    const event: RealityEvent = { id, key: `todo:${todo.id}`, recordedAt: at, subject: copy(todo),
      type: todo.status === 'completed' ? 'TODO_COMPLETED' : todo.status === 'cancelled' ? 'TODO_CANCELLED' : action.type === 'createTodo' ? 'TODO_PLANNED' : 'TODO_UPDATED' };
    return { ...state, todos: existing ? state.todos.map(item => item.id === todo.id ? todo : item) : [...state.todos, todo], pending: pending(state, event) };
  }
  const existing = action.type === 'createRoutine' ? undefined : state.routines.find(routine => routine.id === action.id);
  if (action.type === 'createRoutine' && state.routines.some(routine => routine.id === id)) return state;
  if (action.type !== 'createRoutine' && !existing) throw new Error('例行事项不存在。');
  if (action.type === 'completeRoutine') {
    if (completionEvents(state).some(event => event.occurrence.id === action.occurrenceId)) return state;
    const occurrence = currentOccurrence(existing!, at);
    if (!occurrence || occurrence.id !== action.occurrenceId || Date.parse(at) >= Date.parse(occurrence.endsAt)) throw new Error('此执行窗口已结束或尚未开始。');
    const event: RealityEvent = { id, key: `occurrence:${occurrence.id}`, type: 'ROUTINE_COMPLETED', recordedAt: at, completedAt: at, subject: copy(existing!), occurrence };
    return { ...state, pending: pending(state, event) };
  }
  let routine: Routine;
  if (action.type === 'routineStatus') {
    if (!['active', 'stopped'].includes(action.status)) throw new Error('状态无效。');
    if (existing!.status === action.status) return state;
    routine = { ...existing!, status: action.status, updatedAt: at, scheduleHistory: [...existing!.scheduleHistory, { effectiveAt: at, schedule: action.status === 'active' ? copy(existing!.schedule) : null }] };
  } else {
    const schedule = validateSchedule(action.input.schedule);
    const changed = !existing || JSON.stringify(existing.schedule) !== JSON.stringify(schedule);
    routine = { kind: 'routine', id, position, createdAt: at, status: 'active', ...existing, ...details(action.input), schedule, updatedAt: at,
      scheduleHistory: changed ? [...existing?.scheduleHistory ?? [], { effectiveAt: at, schedule: existing?.status === 'stopped' ? null : copy(schedule) }] : existing!.scheduleHistory };
  }
  const event: RealityEvent = { id, key: `routine:${routine.id}`, recordedAt: at, subject: copy(routine),
    type: routine.status === 'stopped' ? 'ROUTINE_STOPPED' : action.type === 'createRoutine' ? 'ROUTINE_PLANNED' : 'ROUTINE_UPDATED' };
  return { ...state, routines: existing ? state.routines.map(item => item.id === routine.id ? routine : item) : [...state.routines, routine], pending: pending(state, event) };
}
export function readStoredState(value: unknown): RealityState {
  if (value === undefined || value === null) return emptyState();
  const stored = value as RealityState;
  // One-time, user-authorized fresh start for this domain redesign (including interim v3).
  if ([1, 2, 3].includes(stored.version)) return emptyState();
  if (stored.version !== 4 || !Array.isArray(stored.todos) || !Array.isArray(stored.routines)
    || !Array.isArray(stored.pending) || !Array.isArray(stored.turns)) throw new Error('本地记录格式无法读取。请保留数据或使用调试清空。');
  return stored;
}
