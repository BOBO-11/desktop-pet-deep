import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import initSqlJs = require('sql.js');
import type { Database, SqlJsStatic, SqlValue } from 'sql.js';

type StorageSnapshot = Record<string, string>;

export type PointLedgerType = 'earn' | 'spend';

export type PointLedgerWrite = {
  timestamp: number;
  type: PointLedgerType;
  source: string;
  amount: number;
  balanceAfter: number | null;
  note?: string | null;
};

export type PointLedgerEntry = PointLedgerWrite & {
  id: number;
};

type PetDatabase = {
  database: Database;
  filePath: string;
};

type DatabaseFileSignature = {
  mtimeMs: number;
  size: number;
};

const ALLOWED_STORAGE_KEYS = new Set([
  'pet-hunger',
  'pet-points',
  'pet-daily',
  'pet-daily-work',
  'pet-work',
  'pet-spend-history'
]);

const SCHEMA_VERSION = '2';
const LEGACY_SPEND_IMPORT_META_KEY = 'legacy_spend_history_imported';

let databasePromise: Promise<PetDatabase> | null = null;
let sqlModulePromise: Promise<SqlJsStatic> | null = null;
let lastFileSignature: DatabaseFileSignature | null = null;

function resolveSqlWasmPath(file: string) {
  const candidates = [
    path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file),
    path.join(app.getAppPath(), 'node_modules', 'sql.js', 'dist', file),
    path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file)
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
}

function getDatabasePath() {
  return path.join(app.getPath('userData'), 'pet.sqlite');
}

function getSqlModule() {
  sqlModulePromise ??= initSqlJs({
    locateFile: resolveSqlWasmPath
  });
  return sqlModulePromise;
}

function readFileSignature(filePath: string): DatabaseFileSignature | null {
  try {
    const stat = fs.statSync(filePath);
    return {
      mtimeMs: stat.mtimeMs,
      size: stat.size
    };
  } catch {
    return null;
  }
}

function isSameFileSignature(
  left: DatabaseFileSignature | null,
  right: DatabaseFileSignature | null
) {
  return left?.mtimeMs === right?.mtimeMs && left?.size === right?.size;
}

function hasTable(database: Database, tableName: string) {
  const result = database.exec(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?;`,
    [tableName]
  );

  return Boolean(result[0]?.values[0]?.[0]);
}

function getMetaValue(database: Database, key: string) {
  const result = database.exec('SELECT value FROM app_meta WHERE key = ?;', [key]);
  const value = result[0]?.values[0]?.[0];
  return typeof value === 'string' ? value : null;
}

function setMetaValue(database: Database, key: string, value: string) {
  database.run(
    `
      INSERT INTO app_meta (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value;
    `,
    [key, value]
  );
}

function isLegacySpendRecord(value: unknown): value is { timestamp: number; amount: number; category: string } {
  return Boolean(
    value &&
      typeof value === 'object' &&
      Number.isFinite((value as { timestamp?: unknown }).timestamp) &&
      Number.isFinite((value as { amount?: unknown }).amount) &&
      typeof (value as { category?: unknown }).category === 'string'
  );
}

function importLegacySpendHistory(database: Database) {
  if (getMetaValue(database, LEGACY_SPEND_IMPORT_META_KEY) === '1') {
    return false;
  }

  const raw = database.exec('SELECT value FROM kv_store WHERE key = ?;', ['pet-spend-history'])[0]
    ?.values[0]?.[0];

  if (typeof raw === 'string') {
    try {
      const records = JSON.parse(raw) as unknown;
      if (Array.isArray(records)) {
        records.filter(isLegacySpendRecord).forEach((record) => {
          database.run(
            `
              INSERT INTO point_ledger (timestamp, type, source, amount, balance_after, note)
              VALUES (?, 'spend', 'legacy-feed', ?, NULL, ?);
            `,
            [record.timestamp, Math.max(0, Math.floor(record.amount)), record.category]
          );
        });
      }
    } catch {
      // Invalid legacy history should not block the database from opening.
    }
  }

  setMetaValue(database, LEGACY_SPEND_IMPORT_META_KEY, '1');
  return true;
}

function migrate(database: Database) {
  const hadPointLedgerTable = hasTable(database, 'point_ledger');

  database.run(`
    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS point_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('earn', 'spend')),
      source TEXT NOT NULL,
      amount INTEGER NOT NULL,
      balance_after INTEGER,
      note TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_point_ledger_time
      ON point_ledger (timestamp DESC, id DESC);
  `);

  const previousSchemaVersion = getMetaValue(database, 'schema_version');
  const legacyImportChanged = importLegacySpendHistory(database);

  if (previousSchemaVersion !== SCHEMA_VERSION) {
    setMetaValue(database, 'schema_version', SCHEMA_VERSION);
  }

  return !hadPointLedgerTable || legacyImportChanged || previousSchemaVersion !== SCHEMA_VERSION;
}

async function openDatabase(): Promise<PetDatabase> {
  const SQL = await getSqlModule();
  const filePath = getDatabasePath();
  const fileExists = fs.existsSync(filePath);
  const database = fileExists ? new SQL.Database(fs.readFileSync(filePath)) : new SQL.Database();

  const migrated = migrate(database);

  if (!fileExists || migrated) {
    persistDatabase(database, filePath);
  }

  lastFileSignature = readFileSignature(filePath);
  return { database, filePath };
}

function getDatabase() {
  databasePromise ??= openDatabase();
  return databasePromise;
}

function persistDatabase(database: Database, filePath: string) {
  const directory = path.dirname(filePath);
  const temporaryPath = `${filePath}.tmp`;
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(temporaryPath, Buffer.from(database.export()));
  fs.renameSync(temporaryPath, filePath);
  lastFileSignature = readFileSignature(filePath);
}

function scalarToString(value: SqlValue | undefined) {
  return typeof value === 'string' ? value : null;
}

function isSqlNumber(value: SqlValue): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isAllowedStorageKey(key: string) {
  return ALLOWED_STORAGE_KEYS.has(key);
}

function isPointLedgerType(value: unknown): value is PointLedgerType {
  return value === 'earn' || value === 'spend';
}

function normalizePointLedgerEntry(entry: PointLedgerWrite): PointLedgerWrite | null {
  if (
    !entry ||
    typeof entry !== 'object' ||
    !Number.isFinite(entry.timestamp) ||
    !isPointLedgerType(entry.type) ||
    typeof entry.source !== 'string' ||
    !Number.isFinite(entry.amount)
  ) {
    return null;
  }

  const timestamp = Math.floor(entry.timestamp);
  const amount = Math.floor(entry.amount);
  const balanceAfter = entry.balanceAfter === null ? null : Math.floor(entry.balanceAfter);
  const source = entry.source.trim().slice(0, 80);
  const note = typeof entry.note === 'string' ? entry.note.trim().slice(0, 160) : null;

  if (
    timestamp <= 0 ||
    amount <= 0 ||
    !source ||
    (balanceAfter !== null && (!Number.isFinite(balanceAfter) || balanceAfter < 0))
  ) {
    return null;
  }

  return {
    timestamp,
    type: entry.type,
    source,
    amount,
    balanceAfter,
    note
  };
}

export async function getStorageSnapshot(): Promise<StorageSnapshot> {
  const { database } = await getDatabase();
  const result = database.exec('SELECT key, value FROM kv_store ORDER BY key;');
  const rows = result[0]?.values ?? [];
  const snapshot: StorageSnapshot = {};

  rows.forEach(([key, value]) => {
    if (typeof key === 'string' && typeof value === 'string' && isAllowedStorageKey(key)) {
      snapshot[key] = value;
    }
  });

  return snapshot;
}

export async function reloadStorageFromDiskIfChanged(): Promise<StorageSnapshot | null> {
  const state = await getDatabase();
  const currentSignature = readFileSignature(state.filePath);

  if (isSameFileSignature(lastFileSignature, currentSignature)) {
    return null;
  }

  const SQL = await getSqlModule();
  const nextDatabase = currentSignature
    ? new SQL.Database(fs.readFileSync(state.filePath))
    : new SQL.Database();

  const migrated = migrate(nextDatabase);

  if (!currentSignature || migrated) {
    persistDatabase(nextDatabase, state.filePath);
  } else {
    lastFileSignature = readFileSignature(state.filePath);
  }

  state.database.close();
  state.database = nextDatabase;

  return getStorageSnapshot();
}

export function startStorageChangePolling(
  onSnapshotChanged: (snapshot: StorageSnapshot) => void,
  intervalMs = 1000
) {
  const interval = setInterval(() => {
    void reloadStorageFromDiskIfChanged()
      .then((snapshot) => {
        if (snapshot) {
          onSnapshotChanged(snapshot);
        }
      })
      .catch(() => undefined);
  }, intervalMs);

  interval.unref?.();

  return () => clearInterval(interval);
}

export async function setStorageValue(key: string, value: string) {
  if (!isAllowedStorageKey(key)) {
    return;
  }

  const { database, filePath } = await getDatabase();
  database.run(
    `
      INSERT INTO kv_store (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at;
    `,
    [key, value, Date.now()]
  );
  persistDatabase(database, filePath);
}

export async function removeStorageValue(key: string) {
  if (!isAllowedStorageKey(key)) {
    return;
  }

  const { database, filePath } = await getDatabase();
  database.run('DELETE FROM kv_store WHERE key = ?;', [key]);
  persistDatabase(database, filePath);
}

export async function appendPointLedgerEntry(entry: PointLedgerWrite) {
  const normalized = normalizePointLedgerEntry(entry);
  if (!normalized) {
    return;
  }

  const { database, filePath } = await getDatabase();
  database.run(
    `
      INSERT INTO point_ledger (timestamp, type, source, amount, balance_after, note)
      VALUES (?, ?, ?, ?, ?, ?);
    `,
    [
      normalized.timestamp,
      normalized.type,
      normalized.source,
      normalized.amount,
      normalized.balanceAfter,
      normalized.note ?? null
    ]
  );
  persistDatabase(database, filePath);
}

export async function getPointLedgerEntries(limit = 200): Promise<PointLedgerEntry[]> {
  const safeLimit = Math.max(1, Math.min(1000, Math.floor(limit)));
  const { database } = await getDatabase();
  const rows = database.exec(
    `
      SELECT id, timestamp, type, source, amount, balance_after, note
      FROM point_ledger
      ORDER BY timestamp DESC, id DESC
      LIMIT ?;
    `,
    [safeLimit]
  )[0]?.values ?? [];

  return rows.flatMap((row): PointLedgerEntry[] => {
    const [id, timestamp, type, source, amount, balanceAfter, note] = row;

    if (
      !isSqlNumber(id) ||
      !isSqlNumber(timestamp) ||
      !isPointLedgerType(type) ||
      typeof source !== 'string' ||
      !isSqlNumber(amount)
    ) {
      return [];
    }

    return [{
      id: Math.floor(id),
      timestamp: Math.floor(timestamp),
      type,
      source,
      amount: Math.floor(amount),
      balanceAfter: isSqlNumber(balanceAfter) ? Math.floor(balanceAfter) : null,
      note: typeof note === 'string' ? note : null
    }];
  });
}

export async function getDatabaseInfo() {
  const { database, filePath } = await getDatabase();
  const schemaVersion = database
    .exec(`SELECT value FROM app_meta WHERE key = 'schema_version';`)[0]
    ?.values[0]?.[0];

  return {
    path: filePath,
    schemaVersion: scalarToString(schemaVersion) ?? 'unknown'
  };
}
