/// <reference types="vite/client" />

import type { FeedPayload, MoveDelta, WorkPayload } from './domain/pet';

declare global {
  interface Window {
    desktopPet: {
      showContextMenu: () => void;
      moveBy: (delta: MoveDelta) => void;
      getAlwaysOnTop: () => Promise<boolean>;
      onAlwaysOnTopChanged: (callback: (value: boolean) => void) => () => void;
      onFeed: (callback: (data: FeedPayload) => void) => () => void;
      onStartWork: (callback: (data: WorkPayload) => void) => () => void;
    };
  }
}
