import assert from 'node:assert/strict';
import { test } from 'node:test';
import { IDBFactory } from 'fake-indexeddb';
import { emptyState, readStoredState } from '../src/domain/reality';
import { createWebRepository } from '../src/storage/repository.web';
import { command, todoInput } from './helpers';

test('本次重构按用户授权清空旧格式，当前格式重复读取不会清空', () => {
  for (const version of [1, 2, 3]) assert.deepEqual(readStoredState({ version, tasks: ['旧数据'], turns: ['旧历史'] }), emptyState());
  assert.throws(() => readStoredState({ version: 99 }), /格式/);
  const current = { ...emptyState(), pending: [] };
  assert.equal(readStoredState(current), current);
});

test('首次加载旧数据与备份原子清空，之后新记录跨刷新和重开保留', async () => {
  for (const version of [1, 2, 3]) {
    const factory = new IDBFactory();
    const db = await new Promise<IDBDatabase>(resolve => { const r = factory.open('upgrade', 1); r.onupgradeneeded = () => r.result.createObjectStore('reality'); r.onsuccess = () => resolve(r.result); });
    await new Promise<void>(resolve => { const tx = db.transaction('reality', 'readwrite'); const store = tx.objectStore('reality');
      store.put({ version, tasks: ['旧任务'], pending: ['旧事件'], turns: ['旧轮次'] }, 'current'); store.put({ private: '旧备份' }, 'migration-backup-v1'); tx.oncomplete = () => resolve(); });
    const repo = createWebRepository('upgrade', factory);
    assert.deepEqual(await repo.load(), emptyState());
    const keys = await new Promise<IDBValidKey[]>(resolve => { const r = db.transaction('reality').objectStore('reality').getAllKeys(); r.onsuccess = () => resolve(r.result); });
    assert.deepEqual(keys, ['current']);
    await repo.dispatch(command({ type: 'createTodo', input: todoInput('新版记录') }));
    await repo.close();
    const reopened = createWebRepository('upgrade', factory);
    assert.equal((await reopened.load()).todos[0].title, '新版记录');
    assert.equal((await reopened.load()).version, 4);
    await reopened.close(); db.close();
  }
});

test('无法读取的数据仍可显式清空，清空不依赖旧格式解析成功', async () => {
  const factory = new IDBFactory();
  const db = await new Promise<IDBDatabase>(resolve => { const r = factory.open('corrupt', 1); r.onupgradeneeded = () => r.result.createObjectStore('reality'); r.onsuccess = () => resolve(r.result); });
  await new Promise<void>(resolve => { const tx = db.transaction('reality', 'readwrite'); tx.objectStore('reality').put({ version: 99 }, 'current'); tx.oncomplete = () => resolve(); });
  const repo = createWebRepository('corrupt', factory);
  await assert.rejects(repo.load(), /格式/);
  assert.deepEqual(await repo.dispatch(command({ type: 'reset' })), emptyState());
  assert.deepEqual(await repo.load(), emptyState());
  await repo.close(); db.close();
});
