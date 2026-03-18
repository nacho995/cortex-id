/**
 * @file main.ts
 * @description Electron main process entry point for Cortex-ID.
 *
 * Responsibilities:
 *  - Create and manage the BrowserWindow
 *  - Launch the Java backend as a child process
 *  - Register all IPC handlers
 *  - Handle app lifecycle events
 *  - Set up the application menu
 */

import { app, BrowserWindow, Menu, MenuItem, session } from 'electron';
import { createMainWindow } from './window/window-manager';
import { resolveFrontendEntryPath } from './window/frontend-path';
import { registerAllHandlers } from './ipc';
import { launchBackend, stopBackend, waitForBackend } from './native/backend-launcher';
import { ensureDataDir } from './native/platform';

// ── Dev mode detection ──────────────────────────────────────────────────────
const isDev = !app.isPackaged;

// ── Global references ───────────────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null;

// ── App lifecycle ───────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  console.log('[Electron] App ready — starting Cortex-ID');

  // Ensure data directory exists
  ensureDataDir();

  // Launch Java backend
  try {
    console.log('[Electron] Launching Java backend...');
    launchBackend();
    await waitForBackend();
    console.log('[Electron] Java backend is ready');
  } catch (err) {
    console.error('[Electron] Failed to start Java backend:', err);
    // Continue anyway — the app can still function partially without the backend
  }

  // Create main window
  mainWindow = createMainWindow();

  // Register all IPC handlers
  registerAllHandlers(mainWindow);

  // Grant microphone and media permissions for Web Speech API
  const allowedPerms = ['media', 'microphone', 'audioCapture', 'clipboard-read', 'clipboard-sanitized-write'];
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(allowedPerms.includes(permission));
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
    return allowedPerms.includes(permission);
  });

  // Bypass CORS for Open VSX extension downloads.
  // The CDN (openvsx.eclipsecontent.org) doesn't set CORS headers,
  // which blocks fetch() in the renderer process.
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ['https://*.open-vsx.org/*', 'https://*.eclipsecontent.org/*', 'https://open-vsx.org/*'] },
    (details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Access-Control-Allow-Origin': ['*'],
          'Access-Control-Allow-Methods': ['GET, OPTIONS'],
          'Access-Control-Allow-Headers': ['Content-Type'],
        },
      });
    }
  );

  // Load the app
  const frontendEntry = resolveFrontendEntryPath({
    isDev,
    dirname: __dirname,
    resourcesPath: process.resourcesPath,
  });
  if (frontendEntry.type === 'url') {
    console.log(`[Electron] Dev mode — loading ${frontendEntry.value}`);
    await mainWindow.loadURL(frontendEntry.value);
    mainWindow.webContents.openDevTools();
  } else {
    console.log(`[Electron] Prod mode — loading ${frontendEntry.value}`);
    await mainWindow.loadFile(frontendEntry.value);
  }

  // Set up application menu
  setupMenu(mainWindow);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
});

app.on('window-all-closed', () => {
  console.log('[Electron] All windows closed');
  // On macOS, keep the app running until explicitly quit
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  // On macOS, re-create window when dock icon is clicked and no windows are open
  if (BrowserWindow.getAllWindows().length === 0 && mainWindow === null) {
    mainWindow = createMainWindow();
    registerAllHandlers(mainWindow);

    const entry = resolveFrontendEntryPath({
      isDev,
      dirname: __dirname,
      resourcesPath: process.resourcesPath,
    });
    if (entry.type === 'url') {
      await mainWindow.loadURL(entry.value);
    } else {
      await mainWindow.loadFile(entry.value);
    }
  }
});

app.on('before-quit', async () => {
  console.log('[Electron] App quitting — stopping Java backend...');
  await stopBackend();
  console.log('[Electron] Java backend stopped');
});

// ── Application menu ────────────────────────────────────────────────────────

function setupMenu(win: BrowserWindow): void {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    // macOS app menu
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),

    // File menu
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Folder...',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => {
            win.webContents.send('menu:open-folder');
          },
        },
        {
          label: 'Open File...',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            win.webContents.send('menu:open-file');
          },
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            win.webContents.send('menu:save');
          },
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            win.webContents.send('menu:save-as');
          },
        },
        { type: 'separator' },
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },

    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        ...(isMac
          ? [
              { role: 'pasteAndMatchStyle' as const },
              { role: 'delete' as const },
              { role: 'selectAll' as const },
            ]
          : [{ role: 'delete' as const }, { type: 'separator' as const }, { role: 'selectAll' as const }]),
      ],
    },

    // View menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        ...(isDev ? [{ role: 'toggleDevTools' as const }] : []),
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const },
      ],
    },

    // Help menu
    {
      role: 'help' as const,
      submenu: [
        {
          label: 'Documentation',
          click: async () => {
            const { shell } = await import('electron');
            await shell.openExternal('https://github.com/cortex-id/cortex-id');
          },
        },
        {
          label: 'Report Issue',
          click: async () => {
            const { shell } = await import('electron');
            await shell.openExternal('https://github.com/cortex-id/cortex-id/issues');
          },
        },
        { type: 'separator' as const },
        {
          label: `Version ${app.getVersion()}`,
          enabled: false,
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
