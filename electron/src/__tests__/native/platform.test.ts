/**
 * @file __tests__/native/platform.test.ts
 * @description Unit tests for platform utility functions.
 *
 * Tests cover:
 *  - getDefaultShell returns correct shell per platform
 *  - getDataPath returns ~/.cortex-id/
 *  - ensureDataDir creates directory structure
 *
 * NOTE: Because platform.ts reads process.platform and process.env at call time
 * (not at import time), we can control these values per test without resetModules.
 * The fs mock is declared at the top level and its implementations are swapped per test.
 */

import * as path from 'path';

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock fs module to avoid real filesystem operations
const mockExistsSync = jest.fn();
const mockMkdirSync = jest.fn();

jest.mock('fs', () => ({
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    readdir: jest.fn(),
    stat: jest.fn(),
  },
}));

// Mock os module
const mockHomedir = jest.fn().mockReturnValue('/home/testuser');

jest.mock('os', () => ({
  homedir: mockHomedir,
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import { getDefaultShell, getDataPath, ensureDataDir } from '../../native/platform';

// ── Setup ────────────────────────────────────────────────────────────────────

const originalPlatform = process.platform;
const originalEnv = { ...process.env };

afterEach(() => {
  jest.clearAllMocks();
  // Restore platform
  Object.defineProperty(process, 'platform', {
    value: originalPlatform,
    configurable: true,
  });
  // Restore env
  process.env = { ...originalEnv };
  // Restore homedir mock
  mockHomedir.mockReturnValue('/home/testuser');
});

// ── getDefaultShell ───────────────────────────────────────────────────────────

describe('getDefaultShell', () => {
  describe('on Linux', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true,
      });
    });

    it('getDefaultShell_OnLinuxWithShellEnvVar_ReturnsShellEnvValue', () => {
      process.env['SHELL'] = '/usr/bin/zsh';
      delete process.env['COMSPEC'];

      expect(getDefaultShell()).toBe('/usr/bin/zsh');
    });

    it('getDefaultShell_OnLinuxWithoutShellEnvVar_FallsBackToBash', () => {
      delete process.env['SHELL'];
      delete process.env['COMSPEC'];

      mockExistsSync.mockImplementation((p: string) => p === '/bin/bash');

      expect(getDefaultShell()).toBe('/bin/bash');
    });

    it('getDefaultShell_OnLinuxWithNoBashOrZsh_ReturnsBinSh', () => {
      delete process.env['SHELL'];
      delete process.env['COMSPEC'];

      mockExistsSync.mockReturnValue(false);

      expect(getDefaultShell()).toBe('/bin/sh');
    });
  });

  describe('on macOS', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        configurable: true,
      });
    });

    it('getDefaultShell_OnMacOSWithShellEnvVar_ReturnsShellEnvValue', () => {
      process.env['SHELL'] = '/bin/zsh';
      delete process.env['COMSPEC'];

      expect(getDefaultShell()).toBe('/bin/zsh');
    });

    it('getDefaultShell_OnMacOSWithoutShellEnvVar_FallsBackToZshIfExists', () => {
      delete process.env['SHELL'];
      delete process.env['COMSPEC'];

      mockExistsSync.mockImplementation((p: string) => p === '/bin/zsh');

      expect(getDefaultShell()).toBe('/bin/zsh');
    });

    it('getDefaultShell_OnMacOSWithoutZsh_FallsBackToBash', () => {
      delete process.env['SHELL'];
      delete process.env['COMSPEC'];

      mockExistsSync.mockReturnValue(false);

      expect(getDefaultShell()).toBe('/bin/bash');
    });
  });

  describe('on Windows', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        configurable: true,
      });
    });

    it('getDefaultShell_OnWindowsWithComspec_ReturnsComspecValue', () => {
      process.env['COMSPEC'] = 'C:\\Windows\\System32\\cmd.exe';

      expect(getDefaultShell()).toBe('C:\\Windows\\System32\\cmd.exe');
    });

    it('getDefaultShell_OnWindowsWithoutComspec_ReturnsPowershell', () => {
      delete process.env['COMSPEC'];

      expect(getDefaultShell()).toBe('powershell.exe');
    });
  });
});

// ── getDataPath ───────────────────────────────────────────────────────────────

describe('getDataPath', () => {
  it('getDataPath_Always_ReturnsCortexIdDirectoryUnderHome', () => {
    mockHomedir.mockReturnValue('/home/testuser');

    const dataPath = getDataPath();

    expect(dataPath).toBe(path.join('/home/testuser', '.cortex-id'));
  });

  it('getDataPath_WithDifferentHomeDir_UsesCorrectHome', () => {
    mockHomedir.mockReturnValue('/Users/anotheruser');

    const dataPath = getDataPath();

    expect(dataPath).toBe(path.join('/Users/anotheruser', '.cortex-id'));
  });

  it('getDataPath_ReturnedPath_EndsWithCortexId', () => {
    const dataPath = getDataPath();

    expect(dataPath).toMatch(/\.cortex-id$/);
  });
});

// ── ensureDataDir ─────────────────────────────────────────────────────────────

describe('ensureDataDir', () => {
  it('ensureDataDir_WhenDirectoryDoesNotExist_CreatesDataDirectory', () => {
    mockHomedir.mockReturnValue('/home/testuser');
    mockMkdirSync.mockReturnValue(undefined);

    ensureDataDir();

    expect(mockMkdirSync).toHaveBeenCalledWith(
      path.join('/home/testuser', '.cortex-id'),
      { recursive: true }
    );
  });

  it('ensureDataDir_Always_CreatesDbSubdirectory', () => {
    mockHomedir.mockReturnValue('/home/testuser');
    mockMkdirSync.mockReturnValue(undefined);

    ensureDataDir();

    const mkdirCalls = mockMkdirSync.mock.calls as Array<[string, object]>;
    const createdPaths = mkdirCalls.map(([p]) => p);

    expect(createdPaths).toContain(path.join('/home/testuser', '.cortex-id', 'db'));
  });

  it('ensureDataDir_Always_CreatesLogsSubdirectory', () => {
    mockHomedir.mockReturnValue('/home/testuser');
    mockMkdirSync.mockReturnValue(undefined);

    ensureDataDir();

    const mkdirCalls = mockMkdirSync.mock.calls as Array<[string, object]>;
    const createdPaths = mkdirCalls.map(([p]) => p);

    expect(createdPaths).toContain(path.join('/home/testuser', '.cortex-id', 'logs'));
  });

  it('ensureDataDir_Always_CreatesProjectsSubdirectory', () => {
    mockHomedir.mockReturnValue('/home/testuser');
    mockMkdirSync.mockReturnValue(undefined);

    ensureDataDir();

    const mkdirCalls = mockMkdirSync.mock.calls as Array<[string, object]>;
    const createdPaths = mkdirCalls.map(([p]) => p);

    expect(createdPaths).toContain(path.join('/home/testuser', '.cortex-id', 'projects'));
  });

  it('ensureDataDir_CreatesExactlyFourDirectories_RootPlusThreeSubdirs', () => {
    mockHomedir.mockReturnValue('/home/testuser');
    mockMkdirSync.mockReturnValue(undefined);

    ensureDataDir();

    // Should create: .cortex-id, .cortex-id/db, .cortex-id/logs, .cortex-id/projects
    expect(mockMkdirSync).toHaveBeenCalledTimes(4);
  });

  it('ensureDataDir_WhenMkdirThrows_DoesNotPropagateError', () => {
    mockHomedir.mockReturnValue('/home/testuser');
    mockMkdirSync.mockImplementation(() => {
      throw new Error('Permission denied');
    });

    // Should not throw — error is caught and logged
    expect(() => ensureDataDir()).not.toThrow();
  });
});
