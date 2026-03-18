import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  ElementRef,
  EventEmitter,
  HostListener,
  OnDestroy,
  Output,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
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

/** Maps file extensions to shell commands that run the file. */
const RUN_COMMANDS: Record<string, (filePath: string) => string> = {
  '.py': (f) => `python3 "${f}"`,
  '.js': (f) => `node "${f}"`,
  '.ts': (f) => `npx tsx "${f}"`,
  '.java': (f) => `javac "${f}" && java "${f.replace('.java', '')}"`,
  '.c': (f) => `gcc "${f}" -o /tmp/a.out && /tmp/a.out`,
  '.cpp': (f) => `g++ "${f}" -o /tmp/a.out && /tmp/a.out`,
  '.rs': (f) => `rustc "${f}" -o /tmp/a.out && /tmp/a.out`,
  '.go': (f) => `go run "${f}"`,
  '.rb': (f) => `ruby "${f}"`,
  '.php': (f) => `php "${f}"`,
  '.sh': (f) => `bash "${f}"`,
  '.pl': (f) => `perl "${f}"`,
  '.r': (f) => `Rscript "${f}"`,
  '.swift': (f) => `swift "${f}"`,
  '.kt': (f) => `kotlinc "${f}" -include-runtime -d /tmp/out.jar && java -jar /tmp/out.jar`,
};

/** Human-friendly labels for extensions shown in the Run button. */
const RUNNER_LABELS: Record<string, string> = {
  '.py': 'Python',
  '.js': 'Node',
  '.ts': 'TypeScript',
  '.java': 'Java',
  '.c': 'C',
  '.cpp': 'C++',
  '.rs': 'Rust',
  '.go': 'Go',
  '.rb': 'Ruby',
  '.php': 'PHP',
  '.sh': 'Shell',
  '.pl': 'Perl',
  '.r': 'R',
  '.swift': 'Swift',
  '.kt': 'Kotlin',
};

@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [EditorTabsComponent, IconComponent],
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

      <!-- Run button toolbar — visible when the active file is runnable -->
      @if (runnerLabel()) {
        <div class="run-toolbar">
          <button
            class="run-btn"
            [title]="'Run file (F5)'"
            (click)="runCurrentFile()"
          >
            <app-icon name="play" [size]="12" />
            Run ({{ runnerLabel() }})
          </button>
        </div>
      }

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
              <button class="welcome-btn" (click)="newProject()">
                <app-icon name="plus" [size]="16" />
                New Project
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
              <div class="shortcut">
                <kbd>F5</kbd>
                <span>Run file</span>
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

      <!-- New Project Dialog -->
      @if (showNewProjectDialog()) {
        <div class="new-project-overlay" (click)="showNewProjectDialog.set(false)">
          <div class="new-project-dialog" (click)="$event.stopPropagation()">
            <h3>New Project</h3>
            <input type="text" placeholder="Project name..." class="np-input"
                   [value]="newProjectName()"
                   (input)="newProjectName.set($any($event.target).value)" />
            <div class="np-types">
              @for (pt of projectTypes; track pt.id) {
                <button class="np-type" [class.selected]="newProjectType() === pt.id"
                        (click)="newProjectType.set(pt.id)">
                  <span class="np-icon">{{ pt.icon }}</span>
                  <span class="np-name">{{ pt.name }}</span>
                  <span class="np-desc">{{ pt.desc }}</span>
                </button>
              }
            </div>
            <div class="np-actions">
              <button class="np-cancel" (click)="showNewProjectDialog.set(false)">Cancel</button>
              <button class="np-create" [disabled]="!newProjectName()" (click)="createProject()">Create Project</button>
            </div>
          </div>
        </div>
      }

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
      background: radial-gradient(ellipse at center, rgba(166, 226, 46, 0.03) 0%, transparent 70%);
    }

    .welcome-logo {
      color: var(--accent-primary);
      opacity: 0.4;
      filter: drop-shadow(0 0 24px rgba(166, 226, 46, 0.3));
      animation: pulse 3s ease-in-out infinite;
    }

    .welcome-title {
      font-size: 32px;
      font-weight: 700;
      color: var(--text-primary);
      letter-spacing: -1px;
      background: linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .welcome-subtitle {
      font-size: 13px;
      color: var(--text-muted);
      margin-top: -10px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-weight: 500;
    }

    .welcome-actions {
      display: flex;
      gap: 10px;
      margin-top: 8px;
    }

    .welcome-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 9px 18px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: var(--radius-lg);
      color: var(--text-secondary);
      font-size: 13px;
      cursor: pointer;
      transition: all var(--transition-fast);
      font-family: var(--font-sans);

      &:hover {
        background: rgba(166, 226, 46, 0.08);
        border-color: rgba(166, 226, 46, 0.25);
        color: var(--text-primary);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      }

      &:active {
        transform: translateY(0);
      }
    }

    .welcome-shortcuts {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 20px;
      margin-top: 20px;
      padding: 16px 20px;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: var(--radius-lg);
    }

    .shortcut {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 12px;
      color: var(--text-muted);

      kbd {
        padding: 1px 5px;
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: var(--radius-sm);
        font-family: var(--font-mono);
        font-size: 10px;
        color: var(--text-muted);
        white-space: nowrap;
        box-shadow: none;
        opacity: 0.7;
      }
    }

    /* Run toolbar */
    .run-toolbar {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding: 0 8px;
      height: 28px;
      background: var(--bg-secondary);
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      flex-shrink: 0;
    }

    .run-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 3px 12px;
      background: rgba(166, 226, 46, 0.1);
      border: 1px solid rgba(166, 226, 46, 0.25);
      border-radius: var(--radius-sm);
      color: var(--accent-primary);
      font-size: 11px;
      font-weight: 600;
      font-family: var(--font-sans);
      cursor: pointer;
      white-space: nowrap;
      transition: background var(--transition-fast), border-color var(--transition-fast), transform var(--transition-fast);

      &:hover {
        background: rgba(166, 226, 46, 0.18);
        border-color: rgba(166, 226, 46, 0.4);
        transform: translateY(-1px);
      }

      &:active {
        transform: translateY(0);
      }
    }

    /* Status bar */
    .editor-statusbar {
      display: flex;
      align-items: center;
      gap: 16px;
      height: var(--statusbar-height);
      padding: 0 12px;
      background: var(--bg-tertiary);
      border-top: 1px solid rgba(0, 136, 255, 0.3);
      color: var(--text-muted);
      font-size: 10px;
      flex-shrink: 0;
      font-family: var(--font-sans);
    }

    .status-item {
      font-size: 10px;
      letter-spacing: 0.02em;

      &.dirty {
        color: var(--accent-warning);
        font-weight: 600;
      }
    }

    @keyframes pulse {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 0.6; }
    }

    /* New Project Dialog */
    .new-project-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.6); z-index: 9000;
      display: flex; align-items: center; justify-content: center;
      backdrop-filter: blur(4px);
    }

    .new-project-dialog {
      background: var(--bg-secondary); border: 1px solid var(--border-color);
      border-radius: 12px; padding: 24px; width: 500px; max-height: 80vh; overflow-y: auto;

      h3 { margin: 0 0 16px; color: var(--text-primary); font-size: 18px; }
    }

    .np-input {
      width: 100%; padding: 10px 14px; background: var(--bg-surface);
      border: 1px solid var(--border-color); border-radius: 8px;
      color: var(--text-primary); font-size: 14px; margin-bottom: 16px;
      box-sizing: border-box; font-family: var(--font-sans);

      &:focus { border-color: var(--accent-primary); outline: none; }
    }

    .np-types { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }

    .np-type {
      display: flex; align-items: center; gap: 10px; padding: 10px 14px;
      background: var(--bg-surface); border: 2px solid var(--border-color);
      border-radius: 8px; cursor: pointer; text-align: left; transition: all 0.2s;
      font-family: var(--font-sans); width: 100%;

      &:hover { border-color: var(--text-muted); }
      &.selected { border-color: var(--accent-primary); background: rgba(88,166,255,0.05); }
    }

    .np-icon { font-size: 20px; width: 28px; text-align: center; flex-shrink: 0; }
    .np-name { font-weight: 600; color: var(--text-primary); font-size: 13px; min-width: 140px; }
    .np-desc { color: var(--text-muted); font-size: 11px; }

    .np-actions { display: flex; justify-content: flex-end; gap: 8px; }

    .np-cancel {
      padding: 8px 16px; background: transparent; border: 1px solid var(--border-color);
      border-radius: 6px; color: var(--text-secondary); cursor: pointer;
      font-family: var(--font-sans);
    }

    .np-create {
      padding: 8px 20px; background: var(--accent-primary); border: none;
      border-radius: 6px; color: #fff; cursor: pointer; font-weight: 600;
      font-family: var(--font-sans);

      &:disabled { opacity: 0.4; cursor: not-allowed; }
    }
  `],
})
export class EditorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('editorContainer') editorContainer!: ElementRef<HTMLDivElement>;

  /** Emitted after a successful save — WorkbenchComponent listens to show "Saved ✓" */
  @Output() fileSaved = new EventEmitter<void>();
  /** Emitted when user opens a folder from the editor welcome screen. */
  @Output() folderOpened = new EventEmitter<string>();
  /** Emitted when the user clicks "Run" — carries the shell command to execute. */
  @Output() runFile = new EventEmitter<string>();

  private readonly ipc = inject(IpcService);
  private readonly config = inject(ConfigService);
  private readonly themeService = inject(ThemeService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly openTabs = signal<EditorTab[]>([]);
  readonly activeTab = signal<EditorTab | null>(null);

  // New Project dialog
  readonly showNewProjectDialog = signal(false);
  readonly newProjectName = signal('');
  readonly newProjectType = signal('mern');
  readonly projectTypes = [
    { id: 'mern', name: 'MERN Stack', icon: '🟢', desc: 'MongoDB + Express + React + Node.js' },
    { id: 'spring-angular', name: 'Spring Boot + Angular', icon: '☕', desc: 'Java 21 + Spring Boot + Angular 17' },
    { id: 'spring', name: 'Spring Boot API', icon: '🍃', desc: 'Java 21 + Spring Boot + PostgreSQL' },
    { id: 'angular', name: 'Angular App', icon: '🔴', desc: 'Angular 17 standalone + TypeScript' },
    { id: 'fastapi', name: 'FastAPI', icon: '🐍', desc: 'Python + FastAPI + SQLAlchemy' },
    { id: 'next', name: 'Next.js', icon: '▲', desc: 'Next.js 14 + React + TypeScript' },
    { id: 'express', name: 'Express API', icon: '📦', desc: 'Node.js + Express + MongoDB' },
    { id: 'empty', name: 'Empty Project', icon: '📁', desc: 'Just a folder' },
  ];

  /** The language label shown in the Run button, or empty string if the file isn't runnable. */
  readonly runnerLabel = computed(() => {
    const tab = this.activeTab();
    if (!tab) return '';
    const ext = this.fileExtension(tab.path);
    return RUNNER_LABELS[ext] ?? '';
  });

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

    this.editor.addCommand(
      monaco.KeyCode.F5,
      () => this.runCurrentFile()
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

  /** Run the currently active file in the terminal. */
  runCurrentFile(): void {
    const tab = this.activeTab();
    if (!tab) return;

    const ext = this.fileExtension(tab.path);
    const commandFn = RUN_COMMANDS[ext];
    if (!commandFn) return;

    const command = commandFn(tab.path);
    this.runFile.emit(command);
  }

  newProject(): void {
    this.showNewProjectDialog.set(true);
  }

  async createProject(): Promise<void> {
    const name = this.newProjectName();
    const type = this.newProjectType();
    if (!name) return;

    try {
      const result = await this.ipc.openDialog({
        title: 'Choose location for new project',
        properties: ['openDirectory'],
      });

      if (!result?.filePaths?.[0]) return;

      const parentDir = result.filePaths[0];
      const projectPath = parentDir + '/' + name;

      // Create root directory
      await this.ipc.createDirectory({ path: projectPath });

      // Create all files, ensuring parent dirs exist
      const files = this.getProjectFiles(type, name);
      const createdDirs = new Set<string>();

      for (const file of files) {
        const fullPath = projectPath + '/' + file.path;
        // Extract directory from file path
        const lastSlash = fullPath.lastIndexOf('/');
        const dir = fullPath.substring(0, lastSlash);

        // Create directory if not already created
        if (!createdDirs.has(dir)) {
          try {
            await this.ipc.createDirectory({ path: dir });
          } catch { /* dir might already exist */ }
          createdDirs.add(dir);
        }

        // Write file
        await this.ipc.writeFile({ path: fullPath, content: file.content });
      }

      // Open the project
      this.folderOpened.emit(projectPath);
      this.showNewProjectDialog.set(false);
      this.newProjectName.set('');
    } catch (err) {
      console.error('[Editor] Failed to create project:', err);
    }
  }

  private getProjectFiles(type: string, name: string): Array<{path: string; content: string}> {
    switch (type) {
      case 'mern':
        return [
          // Backend
          { path: 'package.json', content: JSON.stringify({
            name, version: '1.0.0',
            scripts: { dev: 'node server.js', start: 'node server.js' },
            dependencies: { express: '^4.18.0', mongoose: '^8.0.0', cors: '^2.8.5', dotenv: '^16.0.0', bcryptjs: '^2.4.3', jsonwebtoken: '^9.0.0' }
          }, null, 2) },
          { path: 'server.js', content: [
            "const express = require('express');",
            "const cors = require('cors');",
            "const mongoose = require('mongoose');",
            "require('dotenv').config();",
            "",
            "const app = express();",
            "app.use(cors());",
            "app.use(express.json());",
            "",
            "// Routes",
            "app.use('/api/auth', require('./routes/auth'));",
            "app.use('/api/items', require('./routes/items'));",
            "",
            "// Connect to MongoDB",
            "mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/" + name + "')",
            "  .then(() => console.log('MongoDB connected'))",
            "  .catch(err => console.error('MongoDB error:', err));",
            "",
            "const PORT = process.env.PORT || 5000;",
            "app.listen(PORT, () => console.log(`Server running on port ${PORT}`));",
          ].join('\n') },
          { path: '.env', content: 'PORT=5000\nMONGODB_URI=mongodb://localhost:27017/' + name + '\nJWT_SECRET=your-secret-key' },
          { path: '.gitignore', content: 'node_modules/\n.env\nclient/build/\n' },
          // Models
          { path: 'models/User.js', content: [
            "const mongoose = require('mongoose');",
            "const bcrypt = require('bcryptjs');",
            "",
            "const UserSchema = new mongoose.Schema({",
            "  name: { type: String, required: true },",
            "  email: { type: String, required: true, unique: true },",
            "  password: { type: String, required: true },",
            "}, { timestamps: true });",
            "",
            "UserSchema.pre('save', async function(next) {",
            "  if (!this.isModified('password')) return next();",
            "  this.password = await bcrypt.hash(this.password, 10);",
            "  next();",
            "});",
            "",
            "module.exports = mongoose.model('User', UserSchema);",
          ].join('\n') },
          { path: 'models/Item.js', content: [
            "const mongoose = require('mongoose');",
            "",
            "const ItemSchema = new mongoose.Schema({",
            "  title: { type: String, required: true },",
            "  description: { type: String, default: '' },",
            "  completed: { type: Boolean, default: false },",
            "  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },",
            "}, { timestamps: true });",
            "",
            "module.exports = mongoose.model('Item', ItemSchema);",
          ].join('\n') },
          // Routes
          { path: 'routes/auth.js', content: [
            "const router = require('express').Router();",
            "const bcrypt = require('bcryptjs');",
            "const jwt = require('jsonwebtoken');",
            "const User = require('../models/User');",
            "",
            "// Register",
            "router.post('/register', async (req, res) => {",
            "  try {",
            "    const { name, email, password } = req.body;",
            "    const exists = await User.findOne({ email });",
            "    if (exists) return res.status(400).json({ msg: 'User already exists' });",
            "    const user = new User({ name, email, password });",
            "    await user.save();",
            "    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });",
            "    res.json({ token, user: { id: user._id, name, email } });",
            "  } catch (err) { res.status(500).json({ msg: err.message }); }",
            "});",
            "",
            "// Login",
            "router.post('/login', async (req, res) => {",
            "  try {",
            "    const { email, password } = req.body;",
            "    const user = await User.findOne({ email });",
            "    if (!user) return res.status(400).json({ msg: 'User not found' });",
            "    const valid = await bcrypt.compare(password, user.password);",
            "    if (!valid) return res.status(400).json({ msg: 'Invalid password' });",
            "    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });",
            "    res.json({ token, user: { id: user._id, name: user.name, email } });",
            "  } catch (err) { res.status(500).json({ msg: err.message }); }",
            "});",
            "",
            "module.exports = router;",
          ].join('\n') },
          { path: 'routes/items.js', content: [
            "const router = require('express').Router();",
            "const auth = require('../middleware/auth');",
            "const Item = require('../models/Item');",
            "",
            "// Get all items for user",
            "router.get('/', auth, async (req, res) => {",
            "  const items = await Item.find({ user: req.user.id }).sort({ createdAt: -1 });",
            "  res.json(items);",
            "});",
            "",
            "// Create item",
            "router.post('/', auth, async (req, res) => {",
            "  const item = new Item({ ...req.body, user: req.user.id });",
            "  await item.save();",
            "  res.status(201).json(item);",
            "});",
            "",
            "// Update item",
            "router.put('/:id', auth, async (req, res) => {",
            "  const item = await Item.findOneAndUpdate(",
            "    { _id: req.params.id, user: req.user.id },",
            "    req.body, { new: true }",
            "  );",
            "  res.json(item);",
            "});",
            "",
            "// Delete item",
            "router.delete('/:id', auth, async (req, res) => {",
            "  await Item.findOneAndDelete({ _id: req.params.id, user: req.user.id });",
            "  res.json({ msg: 'Deleted' });",
            "});",
            "",
            "module.exports = router;",
          ].join('\n') },
          // Middleware
          { path: 'middleware/auth.js', content: [
            "const jwt = require('jsonwebtoken');",
            "",
            "module.exports = (req, res, next) => {",
            "  const token = req.header('Authorization')?.replace('Bearer ', '');",
            "  if (!token) return res.status(401).json({ msg: 'No token' });",
            "  try {",
            "    req.user = jwt.verify(token, process.env.JWT_SECRET);",
            "    next();",
            "  } catch { res.status(401).json({ msg: 'Invalid token' }); }",
            "};",
          ].join('\n') },
          // Client (React)
          { path: 'client/package.json', content: JSON.stringify({
            name: name + '-client', version: '1.0.0', private: true,
            dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0', 'react-scripts': '^5.0.0', axios: '^1.6.0', 'react-router-dom': '^6.0.0' },
            scripts: { start: 'react-scripts start', build: 'react-scripts build' },
            proxy: 'http://localhost:5000'
          }, null, 2) },
          { path: 'client/public/index.html', content: [
            '<!DOCTYPE html>',
            '<html lang="en">',
            '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
            '<title>' + name + '</title></head>',
            '<body><div id="root"></div></body>',
            '</html>',
          ].join('\n') },
          { path: 'client/src/index.js', content: [
            "import React from 'react';",
            "import ReactDOM from 'react-dom/client';",
            "import App from './App';",
            "import './index.css';",
            "",
            "ReactDOM.createRoot(document.getElementById('root')).render(",
            "  <React.StrictMode><App /></React.StrictMode>",
            ");",
          ].join('\n') },
          { path: 'client/src/App.js', content: [
            "import React from 'react';",
            "",
            "function App() {",
            "  return (",
            "    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>",
            "      <h1>" + name + "</h1>",
            "      <p>MERN Stack project ready.</p>",
            "    </div>",
            "  );",
            "}",
            "",
            "export default App;",
          ].join('\n') },
          { path: 'client/src/index.css', content: [
            "* { margin: 0; padding: 0; box-sizing: border-box; }",
            "body { font-family: -apple-system, sans-serif; background: #0d1117; color: #c9d1d9; }",
          ].join('\n') },
          { path: 'README.md', content: [
            '# ' + name,
            '', '## MERN Stack Project', '',
            '### Setup',
            '```bash',
            'npm install',
            'cd client && npm install',
            '```', '',
            '### Run',
            '```bash',
            '# Terminal 1: Backend',
            'npm run dev',
            '',
            '# Terminal 2: Frontend',
            'cd client && npm start',
            '```',
          ].join('\n') },
        ];
      case 'spring-angular':
        return [
          // Backend
          { path: 'backend/pom.xml', content: [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
            '  xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">',
            '  <modelVersion>4.0.0</modelVersion>',
            '  <parent><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-parent</artifactId><version>3.4.0</version></parent>',
            '  <groupId>com.' + name.replace(/[^a-z0-9]/gi, '').toLowerCase() + '</groupId>',
            '  <artifactId>' + name + '</artifactId>',
            '  <version>0.1.0</version>',
            '  <properties><java.version>21</java.version></properties>',
            '  <dependencies>',
            '    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId></dependency>',
            '    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-data-jpa</artifactId></dependency>',
            '    <dependency><groupId>org.postgresql</groupId><artifactId>postgresql</artifactId><scope>runtime</scope></dependency>',
            '    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-test</artifactId><scope>test</scope></dependency>',
            '  </dependencies>',
            '  <build><plugins><plugin><groupId>org.springframework.boot</groupId><artifactId>spring-boot-maven-plugin</artifactId></plugin></plugins></build>',
            '</project>',
          ].join('\n') },
          { path: 'backend/src/main/java/com/app/Application.java', content: [
            'package com.app;',
            '',
            'import org.springframework.boot.SpringApplication;',
            'import org.springframework.boot.autoconfigure.SpringBootApplication;',
            '',
            '@SpringBootApplication',
            'public class Application {',
            '    public static void main(String[] args) {',
            '        SpringApplication.run(Application.class, args);',
            '    }',
            '}',
          ].join('\n') },
          { path: 'backend/src/main/java/com/app/config/CorsConfig.java', content: [
            'package com.app.config;',
            '',
            'import org.springframework.context.annotation.Configuration;',
            'import org.springframework.web.servlet.config.annotation.CorsRegistry;',
            'import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;',
            '',
            '@Configuration',
            'public class CorsConfig implements WebMvcConfigurer {',
            '    @Override',
            '    public void addCorsMappings(CorsRegistry registry) {',
            '        registry.addMapping("/api/**")',
            '                .allowedOrigins("http://localhost:4200")',
            '                .allowedMethods("*");',
            '    }',
            '}',
          ].join('\n') },
          { path: 'backend/src/main/java/com/app/controller/HelloController.java', content: [
            'package com.app.controller;',
            '',
            'import org.springframework.web.bind.annotation.GetMapping;',
            'import org.springframework.web.bind.annotation.RequestMapping;',
            'import org.springframework.web.bind.annotation.RestController;',
            'import java.util.Map;',
            '',
            '@RestController',
            '@RequestMapping("/api")',
            'public class HelloController {',
            '    @GetMapping("/hello")',
            '    public Map<String, String> hello() {',
            '        return Map.of("message", "Hello from ' + name + '!");',
            '    }',
            '}',
          ].join('\n') },
          { path: 'backend/src/main/resources/application.properties', content: [
            'server.port=8080',
            'spring.datasource.url=jdbc:postgresql://localhost:5432/' + name,
            'spring.datasource.username=postgres',
            'spring.datasource.password=postgres',
            'spring.jpa.hibernate.ddl-auto=update',
          ].join('\n') },
          { path: 'backend/.gitignore', content: 'target/\n.idea/\n*.iml\n' },
          // Frontend Angular
          { path: 'frontend/package.json', content: JSON.stringify({
            name: name + '-frontend', version: '0.0.0', scripts: {
              start: 'ng serve', build: 'ng build', test: 'ng test'
            }, dependencies: {
              '@angular/core': '^17.0.0', '@angular/common': '^17.0.0',
              '@angular/platform-browser': '^17.0.0', '@angular/router': '^17.0.0',
              'rxjs': '^7.8.0', 'zone.js': '^0.14.0'
            }, devDependencies: {
              '@angular/cli': '^17.0.0', '@angular/compiler-cli': '^17.0.0', 'typescript': '^5.2.0'
            }
          }, null, 2) },
          { path: 'frontend/src/app/app.component.ts', content: [
            "import { Component } from '@angular/core';",
            "import { HttpClient } from '@angular/common/http';",
            "",
            "@Component({",
            "  selector: 'app-root',",
            "  standalone: true,",
            "  template: `<h1>{{ title }}</h1><p>{{ message }}</p>`,",
            "})",
            "export class AppComponent {",
            "  title = '" + name + "';",
            "  message = 'Loading...';",
            "  constructor(private http: HttpClient) {",
            "    this.http.get<any>('http://localhost:8080/api/hello').subscribe(",
            "      res => this.message = res.message",
            "    );",
            "  }",
            "}",
          ].join('\n') },
          { path: 'frontend/.gitignore', content: 'node_modules/\ndist/\n.angular/\n' },
          { path: 'README.md', content: [
            '# ' + name, '',
            '## Spring Boot + Angular', '',
            '### Backend', '```bash', 'cd backend && mvn spring-boot:run', '```', '',
            '### Frontend', '```bash', 'cd frontend && npm install && ng serve', '```',
          ].join('\n') },
        ];
      case 'spring':
        return [
          { path: 'pom.xml', content: [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
            '  xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">',
            '  <modelVersion>4.0.0</modelVersion>',
            '  <parent><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-parent</artifactId><version>3.4.0</version></parent>',
            '  <groupId>com.' + name.replace(/[^a-z0-9]/gi, '').toLowerCase() + '</groupId>',
            '  <artifactId>' + name + '</artifactId>',
            '  <version>0.1.0</version>',
            '  <properties><java.version>21</java.version></properties>',
            '  <dependencies>',
            '    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId></dependency>',
            '    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-data-jpa</artifactId></dependency>',
            '    <dependency><groupId>org.postgresql</groupId><artifactId>postgresql</artifactId><scope>runtime</scope></dependency>',
            '    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-validation</artifactId></dependency>',
            '    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-test</artifactId><scope>test</scope></dependency>',
            '  </dependencies>',
            '  <build><plugins><plugin><groupId>org.springframework.boot</groupId><artifactId>spring-boot-maven-plugin</artifactId></plugin></plugins></build>',
            '</project>',
          ].join('\n') },
          { path: 'src/main/java/com/app/Application.java', content: 'package com.app;\n\nimport org.springframework.boot.SpringApplication;\nimport org.springframework.boot.autoconfigure.SpringBootApplication;\n\n@SpringBootApplication\npublic class Application {\n    public static void main(String[] args) {\n        SpringApplication.run(Application.class, args);\n    }\n}\n' },
          { path: 'src/main/java/com/app/model/Item.java', content: 'package com.app.model;\n\nimport jakarta.persistence.*;\n\n@Entity\n@Table(name = "items")\npublic class Item {\n    @Id\n    @GeneratedValue(strategy = GenerationType.IDENTITY)\n    private Long id;\n    private String name;\n    private String description;\n\n    public Item() {}\n    public Item(String name, String description) { this.name = name; this.description = description; }\n\n    public Long getId() { return id; }\n    public String getName() { return name; }\n    public void setName(String name) { this.name = name; }\n    public String getDescription() { return description; }\n    public void setDescription(String description) { this.description = description; }\n}\n' },
          { path: 'src/main/java/com/app/repository/ItemRepository.java', content: 'package com.app.repository;\n\nimport com.app.model.Item;\nimport org.springframework.data.jpa.repository.JpaRepository;\n\npublic interface ItemRepository extends JpaRepository<Item, Long> {\n}\n' },
          { path: 'src/main/java/com/app/controller/ItemController.java', content: 'package com.app.controller;\n\nimport com.app.model.Item;\nimport com.app.repository.ItemRepository;\nimport org.springframework.web.bind.annotation.*;\nimport java.util.List;\n\n@RestController\n@RequestMapping("/api/items")\npublic class ItemController {\n    private final ItemRepository repo;\n    public ItemController(ItemRepository repo) { this.repo = repo; }\n\n    @GetMapping\n    public List<Item> getAll() { return repo.findAll(); }\n\n    @PostMapping\n    public Item create(@RequestBody Item item) { return repo.save(item); }\n\n    @PutMapping("/{id}")\n    public Item update(@PathVariable Long id, @RequestBody Item item) {\n        item.setName(item.getName()); item.setDescription(item.getDescription());\n        return repo.save(item);\n    }\n\n    @DeleteMapping("/{id}")\n    public void delete(@PathVariable Long id) { repo.deleteById(id); }\n}\n' },
          { path: 'src/main/resources/application.properties', content: 'server.port=8080\nspring.datasource.url=jdbc:postgresql://localhost:5432/' + name + '\nspring.datasource.username=postgres\nspring.datasource.password=postgres\nspring.jpa.hibernate.ddl-auto=update\n' },
          { path: '.gitignore', content: 'target/\n.idea/\n*.iml\n' },
          { path: 'README.md', content: '# ' + name + '\n\nSpring Boot REST API with PostgreSQL.\n\n```bash\nmvn spring-boot:run\n```\n\nAPI: http://localhost:8080/api/items\n' },
        ];
      case 'angular':
        return [
          { path: 'package.json', content: JSON.stringify({
            name, version: '0.0.0', scripts: { start: 'ng serve', build: 'ng build', test: 'ng test' },
            dependencies: {
              '@angular/core': '^17.0.0', '@angular/common': '^17.0.0', '@angular/compiler': '^17.0.0',
              '@angular/platform-browser': '^17.0.0', '@angular/platform-browser-dynamic': '^17.0.0',
              '@angular/router': '^17.0.0', '@angular/forms': '^17.0.0',
              'rxjs': '^7.8.0', 'zone.js': '^0.14.0', 'tslib': '^2.6.0'
            },
            devDependencies: {
              '@angular/cli': '^17.0.0', '@angular/compiler-cli': '^17.0.0',
              'typescript': '^5.2.0', '@angular-devkit/build-angular': '^17.0.0'
            }
          }, null, 2) },
          { path: 'src/main.ts', content: "import { bootstrapApplication } from '@angular/platform-browser';\nimport { AppComponent } from './app/app.component';\n\nbootstrapApplication(AppComponent);\n" },
          { path: 'src/index.html', content: '<!doctype html>\n<html lang="en">\n<head><meta charset="utf-8"><title>' + name + '</title><base href="/"><meta name="viewport" content="width=device-width, initial-scale=1"></head>\n<body><app-root></app-root></body>\n</html>\n' },
          { path: 'src/styles.css', content: '* { margin: 0; padding: 0; box-sizing: border-box; }\nbody { font-family: -apple-system, sans-serif; }\n' },
          { path: 'src/app/app.component.ts', content: "import { Component } from '@angular/core';\nimport { RouterOutlet } from '@angular/router';\n\n@Component({\n  selector: 'app-root',\n  standalone: true,\n  imports: [RouterOutlet],\n  template: `<h1>" + name + "</h1><router-outlet />`,\n})\nexport class AppComponent {}\n" },
          { path: 'src/app/app.routes.ts', content: "import { Routes } from '@angular/router';\n\nexport const routes: Routes = [];\n" },
          { path: 'tsconfig.json', content: JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ES2022', moduleResolution: 'node', strict: true, esModuleInterop: true, forceConsistentCasingInFileNames: true, experimentalDecorators: true } }, null, 2) },
          { path: '.gitignore', content: 'node_modules/\ndist/\n.angular/\n' },
          { path: 'README.md', content: '# ' + name + '\n\nAngular standalone app.\n\n```bash\nnpm install\nng serve\n```\n' },
        ];
      case 'fastapi':
        return [
          { path: 'main.py', content: [
            'from fastapi import FastAPI',
            'from fastapi.middleware.cors import CORSMiddleware',
            'from routes import items',
            '',
            'app = FastAPI(title="' + name + '")',
            '',
            'app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])',
            '',
            'app.include_router(items.router, prefix="/api/items", tags=["items"])',
            '',
            '@app.get("/")',
            'def root():',
            '    return {"message": "' + name + ' API running"}',
          ].join('\n') },
          { path: 'routes/__init__.py', content: '' },
          { path: 'routes/items.py', content: [
            'from fastapi import APIRouter',
            'from pydantic import BaseModel',
            '',
            'router = APIRouter()',
            '',
            'class Item(BaseModel):',
            '    name: str',
            '    description: str = ""',
            '    completed: bool = False',
            '',
            'items_db: list[Item] = []',
            '',
            '@router.get("/")',
            'def get_all():',
            '    return items_db',
            '',
            '@router.post("/")',
            'def create(item: Item):',
            '    items_db.append(item)',
            '    return item',
          ].join('\n') },
          { path: 'models/__init__.py', content: '' },
          { path: 'models/item.py', content: 'from pydantic import BaseModel\n\nclass ItemModel(BaseModel):\n    name: str\n    description: str = ""\n    completed: bool = False\n' },
          { path: 'requirements.txt', content: 'fastapi==0.115.0\nuvicorn==0.30.0\npydantic==2.5.0\n' },
          { path: '.gitignore', content: '__pycache__/\n.venv/\n*.pyc\n.env\n' },
          { path: 'README.md', content: '# ' + name + '\n\nFastAPI project.\n\n```bash\npip install -r requirements.txt\nuvicorn main:app --reload\n```\n\nAPI docs: http://localhost:8000/docs\n' },
        ];
      case 'next':
        return [
          { path: 'package.json', content: JSON.stringify({
            name, version: '0.1.0', private: true,
            scripts: { dev: 'next dev', build: 'next build', start: 'next start' },
            dependencies: { next: '^14.0.0', react: '^18.0.0', 'react-dom': '^18.0.0' },
            devDependencies: { typescript: '^5.0.0', '@types/react': '^18.0.0', '@types/node': '^20.0.0' }
          }, null, 2) },
          { path: 'tsconfig.json', content: JSON.stringify({ compilerOptions: { target: 'es5', lib: ['dom', 'es2017'], jsx: 'preserve', module: 'esnext', moduleResolution: 'node', strict: true, esModuleInterop: true }, include: ['**/*.ts', '**/*.tsx'], exclude: ['node_modules'] }, null, 2) },
          { path: 'app/layout.tsx', content: "export const metadata = { title: '" + name + "' };\n\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang=\"en\">\n      <body>{children}</body>\n    </html>\n  );\n}\n" },
          { path: 'app/page.tsx', content: "export default function Home() {\n  return (\n    <main style={{ padding: '2rem' }}>\n      <h1>" + name + "</h1>\n      <p>Next.js 14 project ready.</p>\n    </main>\n  );\n}\n" },
          { path: 'app/globals.css', content: '* { margin: 0; padding: 0; box-sizing: border-box; }\nbody { font-family: -apple-system, sans-serif; }\n' },
          { path: 'public/favicon.ico', content: '' },
          { path: '.gitignore', content: 'node_modules/\n.next/\nout/\n' },
          { path: 'README.md', content: '# ' + name + '\n\nNext.js 14 project.\n\n```bash\nnpm install\nnpm run dev\n```\n' },
        ];
      case 'express':
        return [
          { path: 'package.json', content: JSON.stringify({
            name, version: '1.0.0',
            scripts: { dev: 'node server.js', start: 'node server.js' },
            dependencies: { express: '^4.18.0', mongoose: '^8.0.0', cors: '^2.8.5', dotenv: '^16.0.0' }
          }, null, 2) },
          { path: 'server.js', content: [
            "const express = require('express');",
            "const cors = require('cors');",
            "const mongoose = require('mongoose');",
            "require('dotenv').config();",
            "",
            "const app = express();",
            "app.use(cors());",
            "app.use(express.json());",
            "",
            "app.use('/api/items', require('./routes/items'));",
            "",
            "mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/" + name + "')",
            "  .then(() => console.log('MongoDB connected'));",
            "",
            "const PORT = process.env.PORT || 3000;",
            "app.listen(PORT, () => console.log('Running on ' + PORT));",
          ].join('\n') },
          { path: 'models/Item.js', content: "const mongoose = require('mongoose');\n\nconst ItemSchema = new mongoose.Schema({\n  name: { type: String, required: true },\n  description: String,\n  completed: { type: Boolean, default: false },\n}, { timestamps: true });\n\nmodule.exports = mongoose.model('Item', ItemSchema);\n" },
          { path: 'routes/items.js', content: [
            "const router = require('express').Router();",
            "const Item = require('../models/Item');",
            "",
            "router.get('/', async (req, res) => {",
            "  res.json(await Item.find().sort({ createdAt: -1 }));",
            "});",
            "",
            "router.post('/', async (req, res) => {",
            "  res.status(201).json(await Item.create(req.body));",
            "});",
            "",
            "router.delete('/:id', async (req, res) => {",
            "  await Item.findByIdAndDelete(req.params.id);",
            "  res.json({ msg: 'Deleted' });",
            "});",
            "",
            "module.exports = router;",
          ].join('\n') },
          { path: '.env', content: 'PORT=3000\nMONGODB_URI=mongodb://localhost:27017/' + name },
          { path: '.gitignore', content: 'node_modules/\n.env\n' },
          { path: 'README.md', content: '# ' + name + '\n\nExpress + MongoDB API.\n\n```bash\nnpm install\nnpm run dev\n```\n' },
        ];
      case 'empty':
        return [
          { path: 'README.md', content: `# ${name}\n` },
          { path: '.gitignore', content: 'node_modules/\n.env\ntarget/\ndist/\n' },
        ];
      default:
        return [{ path: 'README.md', content: `# ${name}\n` }];
    }
  }

  /** Extract the file extension including the dot (e.g. ".py"). */
  private fileExtension(filePath: string): string {
    const name = filePath.split('/').pop() ?? filePath;
    const dotIdx = name.lastIndexOf('.');
    return dotIdx !== -1 ? name.substring(dotIdx).toLowerCase() : '';
  }

  ngOnDestroy(): void {
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
    this.editor?.dispose();
  }
}
