import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  OnDestroy,
  Output,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IpcService } from '../../core/ipc.service';
import { ConfigService } from '../../core/config.service';
import { ThemeService } from '../../core/theme.service';
import { EditorTabsComponent } from './editor-tabs.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';

export interface EditorTab {
  path: string;
  name: string;
  content: string;
  language: string;
  isDirty: boolean;
}

/* Monaco is loaded globally from assets */
declare const monaco: typeof import('monaco-editor');

const LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  sass: 'scss',
  less: 'less',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  xml: 'xml',
  md: 'markdown',
  mdx: 'markdown',
  java: 'java',
  kt: 'kotlin',
  py: 'python',
  rs: 'rust',
  go: 'go',
  c: 'c',
  cpp: 'cpp',
  h: 'c',
  hpp: 'cpp',
  sh: 'shell',
  bash: 'shell',
  sql: 'sql',
  graphql: 'graphql',
  gql: 'graphql',
  toml: 'ini',
  env: 'ini',
};

@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [CommonModule, EditorTabsComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="editor-container">
      <!-- Tab bar -->
      <app-editor-tabs
        [tabs]="openTabs()"
        [activeTabPath]="activeTab()?.path ?? ''"
        (tabClicked)="switchTab($event)"
        (tabClosed)="closeTab($event)"
      />

      <!-- Editor area -->
      <div class="editor-area">
        @if (openTabs().length === 0) {
          <!-- Welcome screen -->
          <div class="welcome-screen">
            <div class="welcome-logo">
              <app-icon name="code" [size]="64" />
            </div>
            <h1 class="welcome-title">Cortex-ID</h1>
            <p class="welcome-subtitle">AI-Powered IDE</p>
            <div class="welcome-actions">
              <button class="welcome-btn" (click)="openFile()">
                <app-icon name="file" [size]="16" />
                Open File
              </button>
              <button class="welcome-btn" (click)="openFolder()">
                <app-icon name="folder" [size]="16" />
                Open Folder
              </button>
            </div>
            <div class="welcome-shortcuts">
              <div class="shortcut">
                <kbd>Ctrl+S</kbd>
                <span>Save file</span>
              </div>
              <div class="shortcut">
                <kbd>Ctrl+P</kbd>
                <span>Quick open</span>
              </div>
              <div class="shortcut">
                <kbd>Ctrl+W</kbd>
                <span>Close tab</span>
              </div>
              <div class="shortcut">
                <kbd>Ctrl+Tab</kbd>
                <span>Next tab</span>
              </div>
            </div>
          </div>
        }

        <!-- Monaco Editor container -->
        <div
          #editorContainer
          class="monaco-container"
          [class.hidden]="openTabs().length === 0"
        ></div>
      </div>

      <!-- Status bar -->
      @if (activeTab()) {
        <div class="editor-statusbar">
          <span class="status-item">{{ activeTab()!.language }}</span>
          <span class="status-item">UTF-8</span>
          @if (activeTab()!.isDirty) {
            <span class="status-item dirty">● Unsaved changes</span>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .editor-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--bg-primary);
      overflow: hidden;
    }

    .editor-area {
      flex: 1;
      position: relative;
      overflow: hidden;
    }

    .monaco-container {
      width: 100%;
      height: 100%;

      &.hidden {
        display: none;
      }
    }

    /* Welcome screen */
    .welcome-screen {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 16px;
      color: var(--text-muted);
      animation: fadeIn var(--transition-slow);
    }

    .welcome-logo {
      color: var(--accent-primary);
      opacity: 0.6;
    }

    .welcome-title {
      font-size: 28px;
      font-weight: 700;
      color: var(--text-primary);
      letter-spacing: -0.5px;
    }

    .welcome-subtitle {
      font-size: 14px;
      color: var(--text-muted);
      margin-top: -8px;
    }

    .welcome-actions {
      display: flex;
      gap: 12px;
      margin-top: 8px;
    }

    .welcome-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      color: var(--text-primary);
      font-size: 13px;
      cursor: pointer;
      transition: background var(--transition-fast);

      &:hover {
        background: var(--bg-hover);
      }
    }

    .welcome-shortcuts {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 16px;
    }

    .shortcut {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 12px;
      color: var(--text-muted);

      kbd {
        padding: 2px 6px;
        background: var(--bg-surface);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-sm);
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--text-secondary);
      }
    }

    /* Status bar */
    .editor-statusbar {
      display: flex;
      align-items: center;
      gap: 16px;
      height: var(--statusbar-height);
      padding: 0 12px;
      background: var(--accent-primary);
      color: var(--bg-tertiary);
      font-size: 11px;
      flex-shrink: 0;
    }

    .status-item {
      &.dirty {
        color: var(--accent-warning);
      }
    }
  `],
})
export class EditorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('editorContainer') editorContainer!: ElementRef<HTMLDivElement>;

  /** Emitted after a successful save — WorkbenchComponent listens to show "Saved ✓" */
  @Output() fileSaved = new EventEmitter<void>();
  /** Emitted when user opens a folder from the editor welcome screen. */
  @Output() folderOpened = new EventEmitter<string>();

  private readonly ipc = inject(IpcService);
  private readonly config = inject(ConfigService);
  private readonly themeService = inject(ThemeService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly openTabs = signal<EditorTab[]>([]);
  readonly activeTab = signal<EditorTab | null>(null);

  private editor: import('monaco-editor').editor.IStandaloneCodeEditor | null = null;
  private monacoLoaded = false;
  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

  ngAfterViewInit(): void {
    this.loadMonaco();
  }

  private loadMonaco(): void {
    /* Monaco is loaded via AMD loader from assets */
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const win = window as any;

    if (typeof win['require'] === 'undefined') {
      /* Load the Monaco AMD loader */
      const script = document.createElement('script');
      script.src = '/assets/monaco/vs/loader.js';
      script.onload = () => this.configureMonaco();
      document.head.appendChild(script);
    } else {
      this.configureMonaco();
    }
  }

  private configureMonaco(): void {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const win = window as any;

    win['require'].config({ paths: { vs: '/assets/monaco/vs' } });

    win['MonacoEnvironment'] = {
      getWorkerUrl: (_moduleId: string, _label: string) => {
        // monaco-editor v0.47+ uses a single unified worker
        return '/assets/monaco/vs/base/worker/workerMain.js';
      },
    };

    win['require'](['vs/editor/editor.main'], () => {
      this.monacoLoaded = true;
      this.initEditor();
      // Notify ThemeService so it can register the custom theme
      this.themeService.notifyMonacoReady();
    });
  }

  private initEditor(): void {
    if (!this.editorContainer?.nativeElement) return;

    const settings = this.config.settings();

    this.editor = monaco.editor.create(this.editorContainer.nativeElement, {
      value: '',
      language: 'plaintext',
      theme: this.themeService.activeTheme().monacoTheme,
      fontSize: settings.fontSize,
      fontFamily: settings.fontFamily,
      tabSize: settings.tabSize,
      wordWrap: settings.wordWrap ? 'on' : 'off',
      minimap: { enabled: settings.minimap },
      automaticLayout: true,
      scrollBeyondLastLine: settings.scrollBeyondLastLine,
      renderWhitespace: settings.renderWhitespace,
      lineNumbers: settings.lineNumbers,
      glyphMargin: true,
      folding: settings.folding,
      bracketPairColorization: { enabled: settings.bracketPairColorization },
      smoothScrolling: settings.smoothScrolling,
      cursorBlinking: settings.cursorBlinking,
      cursorStyle: settings.cursorStyle,
      fontLigatures: settings.fontLigatures,
      guides: { indentation: settings.guides },
      cursorSmoothCaretAnimation: 'on',
      padding: { top: 8, bottom: 8 },
    });

    /* Listen for content changes */
    this.editor.onDidChangeModelContent(() => {
      const tab = this.activeTab();
      if (!tab) return;

      const newContent = this.editor!.getValue();
      if (newContent !== tab.content) {
        this.markDirty(tab.path);

        /* Auto-save */
        if (this.config.autoSave()) {
          if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
          this.autoSaveTimer = setTimeout(() => {
            this.saveCurrentFile();
          }, this.config.settings().autoSaveDelay);
        }
      }
    });

    /* Add keyboard shortcuts */
    this.editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
      () => this.saveCurrentFile()
    );

    this.cdr.markForCheck();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.editor?.layout();
  }

  async openFilePath(filePath: string): Promise<void> {
    /* Check if already open */
    const existing = this.openTabs().find((t) => t.path === filePath);
    if (existing) {
      this.switchTab(filePath);
      return;
    }

    try {
      const response = await this.ipc.readFile({ path: filePath });
      const name = filePath.split('/').pop() ?? filePath;
      const ext = name.includes('.') ? name.split('.').pop()?.toLowerCase() ?? '' : '';
      const language = LANGUAGE_MAP[ext] ?? 'plaintext';

      const tab: EditorTab = {
        path: filePath,
        name,
        content: response.content,
        language,
        isDirty: false,
      };

      this.openTabs.update((tabs) => [...tabs, tab]);
      this.switchTab(filePath);
    } catch (err) {
      console.error('[Editor] Failed to open file:', err);
    }
  }

  switchTab(path: string): void {
    const tab = this.openTabs().find((t) => t.path === path);
    if (!tab || !this.editor) return;

    this.activeTab.set(tab);

    /* Update editor content and language */
    const model = monaco.editor.createModel(tab.content, tab.language);
    const oldModel = this.editor.getModel();
    this.editor.setModel(model);
    oldModel?.dispose();

    this.cdr.markForCheck();
  }

  closeTab(path: string): void {
    const tabs = this.openTabs();
    const idx = tabs.findIndex((t) => t.path === path);
    if (idx === -1) return;

    const newTabs = tabs.filter((t) => t.path !== path);
    this.openTabs.set(newTabs);

    if (this.activeTab()?.path === path) {
      if (newTabs.length > 0) {
        const newActive = newTabs[Math.min(idx, newTabs.length - 1)];
        this.switchTab(newActive.path);
      } else {
        this.activeTab.set(null);
        if (this.editor) {
          const model = monaco.editor.createModel('', 'plaintext');
          const oldModel = this.editor.getModel();
          this.editor.setModel(model);
          oldModel?.dispose();
        }
      }
    }
  }

  private markDirty(path: string): void {
    this.openTabs.update((tabs) =>
      tabs.map((t) => (t.path === path ? { ...t, isDirty: true } : t))
    );
    const tab = this.activeTab();
    if (tab?.path === path) {
      this.activeTab.set({ ...tab, isDirty: true });
    }
    this.cdr.markForCheck();
  }

  async saveCurrentFile(): Promise<void> {
    const tab = this.activeTab();
    if (!tab || !this.editor) return;

    const content = this.editor.getValue();
    try {
      await this.ipc.writeFile({ path: tab.path, content });
      this.openTabs.update((tabs) =>
        tabs.map((t) => (t.path === tab.path ? { ...t, content, isDirty: false } : t))
      );
      this.activeTab.set({ ...tab, content, isDirty: false });
      this.fileSaved.emit();
      this.cdr.markForCheck();
    } catch (err) {
      console.error('[Editor] Failed to save file:', err);
    }
  }

  /** Close the currently active tab (Ctrl+W) */
  closeActiveTab(): void {
    const tab = this.activeTab();
    if (tab) {
      this.closeTab(tab.path);
    }
  }

  /**
   * Cycle through open tabs.
   * @param direction  1 = next, -1 = previous
   */
  cycleTab(direction: 1 | -1): void {
    const tabs = this.openTabs();
    if (tabs.length < 2) return;

    const currentPath = this.activeTab()?.path;
    const currentIdx = tabs.findIndex((t) => t.path === currentPath);
    if (currentIdx === -1) return;

    const nextIdx = (currentIdx + direction + tabs.length) % tabs.length;
    this.switchTab(tabs[nextIdx].path);
  }

  async openFile(): Promise<void> {
    const result = await this.ipc.openDialog({
      title: 'Open File',
      properties: ['openFile'],
    });
    if (!result.canceled && result.filePaths.length > 0) {
      await this.openFilePath(result.filePaths[0]);
    }
  }

  async openFolder(): Promise<void> {
    const result = await this.ipc.openDialog({
      title: 'Open Folder',
      properties: ['openDirectory'],
    });
    if (!result.canceled && result.filePaths.length > 0) {
      this.folderOpened.emit(result.filePaths[0]);
    }
  }

  setContent(content: string): void {
    if (!this.editor) return;
    const model = this.editor.getModel();
    if (model) {
      model.pushEditOperations([], [{ range: model.getFullModelRange(), text: content }], () => null);
    }
  }

  getContent(): string {
    return this.editor?.getValue() ?? '';
  }

  getSelection(): string {
    if (!this.editor) return '';
    const sel = this.editor.getSelection();
    return sel ? (this.editor.getModel()?.getValueInRange(sel) ?? '') : '';
  }

  ngOnDestroy(): void {
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
    this.editor?.dispose();
  }
}
