import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyCommand, emptyState } from '../src/domain/reality';
import { todayItems } from '../src/domain/today';
import { command, now, todoInput, routineInput } from './helpers';

test('Todo 确认前反复完成、编辑、撤销，只提交最终有效事件', () => {
  const create = command({ type: 'createTodo', input: todoInput() });
  let state = applyCommand(emptyState(), create);
  state = applyCommand(state, command({ type: 'todoStatus', id: create.id, status: 'completed' }));
  assert.equal(state.pending[0].type, 'TODO_COMPLETED');
  state = applyCommand(state, command({ type: 'editTodo', id: create.id, input: { ...todoInput(), description: '修改后的描述' } }));
  state = applyCommand(state, command({ type: 'todoStatus', id: create.id, status: 'todo' }));
  assert.equal(state.pending.length, 1);
  assert.equal(state.pending[0].type, 'TODO_UPDATED');
  state = applyCommand(state, command({ type: 'submit' }));
  assert.equal(state.turns[0].events[0].subject.description, '修改后的描述');
  assert.equal(state.todos[0].archivedAt, null);
});
test('提交后已完成和取消的 Todo 清出 Today，历史保留且不可重新打开', () => {
  for (const status of ['completed', 'cancelled'] as const) {
    const create = command({ type: 'createTodo', input: todoInput() });
    let state = applyCommand(emptyState(), create);
    state = applyCommand(state, command({ type: 'todoStatus', id: create.id, status }));
    assert.equal(todayItems(state, now).length, 1);
    state = applyCommand(state, command({ type: 'submit' }));
    assert.equal(todayItems(state, now).length, 0);
    assert.equal(state.todos.length, 1);
    assert.equal(state.turns[0].events.length, 1);
    assert.throws(() => applyCommand(state, command({ type: 'todoStatus', id: create.id, status: 'todo' })), /已确认/);
  }
});
test('未结束 Todo 可继续编辑，不改写历史；命令与提交重试不重复消费', () => {
  const create = command({ type: 'createTodo', input: todoInput() });
  let state = applyCommand(emptyState(), create);
  assert.equal(applyCommand(state, create).todos.length, 1);
  const submit = command({ type: 'submit' });
  state = applyCommand(state, submit);
  const history = JSON.stringify(state.turns);
  state = applyCommand(state, command({ type: 'editTodo', id: create.id, input: todoInput('更新') }));
  state = applyCommand(state, submit);
  assert.equal(state.pending.length, 1);
  assert.equal(JSON.stringify(state.turns), history);
});
test('校验拒绝空标题、非法日期、难度和星期，不修改状态', () => {
  const initial = emptyState();
  assert.throws(() => applyCommand(initial, command({ type: 'createTodo', input: todoInput(' ') })), /标题/);
  assert.throws(() => applyCommand(initial, command({ type: 'createTodo', input: { ...todoInput(), dueAt: '2026-02-29' } })), /日期/);
  assert.throws(() => applyCommand(initial, command({ type: 'createTodo', input: { ...todoInput(), difficulty: 5 as 4 } })), /难度/);
  assert.throws(() => applyCommand(initial, command({ type: 'createRoutine', input: { ...routineInput(), schedule: { version: 1, calendar: 'local', startDate: '2026-09-15', frequency: 'weekly', weekdays: [] } } })), /星期/);
  assert.deepEqual(initial, emptyState());
});
test('Todo 和 Routine 统一展示与排序，但各自持久化，排序不产生现实事件', () => {
  const a = command({ type: 'createTodo', input: todoInput('A') });
  const b = command({ type: 'createRoutine', input: routineInput('B') });
  let state = applyCommand(applyCommand(emptyState(), a), b);
  assert.deepEqual(todayItems(state, now).map(x => x.subject.title), ['B', 'A']);
  const pending = JSON.stringify(state.pending);
  state = applyCommand(state, command({ type: 'move', id: a.id, direction: 'up' }));
  assert.deepEqual(todayItems(state, now).map(x => x.subject.title), ['A', 'B']);
  assert.equal(JSON.stringify(state.pending), pending);
  state = applyCommand(state, command({ type: 'todoStatus', id: a.id, status: 'completed' }));
  assert.deepEqual(todayItems(state, now).map(x => x.subject.title), ['B', 'A']);
});
