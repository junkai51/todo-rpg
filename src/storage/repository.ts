import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { applyCommand, readStoredState, type Command, type RealityState } from '../domain/reality';

let connection: Promise<SQLiteDatabase> | undefined;
function open() {
  connection ??= openDatabaseAsync('todo-rpg.db').then(async db => {
    await db.execAsync('CREATE TABLE IF NOT EXISTS reality (id INTEGER PRIMARY KEY, data TEXT NOT NULL)');
    return db;
  }).catch(error => { connection = undefined; throw error; });
  return connection;
}

export const repository = {
  async load(): Promise<RealityState> {
    const db = await open();
    const row = await db.getFirstAsync<{ data: string }>('SELECT data FROM reality WHERE id = 1');
    return readStoredState(row ? JSON.parse(row.data) : undefined);
  },
  async dispatch(command: Command): Promise<RealityState> {
    const db = await open();
    let result!: RealityState;
    await db.withExclusiveTransactionAsync(async tx => {
      const row = await tx.getFirstAsync<{ data: string }>('SELECT data FROM reality WHERE id = 1');
      const current = readStoredState(row ? JSON.parse(row.data) : undefined);
      result = applyCommand(current, command);
      if (result !== current) {
        await tx.runAsync('INSERT OR REPLACE INTO reality (id, data) VALUES (1, ?)', JSON.stringify(result));
      }
    });
    return result;
  },
};
