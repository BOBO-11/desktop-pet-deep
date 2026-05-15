/// <reference types="vite/client" />

interface Window {
  desktopPet: {
    showContextMenu: () => void;
    moveBy: (delta: { x: number; y: number }) => void;
    getAlwaysOnTop: () => Promise<boolean>;
    onAlwaysOnTopChanged: (callback: (value: boolean) => void) => () => void;
    onFeed: (callback: (data: { hungerRestore: number; cost: number }) => void) => () => void;
    onStartWork: (callback: (data: { duration: number; reward: number }) => void) => () => void;
  };
}
