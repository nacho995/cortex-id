/**
 * @file channels.ts
 * @description Canonical IPC channel name constants used by both the Electron
 *              main process (handlers) and the Angular renderer (via preload API).
 *
 * IMPACT: Renaming or removing a channel breaks:
 *   - electron/src/ipc/*.handler.ts   (ipcMain.handle registrations)
 *   - electron/preload/index.ts       (ipcRenderer.invoke / .on calls)
 *   - frontend/src/app/core/ipc.service.ts (if channels are referenced directly)
 *
 * Convention: '<domain>:<action>'
 *   - domain  = functional area (fs, terminal, app, window)
 *   - action  = verb or noun describing the operation
 */

export const IPC_CHANNELS = {
  // ── File System ────────────────────────────────────────────────────────────
  /** Read the contents of a file. invoke → ReadFileResponse */
  FILE_READ: 'fs:read',
  /** Write content to a file. invoke → WriteFileResponse */
  FILE_WRITE: 'fs:write',
  /** Create a directory. invoke → CreateDirectoryResponse */
  FILE_CREATE_DIR: 'fs:create-dir',
  /** Delete a file or directory. invoke → DeletePathResponse */
  FILE_DELETE: 'fs:delete',
  /** List the contents of a directory. invoke → ListDirectoryResponse */
  FILE_LIST_DIR: 'fs:list-dir',
  /** Open a native file/directory picker dialog. invoke → OpenDialogResponse */
  FILE_OPEN_DIALOG: 'fs:open-dialog',
  /** Open a native save dialog. invoke → SaveDialogResponse */
  FILE_SAVE_DIALOG: 'fs:save-dialog',
  /** Start watching a directory for changes. invoke → void */
  FILE_WATCH: 'fs:watch',
  /** Pushed from main → renderer when a watched file changes. on → FileChangeEvent */
  FILE_CHANGE: 'fs:file-change',

  // ── Terminal ───────────────────────────────────────────────────────────────
  /** Spawn a new PTY process. invoke → TerminalCreateResponse */
  TERMINAL_CREATE: 'terminal:create',
  /** Send raw input to a PTY. send (fire-and-forget) */
  TERMINAL_INPUT: 'terminal:input',
  /** Resize a PTY. send (fire-and-forget) */
  TERMINAL_RESIZE: 'terminal:resize',
  /** Pushed from main → renderer with PTY output. on → TerminalDataEvent */
  TERMINAL_DATA: 'terminal:data',
  /** Pushed from main → renderer when the shell exits. on → TerminalExitEvent */
  TERMINAL_EXIT: 'terminal:exit',
  /** Destroy a PTY session. send (fire-and-forget) */
  TERMINAL_DESTROY: 'terminal:destroy',

  // ── App ────────────────────────────────────────────────────────────────────
  /** Get static application info. invoke → AppInfo */
  APP_GET_INFO: 'app:get-info',
  /** Get persisted application settings. invoke → AppSettings */
  APP_GET_SETTINGS: 'app:get-settings',
  /** Persist updated application settings. invoke → void */
  APP_SET_SETTINGS: 'app:set-settings',
  /** Store an API key in the OS keychain. invoke → void */
  APP_SET_API_KEY: 'app:set-api-key',
  /** Check whether an API key exists in the OS keychain. invoke → GetApiKeyResponse */
  APP_GET_API_KEY: 'app:get-api-key',
  /** Get the list of recently opened projects. invoke → RecentProject[] */
  APP_GET_RECENT_PROJECTS: 'app:get-recent-projects',
  /** Add or update a project in the recently opened list. invoke → void */
  APP_ADD_RECENT_PROJECT: 'app:add-recent-project',

  // ── Window ─────────────────────────────────────────────────────────────────
  /** Minimize the browser window. send (fire-and-forget) */
  WINDOW_MINIMIZE: 'window:minimize',
  /** Toggle maximize / restore the browser window. send (fire-and-forget) */
  WINDOW_MAXIMIZE: 'window:maximize',
  /** Close the browser window. send (fire-and-forget) */
  WINDOW_CLOSE: 'window:close',
  /** Get the current window state. invoke → WindowState */
  WINDOW_GET_STATE: 'window:get-state',
} as const;

/** Union type of all valid IPC channel strings. */
export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
