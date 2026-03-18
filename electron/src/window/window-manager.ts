/**
 * @file window/window-manager.ts
 * @description BrowserWindow creation, configuration, and state persistence.
 *
 * Responsibilities:
 *  - Create the main BrowserWindow with secure webPreferences
 *  - Persist and restore window bounds across sessions
 *  - Register IPC handlers for window control operations
 */

import { BrowserWindow, ipcMain, screen } from 'electron';
import * as path from 'path';
import Store from 'electron-store';
import type { WindowState, WindowBounds } from '@cortex-id/shared-types';
import { IPC_CHANNELS } from '@cortex-id/shared-types';

// ── Window state persistence ─────────────────────────────────────────────────

interface WindowStateStore {
  bounds: WindowBounds;
  isMaximized: boolean;
}

const DEFAULT_WINDOW_BOUNDS: WindowBounds = {
  x: 0,
  y: 0,
  width: 1280,
  height: 800,
};

const windowStore = new Store<{ windowState: WindowStateStore }>({
  name: 'cortex-id-window',
  defaults: {
    windowState: {
      bounds: DEFAULT_WINDOW_BOUNDS,
      isMaximized: false,
    },
  },
});

// ── Window creation ──────────────────────────────────────────────────────────

/**
 * Creates and configures the main BrowserWindow.
 * Restores previous window position and size from persistent storage.
 */
export function createMainWindow(): BrowserWindow {
  console.log('[Electron] Creating main window');

  const savedState = windowStore.get('windowState');
  const bounds = ensureVisibleBounds(savedState.bounds);

  const preloadPath = path.join(__dirname, '..', '..', 'preload', 'index.js');
  console.log(`[Electron] Preload path: ${preloadPath}`);

  const win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: 800,
    minHeight: 600,
    show: false, // Show after content loads to avoid white flash
    backgroundColor: '#1e1e1e',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: process.platform !== 'darwin',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Required for preload to use require()
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  // Restore maximized state
  if (savedState.isMaximized) {
    win.maximize();
  }

  // Show window once content is ready (avoids white flash)
  win.once('ready-to-show', () => {
    win.show();
    console.log('[Electron] Main window shown');
  });

  // Persist window state on resize/move
  const saveWindowState = () => {
    if (!win.isDestroyed()) {
      const isMaximized = win.isMaximized();
      const bounds = isMaximized ? savedState.bounds : win.getBounds();
      windowStore.set('windowState', {
        bounds: {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
        },
        isMaximized,
      });
    }
  };

  win.on('resize', saveWindowState);
  win.on('move', saveWindowState);
  win.on('close', saveWindowState);

  console.log('[Electron] Main window created');
  return win;
}

// ── Window IPC handlers ──────────────────────────────────────────────────────

/**
 * Registers IPC handlers for window control operations.
 * Must be called after the BrowserWindow is created.
 */
export function registerWindowHandlers(mainWindow: BrowserWindow): void {
  console.log('[IPC] Registering window handlers');

  // ── WINDOW_MINIMIZE ────────────────────────────────────────────────────────
  ipcMain.on(IPC_CHANNELS.WINDOW_MINIMIZE, () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.minimize();
    }
  });

  // ── WINDOW_MAXIMIZE ────────────────────────────────────────────────────────
  ipcMain.on(IPC_CHANNELS.WINDOW_MAXIMIZE, () => {
    if (!mainWindow.isDestroyed()) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  // ── WINDOW_CLOSE ───────────────────────────────────────────────────────────
  ipcMain.on(IPC_CHANNELS.WINDOW_CLOSE, () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.close();
    }
  });

  // ── WINDOW_GET_STATE ───────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.WINDOW_GET_STATE, (): WindowState => {
    if (mainWindow.isDestroyed()) {
      return {
        isMaximized: false,
        isFullScreen: false,
        bounds: DEFAULT_WINDOW_BOUNDS,
      };
    }

    const bounds = mainWindow.getBounds();
    return {
      isMaximized: mainWindow.isMaximized(),
      isFullScreen: mainWindow.isFullScreen(),
      bounds: {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      },
    };
  });

  console.log('[IPC] Window handlers registered');
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Ensures the window bounds are visible on at least one display.
 * Falls back to default bounds if the saved position is off-screen.
 */
function ensureVisibleBounds(bounds: WindowBounds): WindowBounds {
  try {
    const displays = screen.getAllDisplays();
    const isVisible = displays.some((display) => {
      const { x, y, width, height } = display.workArea;
      return (
        bounds.x >= x &&
        bounds.y >= y &&
        bounds.x + bounds.width <= x + width &&
        bounds.y + bounds.height <= y + height
      );
    });

    if (isVisible) {
      return bounds;
    }
  } catch {
    // screen may not be available yet — use defaults
  }

  // Center on primary display
  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    return {
      x: Math.round((screenWidth - DEFAULT_WINDOW_BOUNDS.width) / 2),
      y: Math.round((screenHeight - DEFAULT_WINDOW_BOUNDS.height) / 2),
      width: DEFAULT_WINDOW_BOUNDS.width,
      height: DEFAULT_WINDOW_BOUNDS.height,
    };
  } catch {
    return DEFAULT_WINDOW_BOUNDS;
  }
}
