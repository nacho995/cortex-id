/**
 * @file ipc/terminal.handler.ts
 * @description IPC handlers for PTY / terminal operations using node-pty.
 *
 * Handles:
 *  - TERMINAL_CREATE  — spawn a new PTY process
 *  - TERMINAL_INPUT   — write raw input to a PTY (fire-and-forget via ipcMain.on)
 *  - TERMINAL_RESIZE  — resize PTY dimensions (fire-and-forget via ipcMain.on)
 *  - TERMINAL_DESTROY — kill a PTY session (fire-and-forget via ipcMain.on)
 *
 * Pushes to renderer:
 *  - TERMINAL_DATA — PTY output data
 *  - TERMINAL_EXIT — PTY process exit
 */

import { ipcMain, BrowserWindow } from 'electron';
import * as pty from 'node-pty';
import * as crypto from 'crypto';
import type {
  TerminalCreateRequest,
  TerminalCreateResponse,
  TerminalInputRequest,
  TerminalResizeRequest,
  TerminalDestroyRequest,
  TerminalDataEvent,
  TerminalExitEvent,
} from '@cortex-id/shared-types';
import { IPC_CHANNELS } from '@cortex-id/shared-types';
import { getDefaultShell } from '../native/platform';

// ── Active PTY sessions ──────────────────────────────────────────────────────

/** Map of terminal session ID → IPty instance */
const activePtys = new Map<string, pty.IPty>();

// ── Handler registration ─────────────────────────────────────────────────────

/**
 * Registers all terminal IPC handlers.
 * Must be called after the BrowserWindow is created.
 */
export function registerTerminalHandlers(mainWindow: BrowserWindow): void {
  console.log('[IPC] Registering terminal handlers');

  // ── TERMINAL_CREATE ────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.TERMINAL_CREATE, async (_event, request: TerminalCreateRequest): Promise<TerminalCreateResponse> => {
    const id = crypto.randomUUID();
    const shell = request.shell ?? getDefaultShell();
    const cols = request.cols ?? 80;
    const rows = request.rows ?? 24;
    const cwd = request.cwd ?? process.env['HOME'] ?? process.env['USERPROFILE'] ?? process.cwd();

    console.log(`[IPC] TERMINAL_CREATE id=${id} shell=${shell} cwd=${cwd} cols=${cols} rows=${rows}`);

    try {
      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols,
        rows,
        cwd,
        env: {
          ...process.env,
          ...request.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
        } as Record<string, string>,
      });

      // Push PTY output to renderer
      ptyProcess.onData((data: string) => {
        if (!mainWindow.isDestroyed()) {
          const event: TerminalDataEvent = { id, data };
          mainWindow.webContents.send(IPC_CHANNELS.TERMINAL_DATA, event);
        }
      });

      // Push PTY exit to renderer
      ptyProcess.onExit(({ exitCode }) => {
        console.log(`[IPC] TERMINAL_EXIT id=${id} exitCode=${exitCode}`);
        activePtys.delete(id);
        if (!mainWindow.isDestroyed()) {
          const event: TerminalExitEvent = { id, exitCode };
          mainWindow.webContents.send(IPC_CHANNELS.TERMINAL_EXIT, event);
        }
      });

      activePtys.set(id, ptyProcess);

      return { id, pid: ptyProcess.pid };
    } catch (err) {
      console.error(`[IPC] TERMINAL_CREATE error:`, err);
      throw new Error(`Failed to create terminal: ${(err as Error).message}`);
    }
  });

  // ── TERMINAL_INPUT ─────────────────────────────────────────────────────────
  // Fire-and-forget: use ipcMain.on (not handle)
  ipcMain.on(IPC_CHANNELS.TERMINAL_INPUT, (_event, request: TerminalInputRequest) => {
    const ptyProcess = activePtys.get(request.id);
    if (!ptyProcess) {
      console.warn(`[IPC] TERMINAL_INPUT: unknown terminal id=${request.id}`);
      return;
    }
    try {
      ptyProcess.write(request.data);
    } catch (err) {
      console.error(`[IPC] TERMINAL_INPUT error for id=${request.id}:`, err);
    }
  });

  // ── TERMINAL_RESIZE ────────────────────────────────────────────────────────
  // Fire-and-forget: use ipcMain.on (not handle)
  ipcMain.on(IPC_CHANNELS.TERMINAL_RESIZE, (_event, request: TerminalResizeRequest) => {
    const ptyProcess = activePtys.get(request.id);
    if (!ptyProcess) {
      console.warn(`[IPC] TERMINAL_RESIZE: unknown terminal id=${request.id}`);
      return;
    }
    try {
      ptyProcess.resize(request.cols, request.rows);
      console.log(`[IPC] TERMINAL_RESIZE id=${request.id} cols=${request.cols} rows=${request.rows}`);
    } catch (err) {
      console.error(`[IPC] TERMINAL_RESIZE error for id=${request.id}:`, err);
    }
  });

  // ── TERMINAL_DESTROY ───────────────────────────────────────────────────────
  // Fire-and-forget: use ipcMain.on (not handle)
  ipcMain.on(IPC_CHANNELS.TERMINAL_DESTROY, (_event, request: TerminalDestroyRequest) => {
    const ptyProcess = activePtys.get(request.id);
    if (!ptyProcess) {
      console.warn(`[IPC] TERMINAL_DESTROY: unknown terminal id=${request.id}`);
      return;
    }
    try {
      ptyProcess.kill();
      activePtys.delete(request.id);
      console.log(`[IPC] TERMINAL_DESTROY id=${request.id}`);
    } catch (err) {
      console.error(`[IPC] TERMINAL_DESTROY error for id=${request.id}:`, err);
    }
  });

  console.log('[IPC] Terminal handlers registered');
}

/**
 * Kills all active PTY sessions.
 * Called during graceful shutdown.
 */
export function destroyAllTerminals(): void {
  console.log(`[IPC] Destroying ${activePtys.size} active terminal(s)`);
  for (const [id, ptyProcess] of activePtys.entries()) {
    try {
      ptyProcess.kill();
      console.log(`[IPC] Terminal ${id} killed`);
    } catch (err) {
      console.error(`[IPC] Error killing terminal ${id}:`, err);
    }
  }
  activePtys.clear();
}
