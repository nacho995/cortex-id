import { Injectable } from '@angular/core';
import type { CortexBridgeAPI } from '@cortex-id/shared-types/ipc/preload-api.types';
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
} from '@cortex-id/shared-types/ipc/file-system.types';
import type {
  TerminalCreateRequest,
  TerminalCreateResponse,
  TerminalInputRequest,
  TerminalResizeRequest,
  TerminalDestroyRequest,
  TerminalDataEvent,
  TerminalExitEvent,
} from '@cortex-id/shared-types/ipc/terminal.types';
import type {
  AppInfo,
  AppSettings,
  SetApiKeyRequest,
  GetApiKeyRequest,
  GetApiKeyResponse,
  RecentProject,
  WindowState,
} from '@cortex-id/shared-types/ipc/app.types';

/**
 * IPC Service — wraps the contextBridge API (window.cortex).
 *
 * When running in a browser (dev mode without Electron), all methods
 * fall back to mock implementations that log warnings and return
 * sensible defaults so the app remains usable.
 */
@Injectable({ providedIn: 'root' })
export class IpcService {
  private readonly api: CortexBridgeAPI | null;
  readonly isElectron: boolean;

  constructor() {
    this.api = window.cortex ?? null;
    this.isElectron = this.api !== null;

    if (!this.isElectron) {
      console.warn(
        '[IpcService] Running outside Electron — IPC calls will use mock implementations.'
      );
    }
  }

  // ── File System ─────────────────────────────────────────────────────────────

  readFile(request: ReadFileRequest): Promise<ReadFileResponse> {
    if (this.api) return this.api.readFile(request);
    console.warn('[IpcService] readFile not available in browser mode');
    return Promise.resolve({ path: request.path, content: '// File reading requires Electron\n// Run with: pnpm run dev\n', encoding: 'utf-8' });
  }

  writeFile(request: WriteFileRequest): Promise<WriteFileResponse> {
    if (this.api) return this.api.writeFile(request);
    console.warn('[IpcService] writeFile mock', request);
    return Promise.resolve({ path: request.path, success: true });
  }

  createDirectory(request: CreateDirectoryRequest): Promise<CreateDirectoryResponse> {
    if (this.api) return this.api.createDirectory(request);
    console.warn('[IpcService] createDirectory mock', request);
    return Promise.resolve({ path: request.path, success: true });
  }

  deletePath(request: DeletePathRequest): Promise<DeletePathResponse> {
    if (this.api) return this.api.deletePath(request);
    console.warn('[IpcService] deletePath mock', request);
    return Promise.resolve({ path: request.path, success: true });
  }

  listDirectory(request: ListDirectoryRequest): Promise<ListDirectoryResponse> {
    if (this.api) return this.api.listDirectory(request);
    console.warn('[IpcService] listDirectory mock', request);
    return Promise.resolve({ path: request.path, entries: [] });
  }

  openDialog(request: OpenDialogRequest): Promise<OpenDialogResponse> {
    if (this.api) return this.api.openDialog(request);

    // Browser mode: use HTML file input as fallback
    return new Promise((resolve) => {
      // For openDirectory, prompt user for a path string
      if (request.properties?.includes('openDirectory')) {
        const path = prompt('Enter folder path to open (browser mode):');
        if (path) {
          resolve({ canceled: false, filePaths: [path] });
        } else {
          resolve({ canceled: true, filePaths: [] });
        }
        return;
      }

      // For openFile, use hidden file input
      const input = document.createElement('input');
      input.type = 'file';
      if (request.filters?.length) {
        const exts = request.filters.flatMap(f => f.extensions.map(e => '.' + e));
        input.accept = exts.join(',');
      }
      if (request.properties?.includes('multiSelections')) {
        input.multiple = true;
      }
      input.onchange = () => {
        const files = Array.from(input.files ?? []);
        if (files.length > 0) {
          resolve({ canceled: false, filePaths: files.map(f => f.name) });
        } else {
          resolve({ canceled: true, filePaths: [] });
        }
      };
      // Handle cancel — file input doesn't fire change on cancel
      input.addEventListener('cancel', () => {
        resolve({ canceled: true, filePaths: [] });
      });
      input.click();
    });
  }

  saveDialog(request: SaveDialogRequest): Promise<SaveDialogResponse> {
    if (this.api) return this.api.saveDialog(request);
    console.warn('[IpcService] saveDialog mock', request);
    return Promise.resolve({ canceled: true });
  }

  watchDirectory(request: WatchDirectoryRequest): Promise<void> {
    if (this.api) return this.api.watchDirectory(request);
    console.warn('[IpcService] watchDirectory mock', request);
    return Promise.resolve();
  }

  onFileChange(callback: (event: FileChangeEvent) => void): () => void {
    if (this.api) return this.api.onFileChange(callback);
    console.warn('[IpcService] onFileChange mock — no events will fire');
    return () => {};
  }

  // ── Terminal ────────────────────────────────────────────────────────────────

  createTerminal(request: TerminalCreateRequest): Promise<TerminalCreateResponse> {
    if (this.api) return this.api.createTerminal(request);
    console.warn('[IpcService] createTerminal mock', request);
    return Promise.resolve({ id: 'mock-terminal-1', pid: 0 });
  }

  sendTerminalInput(request: TerminalInputRequest): void {
    if (this.api) {
      this.api.sendTerminalInput(request);
      return;
    }
    console.warn('[IpcService] sendTerminalInput mock', request);
  }

  resizeTerminal(request: TerminalResizeRequest): void {
    if (this.api) {
      this.api.resizeTerminal(request);
      return;
    }
    console.warn('[IpcService] resizeTerminal mock', request);
  }

  destroyTerminal(request: TerminalDestroyRequest): void {
    if (this.api) {
      this.api.destroyTerminal(request);
      return;
    }
    console.warn('[IpcService] destroyTerminal mock', request);
  }

  onTerminalData(callback: (event: TerminalDataEvent) => void): () => void {
    if (this.api) return this.api.onTerminalData(callback);
    console.warn('[IpcService] onTerminalData mock — no events will fire');
    return () => {};
  }

  onTerminalExit(callback: (event: TerminalExitEvent) => void): () => void {
    if (this.api) return this.api.onTerminalExit(callback);
    console.warn('[IpcService] onTerminalExit mock — no events will fire');
    return () => {};
  }

  // ── App ─────────────────────────────────────────────────────────────────────

  getAppInfo(): Promise<AppInfo> {
    if (this.api) return this.api.getAppInfo();
    console.warn('[IpcService] getAppInfo mock');
    return Promise.resolve({
      version: '0.1.0-dev',
      platform: 'linux' as 'linux',
      arch: 'x64',
      dataPath: '~/.cortex-id',
      isPackaged: false,
    });
  }

  getSettings(): Promise<AppSettings> {
    if (this.api) return this.api.getSettings();
    const saved = localStorage.getItem('cortex-settings');
    const defaults: AppSettings = {
      theme: 'dark',
      fontSize: 14,
      fontFamily: 'JetBrains Mono, monospace',
      tabSize: 2,
      wordWrap: false,
      minimap: true,
      fontLigatures: true,
      lineNumbers: 'on' as const,
      bracketPairColorization: true,
      renderWhitespace: 'selection' as const,
      cursorBlinking: 'smooth' as const,
      cursorStyle: 'line' as const,
      smoothScrolling: true,
      folding: true,
      guides: true,
      scrollBeyondLastLine: false,
      aiModel: 'claude-sonnet-4-6',
      autoSave: true,
      autoSaveDelay: 1000,
    };
    if (saved) {
      try { return Promise.resolve({ ...defaults, ...JSON.parse(saved) }); } catch { /* ignore */ }
    }
    return Promise.resolve(defaults);
  }

  setSettings(settings: Partial<AppSettings>): Promise<void> {
    if (this.api) return this.api.setSettings(settings);
    // Browser mode: persist to localStorage
    const current = JSON.parse(localStorage.getItem('cortex-settings') ?? '{}');
    localStorage.setItem('cortex-settings', JSON.stringify({ ...current, ...settings }));
    return Promise.resolve();
  }

  setApiKey(request: SetApiKeyRequest): Promise<void> {
    if (this.api) return this.api.setApiKey(request);
    // Browser mode: save to localStorage (NOT secure, but functional for dev)
    console.log('[IpcService] Browser mode: saving API key to localStorage');
    localStorage.setItem(`cortex-api-key-${request.service}`, request.key);
    return Promise.resolve();
  }

  getApiKey(request: GetApiKeyRequest): Promise<GetApiKeyResponse> {
    if (this.api) return this.api.getApiKey(request);
    // Browser mode: read from localStorage
    const key = localStorage.getItem(`cortex-api-key-${request.service}`);
    if (key) {
      const masked = key.length > 11
        ? key.slice(0, 7) + '…' + key.slice(-4)
        : '***';
      return Promise.resolve({ service: request.service, exists: true, maskedKey: masked, rawKey: key });
    }
    return Promise.resolve({ service: request.service, exists: false });
  }

  getRecentProjects(): Promise<RecentProject[]> {
    if (this.api) return this.api.getRecentProjects();
    console.warn('[IpcService] getRecentProjects mock');
    return Promise.resolve([]);
  }

  addRecentProject(project: RecentProject): Promise<void> {
    if (this.api) return this.api.addRecentProject(project);
    console.warn('[IpcService] addRecentProject mock', project);
    return Promise.resolve();
  }

  // ── Window ──────────────────────────────────────────────────────────────────

  minimizeWindow(): void {
    if (this.api) {
      this.api.minimizeWindow();
      return;
    }
    console.warn('[IpcService] minimizeWindow mock');
  }

  maximizeWindow(): void {
    if (this.api) {
      this.api.maximizeWindow();
      return;
    }
    console.warn('[IpcService] maximizeWindow mock');
  }

  closeWindow(): void {
    if (this.api) {
      this.api.closeWindow();
      return;
    }
    console.warn('[IpcService] closeWindow mock');
  }

  getWindowState(): Promise<WindowState> {
    if (this.api) return this.api.getWindowState();
    console.warn('[IpcService] getWindowState mock');
    return Promise.resolve({
      isMaximized: false,
      isFullScreen: false,
      bounds: { x: 0, y: 0, width: 1280, height: 800 },
    });
  }
}
