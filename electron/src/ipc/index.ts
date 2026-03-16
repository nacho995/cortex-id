/**
 * @file ipc/index.ts
 * @description Barrel file — aggregates all IPC handler registrations.
 *
 * Usage in main.ts:
 * @example
 * import { registerAllHandlers } from './ipc';
 * registerAllHandlers(mainWindow);
 */

import { BrowserWindow } from 'electron';
import { registerFileSystemHandlers } from './file-system.handler';
import { registerTerminalHandlers } from './terminal.handler';
import { registerAppHandlers } from './app.handler';
import { registerWindowHandlers } from '../window/window-manager';

/**
 * Registers all IPC handlers for the application.
 * Must be called once after the BrowserWindow is created and before
 * the renderer process loads.
 *
 * @param mainWindow - The main BrowserWindow instance
 */
export function registerAllHandlers(mainWindow: BrowserWindow): void {
  console.log('[IPC] Registering all handlers...');

  registerFileSystemHandlers(mainWindow);
  registerTerminalHandlers(mainWindow);
  registerAppHandlers();
  registerWindowHandlers(mainWindow);

  console.log('[IPC] All handlers registered successfully');
}

// Re-export individual registrations for granular use if needed
export { registerFileSystemHandlers } from './file-system.handler';
export { registerTerminalHandlers, destroyAllTerminals } from './terminal.handler';
export { registerAppHandlers } from './app.handler';
