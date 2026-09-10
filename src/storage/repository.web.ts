import { applyCommand, readStoredState, type Command, type RealityState } from '../domain/reality';

export function createWebRepository(name = 'todo-rpg-v1', factory?: IDBFactory) {
  let connection: Promise<IDBDatabase> | undefined;

  function open(): Promise<IDBDatabase> {
    if (connection) return connection;
    connection = new Promise<IDBDatabase>((resolve, reject) => {
      const indexedDB = factory ?? globalThis.indexedDB;
      if (!indexedDB) { reject(new Error('当前浏览器无法使用本地数据库，请使用普通浏览窗口。')); return; }
      const request = indexedDB.open(name, 1);
      let abandoned = false;
      request.onupgradeneeded = () => request.result.createObjectStore('reality');
      request.onerror = () => reject(request.error);
      request.onblocked = () => {
        abandoned = true;
        reject(new Error('请先关闭此应用的其他旧页面，再重试。'));
      };
      request.onsuccess = () => {
        if (abandoned) { request.result.close(); return; }
        request.result.onversionchange = () => { request.result.close(); connection = undefined; };
        resolve(request.result);
      };
    }).catch(error => { connection = undefined; throw error; });
    return connection;
  }

  async function transact(command?: Command): Promise<RealityState> {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('reality', command ? 'readwrite' : 'readonly');
      const store = tx.objectStore('reality');
      const request = store.get('current');
      let result: RealityState;
      let failure: unknown;
      request.onsuccess = () => {
        try {
          const current = readStoredState(request.result);
          result = command ? applyCommand(current, command) : current;
          if (command && result !== current) store.put(result, 'current');
        } catch (error) { failure = error; tx.abort(); }
      };
      // Resolve only when the whole transaction commits, never on put success.
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(failure ?? tx.error ?? new Error('保存失败，本轮尚未提交。'));
      tx.onerror = () => { failure ??= tx.error; };
    });
  }

  return {
    load: () => transact(),
    dispatch: (command: Command) => transact(command),
    close: async () => { const db = await connection; db?.close(); connection = undefined; },
  };
}

export const repository = createWebRepository();
