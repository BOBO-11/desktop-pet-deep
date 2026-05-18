import type { PointLedgerWrite } from '../domain/pet';

type StorageSnapshot = Record<string, string>;
type StorageChangeListener = () => void;

let storageSnapshot: StorageSnapshot = {};
let isStorageHydrated = false;
let hydratedKeys = new Set<string>();
let removeStorageSnapshotListener: (() => void) | null = null;
let storageWriteQueue: Promise<void> = Promise.resolve();
const storageChangeListeners = new Set<StorageChangeListener>();

function getDatabaseApi() {
  return typeof window !== 'undefined' ? window.desktopPet : undefined;
}

function enqueueStorageWrite(
  write: (api: NonNullable<ReturnType<typeof getDatabaseApi>>) => Promise<void>
) {
  const api = getDatabaseApi();
  if (!api) {
    return;
  }

  storageWriteQueue = storageWriteQueue
    .catch(() => undefined)
    .then(() => write(api))
    .catch(() => undefined);
}

function persistValueToDatabase(key: string, value: string) {
  enqueueStorageWrite((api) => api.setStorageValue(key, value));
}

function removeValueFromDatabase(key: string) {
  enqueueStorageWrite((api) => api.removeStorageValue(key));
}

export function recordPointLedgerEntry(entry: PointLedgerWrite): void {
  enqueueStorageWrite((api) => api.appendPointLedgerEntry(entry));
}

function filterStorageSnapshot(snapshot: StorageSnapshot, keys: Set<string>) {
  const shouldFilter = keys.size > 0;
  return Object.entries(snapshot).reduce<StorageSnapshot>((nextSnapshot, [key, value]) => {
    if (typeof value === 'string' && (!shouldFilter || keys.has(key))) {
      nextSnapshot[key] = value;
    }

    return nextSnapshot;
  }, {});
}

function areSnapshotsEqual(left: StorageSnapshot, right: StorageSnapshot) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  return leftKeys.length === rightKeys.length && leftKeys.every((key) => left[key] === right[key]);
}

function notifyStorageChangeListeners() {
  storageChangeListeners.forEach((listener) => listener());
}

function applyStorageSnapshot(snapshot: StorageSnapshot) {
  const nextSnapshot = filterStorageSnapshot(snapshot, hydratedKeys);
  if (areSnapshotsEqual(storageSnapshot, nextSnapshot)) {
    return false;
  }

  storageSnapshot = nextSnapshot;
  return true;
}

function ensureStorageSnapshotListener() {
  const api = getDatabaseApi();
  if (!api || removeStorageSnapshotListener) {
    return;
  }

  removeStorageSnapshotListener = api.onStorageSnapshotChanged((snapshot) => {
    if (applyStorageSnapshot(snapshot)) {
      notifyStorageChangeListeners();
    }
  });
}

export function readJson<T>(key: string, fallback: T, isValid: (value: unknown) => value is T): T {
  try {
    const raw = storageSnapshot[key];
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as unknown;
    return isValid(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    const serialized = JSON.stringify(value);
    if (typeof serialized !== 'string') {
      return;
    }

    storageSnapshot = { ...storageSnapshot, [key]: serialized };
    persistValueToDatabase(key, serialized);
  } catch {
    // Database unavailable
  }
}

export function readNumber(key: string, fallback: number): number {
  try {
    const saved = storageSnapshot[key];
    if (saved === undefined) {
      return fallback;
    }

    const value = Number.parseInt(saved, 10);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  } catch {
    return fallback;
  }
}

export function writeNumber(key: string, value: number): void {
  try {
    const serialized = String(value);
    storageSnapshot = { ...storageSnapshot, [key]: serialized };
    persistValueToDatabase(key, serialized);
  } catch {
    // Database unavailable
  }
}

export function removeStoredValue(key: string): void {
  try {
    const nextSnapshot = { ...storageSnapshot };
    delete nextSnapshot[key];
    storageSnapshot = nextSnapshot;
    removeValueFromDatabase(key);
  } catch {
    // Database unavailable
  }
}

export async function hydrateStorageFromDatabase(keys: readonly string[]) {
  const api = getDatabaseApi();
  if (!api) {
    return null;
  }

  try {
    hydratedKeys = new Set(keys);
    ensureStorageSnapshotListener();

    const databaseValues = await api.getStorageSnapshot();
    applyStorageSnapshot(databaseValues);
    isStorageHydrated = true;
    return api.getDatabaseInfo();
  } catch {
    return null;
  }
}

export function isStorageReady() {
  return isStorageHydrated;
}

export function subscribeStorageChanges(listener: StorageChangeListener) {
  storageChangeListeners.add(listener);

  return () => {
    storageChangeListeners.delete(listener);
  };
}
