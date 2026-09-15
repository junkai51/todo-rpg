import assert from 'node:assert/strict';
import { test } from 'node:test';
import { IDBFactory } from 'fake-indexeddb';
import { createWebRepository } from '../src/storage/repository.web';
import type { Action, Command } from '../src/domain/reality';
import { todoInput } from './helpers';

let sequence = 0;
const command = (action: Action): Command => ({ id: `cmd-${++sequence}`, at: '2026-09-10T12:00:00Z', action });

test('重开数据库仍能读到待提交记录和提交后的轮次', async () => {
  const factory = new IDBFactory();
  const first = createWebRepository('persistence', factory);
  const create = command({ type: 'createTodo', input: { ...todoInput('跑步'), description: '晚饭后' } });
  await first.dispatch(create);
  await first.dispatch(command({ type: 'todoStatus', id: create.id, status: 'completed' }));
  await first.close();
  const second = createWebRepository('persistence', factory);
  assert.equal((await second.load()).pending[0].type, 'TODO_COMPLETED');
  await second.dispatch(command({ type: 'submit' }));
  await second.close();
  const third = createWebRepository('persistence', factory);
  const stored = await third.load();
  assert.equal(stored.pending.length, 0);
  assert.equal(stored.turns.length, 1);
  assert.equal(stored.turns[0].events[0].subject.description, '晚饭后');
  await third.close();
});

test('两个页面同时提交，同一份现实记录只进入一个轮次', async () => {
  const factory = new IDBFactory();
  const first = createWebRepository('concurrent', factory);
  const second = createWebRepository('concurrent', factory);
  await first.dispatch(command({ type: 'createTodo', input: todoInput('写作') }));
  await Promise.all([
    first.dispatch(command({ type: 'submit' })),
    second.dispatch(command({ type: 'submit' })),
  ]);
  const saved = await second.load();
  assert.equal(saved.turns.length, 1);
  assert.equal(saved.pending.length, 0);
  assert.equal(saved.turns[0].events.length, 1);
  await first.close(); await second.close();
});

test('失败的修改事务不污染已经保存的任务或待提交记录', async () => {
  const repo = createWebRepository('rollback', new IDBFactory());
  const create = command({ type: 'createTodo', input: todoInput('保留这条记录') });
  const before = await repo.dispatch(create);
  await assert.rejects(repo.dispatch(command({ type: 'editTodo', id: create.id, input: todoInput(' ') })), /标题/);
  assert.deepEqual(await repo.load(), before);
  await repo.close();
});

test('并发完成同一 Routine 窗口只保存一次；并发提交后不出现下一次', async () => {
  const { routineInput, now } = await import('./helpers');
  const { currentOccurrence, todayItems } = await import('../src/domain/today');
  const factory = new IDBFactory();
  const a = createWebRepository('routine-concurrent', factory), b = createWebRepository('routine-concurrent', factory);
  const create: Command = { id: 'routine', at: now, action: { type: 'createRoutine', input: routineInput() } };
  const state = await a.dispatch(create);
  const occurrenceId = currentOccurrence(state.routines[0], now)!.id;
  const complete = (id: string): Command => ({ id, at: now, action: { type: 'completeRoutine', id: create.id, occurrenceId } });
  await Promise.all([a.dispatch(complete('complete-a')), b.dispatch(complete('complete-b'))]);
  assert.equal((await a.load()).pending.filter(e => e.type === 'ROUTINE_COMPLETED').length, 1);
  await Promise.all([a.dispatch({ id: 'submit-a', at: now, action: { type: 'submit' } }), b.dispatch({ id: 'submit-b', at: now, action: { type: 'submit' } })]);
  assert.equal((await a.load()).turns.length, 1);
  assert.equal(todayItems(await a.load(), now).length, 0);
  await a.close(); await b.close();
});

test('清空原子删除所有领域记录和迁移备份，重开仍为空且可重新使用', async () => {
  const { emptyState } = await import('../src/domain/reality');
  const factory = new IDBFactory();
  const repo = createWebRepository('reset', factory);
  await repo.dispatch(command({ type: 'createTodo', input: todoInput() }));
  await repo.dispatch(command({ type: 'submit' }));
  const db = await new Promise<IDBDatabase>(resolve => { const request = factory.open('reset', 1); request.onsuccess = () => resolve(request.result); });
  await new Promise<void>(resolve => { const tx = db.transaction('reality', 'readwrite'); tx.objectStore('reality').put({ private: 'legacy' }, 'migration-backup-v2'); tx.oncomplete = () => resolve(); });
  assert.deepEqual(await repo.dispatch(command({ type: 'reset' })), emptyState());
  await repo.close();
  const again = createWebRepository('reset', factory);
  assert.deepEqual(await again.load(), emptyState());
  const keys = await new Promise<IDBValidKey[]>(resolve => { const request = db.transaction('reality').objectStore('reality').getAllKeys(); request.onsuccess = () => resolve(request.result); });
  assert.deepEqual(keys, ['current']);
  assert.equal((await again.dispatch(command({ type: 'createTodo', input: todoInput('重新使用') }))).todos.length, 1);
  await again.close(); db.close();
});
