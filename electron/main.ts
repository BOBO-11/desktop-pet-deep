import { app, BrowserWindow, Menu, ipcMain, screen } from 'electron';
import path from 'node:path';

let mainWindow: BrowserWindow | null = null;

const isDevelopment = process.env.NODE_ENV === 'development';
const MAX_MOVE_DELTA = 100;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 240,
    height: 240,
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

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
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
  const menu = Menu.buildFromTemplate([
    {
      label: '打工',
      submenu: [
        {
          label: '5分钟 (+15积分)',
          click: () => {
            mainWindow?.webContents.send('pet:start-work', { duration: 5 * 60 * 1000, reward: 15 });
          }
        },
        {
          label: '10分钟 (+28积分)',
          click: () => {
            mainWindow?.webContents.send('pet:start-work', { duration: 10 * 60 * 1000, reward: 28 });
          }
        },
        {
          label: '20分钟 (+50积分)',
          click: () => {
            mainWindow?.webContents.send('pet:start-work', { duration: 20 * 60 * 1000, reward: 50 });
          }
        },
        {
          label: '30分钟 (+60积分)',
          click: () => {
            mainWindow?.webContents.send('pet:start-work', { duration: 30 * 60 * 1000, reward: 60 });
          }
        },
        {
          label: '1小时 (+100积分)',
          click: () => {
            mainWindow?.webContents.send('pet:start-work', { duration: 60 * 60 * 1000, reward: 100 });
          }
        }
      ]
    },
    { type: 'separator' },
    {
      label: '喂食',
      submenu: [
        {
          label: '烤鱼 — 15积分',
          click: () => {
            mainWindow?.webContents.send('pet:feed', { hungerRestore: 30, cost: 15 });
          }
        },
        {
          label: '蒙德土豆饼 — 25积分',
          click: () => {
            mainWindow?.webContents.send('pet:feed', { hungerRestore: 50, cost: 25 });
          }
        },
        {
          label: '嘟嘟莲糕点 — 40积分',
          click: () => {
            mainWindow?.webContents.send('pet:feed', { hungerRestore: 80, cost: 40 });
          }
        },
        {
          label: '渔人吐司 — 60积分',
          click: () => {
            mainWindow?.webContents.send('pet:feed', { hungerRestore: 100, cost: 60 });
          }
        }
      ]
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

ipcMain.on('window:move-by', (_event, delta: { x: number; y: number }) => {
  if (!mainWindow || !Number.isFinite(delta.x) || !Number.isFinite(delta.y)) {
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
