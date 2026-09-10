import assert from 'node:assert/strict';
import { test } from 'node:test';
import { IDBFactory } from 'fake-indexeddb';
import { createWebRepository } from '../src/storage/repository.web';
import type { Action, Command } from '../src/domain/reality';

let sequence = 0;
const command = (action: Action): Command => ({ id: `cmd-${++sequence}`, at: '2026-09-10T12:00:00Z', action });

test('重开数据库仍能读到待提交记录和提交后的轮次', async () => {
  const factory = new IDBFactory();
  const first = createWebRepository('persistence', factory);
  const create = command({ type: 'create', title: '跑步', note: '晚饭后' });
  await first.dispatch(create);
  await first.dispatch(command({ type: 'status', taskId: create.id, status: 'completed' }));
  await first.close();
  const second = createWebRepository('persistence', factory);
  assert.equal((await second.load()).pending[0].status, 'completed');
  await second.dispatch(command({ type: 'submit' }));
  await second.close();
  const third = createWebRepository('persistence', factory);
  const stored = await third.load();
  assert.equal(stored.pending.length, 0);
  assert.equal(stored.turns.length, 1);
  assert.equal(stored.turns[0].records[0].note, '晚饭后');
  await third.close();
});

test('两个页面同时提交，同一份现实记录只进入一个轮次', async () => {
  const factory = new IDBFactory();
  const first = createWebRepository('concurrent', factory);
  const second = createWebRepository('concurrent', factory);
  await first.dispatch(command({ type: 'create', title: '写作', note: '' }));
  await Promise.all([
    first.dispatch(command({ type: 'submit' })),
    second.dispatch(command({ type: 'submit' })),
  ]);
  const saved = await second.load();
  assert.equal(saved.turns.length, 1);
  assert.equal(saved.pending.length, 0);
  assert.equal(saved.turns[0].records.length, 1);
  await first.close(); await second.close();
});

test('失败的修改事务不污染已经保存的任务或待提交记录', async () => {
  const repo = createWebRepository('rollback', new IDBFactory());
  const create = command({ type: 'create', title: '保留这条记录', note: '' });
  const before = await repo.dispatch(create);
  await assert.rejects(repo.dispatch(command({ type: 'edit', taskId: create.id, title: ' ', note: '不应保存' })), /标题/);
  assert.deepEqual(await repo.load(), before);
  await repo.close();
});
