/**
 * @file terminal.types.ts
 * @description IPC contract types for PTY / terminal operations between
 *              Angular (renderer) and Electron (main process via node-pty).
 *
 * IMPACT: Changes here affect:
 *   - electron/src/ipc/terminal.handler.ts   (must update handler signatures)
 *   - electron/preload/index.ts              (must update contextBridge bindings)
 *   - frontend/src/app/workbench/terminal/   (must update terminal component)
 */

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/**
 * Request payload to spawn a new PTY process.
 * A unique terminal ID is returned in the response.
 */
export interface TerminalCreateRequest {
  /** Initial number of columns (default: 80). */
  cols?: number;
  /** Initial number of rows (default: 24). */
  rows?: number;
  /** Working directory for the shell process (default: user home). */
  cwd?: string;
  /** Shell executable to launch (default: system default shell). */
  shell?: string;
  /** Additional environment variables merged into the shell environment. */
  env?: Record<string, string>;
}

/** Response payload confirming that a PTY was created. */
export interface TerminalCreateResponse {
  /** Unique identifier for this terminal session. Used in all subsequent calls. */
  id: string;
  /** OS process ID of the spawned shell. */
  pid: number;
}

/** Request payload to destroy an existing terminal session. */
export interface TerminalDestroyRequest {
  /** ID of the terminal session to destroy. */
  id: string;
}

// ---------------------------------------------------------------------------
// Input / resize
// ---------------------------------------------------------------------------

/** Request payload to send raw input data to a PTY. */
export interface TerminalInputRequest {
  /** ID of the target terminal session. */
  id: string;
  /** Raw data string to write to the PTY (keystrokes, paste content, etc.). */
  data: string;
}

/** Request payload to resize a PTY to new dimensions. */
export interface TerminalResizeRequest {
  /** ID of the target terminal session. */
  id: string;
  /** New number of columns. */
  cols: number;
  /** New number of rows. */
  rows: number;
}

// ---------------------------------------------------------------------------
// Events (main → renderer)
// ---------------------------------------------------------------------------

/**
 * Event emitted whenever the PTY produces output.
 * Delivered to the renderer via IPC_CHANNELS.TERMINAL_DATA.
 */
export interface TerminalDataEvent {
  /** ID of the terminal session that produced the data. */
  id: string;
  /** Raw output string from the PTY (may contain ANSI escape sequences). */
  data: string;
}

/**
 * Event emitted when the shell process exits.
 * Delivered to the renderer via IPC_CHANNELS.TERMINAL_EXIT.
 */
export interface TerminalExitEvent {
  /** ID of the terminal session that exited. */
  id: string;
  /** Exit code returned by the shell process. */
  exitCode: number;
}
