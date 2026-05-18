/// <reference types="vite/client" />

import type { FeedPayload, MoveDelta, PointLedgerEntry, PointLedgerWrite, WorkPayload } from './domain/pet';

declare global {
  interface Window {
    desktopPet: {
      showContextMenu: () => void;
      moveBy: (delta: MoveDelta) => void;
      setWorkRunning: (value: boolean) => void;
      getStorageSnapshot: () => Promise<Record<string, string>>;
      setStorageValue: (key: string, value: string) => Promise<void>;
      removeStorageValue: (key: string) => Promise<void>;
      getDatabaseInfo: () => Promise<{ path: string; schemaVersion: string }>;
      appendPointLedgerEntry: (entry: PointLedgerWrite) => Promise<void>;
      getPointLedgerEntries: (limit?: number) => Promise<PointLedgerEntry[]>;
      onStorageSnapshotChanged: (callback: (snapshot: Record<string, string>) => void) => () => void;
      getAlwaysOnTop: () => Promise<boolean>;
      onAlwaysOnTopChanged: (callback: (value: boolean) => void) => () => void;
      onFeed: (callback: (data: FeedPayload) => void) => () => void;
      onInterruptWork: (callback: () => void) => () => void;
      onStartWork: (callback: (data: WorkPayload) => void) => () => void;
    };
  }
}

export {};
