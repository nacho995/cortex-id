/**
 * @file preload-api.types.ts
 * @description Type definition for the `window.cortex` API object exposed to
 *              the Angular renderer process via Electron's contextBridge.
 *
 * IMPACT: Changes here affect:
 *   - electron/preload/index.ts              (implementation must stay in sync)
 *   - frontend/src/app/core/ipc.service.ts   (consumer must stay in sync)
 *   - frontend/src/types/electron.d.ts       (global Window augmentation)
 *
 * Rule: Every method here maps 1-to-1 to an IPC_CHANNELS constant.
 * Listener methods return an "unsubscribe" function — always call it on destroy.
 */

import type {
  ReadFileRequest,
  ReadFileResponse,
  WriteFileRequest,
  WriteFileResponse,
  CreateDirectoryRequest,
  CreateDirectoryResponse,
  DeletePathRequest,
  DeletePathResponse,
  ListDirectoryRequest,
  ListDirectoryResponse,
  OpenDialogRequest,
  OpenDialogResponse,
  SaveDialogRequest,
  SaveDialogResponse,
  WatchDirectoryRequest,
  FileChangeEvent,
} from './file-system.types';

import type {
  TerminalCreateRequest,
  TerminalCreateResponse,
  TerminalInputRequest,
  TerminalResizeRequest,
  TerminalDestroyRequest,
  TerminalDataEvent,
  TerminalExitEvent,
} from './terminal.types';

import type {
  AppInfo,
  AppSettings,
  SetApiKeyRequest,
  GetApiKeyRequest,
  GetApiKeyResponse,
  RecentProject,
  WindowState,
} from './app.types';

/**
 * The API surface exposed on `window.cortex` by the Electron preload script.
 *
 * All methods are async (return Promises) except fire-and-forget operations
 * and event listener registrations.
 *
 * @example
 * // In Angular service:
 * const api = (window as ElectronWindow).cortex;
 * const info = await api.getAppInfo();
 */
export interface CortexBridgeAPI {
  // ── File System ─────────────────────────────────────────────────────────────

  /**
   * Read the contents of a file from disk.
   * @throws When the file does not exist or cannot be read.
   */
  readFile(request: ReadFileRequest): Promise<ReadFileResponse>;

  /**
   * Write content to a file on disk.
   * @throws When the path is not writable.
   */
  writeFile(request: WriteFileRequest): Promise<WriteFileResponse>;

  /** Create a new directory on disk. */
  createDirectory(request: CreateDirectoryRequest): Promise<CreateDirectoryResponse>;

  /** Delete a file or directory path. */
  deletePath(request: DeletePathRequest): Promise<DeletePathResponse>;

  /**
   * List the contents of a directory.
   * @throws When the path does not exist or is not a directory.
   */
  listDirectory(request: ListDirectoryRequest): Promise<ListDirectoryResponse>;

  /**
   * Open a native file/directory picker dialog.
   * Resolves with `canceled: true` when the user dismisses the dialog.
   */
  openDialog(request: OpenDialogRequest): Promise<OpenDialogResponse>;

  /**
   * Open a native save dialog.
   * Resolves with `canceled: true` when the user dismisses the dialog.
   */
  saveDialog(request: SaveDialogRequest): Promise<SaveDialogResponse>;

  /**
   * Start watching a directory for file system changes.
   * Changes are delivered via `onFileChange`.
   */
  watchDirectory(request: WatchDirectoryRequest): Promise<void>;

  /**
   * Register a callback for file system change events.
   * @returns An unsubscribe function — call it in ngOnDestroy to avoid leaks.
   */
  onFileChange(callback: (event: FileChangeEvent) => void): () => void;

  // ── Terminal ────────────────────────────────────────────────────────────────

  /**
   * Spawn a new PTY process and return its session ID.
   * @throws When the shell executable cannot be found.
   */
  createTerminal(request: TerminalCreateRequest): Promise<TerminalCreateResponse>;

  /**
   * Send raw input data to a PTY (fire-and-forget).
   * No-op when the terminal ID is unknown.
   */
  sendTerminalInput(request: TerminalInputRequest): void;

  /**
   * Resize a PTY to new dimensions (fire-and-forget).
   * Should be called whenever the xterm.js container is resized.
   */
  resizeTerminal(request: TerminalResizeRequest): void;

  /**
   * Destroy a PTY session and kill the underlying shell process (fire-and-forget).
   */
  destroyTerminal(request: TerminalDestroyRequest): void;

  /**
   * Register a callback for PTY output data events.
   * @returns An unsubscribe function — call it in ngOnDestroy to avoid leaks.
   */
  onTerminalData(callback: (event: TerminalDataEvent) => void): () => void;

  /**
   * Register a callback for PTY exit events.
   * @returns An unsubscribe function — call it in ngOnDestroy to avoid leaks.
   */
  onTerminalExit(callback: (event: TerminalExitEvent) => void): () => void;

  // ── App ─────────────────────────────────────────────────────────────────────

  /** Get static information about the running Electron application. */
  getAppInfo(): Promise<AppInfo>;

  /** Get the current persisted application settings. */
  getSettings(): Promise<AppSettings>;

  /**
   * Persist a partial settings update.
   * Only the provided keys are updated; the rest remain unchanged.
   */
  setSettings(settings: Partial<AppSettings>): Promise<void>;

  /**
   * Store an API key in the OS keychain.
   * The key is never written to disk.
   */
  setApiKey(request: SetApiKeyRequest): Promise<void>;

  /** Check whether an API key exists in the OS keychain. */
  getApiKey(request: GetApiKeyRequest): Promise<GetApiKeyResponse>;

  /** Get the list of recently opened projects, sorted by lastOpened descending. */
  getRecentProjects(): Promise<RecentProject[]>;

  /** Add or update a project in the recently opened list. */
  addRecentProject(project: RecentProject): Promise<void>;

  // ── Window ──────────────────────────────────────────────────────────────────

  /** Minimize the application window (fire-and-forget). */
  minimizeWindow(): void;

  /** Toggle maximize / restore the application window (fire-and-forget). */
  maximizeWindow(): void;

  /** Close the application window (fire-and-forget). */
  closeWindow(): void;

  /** Get the current window state (position, size, maximized, full-screen). */
  getWindowState(): Promise<WindowState>;
}

/**
 * Augmentation of the browser `Window` interface so Angular components can
 * access `window.cortex` with full type safety.
 *
 * @example
 * import type { ElectronWindow } from '@cortex-id/shared-types';
 * const api = (window as ElectronWindow).cortex;
 */
export interface ElectronWindow extends Window {
  /** The Cortex-ID bridge API injected by the Electron preload script. */
  cortex: CortexBridgeAPI;
}
