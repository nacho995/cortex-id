/**
 * @file __tests__/ipc/app.handler.test.ts
 * @description Unit tests for app-level IPC handlers.
 *
 * Tests cover:
 *  - APP_GET_INFO          — returns correct app info
 *  - APP_GET_SETTINGS      — reads from electron-store
 *  - APP_SET_SETTINGS      — writes to electron-store
 *  - APP_SET_API_KEY       — stores in keytar
 *  - APP_GET_API_KEY       — retrieves from keytar, returns masked
 *  - APP_GET_RECENT_PROJECTS — returns list from store
 *  - APP_ADD_RECENT_PROJECT  — adds to store, max 10
 */

import { IPC_CHANNELS } from '@cortex-id/shared-types';
import type { AppSettings, RecentProject } from '@cortex-id/shared-types';

// ── Mocks ────────────────────────────────────────────────────────────────────

// Electron is auto-mocked via moduleNameMapper → src/__mocks__/electron.ts
jest.mock('electron');

// keytar is auto-mocked via moduleNameMapper → src/__mocks__/keytar.ts
jest.mock('keytar');

// Mock electron-store with a controllable in-memory store
const mockStoreData: Record<string, unknown> = {};

const mockStore = {
  get: jest.fn().mockImplementation((key: string, defaultValue?: unknown) => {
    return key in mockStoreData ? mockStoreData[key] : defaultValue;
  }),
  set: jest.fn().mockImplementation((key: string, value: unknown) => {
    mockStoreData[key] = value;
  }),
};

jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => mockStore);
});

// Mock platform module
jest.mock('../../native/platform', () => ({
  getDataPath: jest.fn().mockReturnValue('/home/user/.cortex-id'),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

type IpcHandler = (_event: unknown, ...args: unknown[]) => Promise<unknown>;

function getHandler(ipcMainMock: { handle: jest.Mock }, channel: string): IpcHandler | undefined {
  const calls = ipcMainMock.handle.mock.calls as Array<[string, IpcHandler]>;
  const call = calls.find(([ch]) => ch === channel);
  return call?.[1];
}

// ── Setup ────────────────────────────────────────────────────────────────────

import { ipcMain, app } from 'electron';
import { registerAppHandlers } from '../../ipc/app.handler';

const mockIpcMain = ipcMain as unknown as { handle: jest.Mock; on: jest.Mock };
const mockApp = app as unknown as {
  getVersion: jest.Mock;
  getPath: jest.Mock;
  isPackaged: boolean;
};

// keytar mock
const keytar = jest.requireMock('keytar') as {
  setPassword: jest.Mock;
  getPassword: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();

  // Reset store data
  for (const key of Object.keys(mockStoreData)) {
    delete mockStoreData[key];
  }

  // Restore default mock implementations after clearAllMocks
  mockStore.get.mockImplementation((key: string, defaultValue?: unknown) => {
    return key in mockStoreData ? mockStoreData[key] : defaultValue;
  });
  mockStore.set.mockImplementation((key: string, value: unknown) => {
    mockStoreData[key] = value;
  });

  // Reset keytar
  keytar.getPassword.mockResolvedValue(null);
  keytar.setPassword.mockResolvedValue(undefined);

  // Re-register handlers
  registerAppHandlers();
});

// ── APP_GET_INFO ──────────────────────────────────────────────────────────────

describe('APP_GET_INFO handler', () => {
  it('APP_GET_INFO_WhenCalled_ReturnsCorrectAppInfo', async () => {
    mockApp.getVersion.mockReturnValue('0.1.0');
    (mockApp as unknown as { isPackaged: boolean }).isPackaged = false;

    const handler = getHandler(mockIpcMain, IPC_CHANNELS.APP_GET_INFO);
    const result = await handler!(null) as {
      version: string;
      platform: string;
      arch: string;
      dataPath: string;
      isPackaged: boolean;
    };

    expect(result.version).toBe('0.1.0');
    expect(result.platform).toBe(process.platform);
    expect(result.arch).toBe(process.arch);
    expect(result.dataPath).toBe('/home/user/.cortex-id');
    expect(result.isPackaged).toBe(false);
  });

  it('APP_GET_INFO_WhenPackaged_ReturnsIsPackagedTrue', async () => {
    (mockApp as unknown as { isPackaged: boolean }).isPackaged = true;

    const handler = getHandler(mockIpcMain, IPC_CHANNELS.APP_GET_INFO);
    const result = await handler!(null) as { isPackaged: boolean };

    expect(result.isPackaged).toBe(true);

    // Restore
    (mockApp as unknown as { isPackaged: boolean }).isPackaged = false;
  });
});

// ── APP_GET_SETTINGS ──────────────────────────────────────────────────────────

describe('APP_GET_SETTINGS handler', () => {
  it('APP_GET_SETTINGS_WithNoStoredSettings_ReturnsDefaults', async () => {
    // store.get returns undefined → handler uses DEFAULT_SETTINGS
    mockStore.get.mockReturnValue(undefined);

    const handler = getHandler(mockIpcMain, IPC_CHANNELS.APP_GET_SETTINGS);
    const result = await handler!(null) as AppSettings;

    expect(result.theme).toBe('dark');
    expect(result.fontSize).toBe(14);
    expect(result.fontFamily).toBe('JetBrains Mono, monospace');
    expect(result.tabSize).toBe(2);
    expect(result.wordWrap).toBe(false);
    expect(result.minimap).toBe(true);
    expect(result.aiModel).toBe('claude-3-5-sonnet-20241022');
    expect(result.autoSave).toBe(true);
    expect(result.autoSaveDelay).toBe(1000);
  });

  it('APP_GET_SETTINGS_WithStoredSettings_MergesWithDefaults', async () => {
    const storedSettings: Partial<AppSettings> = {
      theme: 'light',
      fontSize: 16,
    };
    mockStore.get.mockReturnValue(storedSettings);

    const handler = getHandler(mockIpcMain, IPC_CHANNELS.APP_GET_SETTINGS);
    const result = await handler!(null) as AppSettings;

    // Stored values override defaults
    expect(result.theme).toBe('light');
    expect(result.fontSize).toBe(16);
    // Default values are preserved for unset fields
    expect(result.tabSize).toBe(2);
    expect(result.autoSave).toBe(true);
  });

  it('APP_GET_SETTINGS_WhenStoreThrows_ReturnsDefaults', async () => {
    mockStore.get.mockImplementation(() => {
      throw new Error('Store corrupted');
    });

    const handler = getHandler(mockIpcMain, IPC_CHANNELS.APP_GET_SETTINGS);
    const result = await handler!(null) as AppSettings;

    // Should return defaults without throwing
    expect(result.theme).toBe('dark');
    expect(result.fontSize).toBe(14);
  });
});

// ── APP_SET_SETTINGS ──────────────────────────────────────────────────────────

describe('APP_SET_SETTINGS handler', () => {
  it('APP_SET_SETTINGS_WithPartialSettings_MergesWithCurrentAndPersists', async () => {
    const currentSettings: AppSettings = {
      theme: 'dark',
      fontSize: 14,
      fontFamily: 'JetBrains Mono, monospace',
      tabSize: 2,
      wordWrap: false,
      minimap: true,
      fontLigatures: true,
      lineNumbers: 'on',
      bracketPairColorization: true,
      renderWhitespace: 'selection',
      cursorBlinking: 'smooth',
      cursorStyle: 'line',
      smoothScrolling: true,
      folding: true,
      guides: true,
      scrollBeyondLastLine: false,
      aiModel: 'claude-3-5-sonnet-20241022',
      ollamaUrl: 'http://localhost:11434',
      autoSave: true,
      autoSaveDelay: 1000,
    };
    mockStore.get.mockReturnValue(currentSettings);

    const handler = getHandler(mockIpcMain, IPC_CHANNELS.APP_SET_SETTINGS);
    await handler!(null, { theme: 'light', fontSize: 18 });

    expect(mockStore.set).toHaveBeenCalledWith(
      'settings',
      expect.objectContaining({
        theme: 'light',
        fontSize: 18,
        tabSize: 2,       // unchanged
        autoSave: true,   // unchanged
      })
    );
  });

  it('APP_SET_SETTINGS_WhenStoreThrows_ThrowsWrappedError', async () => {
    mockStore.get.mockReturnValue({});
    mockStore.set.mockImplementation(() => {
      throw new Error('Disk full');
    });

    const handler = getHandler(mockIpcMain, IPC_CHANNELS.APP_SET_SETTINGS);

    await expect(handler!(null, { theme: 'light' })).rejects.toThrow(
      'Failed to save settings: Disk full'
    );
  });
});

// ── APP_SET_API_KEY ───────────────────────────────────────────────────────────

describe('APP_SET_API_KEY handler', () => {
  it('APP_SET_API_KEY_WithValidRequest_StoresKeyInKeytar', async () => {
    keytar.setPassword.mockResolvedValue(undefined);

    const handler = getHandler(mockIpcMain, IPC_CHANNELS.APP_SET_API_KEY);
    await handler!(null, { service: 'anthropic', key: 'sk-ant-api03-test-key' });

    expect(keytar.setPassword).toHaveBeenCalledWith(
      'cortex-id',
      'anthropic',
      'sk-ant-api03-test-key'
    );
  });

  it('APP_SET_API_KEY_WhenKeytarThrows_ThrowsWrappedError', async () => {
    keytar.setPassword.mockRejectedValue(new Error('Keychain locked'));

    const handler = getHandler(mockIpcMain, IPC_CHANNELS.APP_SET_API_KEY);

    await expect(
      handler!(null, { service: 'openai', key: 'sk-test-key' })
    ).rejects.toThrow('Failed to store API key: Keychain locked');
  });
});

// ── APP_GET_API_KEY ───────────────────────────────────────────────────────────

describe('APP_GET_API_KEY handler', () => {
  it('APP_GET_API_KEY_WhenKeyExists_ReturnsMaskedKey', async () => {
    keytar.getPassword.mockResolvedValue('sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUVWXYZ');

    const handler = getHandler(mockIpcMain, IPC_CHANNELS.APP_GET_API_KEY);
    const result = await handler!(null, { service: 'anthropic' }) as {
      service: string;
      exists: boolean;
      maskedKey?: string;
    };

    expect(result.service).toBe('anthropic');
    expect(result.exists).toBe(true);
    expect(result.maskedKey).toBeDefined();
    // Masked key should show first 7 chars + "…" + last 4 chars
    expect(result.maskedKey).toMatch(/^sk-ant-…WXYZ$/);
  });

  it('APP_GET_API_KEY_WhenKeyDoesNotExist_ReturnsExistsFalse', async () => {
    keytar.getPassword.mockResolvedValue(null);

    const handler = getHandler(mockIpcMain, IPC_CHANNELS.APP_GET_API_KEY);
    const result = await handler!(null, { service: 'openai' }) as {
      service: string;
      exists: boolean;
      maskedKey?: string;
    };

    expect(result.service).toBe('openai');
    expect(result.exists).toBe(false);
    expect(result.maskedKey).toBeUndefined();
  });

  it('APP_GET_API_KEY_WhenKeyIsShort_ReturnsMaskedWithStars', async () => {
    // Key shorter than 11 chars should be fully masked
    keytar.getPassword.mockResolvedValue('short');

    const handler = getHandler(mockIpcMain, IPC_CHANNELS.APP_GET_API_KEY);
    const result = await handler!(null, { service: 'anthropic' }) as {
      exists: boolean;
      maskedKey?: string;
    };

    expect(result.exists).toBe(true);
    expect(result.maskedKey).toBe('***');
  });

  it('APP_GET_API_KEY_WhenKeytarThrows_ReturnsExistsFalseWithoutThrowing', async () => {
    keytar.getPassword.mockRejectedValue(new Error('Keychain unavailable'));

    const handler = getHandler(mockIpcMain, IPC_CHANNELS.APP_GET_API_KEY);
    const result = await handler!(null, { service: 'anthropic' }) as {
      exists: boolean;
    };

    // Should not throw — returns "not found" gracefully
    expect(result.exists).toBe(false);
  });
});

// ── APP_GET_RECENT_PROJECTS ───────────────────────────────────────────────────

describe('APP_GET_RECENT_PROJECTS handler', () => {
  it('APP_GET_RECENT_PROJECTS_WithStoredProjects_ReturnsSortedByLastOpened', async () => {
    const projects: RecentProject[] = [
      { path: '/project/old', name: 'old', lastOpened: 1000 },
      { path: '/project/newest', name: 'newest', lastOpened: 3000 },
      { path: '/project/middle', name: 'middle', lastOpened: 2000 },
    ];
    mockStore.get.mockReturnValue(projects);

    const handler = getHandler(mockIpcMain, IPC_CHANNELS.APP_GET_RECENT_PROJECTS);
    const result = await handler!(null) as RecentProject[];

    expect(result).toHaveLength(3);
    // Most recent first
    expect(result[0].name).toBe('newest');
    expect(result[1].name).toBe('middle');
    expect(result[2].name).toBe('old');
  });

  it('APP_GET_RECENT_PROJECTS_WithNoProjects_ReturnsEmptyArray', async () => {
    mockStore.get.mockReturnValue([]);

    const handler = getHandler(mockIpcMain, IPC_CHANNELS.APP_GET_RECENT_PROJECTS);
    const result = await handler!(null) as RecentProject[];

    expect(result).toEqual([]);
  });

  it('APP_GET_RECENT_PROJECTS_WhenStoreThrows_ReturnsEmptyArray', async () => {
    mockStore.get.mockImplementation(() => {
      throw new Error('Store error');
    });

    const handler = getHandler(mockIpcMain, IPC_CHANNELS.APP_GET_RECENT_PROJECTS);
    const result = await handler!(null) as RecentProject[];

    expect(result).toEqual([]);
  });
});

// ── APP_ADD_RECENT_PROJECT ────────────────────────────────────────────────────

describe('APP_ADD_RECENT_PROJECT handler', () => {
  it('APP_ADD_RECENT_PROJECT_WithNewProject_AddsToFrontOfList', async () => {
    const existingProjects: RecentProject[] = [
      { path: '/project/existing', name: 'existing', lastOpened: 1000 },
    ];
    mockStore.get.mockReturnValue(existingProjects);

    const newProject: RecentProject = {
      path: '/project/new',
      name: 'new',
      lastOpened: 2000,
    };

    const handler = getHandler(mockIpcMain, IPC_CHANNELS.APP_ADD_RECENT_PROJECT);
    await handler!(null, newProject);

    expect(mockStore.set).toHaveBeenCalledWith(
      'recentProjects',
      expect.arrayContaining([
        expect.objectContaining({ path: '/project/new' }),
        expect.objectContaining({ path: '/project/existing' }),
      ])
    );

    // New project should be first
    const savedProjects = (mockStore.set.mock.calls[0] as [string, RecentProject[]])[1];
    expect(savedProjects[0].path).toBe('/project/new');
  });

  it('APP_ADD_RECENT_PROJECT_WithDuplicatePath_ReplacesExistingEntry', async () => {
    const existingProjects: RecentProject[] = [
      { path: '/project/same', name: 'same-old', lastOpened: 1000 },
      { path: '/project/other', name: 'other', lastOpened: 500 },
    ];
    mockStore.get.mockReturnValue(existingProjects);

    const updatedProject: RecentProject = {
      path: '/project/same',
      name: 'same-updated',
      lastOpened: 9999,
    };

    const handler = getHandler(mockIpcMain, IPC_CHANNELS.APP_ADD_RECENT_PROJECT);
    await handler!(null, updatedProject);

    const savedProjects = (mockStore.set.mock.calls[0] as [string, RecentProject[]])[1];
    // Should only have 2 entries (no duplicate)
    expect(savedProjects).toHaveLength(2);
    // Updated entry should be first
    expect(savedProjects[0].lastOpened).toBe(9999);
  });

  it('APP_ADD_RECENT_PROJECT_WithMoreThan10Projects_KeepsOnly10', async () => {
    // Create 10 existing projects
    const existingProjects: RecentProject[] = Array.from({ length: 10 }, (_, i) => ({
      path: `/project/${i}`,
      name: `project-${i}`,
      lastOpened: i * 100,
    }));
    mockStore.get.mockReturnValue(existingProjects);

    const newProject: RecentProject = {
      path: '/project/eleventh',
      name: 'eleventh',
      lastOpened: 9999,
    };

    const handler = getHandler(mockIpcMain, IPC_CHANNELS.APP_ADD_RECENT_PROJECT);
    await handler!(null, newProject);

    const savedProjects = (mockStore.set.mock.calls[0] as [string, RecentProject[]])[1];
    expect(savedProjects).toHaveLength(10);
    // New project should be first
    expect(savedProjects[0].path).toBe('/project/eleventh');
  });

  it('APP_ADD_RECENT_PROJECT_WhenStoreThrows_ThrowsWrappedError', async () => {
    mockStore.get.mockReturnValue([]);
    mockStore.set.mockImplementation(() => {
      throw new Error('Write failed');
    });

    const handler = getHandler(mockIpcMain, IPC_CHANNELS.APP_ADD_RECENT_PROJECT);

    await expect(
      handler!(null, { path: '/project/x', name: 'x', lastOpened: 1 })
    ).rejects.toThrow('Failed to add recent project: Write failed');
  });
});
