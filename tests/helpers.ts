import type { Action, Command, RoutineInput, TodoInput } from '../src/domain/reality';
export const at = (date: string, time = '12:00:00') => new Date(`${date}T${time}`).toISOString();
export const now = at('2026-09-15');
let sequence = 0;
export const command = (action: Action, time = now): Command => ({ id: `cmd-${++sequence}`, at: time, action });
export const todoInput = (title = '一次性事项'): TodoInput => ({ title, description: '描述', difficulty: 2, dueAt: null });
export const routineInput = (title = '每日例行'): RoutineInput => ({ title, description: '描述', difficulty: 2, schedule: { version: 1, calendar: 'local', frequency: 'daily', startDate: '2026-09-15' } });
