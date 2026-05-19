import { app, BrowserWindow, Menu, ipcMain, screen, type MenuItemConstructorOptions } from 'electron';
import path from 'node:path';
import { FEED_MENU_ITEMS, INTERRUPT_WORK_MENU_ITEM, WORK_MENU_ITEMS } from './menuConfig';
import {
  appendPointLedgerEntry,
  getDatabaseInfo,
  getPointLedgerEntries,
  getStorageSnapshot,
  removeStorageValue,
  setStorageValue,
  startStorageChangePolling,
  type PointLedgerWrite
} from './petDatabase';

app.disableHardwareAcceleration();

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.exit(0);
}

let mainWindow: BrowserWindow | null = null;
let isPetWorking = false;
let stopStorageChangePolling: (() => void) | null = null;

const isDevelopment = process.env.NODE_ENV === 'development';
const MAX_MOVE_DELTA = 100;
const WINDOW_SIZE = 240;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function isPointLedgerWrite(value: unknown): value is PointLedgerWrite {
  const entry = value as PointLedgerWrite;

  return Boolean(
    value &&
      typeof value === 'object' &&
      Number.isFinite(entry.timestamp) &&
      entry.timestamp > 0 &&
      (entry.type === 'earn' || entry.type === 'spend') &&
      typeof entry.source === 'string' &&
      entry.source.trim().length > 0 &&
      Number.isFinite(entry.amount) &&
      entry.amount > 0 &&
      (
        entry.balanceAfter === null ||
        (Number.isFinite(entry.balanceAfter) && entry.balanceAfter >= 0)
      )
  );
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: WINDOW_SIZE,
    height: WINDOW_SIZE,
    frame: false,
    transparent: true,
    resizable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.setAlwaysOnTop(true, 'floating');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  if (isDevelopment) {
    void mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('second-instance', () => {
  if (!mainWindow) {
    createWindow();
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
});

app.whenReady().then(() => {
  if (!gotSingleInstanceLock) {
    app.exit(0);
    return;
  }

  createWindow();
  stopStorageChangePolling?.();
  stopStorageChangePolling = startStorageChangePolling((snapshot) => {
    mainWindow?.webContents.send('storage:snapshot-changed', snapshot);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  stopStorageChangePolling?.();
  stopStorageChangePolling = null;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('window:get-always-on-top', () => {
  return mainWindow?.isAlwaysOnTop() ?? false;
});

ipcMain.on('window:show-context-menu', () => {
  if (!mainWindow) {
    return;
  }

  const isAlwaysOnTop = mainWindow.isAlwaysOnTop();
  const workSubmenu: MenuItemConstructorOptions[] = isPetWorking
    ? [
        { label: '正在打工中', enabled: false },
        { type: 'separator' },
        {
          label: INTERRUPT_WORK_MENU_ITEM.label,
          click: () => {
            mainWindow?.webContents.send('pet:interrupt-work');
          }
        }
      ]
    : WORK_MENU_ITEMS.map((item) => ({
        label: item.label,
        click: () => {
          mainWindow?.webContents.send('pet:start-work', { duration: item.duration, reward: item.reward });
        }
      }));

  const menu = Menu.buildFromTemplate([
    {
      label: '打工',
      submenu: workSubmenu
    },
    { type: 'separator' },
    {
      label: '喂食',
      submenu: FEED_MENU_ITEMS.map((item) => ({
        label: item.label,
        click: () => {
          mainWindow?.webContents.send('pet:feed', { label: item.label, hungerRestore: item.hungerRestore, cost: item.cost });
        }
      }))
    },
    { type: 'separator' },
    {
      label: '切换置顶',
      type: 'checkbox',
      checked: isAlwaysOnTop,
      click: () => {
        if (!mainWindow) {
          return;
        }

        const nextValue = !mainWindow.isAlwaysOnTop();
        mainWindow.setAlwaysOnTop(nextValue, 'floating');
        mainWindow.webContents.send('window:always-on-top-changed', nextValue);
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => app.quit()
    }
  ]);

  menu.popup({ window: mainWindow });
});

ipcMain.on('pet:set-work-running', (_event, value: boolean) => {
  isPetWorking = value === true;
});

ipcMain.handle('storage:get-snapshot', () => {
  return getStorageSnapshot();
});

ipcMain.handle('storage:set-value', (_event, key: unknown, value: unknown) => {
  if (typeof key !== 'string' || typeof value !== 'string') {
    return undefined;
  }

  return setStorageValue(key, value);
});

ipcMain.handle('storage:remove-value', (_event, key: unknown) => {
  if (typeof key !== 'string') {
    return undefined;
  }

  return removeStorageValue(key);
});

ipcMain.handle('storage:get-database-info', () => {
  return getDatabaseInfo();
});

ipcMain.handle('points:append-ledger', (_event, entry: unknown) => {
  if (!isPointLedgerWrite(entry)) {
    return undefined;
  }

  return appendPointLedgerEntry(entry);
});

ipcMain.handle('points:get-ledger', (_event, limit: unknown) => {
  return getPointLedgerEntries(typeof limit === 'number' && Number.isFinite(limit) ? limit : undefined);
});

ipcMain.on('window:move-by', (_event, delta: { x: number; y: number }) => {
  if (
    !mainWindow ||
    !delta ||
    typeof delta !== 'object' ||
    !Number.isFinite(delta.x) ||
    !Number.isFinite(delta.y)
  ) {
    return;
  }

  const bounds = mainWindow.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const { x, y, width, height } = display.workArea;
  const safeDeltaX = clamp(delta.x, -MAX_MOVE_DELTA, MAX_MOVE_DELTA);
  const safeDeltaY = clamp(delta.y, -MAX_MOVE_DELTA, MAX_MOVE_DELTA);
  const nextX = clamp(bounds.x + safeDeltaX, x, x + width - bounds.width);
  const nextY = clamp(bounds.y + safeDeltaY, y, y + height - bounds.height);

  mainWindow.setBounds({
    ...bounds,
    x: Math.round(nextX),
    y: Math.round(nextY)
  });
});
