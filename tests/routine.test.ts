import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyCommand, emptyState } from '../src/domain/reality';
import { currentOccurrence, todayItems } from '../src/domain/today';
import { dayWindow } from '../src/domain/schedule';
import { at, command, now, routineInput, todoInput } from './helpers';

function setup(input = routineInput()) {
  const create = command({ type: 'createRoutine', input });
  const state = applyCommand(emptyState(), create);
  return { state, routine: state.routines[0] };
}
test('Routine 生命周期独立于 Turn：跨日更换窗口，不补建漏期，不修改存储', () => {
  const { state, routine } = setup();
  const before = JSON.stringify(state);
  assert.equal(currentOccurrence(routine, now)?.date, '2026-09-15');
  assert.equal(todayItems(state, at('2026-09-30')).length, 1);
  const later = todayItems(state, at('2026-09-30'))[0];
  assert.ok(later.kind === 'routine'); assert.equal(later.occurrence.date, '2026-09-30');
  assert.equal(JSON.stringify(state), before);
  assert.equal(state.turns.length, 0);
});
test('有效窗口包含开始不包含结束，拒绝过期点击和提前完成', () => {
  const { state, routine } = setup();
  const occurrence = currentOccurrence(routine, now)!;
  assert.equal(currentOccurrence(routine, at('2026-09-14')), null);
  const beforeEnd = new Date(Date.parse(occurrence.endsAt) - 1).toISOString();
  assert.equal(currentOccurrence(routine, beforeEnd)?.id, occurrence.id);
  assert.notEqual(currentOccurrence(routine, occurrence.endsAt)?.id, occurrence.id);
  assert.throws(() => applyCommand(state, command({ type: 'completeRoutine', id: routine.id, occurrenceId: occurrence.id }, occurrence.endsAt)), /窗口/);
  assert.throws(() => applyCommand(state, command({ type: 'completeRoutine', id: routine.id, occurrenceId: `${routine.id}:2026-09-16` })), /窗口/);
});
test('指定星期与开始日期限制 actionable，非执行日不显示，周日与跨周正确', () => {
  const input = routineInput(); input.schedule = { version: 1, calendar: 'local', frequency: 'weekly', startDate: '2026-09-15', weekdays: [0, 1] };
  const { state } = setup(input);
  assert.equal(todayItems(state, now).length, 0);
  assert.equal(todayItems(state, at('2026-09-20')).length, 1);
  assert.equal(todayItems(state, at('2026-09-21')).length, 1);
  assert.equal(todayItems(state, at('2026-09-22')).length, 0);
});
test('Routine 完成与 Todo 完成生成不同事件；确认不生成下一次，提交后清空已完成列表', () => {
  let { state, routine } = setup();
  const todo = command({ type: 'createTodo', input: todoInput() });
  state = applyCommand(state, todo);
  state = applyCommand(state, command({ type: 'todoStatus', id: todo.id, status: 'completed' }));
  state = applyCommand(state, command({ type: 'completeRoutine', id: routine.id, occurrenceId: currentOccurrence(routine, now)!.id }));
  assert.deepEqual(state.pending.filter(e => e.type.endsWith('COMPLETED')).map(e => e.type).sort(), ['ROUTINE_COMPLETED', 'TODO_COMPLETED']);
  assert.equal(todayItems(state, now).filter(x => x.status === 'todo').length, 0);
  const schedules = JSON.stringify(state.routines);
  state = applyCommand(state, command({ type: 'submit' }));
  assert.equal(todayItems(state, now).length, 0);
  assert.equal(state.todos.length, 1);
  assert.equal(JSON.stringify(state.routines), schedules);
  assert.equal(todayItems(state, at('2026-09-16')).filter(x => x.status === 'todo').length, 1);
});
test('不确认昨天也能完成今天；旧完成可审核和撤销，但不能补做过期窗口', () => {
  let { state, routine } = setup();
  const occurrenceId = currentOccurrence(routine, now)!.id;
  state = applyCommand(state, command({ type: 'completeRoutine', id: routine.id, occurrenceId }));
  const tomorrow = at('2026-09-16');
  assert.equal(todayItems(state, tomorrow).length, 2);
  assert.equal(todayItems(state, tomorrow).filter(x => x.status === 'todo').length, 1);
  state = applyCommand(state, command({ type: 'undoRoutineCompletion', occurrenceId }, tomorrow));
  assert.equal(todayItems(state, tomorrow).length, 1);
  assert.throws(() => applyCommand(state, command({ type: 'completeRoutine', id: routine.id, occurrenceId }, tomorrow)), /窗口/);
});
test('重复完成/提交/切换日程不会重复奖励同一窗口，已确认完成不可撤销', () => {
  let { state, routine } = setup();
  const occurrenceId = currentOccurrence(routine, now)!.id;
  const complete = command({ type: 'completeRoutine', id: routine.id, occurrenceId });
  state = applyCommand(state, complete); state = applyCommand(state, complete);
  state = applyCommand(state, command({ type: 'editRoutine', id: routine.id, input: { ...routineInput('改名'), schedule: { version: 1, calendar: 'local', startDate: '2026-09-15', frequency: 'weekly', weekdays: [2] } } }));
  assert.equal(state.pending.filter(e => e.type === 'ROUTINE_COMPLETED').length, 1);
  assert.equal(todayItems(state, now).filter(x => x.status === 'todo').length, 0);
  state = applyCommand(state, command({ type: 'submit' }));
  state = applyCommand(state, complete);
  state = applyCommand(state, command({ type: 'submit' }));
  assert.equal(state.turns.length, 1);
  assert.throws(() => applyCommand(state, command({ type: 'undoRoutineCompletion', occurrenceId })), /已确认/);
});
test('停用立即停止窗口，保留完成和日程版本；重新启用不会清除完成', () => {
  let { state, routine } = setup();
  state = applyCommand(state, command({ type: 'completeRoutine', id: routine.id, occurrenceId: currentOccurrence(routine, now)!.id }));
  state = applyCommand(state, command({ type: 'routineStatus', id: routine.id, status: 'stopped' }));
  assert.equal(currentOccurrence(state.routines[0], now), null);
  assert.equal(state.pending.filter(e => e.type === 'ROUTINE_COMPLETED').length, 1);
  assert.equal(state.routines[0].scheduleHistory.at(-1)?.schedule, null);
  state = applyCommand(state, command({ type: 'routineStatus', id: routine.id, status: 'active' }));
  assert.equal(todayItems(state, now).filter(x => x.status === 'todo').length, 0);
});
test('后续编辑保留完成时快照和日程历史，未改日程不新增版本', () => {
  let { state, routine } = setup();
  state = applyCommand(state, command({ type: 'completeRoutine', id: routine.id, occurrenceId: currentOccurrence(routine, now)!.id }));
  state = applyCommand(state, command({ type: 'submit' }));
  const history = JSON.stringify(state.turns);
  state = applyCommand(state, command({ type: 'editRoutine', id: routine.id, input: routineInput('改名') }));
  assert.equal(state.routines[0].scheduleHistory.length, 1);
  assert.equal(JSON.stringify(state.turns), history);
  state = applyCommand(state, command({ type: 'editRoutine', id: routine.id, input: { ...routineInput(), schedule: { version: 1, calendar: 'local', startDate: '2026-09-16', frequency: 'daily' } } }));
  assert.equal(state.routines[0].scheduleHistory.length, 2);
});
test('本地日历窗口跨月、闰日保持正确', () => {
  assert.equal(new Date(dayWindow('2028-02-29').endsAt).getDate(), 1);
  assert.equal(new Date(dayWindow('2026-12-31').endsAt).getFullYear(), 2027);

});

test('自然日窗口适应夏令时的 23 小时和 25 小时日', () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = 'America/Los_Angeles';
    const spring = dayWindow('2026-03-08'), fall = dayWindow('2026-11-01');
    assert.equal((Date.parse(spring.endsAt) - Date.parse(spring.startsAt)) / 3600000, 23);
    assert.equal((Date.parse(fall.endsAt) - Date.parse(fall.startsAt)) / 3600000, 25);
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});
