/**
 * @file __tests__/ipc/file-system.handler.test.ts
 * @description Unit tests for file system IPC handlers.
 *
 * Tests cover:
 *  - FILE_READ    — reads file content correctly
 *  - FILE_WRITE   — writes file content, creates directories if needed
 *  - FILE_LIST_DIR — lists directory entries with correct structure
 *  - FILE_OPEN_DIALOG — calls dialog.showOpenDialog
 *  - FILE_SAVE_DIALOG — calls dialog.showSaveDialog
 *  - Error handling for non-existent files
 */

import { IPC_CHANNELS } from '@cortex-id/shared-types';

// ── Mocks ────────────────────────────────────────────────────────────────────

// Electron is auto-mocked via moduleNameMapper → src/__mocks__/electron.ts
jest.mock('electron');

// Mock fs module — must be declared before any imports that use fs
const mockFsPromises = {
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  rm: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn(),
};

const mockMkdirSync = jest.fn();
const mockWatch = jest.fn().mockReturnValue({ on: jest.fn(), close: jest.fn() });
const mockAccessSync = jest.fn();

jest.mock('fs', () => ({
  promises: mockFsPromises,
  mkdirSync: mockMkdirSync,
  watch: mockWatch,
  accessSync: mockAccessSync,
  existsSync: jest.fn(),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

type IpcHandler = (_event: unknown, ...args: unknown[]) => Promise<unknown>;

function getHandler(ipcMainMock: { handle: jest.Mock }, channel: string): IpcHandler | undefined {
  const calls = ipcMainMock.handle.mock.calls as Array<[string, IpcHandler]>;
  const call = calls.find(([ch]) => ch === channel);
  return call?.[1];
}

// ── Setup ────────────────────────────────────────────────────────────────────

const mockMainWindow = {
  isDestroyed: jest.fn().mockReturnValue(false),
  webContents: { send: jest.fn() },
} as unknown as import('electron').BrowserWindow;

// Get the mocked ipcMain and dialog from the electron mock
import { ipcMain, dialog } from 'electron';
const mockIpcMain = ipcMain as unknown as { handle: jest.Mock; on: jest.Mock };
const mockDialog = dialog as unknown as {
  showOpenDialog: jest.Mock;
  showSaveDialog: jest.Mock;
};

// Import the handler module AFTER mocks are set up
import { registerFileSystemHandlers } from '../../ipc/file-system.handler';

beforeEach(() => {
  jest.clearAllMocks();
  mockWatch.mockReturnValue({ on: jest.fn(), close: jest.fn() });
  registerFileSystemHandlers(mockMainWindow);
});

// ── FILE_READ ─────────────────────────────────────────────────────────────────

describe('FILE_READ handler', () => {
  it('FILE_READ_WithValidPath_ReturnsFileContent', async () => {
    const mockContent = 'console.log("hello world");';
    mockFsPromises.readFile.mockResolvedValue(mockContent);

    const handler = getHandler(mockIpcMain, IPC_CHANNELS.FILE_READ);
    const result = await handler!(null, { path: '/project/src/index.ts' });

    expect(result).toEqual({
      path: '/project/src/index.ts',
      content: mockContent,
      encoding: 'utf-8',
    });
    expect(mockFsPromises.readFile).toHaveBeenCalledWith(
      '/project/src/index.ts',
      { encoding: 'utf-8' }
    );
  });

  it('FILE_READ_WithCustomEncoding_UsesProvidedEncoding', async () => {
    mockFsPromises.readFile.mockResolvedValue('binary data');

    const handler = getHandler(mockIpcMain, IPC_CHANNELS.FILE_READ);
    await handler!(null, { path: '/file.bin', encoding: 'base64' });

    expect(mockFsPromises.readFile).toHaveBeenCalledWith(
      '/file.bin',
      { encoding: 'base64' }
    );
  });

  it('FILE_READ_WithNonExistentFile_ThrowsError', async () => {
    mockFsPromises.readFile.mockRejectedValue(
      new Error('ENOENT: no such file or directory')
    );

    const handler = getHandler(mockIpcMain, IPC_CHANNELS.FILE_READ);

    await expect(handler!(null, { path: '/nonexistent/file.ts' })).rejects.toThrow(
      'Failed to read file: ENOENT: no such file or directory'
    );
  });

  it('FILE_READ_WithPermissionDenied_ThrowsError', async () => {
    mockFsPromises.readFile.mockRejectedValue(
      new Error('EACCES: permission denied')
    );

    const handler = getHandler(mockIpcMain, IPC_CHANNELS.FILE_READ);

    await expect(handler!(null, { path: '/root/secret.txt' })).rejects.toThrow(
      'Failed to read file: EACCES: permission denied'
    );
  });

  it('FILE_READ_WithBlockedWindowsPath_ThrowsAccessDenied', async () => {
    const handler = getHandler(mockIpcMain, IPC_CHANNELS.FILE_READ);

    await expect(handler!(null, { path: 'C:\\Windows\\System32\\config\\SAM' })).rejects.toThrow(
      'Failed to read file: Access denied: path is restricted',
    );
  });
});

// ── FILE_WRITE ────────────────────────────────────────────────────────────────

describe('FILE_WRITE handler', () => {
  it('FILE_WRITE_WithValidRequest_WritesFileAndReturnsSuccess', async () => {
    mockFsPromises.writeFile.mockResolvedValue(undefined);

    const handler = getHandler(mockIpcMain, IPC_CHANNELS.FILE_WRITE);
    const result = await handler!(null, {
      path: '/project/src/new-file.ts',
      content: 'export const x = 1;',
    });

    expect(result).toEqual({
      path: '/project/src/new-file.ts',
      success: true,
    });
    expect(mockFsPromises.writeFile).toHaveBeenCalledWith(
      '/project/src/new-file.ts',
      'export const x = 1;',
      { encoding: 'utf-8' }
    );
  });

  it('FILE_WRITE_WithCreateIfNotExists_CreatesMissingDirectories', async () => {
    mockFsPromises.writeFile.mockResolvedValue(undefined);

    const handler = getHandler(mockIpcMain, IPC_CHANNELS.FILE_WRITE);
    await handler!(null, {
      path: '/project/new-dir/subdir/file.ts',
      content: 'const x = 1;',
      createIfNotExists: true,
    });

    expect(mockMkdirSync).toHaveBeenCalledWith(
      '/project/new-dir/subdir',
      { recursive: true }
    );
    expect(mockFsPromises.writeFile).toHaveBeenCalled();
  });

  it('FILE_WRITE_WithoutCreateIfNotExists_DoesNotCreateDirectories', async () => {
    mockFsPromises.writeFile.mockResolvedValue(undefined);

    const handler = getHandler(mockIpcMain, IPC_CHANNELS.FILE_WRITE);
    await handler!(null, {
      path: '/existing/dir/file.ts',
      content: 'const x = 1;',
      createIfNotExists: false,
    });

    expect(mockMkdirSync).not.toHaveBeenCalled();
  });

  it('FILE_WRITE_WhenWriteFails_ThrowsError', async () => {
    mockFsPromises.writeFile.mockRejectedValue(
      new Error('ENOSPC: no space left on device')
    );

    const handler = getHandler(mockIpcMain, IPC_CHANNELS.FILE_WRITE);

    await expect(
      handler!(null, { path: '/full/disk/file.ts', content: 'data' })
    ).rejects.toThrow('Failed to write file: ENOSPC: no space left on device');
  });
});

// ── FILE_LIST_DIR ─────────────────────────────────────────────────────────────

describe('FILE_LIST_DIR handler', () => {
  it('FILE_LIST_DIR_WithValidDirectory_ReturnsEntriesWithCorrectStructure', async () => {
    mockFsPromises.readdir.mockResolvedValue(['src', 'package.json', 'README.md']);

    const mockStatDir = {
      isDirectory: () => true,
      isFile: () => false,
      size: 0,
      mtimeMs: 1700000000000,
    };
    const mockStatFile = {
      isDirectory: () => false,
      isFile: () => true,
      size: 1024,
      mtimeMs: 1700000001000,
    };

    mockFsPromises.stat
      .mockResolvedValueOnce(mockStatDir)    // src/
      .mockResolvedValueOnce(mockStatFile)   // package.json
      .mockResolvedValueOnce(mockStatFile);  // README.md

    const handler = getHandler(mockIpcMain, IPC_CHANNELS.FILE_LIST_DIR);
    const result = await handler!(null, { path: '/project', recursive: false }) as {
      path: string;
      entries: Array<{ name: string; isDirectory: boolean; isFile: boolean }>;
    };

    expect(result.path).toBe('/project');
    expect(result.entries).toHaveLength(3);

    // Directories should come first (sorted)
    expect(result.entries[0].name).toBe('src');
    expect(result.entries[0].isDirectory).toBe(true);
    expect(result.entries[0].isFile).toBe(false);

    // Files come after directories, alphabetically
    expect(result.entries[1].name).toBe('package.json');
    expect(result.entries[1].isFile).toBe(true);
  });

  it('FILE_LIST_DIR_WithHiddenFiles_ExcludesHiddenByDefault', async () => {
    mockFsPromises.readdir.mockResolvedValue(['.git', '.env', 'src']);

    const mockStatDir = {
      isDirectory: () => true,
      isFile: () => false,
      size: 0,
      mtimeMs: 1700000000000,
    };

    mockFsPromises.stat.mockResolvedValue(mockStatDir);

    const handler = getHandler(mockIpcMain, IPC_CHANNELS.FILE_LIST_DIR);
    const result = await handler!(null, {
      path: '/project',
      recursive: false,
      includeHidden: false,
    }) as { entries: Array<{ name: string }> };

    // Only 'src' should be included (hidden files filtered out)
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].name).toBe('src');
  });

  it('FILE_LIST_DIR_WithIncludeHidden_IncludesHiddenFiles', async () => {
    mockFsPromises.readdir.mockResolvedValue(['.git', 'src']);

    const mockStat = {
      isDirectory: () => true,
      isFile: () => false,
      size: 0,
      mtimeMs: 1700000000000,
    };

    mockFsPromises.stat.mockResolvedValue(mockStat);

    const handler = getHandler(mockIpcMain, IPC_CHANNELS.FILE_LIST_DIR);
    const result = await handler!(null, {
      path: '/project',
      recursive: false,
      includeHidden: true,
    }) as { entries: Array<{ name: string }> };

    expect(result.entries).toHaveLength(2);
    const names = result.entries.map((e) => e.name);
    expect(names).toContain('.git');
    expect(names).toContain('src');
  });

  it('FILE_LIST_DIR_WithFileExtension_IncludesExtensionInEntry', async () => {
    mockFsPromises.readdir.mockResolvedValue(['index.ts']);

    const mockStatFile = {
      isDirectory: () => false,
      isFile: () => true,
      size: 512,
      mtimeMs: 1700000000000,
    };

    mockFsPromises.stat.mockResolvedValue(mockStatFile);

    const handler = getHandler(mockIpcMain, IPC_CHANNELS.FILE_LIST_DIR);
    const result = await handler!(null, { path: '/src', recursive: false }) as {
      entries: Array<{ name: string; extension?: string }>;
    };

    expect(result.entries[0].extension).toBe('.ts');
  });

  it('FILE_LIST_DIR_WithNonExistentDirectory_ThrowsError', async () => {
    mockFsPromises.readdir.mockRejectedValue(
      new Error('ENOENT: no such file or directory')
    );

    const handler = getHandler(mockIpcMain, IPC_CHANNELS.FILE_LIST_DIR);

    await expect(
      handler!(null, { path: '/nonexistent', recursive: false })
    ).rejects.toThrow('Failed to list directory');
  });
});

// ── FILE_OPEN_DIALOG ──────────────────────────────────────────────────────────

describe('FILE_OPEN_DIALOG handler', () => {
  it('FILE_OPEN_DIALOG_WhenUserSelectsFile_ReturnsCanceledFalseWithPaths', async () => {
    mockDialog.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/home/user/project/src/main.ts'],
    });

    const handler = getHandler(mockIpcMain, IPC_CHANNELS.FILE_OPEN_DIALOG);
    const result = await handler!(null, {
      title: 'Open File',
      properties: ['openFile'],
    });

    expect(result).toEqual({
      canceled: false,
      filePaths: ['/home/user/project/src/main.ts'],
    });
    expect(mockDialog.showOpenDialog).toHaveBeenCalledWith(
      mockMainWindow,
      expect.objectContaining({
        title: 'Open File',
        properties: ['openFile'],
      })
    );
  });

  it('FILE_OPEN_DIALOG_WhenUserCancels_ReturnsCanceledTrueWithEmptyPaths', async () => {
    mockDialog.showOpenDialog.mockResolvedValue({
      canceled: true,
      filePaths: [],
    });

    const handler = getHandler(mockIpcMain, IPC_CHANNELS.FILE_OPEN_DIALOG);
    const result = await handler!(null, { title: 'Open File' }) as {
      canceled: boolean;
      filePaths: string[];
    };

    expect(result.canceled).toBe(true);
    expect(result.filePaths).toHaveLength(0);
  });

  it('FILE_OPEN_DIALOG_WithDefaultProperties_UsesOpenFileProperty', async () => {
    mockDialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [] });

    const handler = getHandler(mockIpcMain, IPC_CHANNELS.FILE_OPEN_DIALOG);
    await handler!(null, { title: 'Open' });

    expect(mockDialog.showOpenDialog).toHaveBeenCalledWith(
      mockMainWindow,
      expect.objectContaining({ properties: ['openFile'] })
    );
  });

  it('FILE_OPEN_DIALOG_WithFilters_PassesFiltersToDialog', async () => {
    mockDialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [] });

    const filters = [{ name: 'TypeScript', extensions: ['ts', 'tsx'] }];
    const handler = getHandler(mockIpcMain, IPC_CHANNELS.FILE_OPEN_DIALOG);
    await handler!(null, { title: 'Open TS', filters });

    expect(mockDialog.showOpenDialog).toHaveBeenCalledWith(
      mockMainWindow,
      expect.objectContaining({ filters })
    );
  });

  it('FILE_OPEN_DIALOG_WhenDialogThrows_ThrowsWrappedError', async () => {
    mockDialog.showOpenDialog.mockRejectedValue(new Error('Dialog unavailable'));

    const handler = getHandler(mockIpcMain, IPC_CHANNELS.FILE_OPEN_DIALOG);

    await expect(handler!(null, {})).rejects.toThrow('Failed to open dialog: Dialog unavailable');
  });
});

// ── FILE_SAVE_DIALOG ──────────────────────────────────────────────────────────

describe('FILE_SAVE_DIALOG handler', () => {
  it('FILE_SAVE_DIALOG_WhenUserSelectsPath_ReturnsCanceledFalseWithFilePath', async () => {
    mockDialog.showSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: '/home/user/documents/output.json',
    });

    const handler = getHandler(mockIpcMain, IPC_CHANNELS.FILE_SAVE_DIALOG);
    const result = await handler!(null, {
      title: 'Save File',
      defaultPath: '/home/user/documents',
    });

    expect(result).toEqual({
      canceled: false,
      filePath: '/home/user/documents/output.json',
    });
    expect(mockDialog.showSaveDialog).toHaveBeenCalledWith(
      mockMainWindow,
      expect.objectContaining({
        title: 'Save File',
        defaultPath: '/home/user/documents',
      })
    );
  });

  it('FILE_SAVE_DIALOG_WhenUserCancels_ReturnsCanceledTrueWithUndefinedPath', async () => {
    mockDialog.showSaveDialog.mockResolvedValue({
      canceled: true,
      filePath: undefined,
    });

    const handler = getHandler(mockIpcMain, IPC_CHANNELS.FILE_SAVE_DIALOG);
    const result = await handler!(null, { title: 'Save' }) as {
      canceled: boolean;
      filePath: string | undefined;
    };

    expect(result.canceled).toBe(true);
    expect(result.filePath).toBeUndefined();
  });

  it('FILE_SAVE_DIALOG_WithFilters_PassesFiltersToDialog', async () => {
    mockDialog.showSaveDialog.mockResolvedValue({ canceled: false, filePath: '/out.ts' });

    const filters = [{ name: 'TypeScript', extensions: ['ts'] }];
    const handler = getHandler(mockIpcMain, IPC_CHANNELS.FILE_SAVE_DIALOG);
    await handler!(null, { title: 'Save TS', filters });

    expect(mockDialog.showSaveDialog).toHaveBeenCalledWith(
      mockMainWindow,
      expect.objectContaining({ filters })
    );
  });

  it('FILE_SAVE_DIALOG_WhenDialogThrows_ThrowsWrappedError', async () => {
    mockDialog.showSaveDialog.mockRejectedValue(new Error('Save dialog failed'));

    const handler = getHandler(mockIpcMain, IPC_CHANNELS.FILE_SAVE_DIALOG);

    await expect(handler!(null, {})).rejects.toThrow('Failed to open save dialog: Save dialog failed');
  });
});
