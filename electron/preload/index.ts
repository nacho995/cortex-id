/**
 * @file preload/index.ts
 * @description Electron preload script — exposes a secure, typed API to the
 *              Angular renderer process via contextBridge.
 *
 * Security rules:
 *  - NEVER expose ipcRenderer directly to the renderer
 *  - NEVER expose Node.js APIs (fs, path, process, etc.) directly
 *  - ALL communication goes through typed wrapper functions
 *  - Event listeners return unsubscribe functions to prevent memory leaks
 *
 * The exposed API surface is defined by CortexBridgeAPI in shared-types.
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { IpcRendererEvent } from 'electron';
import type { CortexBridgeAPI } from '@cortex-id/shared-types';
import { IPC_CHANNELS } from '@cortex-id/shared-types';

import type {
  ReadFileRequest,
  WriteFileRequest,
  ListDirectoryRequest,
  OpenDialogRequest,
  SaveDialogRequest,
  WatchDirectoryRequest,
  FileChangeEvent,
} from '@cortex-id/shared-types';

import type {
  TerminalCreateRequest,
  TerminalInputRequest,
  TerminalResizeRequest,
  TerminalDestroyRequest,
  TerminalDataEvent,
  TerminalExitEvent,
} from '@cortex-id/shared-types';

import type {
  AppSettings,
  SetApiKeyRequest,
  GetApiKeyRequest,
  RecentProject,
} from '@cortex-id/shared-types';

// ── Helper: safe event listener registration ────────────────────────────────

/**
 * Registers an ipcRenderer.on listener and returns an unsubscribe function.
 * The listener is automatically wrapped to extract the payload from the event.
 */
function onEvent<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, payload: T) => {
    callback(payload);
  };
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

// ── CortexBridgeAPI implementation ──────────────────────────────────────────

const cortexAPI: CortexBridgeAPI = {
  // ── File System ────────────────────────────────────────────────────────────

  readFile(request: ReadFileRequest) {
    return ipcRenderer.invoke(IPC_CHANNELS.FILE_READ, request);
  },

  writeFile(request: WriteFileRequest) {
    return ipcRenderer.invoke(IPC_CHANNELS.FILE_WRITE, request);
  },

  createDirectory(request) {
    return ipcRenderer.invoke(IPC_CHANNELS.FILE_CREATE_DIR, request);
  },

  deletePath(request) {
    return ipcRenderer.invoke(IPC_CHANNELS.FILE_DELETE, request);
  },

  listDirectory(request: ListDirectoryRequest) {
    return ipcRenderer.invoke(IPC_CHANNELS.FILE_LIST_DIR, request);
  },

  openDialog(request: OpenDialogRequest) {
    return ipcRenderer.invoke(IPC_CHANNELS.FILE_OPEN_DIALOG, request);
  },

  saveDialog(request: SaveDialogRequest) {
    return ipcRenderer.invoke(IPC_CHANNELS.FILE_SAVE_DIALOG, request);
  },

  watchDirectory(request: WatchDirectoryRequest) {
    return ipcRenderer.invoke(IPC_CHANNELS.FILE_WATCH, request);
  },

  onFileChange(callback: (event: FileChangeEvent) => void): () => void {
    return onEvent<FileChangeEvent>(IPC_CHANNELS.FILE_CHANGE, callback);
  },

  // ── Terminal ───────────────────────────────────────────────────────────────

  createTerminal(request: TerminalCreateRequest) {
    return ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_CREATE, request);
  },

  sendTerminalInput(request: TerminalInputRequest): void {
    ipcRenderer.send(IPC_CHANNELS.TERMINAL_INPUT, request);
  },

  resizeTerminal(request: TerminalResizeRequest): void {
    ipcRenderer.send(IPC_CHANNELS.TERMINAL_RESIZE, request);
  },

  destroyTerminal(request: TerminalDestroyRequest): void {
    ipcRenderer.send(IPC_CHANNELS.TERMINAL_DESTROY, request);
  },

  onTerminalData(callback: (event: TerminalDataEvent) => void): () => void {
    return onEvent<TerminalDataEvent>(IPC_CHANNELS.TERMINAL_DATA, callback);
  },

  onTerminalExit(callback: (event: TerminalExitEvent) => void): () => void {
    return onEvent<TerminalExitEvent>(IPC_CHANNELS.TERMINAL_EXIT, callback);
  },

  // ── App ────────────────────────────────────────────────────────────────────

  getAppInfo() {
    return ipcRenderer.invoke(IPC_CHANNELS.APP_GET_INFO);
  },

  getSettings() {
    return ipcRenderer.invoke(IPC_CHANNELS.APP_GET_SETTINGS);
  },

  setSettings(settings: Partial<AppSettings>) {
    return ipcRenderer.invoke(IPC_CHANNELS.APP_SET_SETTINGS, settings);
  },

  setApiKey(request: SetApiKeyRequest) {
    return ipcRenderer.invoke(IPC_CHANNELS.APP_SET_API_KEY, request);
  },

  getApiKey(request: GetApiKeyRequest) {
    return ipcRenderer.invoke(IPC_CHANNELS.APP_GET_API_KEY, request);
  },

  getRecentProjects() {
    return ipcRenderer.invoke(IPC_CHANNELS.APP_GET_RECENT_PROJECTS);
  },

  addRecentProject(project: RecentProject) {
    return ipcRenderer.invoke(IPC_CHANNELS.APP_ADD_RECENT_PROJECT, project);
  },

  // ── Window ─────────────────────────────────────────────────────────────────

  minimizeWindow(): void {
    ipcRenderer.send(IPC_CHANNELS.WINDOW_MINIMIZE);
  },

  maximizeWindow(): void {
    ipcRenderer.send(IPC_CHANNELS.WINDOW_MAXIMIZE);
  },

  closeWindow(): void {
    ipcRenderer.send(IPC_CHANNELS.WINDOW_CLOSE);
  },

  getWindowState() {
    return ipcRenderer.invoke(IPC_CHANNELS.WINDOW_GET_STATE);
  },
};

// ── Expose the API via contextBridge ────────────────────────────────────────

contextBridge.exposeInMainWorld('cortex', cortexAPI);

console.log('[Preload] cortex API exposed on window.cortex');
