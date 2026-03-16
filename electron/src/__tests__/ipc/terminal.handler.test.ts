/**
 * @file __tests__/ipc/terminal.handler.test.ts
 * @description Unit tests for terminal IPC handlers.
 *
 * Tests cover:
 *  - TERMINAL_CREATE  — creates PTY process, returns id and pid
 *  - TERMINAL_INPUT   — writes data to PTY
 *  - TERMINAL_RESIZE  — resizes PTY
 *  - TERMINAL_DESTROY — kills PTY process
 *  - Data events forwarded to renderer
 *  - Exit events forwarded to renderer
 */

import { IPC_CHANNELS } from '@cortex-id/shared-types';

// ── Mocks ────────────────────────────────────────────────────────────────────

// Electron is auto-mocked via moduleNameMapper → src/__mocks__/electron.ts
jest.mock('electron');

// node-pty is auto-mocked via moduleNameMapper → src/__mocks__/node-pty.ts
jest.mock('node-pty');

// Mock crypto.randomUUID to return predictable IDs
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn().mockReturnValue('test-terminal-id-1234'),
}));

// Mock platform module to avoid fs.existsSync calls
jest.mock('../../native/platform', () => ({
  getDefaultShell: jest.fn().mockReturnValue('/bin/bash'),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

type IpcHandleHandler = (_event: unknown, ...args: unknown[]) => Promise<unknown>;
type IpcOnListener = (_event: unknown, ...args: unknown[]) => void;

function getHandleHandler(ipcMainMock: { handle: jest.Mock }, channel: string): IpcHandleHandler | undefined {
  const calls = ipcMainMock.handle.mock.calls as Array<[string, IpcHandleHandler]>;
  const call = calls.find(([ch]) => ch === channel);
  return call?.[1];
}

function getOnListener(ipcMainMock: { on: jest.Mock }, channel: string): IpcOnListener | undefined {
  const calls = ipcMainMock.on.mock.calls as Array<[string, IpcOnListener]>;
  const call = calls.find(([ch]) => ch === channel);
  return call?.[1];
}

// ── Mock PTY process factory ─────────────────────────────────────────────────

function createMockPtyProcess(pid = 12345) {
  let dataCallback: ((data: string) => void) | null = null;
  let exitCallback: ((event: { exitCode: number }) => void) | null = null;

  return {
    pid,
    write: jest.fn(),
    resize: jest.fn(),
    kill: jest.fn(),
    onData: jest.fn().mockImplementation((cb: (data: string) => void) => {
      dataCallback = cb;
    }),
    onExit: jest.fn().mockImplementation((cb: (event: { exitCode: number }) => void) => {
      exitCallback = cb;
    }),
    // Test helpers to trigger callbacks
    _triggerData: (data: string) => dataCallback?.(data),
    _triggerExit: (exitCode: number) => exitCallback?.({ exitCode }),
  };
}

// ── Setup ────────────────────────────────────────────────────────────────────

import { ipcMain } from 'electron';
import * as nodePty from 'node-pty';
import { registerTerminalHandlers, destroyAllTerminals } from '../../ipc/terminal.handler';

const mockIpcMain = ipcMain as unknown as { handle: jest.Mock; on: jest.Mock };
const mockPtySpawn = nodePty.spawn as jest.Mock;

const mockMainWindow = {
  isDestroyed: jest.fn().mockReturnValue(false),
  webContents: { send: jest.fn() },
} as unknown as import('electron').BrowserWindow;

beforeEach(() => {
  jest.clearAllMocks();
  registerTerminalHandlers(mockMainWindow);
});

// ── TERMINAL_CREATE ───────────────────────────────────────────────────────────

describe('TERMINAL_CREATE handler', () => {
  it('TERMINAL_CREATE_WithDefaultOptions_SpawnsPtyAndReturnsIdAndPid', async () => {
    const mockPty = createMockPtyProcess(99999);
    mockPtySpawn.mockReturnValue(mockPty);

    const handler = getHandleHandler(mockIpcMain, IPC_CHANNELS.TERMINAL_CREATE);
    const result = await handler!(null, {}) as { id: string; pid: number };

    expect(result.id).toBe('test-terminal-id-1234');
    expect(result.pid).toBe(99999);
    expect(mockPtySpawn).toHaveBeenCalledWith(
      '/bin/bash',
      [],
      expect.objectContaining({
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
      })
    );
  });

  it('TERMINAL_CREATE_WithCustomShell_UsesProvidedShell', async () => {
    const mockPty = createMockPtyProcess();
    mockPtySpawn.mockReturnValue(mockPty);

    const handler = getHandleHandler(mockIpcMain, IPC_CHANNELS.TERMINAL_CREATE);
    await handler!(null, { shell: '/bin/zsh', cols: 120, rows: 40 });

    expect(mockPtySpawn).toHaveBeenCalledWith(
      '/bin/zsh',
      [],
      expect.objectContaining({ cols: 120, rows: 40 })
    );
  });

  it('TERMINAL_CREATE_WithCustomCwd_UsesCwdInSpawnOptions', async () => {
    const mockPty = createMockPtyProcess();
    mockPtySpawn.mockReturnValue(mockPty);

    const handler = getHandleHandler(mockIpcMain, IPC_CHANNELS.TERMINAL_CREATE);
    await handler!(null, { cwd: '/home/user/project' });

    expect(mockPtySpawn).toHaveBeenCalledWith(
      expect.any(String),
      [],
      expect.objectContaining({ cwd: '/home/user/project' })
    );
  });

  it('TERMINAL_CREATE_WithoutCwd_UsesUSERPROFILEWhenHOMEIsMissing', async () => {
    const originalHome = process.env['HOME'];
    const originalUserProfile = process.env['USERPROFILE'];
    delete process.env['HOME'];
    process.env['USERPROFILE'] = 'C:\\Users\\nacho';
    const mockPty = createMockPtyProcess();
    mockPtySpawn.mockReturnValue(mockPty);

    const handler = getHandleHandler(mockIpcMain, IPC_CHANNELS.TERMINAL_CREATE);
    await handler!(null, {});

    expect(mockPtySpawn).toHaveBeenCalledWith(
      expect.any(String),
      [],
      expect.objectContaining({ cwd: 'C:\\Users\\nacho' }),
    );

    process.env['HOME'] = originalHome;
    process.env['USERPROFILE'] = originalUserProfile;
  });

  it('TERMINAL_CREATE_WithEnvVars_MergesEnvWithProcessEnv', async () => {
    const mockPty = createMockPtyProcess();
    mockPtySpawn.mockReturnValue(mockPty);

    const handler = getHandleHandler(mockIpcMain, IPC_CHANNELS.TERMINAL_CREATE);
    await handler!(null, { env: { MY_VAR: 'my_value' } });

    expect(mockPtySpawn).toHaveBeenCalledWith(
      expect.any(String),
      [],
      expect.objectContaining({
        env: expect.objectContaining({
          MY_VAR: 'my_value',
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
        }),
      })
    );
  });

  it('TERMINAL_CREATE_WhenPtySpawnFails_ThrowsWrappedError', async () => {
    mockPtySpawn.mockImplementation(() => {
      throw new Error('spawn failed: java not found');
    });

    const handler = getHandleHandler(mockIpcMain, IPC_CHANNELS.TERMINAL_CREATE);

    await expect(handler!(null, {})).rejects.toThrow(
      'Failed to create terminal: spawn failed: java not found'
    );
  });
});

// ── TERMINAL_INPUT ────────────────────────────────────────────────────────────

describe('TERMINAL_INPUT listener', () => {
  it('TERMINAL_INPUT_WithValidId_WritesDataToPty', async () => {
    const mockPty = createMockPtyProcess();
    mockPtySpawn.mockReturnValue(mockPty);

    // First create a terminal to register it in activePtys
    const createHandler = getHandleHandler(mockIpcMain, IPC_CHANNELS.TERMINAL_CREATE);
    await createHandler!(null, {});

    // Now send input
    const inputListener = getOnListener(mockIpcMain, IPC_CHANNELS.TERMINAL_INPUT);
    inputListener!(null, { id: 'test-terminal-id-1234', data: 'ls -la\n' });

    expect(mockPty.write).toHaveBeenCalledWith('ls -la\n');
  });

  it('TERMINAL_INPUT_WithUnknownId_DoesNotThrow', () => {
    const inputListener = getOnListener(mockIpcMain, IPC_CHANNELS.TERMINAL_INPUT);

    // Should not throw — just logs a warning
    expect(() => {
      inputListener!(null, { id: 'nonexistent-id', data: 'some input' });
    }).not.toThrow();
  });
});

// ── TERMINAL_RESIZE ───────────────────────────────────────────────────────────

describe('TERMINAL_RESIZE listener', () => {
  it('TERMINAL_RESIZE_WithValidId_ResizesPty', async () => {
    const mockPty = createMockPtyProcess();
    mockPtySpawn.mockReturnValue(mockPty);

    const createHandler = getHandleHandler(mockIpcMain, IPC_CHANNELS.TERMINAL_CREATE);
    await createHandler!(null, {});

    const resizeListener = getOnListener(mockIpcMain, IPC_CHANNELS.TERMINAL_RESIZE);
    resizeListener!(null, { id: 'test-terminal-id-1234', cols: 200, rows: 50 });

    expect(mockPty.resize).toHaveBeenCalledWith(200, 50);
  });

  it('TERMINAL_RESIZE_WithUnknownId_DoesNotThrow', () => {
    const resizeListener = getOnListener(mockIpcMain, IPC_CHANNELS.TERMINAL_RESIZE);

    expect(() => {
      resizeListener!(null, { id: 'unknown-id', cols: 80, rows: 24 });
    }).not.toThrow();
  });
});

// ── TERMINAL_DESTROY ──────────────────────────────────────────────────────────

describe('TERMINAL_DESTROY listener', () => {
  it('TERMINAL_DESTROY_WithValidId_KillsPtyAndRemovesFromMap', async () => {
    const mockPty = createMockPtyProcess();
    mockPtySpawn.mockReturnValue(mockPty);

    const createHandler = getHandleHandler(mockIpcMain, IPC_CHANNELS.TERMINAL_CREATE);
    await createHandler!(null, {});

    const destroyListener = getOnListener(mockIpcMain, IPC_CHANNELS.TERMINAL_DESTROY);
    destroyListener!(null, { id: 'test-terminal-id-1234' });

    expect(mockPty.kill).toHaveBeenCalledTimes(1);
  });

  it('TERMINAL_DESTROY_WithUnknownId_DoesNotThrow', () => {
    const destroyListener = getOnListener(mockIpcMain, IPC_CHANNELS.TERMINAL_DESTROY);

    expect(() => {
      destroyListener!(null, { id: 'ghost-terminal' });
    }).not.toThrow();
  });
});

// ── Data events forwarded to renderer ────────────────────────────────────────

describe('TERMINAL_DATA event forwarding', () => {
  it('TERMINAL_DATA_WhenPtyEmitsData_SendsEventToRenderer', async () => {
    const mockPty = createMockPtyProcess();
    mockPtySpawn.mockReturnValue(mockPty);

    const createHandler = getHandleHandler(mockIpcMain, IPC_CHANNELS.TERMINAL_CREATE);
    await createHandler!(null, {});

    // Simulate PTY emitting data
    mockPty._triggerData('$ ls -la\r\n');

    expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
      IPC_CHANNELS.TERMINAL_DATA,
      { id: 'test-terminal-id-1234', data: '$ ls -la\r\n' }
    );
  });

  it('TERMINAL_DATA_WhenWindowIsDestroyed_DoesNotSendToRenderer', async () => {
    const mockPty = createMockPtyProcess();
    mockPtySpawn.mockReturnValue(mockPty);

    // Simulate destroyed window
    (mockMainWindow.isDestroyed as jest.Mock).mockReturnValue(true);

    const createHandler = getHandleHandler(mockIpcMain, IPC_CHANNELS.TERMINAL_CREATE);
    await createHandler!(null, {});

    mockPty._triggerData('some output');

    expect(mockMainWindow.webContents.send).not.toHaveBeenCalled();

    // Restore
    (mockMainWindow.isDestroyed as jest.Mock).mockReturnValue(false);
  });
});

// ── Exit events forwarded to renderer ────────────────────────────────────────

describe('TERMINAL_EXIT event forwarding', () => {
  it('TERMINAL_EXIT_WhenPtyExits_SendsExitEventToRenderer', async () => {
    const mockPty = createMockPtyProcess();
    mockPtySpawn.mockReturnValue(mockPty);

    const createHandler = getHandleHandler(mockIpcMain, IPC_CHANNELS.TERMINAL_CREATE);
    await createHandler!(null, {});

    // Simulate PTY exit
    mockPty._triggerExit(0);

    expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
      IPC_CHANNELS.TERMINAL_EXIT,
      { id: 'test-terminal-id-1234', exitCode: 0 }
    );
  });

  it('TERMINAL_EXIT_WhenPtyExitsWithNonZeroCode_SendsCorrectExitCode', async () => {
    const mockPty = createMockPtyProcess();
    mockPtySpawn.mockReturnValue(mockPty);

    const createHandler = getHandleHandler(mockIpcMain, IPC_CHANNELS.TERMINAL_CREATE);
    await createHandler!(null, {});

    mockPty._triggerExit(127);

    expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
      IPC_CHANNELS.TERMINAL_EXIT,
      { id: 'test-terminal-id-1234', exitCode: 127 }
    );
  });
});

// ── destroyAllTerminals ───────────────────────────────────────────────────────

describe('destroyAllTerminals', () => {
  it('destroyAllTerminals_WithActiveTerminals_KillsAllPtyProcesses', async () => {
    const mockPty1 = createMockPtyProcess(1001);
    const mockPty2 = createMockPtyProcess(1002);

    // Create two terminals with different IDs
    const { randomUUID } = jest.requireMock('crypto') as { randomUUID: jest.Mock };
    randomUUID
      .mockReturnValueOnce('terminal-1')
      .mockReturnValueOnce('terminal-2');

    mockPtySpawn
      .mockReturnValueOnce(mockPty1)
      .mockReturnValueOnce(mockPty2);

    const createHandler = getHandleHandler(mockIpcMain, IPC_CHANNELS.TERMINAL_CREATE);
    await createHandler!(null, {});
    await createHandler!(null, {});

    destroyAllTerminals();

    expect(mockPty1.kill).toHaveBeenCalledTimes(1);
    expect(mockPty2.kill).toHaveBeenCalledTimes(1);
  });
});
