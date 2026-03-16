/**
 * @file native/platform.ts
 * @description Platform-specific utilities for Cortex-ID.
 *
 * Provides:
 *  - getDefaultShell()  — platform-appropriate shell executable
 *  - getDataPath()      — path to the Cortex-ID data directory
 *  - ensureDataDir()    — create the data directory if it doesn't exist
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ── Shell detection ──────────────────────────────────────────────────────────

/**
 * Returns the default shell executable for the current platform.
 *
 * Priority:
 *  1. SHELL environment variable (Linux/macOS)
 *  2. COMSPEC environment variable (Windows)
 *  3. Platform-specific fallback
 */
export function getDefaultShell(): string {
  switch (process.platform) {
    case 'win32':
      return process.env['COMSPEC'] ?? 'powershell.exe';

    case 'darwin': {
      // Prefer zsh on macOS (default since Catalina), fall back to bash
      const shellEnv = process.env['SHELL'];
      if (shellEnv) return shellEnv;

      // Check if zsh is available
      if (fs.existsSync('/bin/zsh')) return '/bin/zsh';
      return '/bin/bash';
    }

    default: {
      // Linux and other Unix-like systems
      const shellEnv = process.env['SHELL'];
      if (shellEnv) return shellEnv;

      // Common shell fallback order
      const candidates = ['/bin/bash', '/bin/sh', '/usr/bin/bash'];
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) return candidate;
      }
      return '/bin/sh';
    }
  }
}

// ── Data directory ───────────────────────────────────────────────────────────

/**
 * Returns the absolute path to the Cortex-ID data directory.
 * This is where SQLite databases, project memories, and other
 * persistent data are stored.
 *
 * Path: ~/.cortex-id/
 */
export function getDataPath(): string {
  return path.join(os.homedir(), '.cortex-id');
}

/**
 * Creates the Cortex-ID data directory and its subdirectories
 * if they do not already exist.
 *
 * Directory structure:
 *  ~/.cortex-id/
 *  ├── db/          — SQLite databases
 *  ├── logs/        — Application logs
 *  └── projects/    — Per-project memory and metadata
 */
export function ensureDataDir(): void {
  const dataPath = getDataPath();
  const subdirs = ['db', 'logs', 'projects'];

  try {
    fs.mkdirSync(dataPath, { recursive: true });
    console.log(`[Electron] Data directory ensured: ${dataPath}`);

    for (const subdir of subdirs) {
      const subdirPath = path.join(dataPath, subdir);
      fs.mkdirSync(subdirPath, { recursive: true });
    }
  } catch (err) {
    console.error(`[Electron] Failed to create data directory at ${dataPath}:`, err);
    // Non-fatal — the app can still run without the data directory
  }
}
