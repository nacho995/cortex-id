/**
 * @file ipc/file-system.handler.ts
 * @description IPC handlers for all file system operations.
 *
 * Handles:
 *  - FILE_READ    — read file contents
 *  - FILE_WRITE   — write file contents (creates dirs if needed)
 *  - FILE_LIST_DIR — list directory contents (optionally recursive)
 *  - FILE_OPEN_DIALOG — native open dialog
 *  - FILE_SAVE_DIALOG — native save dialog
 *  - FILE_WATCH   — watch directory for changes, push FILE_CHANGE events
 */

import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function validatePath(filePath: string): void {
  const resolved = path.resolve(filePath);
  // Block access to sensitive system directories
  const blocked = ['/etc/shadow', '/etc/passwd'];
  const blockedWindows = [
    /[a-zA-Z]:\\Windows\\System32\\config\\SAM/i,
    /[a-zA-Z]:\\Windows\\System32\\config\\SECURITY/i,
  ];
  if (blocked.some(b => resolved.startsWith(b)) || blockedWindows.some((regex) => regex.test(filePath))) {
    throw new Error('Access denied: path is restricted');
  }
  // Ensure path doesn't contain null bytes (path traversal attack)
  if (filePath.includes('\0')) {
    throw new Error('Access denied: invalid path');
  }
}
import type {
  ReadFileRequest,
  ReadFileResponse,
  WriteFileRequest,
  WriteFileResponse,
  CreateDirectoryRequest,
  CreateDirectoryResponse,
  DeletePathRequest,
  DeletePathResponse,
  ListDirectoryRequest,
  ListDirectoryResponse,
  DirectoryEntry,
  OpenDialogRequest,
  OpenDialogResponse,
  SaveDialogRequest,
  SaveDialogResponse,
  WatchDirectoryRequest,
  FileChangeEvent,
} from '@cortex-id/shared-types';
import { IPC_CHANNELS } from '@cortex-id/shared-types';

// ── Active file watchers ─────────────────────────────────────────────────────

/** Map of watched paths to their fs.FSWatcher instances */
const activeWatchers = new Map<string, fs.FSWatcher>();

// ── Handler registration ─────────────────────────────────────────────────────

/**
 * Registers all file system IPC handlers.
 * Must be called after the BrowserWindow is created.
 */
export function registerFileSystemHandlers(mainWindow: BrowserWindow): void {
  console.log('[IPC] Registering file system handlers');

  // ── FILE_READ ──────────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.FILE_READ, async (_event, request: ReadFileRequest): Promise<ReadFileResponse> => {
    console.log(`[IPC] FILE_READ: ${request.path}`);
    try {
      validatePath(request.path);
      const encoding = (request.encoding ?? 'utf-8') as BufferEncoding;
      const content = await fs.promises.readFile(request.path, { encoding });
      return {
        path: request.path,
        content,
        encoding,
      };
    } catch (err) {
      console.error(`[IPC] FILE_READ error for ${request.path}:`, err);
      throw new Error(`Failed to read file: ${(err as Error).message}`);
    }
  });

  // ── FILE_WRITE ─────────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.FILE_WRITE, async (_event, request: WriteFileRequest): Promise<WriteFileResponse> => {
    console.log(`[IPC] FILE_WRITE: ${request.path}`);
    try {
      validatePath(request.path);
      if (request.createIfNotExists) {
        const dir = path.dirname(request.path);
        fs.mkdirSync(dir, { recursive: true });
      }
      const encoding = (request.encoding ?? 'utf-8') as BufferEncoding;
      await fs.promises.writeFile(request.path, request.content, { encoding });
      return {
        path: request.path,
        success: true,
      };
    } catch (err) {
      console.error(`[IPC] FILE_WRITE error for ${request.path}:`, err);
      throw new Error(`Failed to write file: ${(err as Error).message}`);
    }
  });

  // ── FILE_LIST_DIR ──────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.FILE_LIST_DIR, async (_event, request: ListDirectoryRequest): Promise<ListDirectoryResponse> => {
    console.log(`[IPC] FILE_LIST_DIR: ${request.path} (recursive=${request.recursive})`);
    try {
      const entries = await listDirectory(request.path, request.recursive ?? false, request.includeHidden ?? false);
      return {
        path: request.path,
        entries,
      };
    } catch (err) {
      console.error(`[IPC] FILE_LIST_DIR error for ${request.path}:`, err);
      throw new Error(`Failed to list directory: ${(err as Error).message}`);
    }
  });

  // ── FILE_CREATE_DIR ────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.FILE_CREATE_DIR, async (_event, request: CreateDirectoryRequest): Promise<CreateDirectoryResponse> => {
    console.log(`[IPC] FILE_CREATE_DIR: ${request.path}`);
    try {
      validatePath(request.path);
      await fs.promises.mkdir(request.path, { recursive: request.recursive ?? true });
      return {
        path: request.path,
        success: true,
      };
    } catch (err) {
      console.error(`[IPC] FILE_CREATE_DIR error for ${request.path}:`, err);
      throw new Error(`Failed to create directory: ${(err as Error).message}`);
    }
  });

  // ── FILE_DELETE ────────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.FILE_DELETE, async (_event, request: DeletePathRequest): Promise<DeletePathResponse> => {
    console.log(`[IPC] FILE_DELETE: ${request.path}`);
    try {
      validatePath(request.path);
      await fs.promises.rm(request.path, {
        recursive: request.recursive ?? true,
        force: false,
      });
      return {
        path: request.path,
        success: true,
      };
    } catch (err) {
      console.error(`[IPC] FILE_DELETE error for ${request.path}:`, err);
      throw new Error(`Failed to delete path: ${(err as Error).message}`);
    }
  });

  // ── FILE_OPEN_DIALOG ───────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.FILE_OPEN_DIALOG, async (_event, request: OpenDialogRequest): Promise<OpenDialogResponse> => {
    console.log('[IPC] FILE_OPEN_DIALOG');
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: request.title,
        defaultPath: request.defaultPath,
        filters: request.filters,
        properties: request.properties ?? ['openFile'],
      });
      return {
        canceled: result.canceled,
        filePaths: result.filePaths,
      };
    } catch (err) {
      console.error('[IPC] FILE_OPEN_DIALOG error:', err);
      throw new Error(`Failed to open dialog: ${(err as Error).message}`);
    }
  });

  // ── FILE_SAVE_DIALOG ───────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.FILE_SAVE_DIALOG, async (_event, request: SaveDialogRequest): Promise<SaveDialogResponse> => {
    console.log('[IPC] FILE_SAVE_DIALOG');
    try {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: request.title,
        defaultPath: request.defaultPath,
        filters: request.filters,
      });
      return {
        canceled: result.canceled,
        filePath: result.filePath,
      };
    } catch (err) {
      console.error('[IPC] FILE_SAVE_DIALOG error:', err);
      throw new Error(`Failed to open save dialog: ${(err as Error).message}`);
    }
  });

  // ── FILE_WATCH ─────────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.FILE_WATCH, async (_event, request: WatchDirectoryRequest): Promise<void> => {
    console.log(`[IPC] FILE_WATCH: ${request.path} (recursive=${request.recursive})`);
    try {
      // Stop existing watcher for this path if any
      const existing = activeWatchers.get(request.path);
      if (existing) {
        existing.close();
        activeWatchers.delete(request.path);
      }

      const watcher = fs.watch(
        request.path,
        { recursive: request.recursive ?? false },
        (eventType, filename) => {
          if (!filename) return;

          const fullPath = path.join(request.path, filename);
          let changeType: FileChangeEvent['type'];

          if (eventType === 'rename') {
            // Determine if it's a create or delete by checking existence
            try {
              fs.accessSync(fullPath);
              changeType = 'created';
            } catch {
              changeType = 'deleted';
            }
          } else {
            changeType = 'modified';
          }

          const event: FileChangeEvent = {
            type: changeType,
            path: fullPath,
          };

          if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send(IPC_CHANNELS.FILE_CHANGE, event);
          }
        }
      );

      watcher.on('error', (err) => {
        console.error(`[IPC] FILE_WATCH error for ${request.path}:`, err);
      });

      activeWatchers.set(request.path, watcher);
      console.log(`[IPC] FILE_WATCH started for: ${request.path}`);
    } catch (err) {
      console.error(`[IPC] FILE_WATCH setup error for ${request.path}:`, err);
      throw new Error(`Failed to watch directory: ${(err as Error).message}`);
    }
  });

  console.log('[IPC] File system handlers registered');
}

// ── Helper: recursive directory listing ─────────────────────────────────────

async function listDirectory(
  dirPath: string,
  recursive: boolean,
  includeHidden: boolean
): Promise<DirectoryEntry[]> {
  const entries: DirectoryEntry[] = [];

  let items: string[];
  try {
    items = await fs.promises.readdir(dirPath);
  } catch (err) {
    throw new Error(`Cannot read directory ${dirPath}: ${(err as Error).message}`);
  }

  for (const item of items) {
    // Skip hidden files unless requested
    if (!includeHidden && item.startsWith('.')) {
      continue;
    }

    const fullPath = path.join(dirPath, item);

    let stat: fs.Stats;
    try {
      stat = await fs.promises.stat(fullPath);
    } catch {
      // Skip entries we can't stat (e.g. broken symlinks)
      continue;
    }

    const isDirectory = stat.isDirectory();
    const isFile = stat.isFile();
    const ext = isFile ? path.extname(item) : undefined;

    const entry: DirectoryEntry = {
      path: fullPath,
      name: item,
      isDirectory,
      isFile,
      size: isFile ? stat.size : 0,
      modifiedAt: stat.mtimeMs,
      ...(ext ? { extension: ext } : {}),
    };

    if (isDirectory && recursive) {
      entry.children = await listDirectory(fullPath, recursive, includeHidden);
    }

    entries.push(entry);
  }

  // Sort: directories first, then files, both alphabetically
  entries.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });

  return entries;
}
