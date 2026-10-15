// The on-device database. Sessions are stored whole (as the backup format has them) so nothing is lost
// moving data between the web app and this one; bodyweight has its own table; everything else is key-value.

/** The part of expo-sqlite's database the app uses (tests run it on Node's built-in SQLite) */
export interface Db {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: (string | number | null)[]): Promise<unknown>;
  getAllAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

/** Each entry upgrades the database by one version; never edit one that has shipped, add a new one. */
const MIGRATIONS = [
  `CREATE TABLE sessions (id INTEGER PRIMARY KEY NOT NULL, date_str TEXT NOT NULL, data TEXT NOT NULL);
   CREATE INDEX sessions_date ON sessions (date_str);
   CREATE TABLE bodyweight (date_str TEXT PRIMARY KEY NOT NULL, kg REAL NOT NULL);
   CREATE TABLE kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);`
];

export async function migrate(db: Db): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const from = row?.user_version ?? 0;
  for (let v = from; v < MIGRATIONS.length; v++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[v]);
      await db.execAsync(`PRAGMA user_version = ${v + 1}`);
    });
  }
}
