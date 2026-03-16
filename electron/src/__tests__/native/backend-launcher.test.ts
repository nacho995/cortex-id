/**
 * @file __tests__/native/backend-launcher.test.ts
 * @description Unit tests for the Java backend launcher.
 *
 * Tests cover:
 *  - launchBackend spawns java process with correct args
 *  - waitForBackend polls health endpoint until ready
 *  - stopBackend kills process gracefully
 *  - getBackendJarPath returns correct path for dev and packaged modes
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

// Electron is auto-mocked via moduleNameMapper → src/__mocks__/electron.ts
jest.mock('electron');

// Mock child_process
const mockChildProcess = {
  pid: 54321,
  killed: false,
  stdout: { on: jest.fn() },
  stderr: { on: jest.fn() },
  on: jest.fn(),
  once: jest.fn(),
  kill: jest.fn(),
};

jest.mock('child_process', () => ({
  spawn: jest.fn().mockReturnValue(mockChildProcess),
}));

// Mock http module
const mockHttpGetReq = {
  on: jest.fn().mockReturnThis(),
  destroy: jest.fn(),
};

const mockHttpRequestReq = {
  on: jest.fn().mockReturnThis(),
  end: jest.fn(),
  destroy: jest.fn(),
};

jest.mock('http', () => ({
  get: jest.fn(),
  request: jest.fn(),
}));

// ── Types ─────────────────────────────────────────────────────────────────────

interface MockHttpReq {
  on: (event: string, cb: (err?: Error) => void) => MockHttpReq;
  destroy: jest.Mock;
  end?: jest.Mock;
}

// ── Imports ───────────────────────────────────────────────────────────────────

import { spawn } from 'child_process';
import * as http from 'http';
import { app } from 'electron';
import {
  launchBackend,
  waitForBackend,
  stopBackend,
  getBackendJarPath,
} from '../../native/backend-launcher';

const mockSpawn = spawn as jest.Mock;
const mockHttpGet = http.get as jest.Mock;
const mockHttpRequest = http.request as jest.Mock;
const mockApp = app as unknown as {
  getVersion: jest.Mock;
  getPath: jest.Mock;
  isPackaged: boolean;
};

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockChildProcess.killed = false;
  mockChildProcess.pid = 54321;

  // Restore spawn mock
  mockSpawn.mockReturnValue(mockChildProcess);

  // Restore http mocks
  mockHttpGetReq.on.mockReturnThis();
  mockHttpRequestReq.on.mockReturnThis();
});

// ── launchBackend ─────────────────────────────────────────────────────────────

describe('launchBackend', () => {
  it('launchBackend_InDevelopmentMode_SpawnsJavaWithCorrectArgs', () => {
    (mockApp as unknown as { isPackaged: boolean }).isPackaged = false;

    launchBackend();

    expect(mockSpawn).toHaveBeenCalledWith(
      'java',
      expect.arrayContaining([
        '-jar',
        expect.stringContaining('cortex-id-backend.jar'),
        '--server.port=7432',
        '--spring.profiles.active=prod',
      ]),
      expect.objectContaining({
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    );
  });

  it('launchBackend_InDevelopmentMode_JarPathPointsToBackendTarget', () => {
    (mockApp as unknown as { isPackaged: boolean }).isPackaged = false;

    launchBackend();

    const spawnArgs = mockSpawn.mock.calls[0] as [string, string[], object];
    const jarArg = spawnArgs[1].find((arg: string) => arg.endsWith('.jar'));
    expect(jarArg).toContain('backend');
    expect(jarArg).toContain('target');
    expect(jarArg).toContain('cortex-id-backend.jar');
  });

  it('launchBackend_SetsCorteXDataDirEnvVar', () => {
    mockApp.getPath.mockReturnValue('/mock/userData');
    (mockApp as unknown as { isPackaged: boolean }).isPackaged = false;

    launchBackend();

    const spawnOptions = mockSpawn.mock.calls[0][2] as { env: Record<string, string> };
    expect(spawnOptions.env).toHaveProperty('CORTEX_DATA_DIR');
    expect(spawnOptions.env['CORTEX_DATA_DIR']).toContain('data');
  });

  it('launchBackend_AttachesStdoutAndStderrListeners', () => {
    launchBackend();

    expect(mockChildProcess.stdout.on).toHaveBeenCalledWith('data', expect.any(Function));
    expect(mockChildProcess.stderr.on).toHaveBeenCalledWith('data', expect.any(Function));
  });

  it('launchBackend_AttachesErrorAndExitListeners', () => {
    launchBackend();

    const onCalls = mockChildProcess.on.mock.calls as Array<[string, unknown]>;
    const events = onCalls.map(([event]) => event);
    expect(events).toContain('error');
    expect(events).toContain('exit');
  });
});

// ── getBackendJarPath ─────────────────────────────────────────────────────────

describe('getBackendJarPath', () => {
  it('getBackendJarPath_InDevelopmentMode_ReturnsPathInBackendTarget', () => {
    (mockApp as unknown as { isPackaged: boolean }).isPackaged = false;

    const jarPath = getBackendJarPath();

    expect(jarPath).toContain('backend');
    expect(jarPath).toContain('target');
    expect(jarPath).toContain('cortex-id-backend.jar');
  });

  it('getBackendJarPath_InPackagedMode_ReturnsPathInResources', () => {
    (mockApp as unknown as { isPackaged: boolean }).isPackaged = true;

    const originalResourcesPath = process.resourcesPath;
    Object.defineProperty(process, 'resourcesPath', {
      value: '/Applications/Cortex-ID.app/Contents/Resources',
      configurable: true,
    });

    const jarPath = getBackendJarPath();

    expect(jarPath).toContain('Resources');
    expect(jarPath).toContain('backend');
    expect(jarPath).toContain('cortex-id-backend.jar');

    // Restore
    Object.defineProperty(process, 'resourcesPath', {
      value: originalResourcesPath,
      configurable: true,
    });
    (mockApp as unknown as { isPackaged: boolean }).isPackaged = false;
  });
});

// ── waitForBackend ────────────────────────────────────────────────────────────

describe('waitForBackend', () => {
  it('waitForBackend_WhenHealthCheckReturns200_Resolves', async () => {
    const mockResponse = { statusCode: 200 };

    mockHttpGet.mockImplementation(
      (_url: string, _options: object, callback: (res: typeof mockResponse) => void) => {
        callback(mockResponse);
        return mockHttpGetReq;
      }
    );

    await expect(waitForBackend()).resolves.toBeUndefined();
  });

  it('waitForBackend_WhenHealthCheckReturnsNon200_RetriesUntilSuccess', async () => {
    jest.useFakeTimers();

    let callCount = 0;
    mockHttpGet.mockImplementation(
      (_url: string, _options: object, callback: (res: { statusCode: number }) => void) => {
        callCount++;
        if (callCount < 3) {
          callback({ statusCode: 503 });
        } else {
          callback({ statusCode: 200 });
        }
        return mockHttpGetReq;
      }
    );

    const waitPromise = waitForBackend();

    // Advance timers to skip retry delays
    await jest.runAllTimersAsync();

    await expect(waitPromise).resolves.toBeUndefined();
    expect(callCount).toBeGreaterThanOrEqual(3);

    jest.useRealTimers();
  });

  it('waitForBackend_WhenHealthCheckAlwaysFails_ThrowsTimeoutError', async () => {
    jest.useFakeTimers();

    // Always return non-200 (never healthy)
    mockHttpGet.mockImplementation(
      (_url: string, _options: object, callback: (res: { statusCode: number }) => void) => {
        callback({ statusCode: 503 });
        return mockHttpGetReq;
      }
    );

    // Capture the rejection before advancing timers
    let caughtError: Error | null = null;
    const waitPromise = waitForBackend().catch((err: Error) => {
      caughtError = err;
    });

    // Advance past MAX_WAIT_MS (30 seconds) in steps to allow microtasks to run
    for (let i = 0; i < 70; i++) {
      await jest.advanceTimersByTimeAsync(500);
    }

    await waitPromise;

    expect(caughtError).not.toBeNull();
    expect((caughtError as unknown as Error).message).toContain('waiting for backend to start');

    jest.useRealTimers();
  }, 15_000);
});

// ── stopBackend ───────────────────────────────────────────────────────────────

describe('stopBackend', () => {
  it('stopBackend_WhenNoBackendProcess_ReturnsWithoutError', async () => {
    // backendProcess is null (no launchBackend called in this test)
    // We need a fresh module state — use a separate describe block approach
    // Since module state persists, we test the "already stopped" case
    // by calling stopBackend after a previous stop
    launchBackend();

    // Simulate process already exited
    mockChildProcess.killed = true;

    // Mock actuator shutdown failing (process already gone)
    mockHttpRequest.mockImplementation(
      (_options: object, _callback: unknown) => {
        const req: MockHttpReq = {
          on: jest.fn().mockImplementation((event: string, cb: (err: Error) => void) => {
            if (event === 'error') {
              setImmediate(() => cb(new Error('ECONNREFUSED')));
            }
            return req;
          }),
          end: jest.fn(),
          destroy: jest.fn(),
        };
        return req;
      }
    );

    // Should not throw
    await expect(stopBackend()).resolves.toBeUndefined();
  });

  it('stopBackend_WhenActuatorShutdownSucceeds_ResolvesCleanly', async () => {
    launchBackend();

    // Mock actuator shutdown endpoint responding successfully
    const mockResponse = { statusCode: 200, resume: jest.fn() };

    mockHttpRequest.mockImplementation(
      (_options: object, callback: (res: typeof mockResponse) => void) => {
        const req = {
          on: jest.fn().mockReturnThis(),
          end: jest.fn().mockImplementation(() => {
            setImmediate(() => callback(mockResponse));
          }),
          destroy: jest.fn(),
        };
        return req;
      }
    );

    // Mock process exit after actuator shutdown
    mockChildProcess.once.mockImplementation((event: string, cb: () => void) => {
      if (event === 'exit') {
        setImmediate(cb);
      }
    });

    await expect(stopBackend()).resolves.toBeUndefined();
  });

  it('stopBackend_WhenActuatorShutdownFails_SendsSigterm', async () => {
    launchBackend();

    // Mock actuator shutdown failing
    mockHttpRequest.mockImplementation(
      (_options: object, _callback: unknown) => {
        const req: MockHttpReq = {
          on: jest.fn().mockImplementation((event: string, cb: (err: Error) => void) => {
            if (event === 'error') {
              setImmediate(() => cb(new Error('Connection refused')));
            }
            return req;
          }),
          end: jest.fn(),
          destroy: jest.fn(),
        };
        return req;
      }
    );

    // Mock process exit after SIGTERM
    mockChildProcess.once.mockImplementation((event: string, cb: () => void) => {
      if (event === 'exit') {
        setImmediate(cb);
      }
    });

    await stopBackend();

    expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM');
  });
});
