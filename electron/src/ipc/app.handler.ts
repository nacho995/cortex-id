/**
 * @file ipc/app.handler.ts
 * @description IPC handlers for application-level operations.
 *
 * Handles:
 *  - APP_GET_INFO          — static app info (version, platform, etc.)
 *  - APP_GET_SETTINGS      — read persisted settings from electron-store
 *  - APP_SET_SETTINGS      — write settings to electron-store
 *  - APP_SET_API_KEY       — store API key in OS keychain via keytar
 *  - APP_GET_API_KEY       — retrieve masked API key from OS keychain
 *  - APP_GET_RECENT_PROJECTS — read recent projects list
 *  - APP_ADD_RECENT_PROJECT  — add/update recent project (max 10)
 */

import { ipcMain, app } from 'electron';
import Store from 'electron-store';
import type {
  AppInfo,
  AppSettings,
  SetApiKeyRequest,
  GetApiKeyRequest,
  GetApiKeyResponse,
  RecentProject,
} from '@cortex-id/shared-types';
import { IPC_CHANNELS } from '@cortex-id/shared-types';
import { getDataPath } from '../native/platform';

// ── electron-store schema ────────────────────────────────────────────────────

interface StoreSchema {
  settings: AppSettings;
  recentProjects: RecentProject[];
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  fontSize: 14,
  fontFamily: 'JetBrains Mono, monospace',
  tabSize: 2,
  wordWrap: false,
  minimap: true,
  fontLigatures: true,
  lineNumbers: 'on',
  bracketPairColorization: true,
  renderWhitespace: 'selection',
  cursorBlinking: 'smooth',
  cursorStyle: 'line',
  smoothScrolling: true,
  folding: true,
  guides: true,
  scrollBeyondLastLine: false,
  aiModel: 'claude-3-5-sonnet-20241022',
  ollamaUrl: 'http://localhost:11434',
  autoSave: true,
  autoSaveDelay: 1000,
};

const store = new Store<StoreSchema>({
  name: 'cortex-id-settings',
  defaults: {
    settings: DEFAULT_SETTINGS,
    recentProjects: [],
  },
});

// ── Keytar (lazy import — native module) ─────────────────────────────────────

const KEYTAR_SERVICE = 'cortex-id';

async function getKeytar() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('keytar') as typeof import('keytar');
}

// ── Handler registration ─────────────────────────────────────────────────────

/**
 * Registers all app-level IPC handlers.
 */
export function registerAppHandlers(): void {
  console.log('[IPC] Registering app handlers');

  // ── APP_GET_INFO ───────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.APP_GET_INFO, async (): Promise<AppInfo> => {
    console.log('[IPC] APP_GET_INFO');
    return {
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      dataPath: getDataPath(),
      isPackaged: app.isPackaged,
    };
  });

  // ── APP_GET_SETTINGS ───────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.APP_GET_SETTINGS, async (): Promise<AppSettings> => {
    console.log('[IPC] APP_GET_SETTINGS');
    try {
      const settings = store.get('settings', DEFAULT_SETTINGS);
      // Merge with defaults to handle new fields added in updates
      return { ...DEFAULT_SETTINGS, ...settings };
    } catch (err) {
      console.error('[IPC] APP_GET_SETTINGS error:', err);
      return DEFAULT_SETTINGS;
    }
  });

  // ── APP_SET_SETTINGS ───────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.APP_SET_SETTINGS, async (_event, partialSettings: Partial<AppSettings>): Promise<void> => {
    console.log('[IPC] APP_SET_SETTINGS', Object.keys(partialSettings));
    try {
      const current = store.get('settings', DEFAULT_SETTINGS);
      const updated: AppSettings = { ...current, ...partialSettings };
      store.set('settings', updated);
    } catch (err) {
      console.error('[IPC] APP_SET_SETTINGS error:', err);
      throw new Error(`Failed to save settings: ${(err as Error).message}`);
    }
  });

  // ── APP_SET_API_KEY ────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.APP_SET_API_KEY, async (_event, request: SetApiKeyRequest): Promise<void> => {
    console.log(`[IPC] APP_SET_API_KEY service=${request.service}`);
    try {
      const keytar = await getKeytar();
      await keytar.setPassword(KEYTAR_SERVICE, request.service, request.key);
      console.log(`[IPC] API key stored for service=${request.service}`);
    } catch (err) {
      console.error(`[IPC] APP_SET_API_KEY error for service=${request.service}:`, err);
      throw new Error(`Failed to store API key: ${(err as Error).message}`);
    }
  });

  // ── APP_GET_API_KEY ────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.APP_GET_API_KEY, async (_event, request: GetApiKeyRequest): Promise<GetApiKeyResponse> => {
    console.log(`[IPC] APP_GET_API_KEY service=${request.service}`);
    try {
      const keytar = await getKeytar();
      const key = await keytar.getPassword(KEYTAR_SERVICE, request.service);

      if (!key) {
        return { service: request.service, exists: false };
      }

      // Mask the key for display: show first 7 chars and last 4 chars
      const maskedKey = maskApiKey(key);
      return { service: request.service, exists: true, maskedKey, rawKey: key };
    } catch (err) {
      console.error(`[IPC] APP_GET_API_KEY error for service=${request.service}:`, err);
      // Return "not found" rather than throwing — keytar may not be available
      return { service: request.service, exists: false };
    }
  });

  // ── APP_GET_RECENT_PROJECTS ────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.APP_GET_RECENT_PROJECTS, async (): Promise<RecentProject[]> => {
    console.log('[IPC] APP_GET_RECENT_PROJECTS');
    try {
      const projects = store.get('recentProjects', []);
      // Sort by lastOpened descending (most recent first)
      return [...projects].sort((a, b) => b.lastOpened - a.lastOpened);
    } catch (err) {
      console.error('[IPC] APP_GET_RECENT_PROJECTS error:', err);
      return [];
    }
  });

  // ── APP_ADD_RECENT_PROJECT ─────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.APP_ADD_RECENT_PROJECT, async (_event, project: RecentProject): Promise<void> => {
    console.log(`[IPC] APP_ADD_RECENT_PROJECT path=${project.path}`);
    try {
      const projects = store.get('recentProjects', []);

      // Remove existing entry for the same path (if any)
      const filtered = projects.filter((p) => p.path !== project.path);

      // Add the new entry at the front
      const updated = [project, ...filtered];

      // Keep only the 10 most recent
      const trimmed = updated.slice(0, 10);

      store.set('recentProjects', trimmed);
    } catch (err) {
      console.error('[IPC] APP_ADD_RECENT_PROJECT error:', err);
      throw new Error(`Failed to add recent project: ${(err as Error).message}`);
    }
  });

  console.log('[IPC] App handlers registered');
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Masks an API key for safe display.
 * Shows the first 7 characters and the last 4, with "…" in between.
 * Example: "sk-ant-api03-XXXX…YYYY"
 */
function maskApiKey(key: string): string {
  if (key.length <= 11) {
    return '***';
  }
  const prefix = key.slice(0, 7);
  const suffix = key.slice(-4);
  return `${prefix}…${suffix}`;
}
