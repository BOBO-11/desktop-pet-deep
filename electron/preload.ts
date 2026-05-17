import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('desktopPet', {
  showContextMenu: () => ipcRenderer.send('window:show-context-menu'),
  moveBy: (delta: { x: number; y: number }) => ipcRenderer.send('window:move-by', delta),
  setWorkRunning: (value: boolean) => ipcRenderer.send('pet:set-work-running', value),
  getAlwaysOnTop: () => ipcRenderer.invoke('window:get-always-on-top') as Promise<boolean>,
  onAlwaysOnTopChanged: (callback: (value: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, value: boolean) => callback(value);
    ipcRenderer.on('window:always-on-top-changed', listener);

    return () => ipcRenderer.removeListener('window:always-on-top-changed', listener);
  },
  onFeed: (callback: (data: { hungerRestore: number; cost: number }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { hungerRestore: number; cost: number }) => callback(data);
    ipcRenderer.on('pet:feed', listener);

    return () => ipcRenderer.removeListener('pet:feed', listener);
  },
  onInterruptWork: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('pet:interrupt-work', listener);

    return () => ipcRenderer.removeListener('pet:interrupt-work', listener);
  },
  onStartWork: (callback: (data: { duration: number; reward: number }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { duration: number; reward: number }) => callback(data);
    ipcRenderer.on('pet:start-work', listener);

    return () => ipcRenderer.removeListener('pet:start-work', listener);
  }
});
