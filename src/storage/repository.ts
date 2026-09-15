import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { applyCommand, emptyState, readStoredState, type Command, type RealityState } from '../domain/reality';

let connection: Promise<SQLiteDatabase> | undefined;
function open() {
  connection ??= openDatabaseAsync('todo-rpg.db').then(async db => {
    await db.execAsync('CREATE TABLE IF NOT EXISTS reality (id INTEGER PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS migration_backups (version INTEGER PRIMARY KEY, data TEXT NOT NULL)');
    return db;
  }).catch(error => { connection = undefined; throw error; });
  return connection;
}

async function transact(command?: Command): Promise<RealityState> {
  const db = await open();
  let result!: RealityState;
  await db.withExclusiveTransactionAsync(async tx => {
    const row = await tx.getFirstAsync<{ data: string }>('SELECT data FROM reality WHERE id = 1');
    const resetting = command?.action.type === 'reset';
    const stored = row && !resetting ? JSON.parse(row.data) : undefined;
    const current = resetting ? emptyState() : readStoredState(stored);
    result = command ? applyCommand(current, command) : current;
    const migrating = stored && stored.version !== current.version;
    if (resetting || migrating) { await tx.runAsync('DELETE FROM reality'); await tx.runAsync('DELETE FROM migration_backups'); }
    if (migrating || (command && result !== current)) {
      await tx.runAsync('INSERT OR REPLACE INTO reality (id, data) VALUES (1, ?)', JSON.stringify(result));
    }
  });
  return result;
}

export const repository = {
  load: () => transact(),
  dispatch: (command: Command) => transact(command),
};
