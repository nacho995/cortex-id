/**
 * @file native/backend-launcher.ts
 * @description Java Spring Boot backend lifecycle management.
 *
 * Responsibilities:
 *  - Spawn the Java backend JAR as a child process
 *  - Poll the health endpoint until the backend is ready
 *  - Gracefully shut down the backend on app quit
 *  - Resolve the JAR path for both dev and packaged modes
 */

import { app } from 'electron';
import * as path from 'path';
import * as http from 'http';
import { spawn, ChildProcess } from 'child_process';

// ── Constants ────────────────────────────────────────────────────────────────

const BACKEND_PORT = 7432;
const HEALTH_ENDPOINT = `http://localhost:${BACKEND_PORT}/actuator/health`;
const SHUTDOWN_ENDPOINT = `http://localhost:${BACKEND_PORT}/actuator/shutdown`;

/** Maximum time to wait for backend startup (30 seconds) */
const MAX_WAIT_MS = 30_000;
/** Initial retry delay in ms (exponential backoff) */
const INITIAL_RETRY_DELAY_MS = 500;
/** Maximum retry delay cap */
const MAX_RETRY_DELAY_MS = 3_000;

// ── State ────────────────────────────────────────────────────────────────────

let backendProcess: ChildProcess | null = null;

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Spawns the Java backend as a child process.
 * Stdout/stderr are piped and logged with the [Backend] prefix.
 */
export function launchBackend(): void {
  const jarPath = getBackendJarPath();
  console.log(`[Backend] Launching JAR: ${jarPath}`);

  const javaArgs = [
    '-jar',
    jarPath,
    `--server.port=${BACKEND_PORT}`,
    '--spring.profiles.active=prod',
  ];

  backendProcess = spawn('java', javaArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      CORTEX_DATA_DIR: path.join(app.getPath('userData'), 'data'),
    },
  });

  backendProcess.stdout?.on('data', (data: Buffer) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach((line) => console.log(`[Backend] ${line}`));
  });

  backendProcess.stderr?.on('data', (data: Buffer) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach((line) => console.error(`[Backend] ${line}`));
  });

  backendProcess.on('error', (err) => {
    console.error('[Backend] Process error:', err);
    backendProcess = null;
  });

  backendProcess.on('exit', (code, signal) => {
    console.log(`[Backend] Process exited — code=${code} signal=${signal}`);
    backendProcess = null;
  });

  console.log(`[Backend] Process spawned with PID=${backendProcess.pid}`);
}

/**
 * Polls the backend health endpoint until it responds with 200 OK.
 * Uses exponential backoff with a maximum wait of 30 seconds.
 *
 * @throws Error if the backend does not become healthy within MAX_WAIT_MS
 */
export async function waitForBackend(): Promise<void> {
  console.log(`[Backend] Waiting for health check at ${HEALTH_ENDPOINT}...`);

  const startTime = Date.now();
  let delay = INITIAL_RETRY_DELAY_MS;

  while (Date.now() - startTime < MAX_WAIT_MS) {
    try {
      const healthy = await checkHealth();
      if (healthy) {
        const elapsed = Date.now() - startTime;
        console.log(`[Backend] Health check passed after ${elapsed}ms`);
        return;
      }
    } catch {
      // Not ready yet — continue polling
    }

    console.log(`[Backend] Not ready yet, retrying in ${delay}ms...`);
    await sleep(delay);

    // Exponential backoff with cap
    delay = Math.min(delay * 1.5, MAX_RETRY_DELAY_MS);
  }

  throw new Error(`[Backend] Timed out after ${MAX_WAIT_MS}ms waiting for backend to start`);
}

/**
 * Gracefully shuts down the Java backend.
 * First tries the Spring Boot actuator shutdown endpoint,
 * then falls back to SIGTERM if the process is still running.
 */
export async function stopBackend(): Promise<void> {
  if (!backendProcess) {
    console.log('[Backend] No backend process to stop');
    return;
  }

  console.log('[Backend] Initiating graceful shutdown...');

  // Try actuator shutdown endpoint first
  try {
    await httpPost(SHUTDOWN_ENDPOINT);
    console.log('[Backend] Shutdown request sent via actuator');

    // Wait up to 5 seconds for graceful shutdown
    await waitForProcessExit(5_000);
    return;
  } catch (err) {
    console.warn('[Backend] Actuator shutdown failed, falling back to SIGTERM:', err);
  }

  // Fallback: send SIGTERM
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill('SIGTERM');
    console.log('[Backend] SIGTERM sent');

    // Wait up to 3 seconds, then SIGKILL
    await waitForProcessExit(3_000);

    if (backendProcess && !backendProcess.killed) {
      backendProcess.kill('SIGKILL');
      console.log('[Backend] SIGKILL sent');
    }
  }

  backendProcess = null;
}

/**
 * Resolves the path to the backend JAR file.
 * - In development: looks for the JAR in the backend/target/ directory
 * - In production: looks in the extraResources directory
 */
export function getBackendJarPath(): string {
  if (app.isPackaged) {
    // In packaged app, the JAR is in the resources directory
    return path.join(process.resourcesPath, 'backend', 'cortex-id-backend.jar');
  } else {
    // In development, look for the JAR in the backend/target directory
    const projectRoot = path.join(__dirname, '..', '..', '..', '..');
    return path.join(projectRoot, 'backend', 'target', 'cortex-id-backend.jar');
  }
}

// ── Private helpers ──────────────────────────────────────────────────────────

/**
 * Performs a single HTTP GET health check.
 * Returns true if the response status is 200.
 */
function checkHealth(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const req = http.get(HEALTH_ENDPOINT, { timeout: 2_000 }, (res) => {
      resolve(res.statusCode === 200);
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Health check timed out'));
    });
  });
}

/**
 * Sends an HTTP POST request (used for actuator shutdown).
 */
function httpPost(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'POST',
      timeout: 3_000,
    };

    const req = http.request(options, (res) => {
      res.resume(); // Consume response body
      if (res.statusCode && res.statusCode < 400) {
        resolve();
      } else {
        reject(new Error(`HTTP ${res.statusCode}`));
      }
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    req.end();
  });
}

/**
 * Waits for the backend process to exit, up to the given timeout.
 */
function waitForProcessExit(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    if (!backendProcess || backendProcess.killed) {
      resolve();
      return;
    }

    const timer = setTimeout(resolve, timeoutMs);

    backendProcess.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

/**
 * Returns a Promise that resolves after the given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
