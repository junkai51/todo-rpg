import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyCommand, emptyState, type Action, type Command } from '../src/domain/reality';

let sequence = 0;
const command = (action: Action): Command => ({ id: `op-${++sequence}`, at: '2026-09-10T12:00:00Z', action });

test('确认前反复完成和修改，只提交最终有效状态', () => {
  const create = command({ type: 'create', title: '  读论文  ', note: '' });
  let state = applyCommand(emptyState(), create);
  state = applyCommand(state, command({ type: 'status', taskId: create.id, status: 'completed' }));
  state = applyCommand(state, command({ type: 'edit', taskId: create.id, title: '读论文', note: '今天先读摘要' }));
  state = applyCommand(state, command({ type: 'status', taskId: create.id, status: 'todo' }));
  assert.equal(state.pending.length, 1);
  assert.equal(state.pending[0].completedAt, null);
  state = applyCommand(state, command({ type: 'submit' }));
  assert.equal(state.turns[0].records[0].status, 'todo');
  assert.equal(state.turns[0].records[0].note, '今天先读摘要');
  assert.equal(state.tasks[0].closed, false);
});

test('提交快照不随后续修改改变，未完成事项可进入下一轮', () => {
  const create = command({ type: 'create', title: '阅读', note: '旧备注' });
  let state = applyCommand(emptyState(), create);
  state = applyCommand(state, command({ type: 'submit' }));
  const oldTurn = JSON.stringify(state.turns[0]);
  state = applyCommand(state, command({ type: 'edit', taskId: create.id, title: '阅读新材料', note: '新备注' }));
  assert.equal(JSON.stringify(state.turns[0]), oldTurn);
  assert.equal(state.pending[0].title, '阅读新材料');
});

test('重复提交和延迟重试都不能再次消费记录', () => {
  let state = applyCommand(emptyState(), command({ type: 'create', title: '第一件事', note: '' }));
  const submit = command({ type: 'submit' });
  state = applyCommand(state, submit);
  state = applyCommand(state, command({ type: 'submit' }));
  assert.equal(state.turns.length, 1);
  state = applyCommand(state, command({ type: 'create', title: '下一轮的事', note: '' }));
  state = applyCommand(state, submit);
  assert.equal(state.turns.length, 1);
  assert.equal(state.pending.length, 1);
});

test('已提交的完成或取消记录不能再次打开', () => {
  for (const status of ['completed', 'cancelled'] as const) {
    const create = command({ type: 'create', title: '事项', note: '' });
    let state = applyCommand(emptyState(), create);
    state = applyCommand(state, command({ type: 'status', taskId: create.id, status }));
    state = applyCommand(state, command({ type: 'submit' }));
    assert.throws(() => applyCommand(state, command({ type: 'status', taskId: create.id, status: 'todo' })), /已提交/);
    assert.equal(state.turns[0].records[0].status, status);
  }
});

test('无效输入不会改变原状态；重放同一新增命令不重复创建', () => {
  const initial = emptyState();
  assert.throws(() => applyCommand(initial, command({ type: 'create', title: '   ', note: '' })), /标题/);
  assert.deepEqual(initial, emptyState());
  const create = command({ type: 'create', title: '有效事项', note: '' });
  const state = applyCommand(initial, create);
  assert.equal(applyCommand(state, create).tasks.length, 1);
});
