/**
 * @file app.types.ts
 * @description IPC contract types for application-level operations: app info,
 *              settings, API key management, window control and recent projects.
 *
 * IMPACT: Changes here affect:
 *   - electron/src/ipc/app.handler.ts        (must update handler signatures)
 *   - electron/preload/index.ts              (must update contextBridge bindings)
 *   - frontend/src/app/core/ipc.service.ts   (must update service method signatures)
 *   - frontend/src/app/core/settings/        (must update settings models)
 */

// ---------------------------------------------------------------------------
// App info
// ---------------------------------------------------------------------------

/**
 * Static information about the running Electron application.
 * Returned once on startup; does not change at runtime.
 */
export interface AppInfo {
  /** Semantic version string (e.g. "0.1.0"). */
  version: string;
  /** Host operating system platform identifier. */
  platform: NodeJS.Platform;
  /** CPU architecture (e.g. "x64", "arm64"). */
  arch: string;
  /** Absolute path to the application data directory (~/.cortex-id/). */
  dataPath: string;
  /** True when running from a packaged distribution, false in development. */
  isPackaged: boolean;
}

// ---------------------------------------------------------------------------
// Window state
// ---------------------------------------------------------------------------

/** Bounding rectangle of the browser window in screen coordinates. */
export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Current state of the Electron BrowserWindow. */
export interface WindowState {
  /** True when the window is maximized. */
  isMaximized: boolean;
  /** True when the window is in full-screen mode. */
  isFullScreen: boolean;
  /** Window position and size. */
  bounds: WindowBounds;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/** UI colour theme preference. */
export type ThemeMode = 'dark' | 'light' | 'system';

/**
 * Persisted application settings.
 * Stored in the OS keychain / app data directory.
 * All fields have sensible defaults applied by the Electron main process.
 */
export interface AppSettings {
  // ── Appearance ────────────────────────────────────────────────────────────
  /** Colour theme. Default: 'dark'. */
  theme: ThemeMode;
  /** Editor font size in pixels. Default: 14. */
  fontSize: number;
  /** Editor font family. Default: 'JetBrains Mono, monospace'. */
  fontFamily: string;
  /** Number of spaces per tab stop. Default: 2. */
  tabSize: number;
  /** Enable word-wrap in the editor. Default: false. */
  wordWrap: boolean;
  /** Show the Monaco minimap. Default: true. */
  minimap: boolean;
  /** Enable font ligatures in the editor (e.g. => becomes →). Default: true. */
  fontLigatures: boolean;
  /** Show line numbers. Options: 'on', 'off', 'relative'. Default: 'on'. */
  lineNumbers: 'on' | 'off' | 'relative';
  /** Enable bracket pair colorization. Default: true. */
  bracketPairColorization: boolean;
  /** Render whitespace. Options: 'none', 'selection', 'all'. Default: 'selection'. */
  renderWhitespace: 'none' | 'selection' | 'all';
  /** Cursor blinking style. Default: 'smooth'. */
  cursorBlinking: 'blink' | 'smooth' | 'phase' | 'expand' | 'solid';
  /** Cursor style. Default: 'line'. */
  cursorStyle: 'line' | 'block' | 'underline' | 'line-thin' | 'block-outline' | 'underline-thin';
  /** Enable smooth scrolling in the editor. Default: true. */
  smoothScrolling: boolean;
  /** Enable code folding. Default: true. */
  folding: boolean;
  /** Show indent guides. Default: true. */
  guides: boolean;
  /** Scroll beyond last line. Default: false. */
  scrollBeyondLastLine: boolean;

  // ── AI ────────────────────────────────────────────────────────────────────
  /**
   * Active AI model identifier.
   * Examples: 'claude-3-5-sonnet-20241022', 'gpt-4o', 'ollama/llama3'.
   */
  aiModel: string;
  /** Base URL for a local Ollama instance (e.g. 'http://localhost:11434'). */
  ollamaUrl?: string;

  // ── Editor behaviour ──────────────────────────────────────────────────────
  /** Automatically save files after a period of inactivity. Default: true. */
  autoSave: boolean;
  /** Delay in milliseconds before auto-saving. Default: 1000. */
  autoSaveDelay: number;
}

// ---------------------------------------------------------------------------
// API key management
// ---------------------------------------------------------------------------

/**
 * Supported external AI service providers for OS keychain storage.
 *
 * IMPACT: Adding a value here requires updates in:
 *   - electron/src/ipc/app.handler.ts   (keychain read/write switch)
 *   - frontend/src/app/core/settings/   (provider settings UI)
 *   - shared-types/src/ws/messages.types.ts  (AiProvider must stay aligned)
 */
export type ApiKeyService = 'anthropic' | 'openai' | 'google';

/** Request payload to store an API key in the OS keychain. */
export interface SetApiKeyRequest {
  /** Target service. */
  service: ApiKeyService;
  /** Plain-text API key — never logged or persisted to disk. */
  key: string;
}

/** Request payload to check whether an API key exists in the OS keychain. */
export interface GetApiKeyRequest {
  /** Target service. */
  service: ApiKeyService;
}

/** Response payload for an API key existence check. */
export interface GetApiKeyResponse {
  /** Service that was queried. */
  service: ApiKeyService;
  /** True when a key is stored for this service. */
  exists: boolean;
  /**
   * Partially masked key for display purposes (e.g. "sk-ant-…XYZ").
   * Only present when `exists` is true.
   */
  maskedKey?: string;
  /**
   * Optional raw key for trusted renderer flows (e.g. backend re-sync after reconnect).
   * Undefined when the key does not exist or cannot be read.
   */
  rawKey?: string;
}

// ---------------------------------------------------------------------------
// Recent projects
// ---------------------------------------------------------------------------

/** A project entry in the "recently opened" list. */
export interface RecentProject {
  /** Absolute path to the project root directory. */
  path: string;
  /** Human-readable project name (usually the directory base name). */
  name: string;
  /** Timestamp (ms since epoch) when the project was last opened. */
  lastOpened: number;
}
