import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from './sidebar/sidebar.component';
import { EditorComponent } from './editor/editor.component';
import { PanelsComponent } from './panels/panels.component';
import { ChatPanelComponent } from '../ai/chat/chat-panel.component';
import { IconComponent } from '../shared/ui/icon/icon.component';
import { TooltipDirective } from '../shared/ui/tooltip/tooltip.directive';
import { SettingsPanelComponent } from './settings/settings-panel.component';
import { IpcService } from '../core/ipc.service';
import { ConfigService } from '../core/config.service';
import { ToastService } from '../shared/ui/toast/toast.service';
import { MoodService } from '../core/mood.service';
import { ThemeService } from '../core/theme.service';

@Component({
  selector: 'app-workbench',
  standalone: true,
  imports: [
    CommonModule,
    SidebarComponent,
    EditorComponent,
    PanelsComponent,
    ChatPanelComponent,
    IconComponent,
    TooltipDirective,
    SettingsPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="workbench">
      <!-- Title Bar (Electron custom titlebar) -->
      <div class="titlebar">
        <!-- Window controls (macOS style) -->
        <div class="titlebar-controls">
          <button
            class="window-btn close"
            appTooltip="Close"
            (click)="ipc.closeWindow()"
          ></button>
          <button
            class="window-btn minimize"
            appTooltip="Minimize"
            (click)="ipc.minimizeWindow()"
          ></button>
          <button
            class="window-btn maximize"
            appTooltip="Maximize"
            (click)="ipc.maximizeWindow()"
          ></button>
        </div>

        <!-- App title -->
        <div class="titlebar-title">
          <span class="app-name cortex-brand">CORTEX-ID</span>
          @if (currentProjectName()) {
            <span class="project-name">— {{ currentProjectName() }}</span>
          }
        </div>

        <!-- Titlebar actions -->
        <div class="titlebar-actions">
          <button
            class="titlebar-btn"
            appTooltip="Toggle AI Panel (Ctrl+Shift+I)"
            [class.active]="showAiPanel()"
            (click)="toggleAiPanel()"
          >
            <app-icon name="chat" [size]="15" />
          </button>
          <button
            class="titlebar-btn"
            appTooltip="Settings (Ctrl+,)"
            [class.active]="showSettings()"
            (click)="openSettings()"
          >
            <app-icon name="settings" [size]="15" />
          </button>
        </div>
      </div>

      <!-- Focus Mode Bar -->
      @if (focusMode()) {
        <div class="focus-bar">
          <span class="focus-icon">🎯</span>
          <span class="focus-objective">Focus: "{{ focusObjective() }}"</span>
          <span class="focus-timer">{{ focusElapsed() }}</span>
          <button class="focus-done" (click)="endFocusMode()">✓ Done</button>
          <button class="focus-cancel" (click)="focusMode.set(false)">✕</button>
        </div>
      }

      <!-- Main layout -->
      <div class="workbench-layout">
        <!-- Sidebar -->
        @if (showSidebar()) {
          <div
            class="sidebar-area"
            [style.width.px]="sidebarWidth()"
          >
            <app-sidebar
              #sidebarRef
              (fileSelected)="onFileSelected($event)"
              (settingsRequested)="openSettings()"
              (projectOpened)="onProjectOpened($event)"
            />
          </div>

          <!-- Sidebar resize handle -->
          <div
            class="resize-handle resize-handle-h"
            (mousedown)="startSidebarResize($event)"
          ></div>
        }

        <!-- Center area: Editor + Bottom Panel -->
        <div class="center-area" style="position: relative;">
          <!-- Editor -->
          <div
            class="editor-area workbench-editor-area"
            [style.height]="showBottomPanel() ? 'calc(100% - ' + panelHeight() + 'px)' : '100%'"
          >
            <app-editor #editorRef (fileSaved)="onFileSaved()" (folderOpened)="onFolderOpened($event)" />
          </div>

          <!-- Bottom panel resize handle -->
          @if (showBottomPanel()) {
            <div
              class="resize-handle resize-handle-v"
              (mousedown)="startPanelResize($event)"
            ></div>

            <!-- Bottom panel -->
            <div
              class="bottom-panel-area"
              [style.height.px]="panelHeight()"
            >
              <app-panels
                (closeRequested)="showBottomPanel.set(false)"
                (maximizeRequested)="onPanelMaximize($event)"
              />
            </div>
          }

          <!-- AI Panel Toggle — always visible at right edge of center area -->
          <button
            class="ai-toggle-btn"
            (click)="toggleAiPanel()"
            [title]="showAiPanel() ? 'Close AI Chat (Ctrl+Shift+I)' : 'Open AI Chat (Ctrl+Shift+I)'"
          >
            {{ showAiPanel() ? '›' : '💬' }}
          </button>
        </div>

        <!-- AI Chat Panel -->
        @if (showAiPanel()) {
          <!-- AI panel resize handle -->
          <div
            class="resize-handle resize-handle-h"
            (mousedown)="startAiPanelResize($event)"
          ></div>

          <div
            class="ai-panel-area"
            [style.width.px]="aiPanelWidth()"
          >
            <app-chat-panel
              [editorContext]="currentEditorContext()"
              [projectFiles]="projectFileList()"
              (applyEdit)="onApplyEdit($event)"
            />
          </div>
        }
      </div>

      <!-- Settings Panel Modal -->
      @if (showSettings()) {
        <app-settings-panel (closed)="closeSettings()" />
      }

      <!-- Status bar -->
      <div class="statusbar">
        <div class="statusbar-left">
          <!-- Toggle sidebar -->
          <button
            class="statusbar-btn"
            appTooltip="Toggle Sidebar (Ctrl+B)"
            tooltipPosition="top"
            (click)="toggleSidebar()"
          >
            <app-icon name="file" [size]="13" />
          </button>

          <!-- Toggle panel -->
          <button
            class="statusbar-btn"
            appTooltip="Toggle Terminal (Ctrl+\`)"
            tooltipPosition="top"
            (click)="toggleBottomPanel()"
          >
            <app-icon name="terminal" [size]="13" />
          </button>
        </div>

        <div class="statusbar-center">
          @if (savedMessage()) {
            <span class="statusbar-saved">{{ savedMessage() }}</span>
          } @else {
            <span class="statusbar-info">Cortex-ID v0.1.0</span>
          }
        </div>

        <div class="statusbar-right">
          @if (!ipc.isElectron) {
            <span class="statusbar-badge warning">Browser Mode</span>
          }
          <span class="statusbar-info">Ready</span>
        </div>
      </div>

      <!-- Pair Review notification -->
      @if (pairReviewResult()) {
        <div class="pair-review">
          <div class="pair-review-header">
            <span>🔍 Cortex reviewed your changes</span>
            <button class="pair-review-close" (click)="pairReviewResult.set(null)">✕</button>
          </div>
          @for (file of pairReviewResult()!.files; track file.name) {
            <div class="review-file" [class]="'review-' + file.status">
              <span class="review-icon">{{ file.status === 'ok' ? '✅' : file.status === 'warn' ? '⚠️' : '❌' }}</span>
              <span class="review-name">{{ file.name }}</span>
              <span class="review-msg">{{ file.message }}</span>
            </div>
          }
          <div class="pair-review-actions">
            <button class="pr-btn commit" (click)="pairReviewResult.set(null)">Commit anyway</button>
            <button class="pr-btn fix" (click)="pairReviewResult.set(null)">Fix first</button>
          </div>
        </div>
      }

      <!-- Fixed Settings FAB — always visible -->
      <button
        class="settings-fab"
        (click)="openSettings()"
        title="Settings (Ctrl+,)"
      >
        ⚙
      </button>

      <!-- Fixed Chat Toggle — always visible on right edge -->
      <button
        class="chat-fab"
        (click)="toggleAiPanel()"
        title="{{ showAiPanel() ? 'Close AI Chat' : 'Open AI Chat (Ctrl+Shift+I)' }}"
      >
        {{ showAiPanel() ? '›' : '💬' }}
      </button>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100vh;
      width: 100vw;
    }

    .workbench {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      overflow: hidden;
      background: var(--bg-primary);
    }

    /* ── Title Bar ────────────────────────────────────────────────────────────── */
    .titlebar {
      display: flex;
      align-items: center;
      height: var(--titlebar-height);
      background: var(--bg-tertiary);
      border-bottom: 1px solid var(--border-color);
      flex-shrink: 0;
      -webkit-app-region: drag;
      user-select: none;
      padding: 0 12px;
      gap: 12px;
    }

    .titlebar-controls {
      display: flex;
      gap: 6px;
      -webkit-app-region: no-drag;
    }

    .window-btn {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      transition: opacity var(--transition-fast);

      &.close { background: #ff5f57; }
      &.minimize { background: #febc2e; }
      &.maximize { background: #28c840; }

      &:hover { opacity: 0.8; }
    }

    .titlebar-title {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: 12px;
    }

    .app-name {
      font-weight: 600;
      color: var(--text-primary);
    }

    .cortex-brand {
      background: linear-gradient(90deg, #FF0040, #00FF88, #FF0040);
      background-size: 200% auto;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: gradientShift 3s linear infinite;
      font-weight: 700;
      letter-spacing: 1.5px;
    }

    @keyframes gradientShift {
      0%   { background-position: 0% center; }
      100% { background-position: 200% center; }
    }

    .project-name {
      color: var(--text-muted);
    }

    .titlebar-actions {
      display: flex;
      gap: 4px;
      -webkit-app-region: no-drag;
    }

    .titlebar-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      background: transparent;
      border: none;
      border-radius: var(--radius-sm);
      color: var(--text-muted);
      cursor: pointer;
      transition: background var(--transition-fast), color var(--transition-fast);

      &:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
      }

      &.active {
        background: var(--bg-surface);
        color: var(--accent-primary);
      }
    }

    /* ── Focus Mode Bar ───────────────────────────────────────────────────────── */
    .focus-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 16px;
      background: rgba(0, 255, 136, 0.1);
      border-bottom: 1px solid rgba(0, 255, 136, 0.2);
      font-size: 12px;
      color: #00FF88;
      flex-shrink: 0;

      .focus-icon { font-size: 14px; }
      .focus-objective { font-weight: 600; flex: 1; }
      .focus-timer { font-family: var(--font-mono); color: var(--text-muted); }

      .focus-done, .focus-cancel {
        padding: 2px 8px;
        border: none;
        border-radius: var(--radius-sm);
        font-size: 11px;
        cursor: pointer;
      }

      .focus-done {
        background: rgba(0, 255, 136, 0.2);
        color: #00FF88;
        &:hover { background: rgba(0, 255, 136, 0.3); }
      }

      .focus-cancel {
        background: transparent;
        color: var(--text-muted);
        &:hover { color: var(--accent-error); }
      }
    }

    /* ── Main Layout ──────────────────────────────────────────────────────────── */
    .workbench-layout {
      display: flex;
      flex: 1;
      overflow: hidden;
      min-height: 0;
    }

    .sidebar-area {
      flex-shrink: 0;
      overflow: hidden;
      min-width: 160px;
      max-width: 600px;
    }

    .center-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-width: 0;
    }

    .editor-area {
      flex-shrink: 0;
      overflow: hidden;
      transition: height var(--transition-fast);
    }

    .bottom-panel-area {
      flex-shrink: 0;
      overflow: hidden;
      min-height: 80px;
      max-height: 80vh;
    }

    .ai-panel-area {
      flex-shrink: 0;
      overflow: hidden;
      min-width: 240px;
      max-width: 600px;
      border-left: 1px solid var(--border-color);
    }

    /* ── AI Panel Toggle Button ───────────────────────────────────────────────── */
    .ai-toggle-btn {
      position: absolute;
      right: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 24px;
      height: 48px;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-right: none;
      border-radius: var(--radius-sm) 0 0 var(--radius-sm);
      color: var(--text-primary);
      font-size: 14px;
      cursor: pointer;
      z-index: 50;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
      padding: 0;
      line-height: 1;

      &:hover {
        background: var(--accent-primary);
        color: var(--bg-tertiary);
        width: 28px;
      }
    }

    /* ── Resize Handles ───────────────────────────────────────────────────────── */
    .resize-handle {
      flex-shrink: 0;
      background: transparent;
      transition: background var(--transition-fast);
      z-index: 10;

      &:hover, &.dragging {
        background: var(--accent-primary);
      }

      &.resize-handle-h {
        width: 4px;
        cursor: col-resize;
      }

      &.resize-handle-v {
        height: 4px;
        cursor: row-resize;
        width: 100%;
      }
    }

    /* ── Status Bar ───────────────────────────────────────────────────────────── */
    .statusbar {
      display: flex;
      align-items: center;
      height: var(--statusbar-height);
      background: var(--accent-primary);
      color: var(--bg-tertiary);
      font-size: 11px;
      flex-shrink: 0;
      padding: 0 8px;
      gap: 8px;
    }

    .statusbar-left,
    .statusbar-right {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .statusbar-center {
      flex: 1;
      display: flex;
      justify-content: center;
    }

    .statusbar-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      background: transparent;
      border: none;
      border-radius: var(--radius-sm);
      color: var(--bg-tertiary);
      cursor: pointer;
      opacity: 0.8;

      &:hover {
        opacity: 1;
        background: rgba(0, 0, 0, 0.15);
      }
    }

    .statusbar-info {
      opacity: 0.8;
    }

    .statusbar-saved {
      font-weight: 600;
      color: var(--bg-tertiary);
      animation: fadeIn var(--transition-fast);
    }

    .statusbar-badge {
      padding: 1px 6px;
      border-radius: var(--radius-sm);
      font-size: 10px;
      font-weight: 600;

      &.warning {
        background: var(--accent-warning);
        color: var(--bg-tertiary);
      }
    }

    /* ── Settings FAB ─────────────────────────────────────────────────────────── */
    .settings-fab {
      position: fixed;
      bottom: 28px;
      left: 12px;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--accent-primary);
      color: var(--bg-tertiary);
      font-size: 18px;
      border: none;
      cursor: pointer;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      transition: transform 0.15s ease, box-shadow 0.15s ease;

      &:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.5);
      }
    }

    /* ── Chat FAB ─────────────────────────────────────────────────────────────── */
    .chat-fab {
      position: fixed;
      right: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 28px;
      height: 64px;
      background: var(--accent-primary);
      color: var(--bg-tertiary);
      font-size: 16px;
      font-weight: bold;
      border: none;
      border-radius: 8px 0 0 8px;
      cursor: pointer;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: -4px 0 12px rgba(0, 0, 0, 0.3);
      transition: width 0.15s ease;

      &:hover {
        width: 36px;
      }
    }

    /* ── Pair Review ──────────────────────────────────────────────────────────── */
    .pair-review {
      position: fixed;
      bottom: 80px;
      right: 16px;
      width: 380px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
      z-index: 8000;
      animation: slideInUp 0.2s ease;
      overflow: hidden;

      .pair-review-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        font-size: 13px;
        font-weight: 600;
        color: var(--text-primary);
        border-bottom: 1px solid var(--border-color);
      }

      .pair-review-close {
        background: none;
        border: none;
        color: var(--text-muted);
        cursor: pointer;
        font-size: 14px;
        &:hover { color: var(--text-primary); }
      }

      .review-file {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        font-size: 12px;

        .review-icon { font-size: 13px; }
        .review-name { font-weight: 500; color: var(--text-primary); }
        .review-msg { color: var(--text-muted); flex: 1; text-align: right; }
      }

      .pair-review-actions {
        display: flex;
        gap: 8px;
        padding: 12px 16px;
        border-top: 1px solid var(--border-color);
      }

      .pr-btn {
        flex: 1;
        padding: 6px 12px;
        border-radius: var(--radius-sm);
        font-size: 12px;
        cursor: pointer;
        border: 1px solid var(--border-color);

        &.commit {
          background: transparent;
          color: var(--text-secondary);
          &:hover { background: var(--bg-hover); }
        }

        &.fix {
          background: var(--accent-primary);
          color: var(--bg-tertiary);
          border: none;
          font-weight: 600;
          &:hover { opacity: 0.9; }
        }
      }
    }

    @keyframes slideInUp {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `],
})
export class WorkbenchComponent implements OnInit {
  @ViewChild('editorRef') editorRef!: EditorComponent;
  @ViewChild('sidebarRef') sidebarRef!: SidebarComponent;

  readonly ipc = inject(IpcService);
  private readonly config = inject(ConfigService);
  private readonly toast = inject(ToastService);
  private readonly moodService = inject(MoodService);
  private readonly themeService = inject(ThemeService);

  /* Layout state */
  readonly showSidebar = signal(true);
  readonly showBottomPanel = signal(true);
  readonly showAiPanel = signal(true);
  readonly showSettings = signal(false);
  readonly sidebarWidth = signal(260);
  readonly panelHeight = signal(250);
  readonly aiPanelWidth = signal(350);

  /** Full filesystem path of the open project (e.g. /home/user/my-app) */
  readonly currentProjectPath = signal('');
  /** Display name shown in the titlebar (last path segment) */
  readonly currentProjectName = signal('');
  /** Top-level file list sent to the AI for project awareness */
  readonly projectFileList = signal<string[]>([]);

  /** Transient "Saved ✓" message shown in statusbar for 2 seconds after save */
  readonly savedMessage = signal('');
  private savedMessageTimer: ReturnType<typeof setTimeout> | null = null;

  /* ── INNOVACIÓN B: Focus Mode ───────────────────────────────────────────────── */
  readonly focusMode = signal(false);
  readonly focusObjective = signal('');
  readonly focusStartTime = signal(0);
  readonly focusElapsed = signal('');

  /* ── INNOVACIÓN D: Pair Review ──────────────────────────────────────────────── */
  readonly pairReviewResult = signal<{ files: { name: string; status: 'ok' | 'warn' | 'error'; message: string }[] } | null>(null);

  /** Editor context passed down to the chat panel so the AI knows what file is open */
  readonly currentEditorContext = computed(() => {
    // editorRef is a ViewChild — may be undefined before view init; access signal safely
    const tab = this.editorRef?.activeTab();
    return {
      filePath: tab?.path ?? undefined,
      selectedCode: undefined,
      language: tab?.language ?? undefined,
      projectPath: this.currentProjectPath() || undefined,
      fileContent: tab?.content ?? undefined,
    };
  });

  /* ── Keyboard shortcuts ─────────────────────────────────────────────────────── */

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    const ctrl = event.ctrlKey || event.metaKey;

    // Ctrl+B — Toggle sidebar
    if (ctrl && event.key === 'b') {
      event.preventDefault();
      this.toggleSidebar();
      return;
    }

    // Ctrl+` — Toggle bottom panel (terminal)
    if (ctrl && event.key === '`') {
      event.preventDefault();
      this.toggleBottomPanel();
      return;
    }

    // Ctrl+Shift+I — Toggle AI chat panel
    if (ctrl && event.shiftKey && event.key === 'I') {
      event.preventDefault();
      this.toggleAiPanel();
      return;
    }

    // Ctrl+, — Open settings
    if (ctrl && event.key === ',') {
      event.preventDefault();
      this.openSettings();
      return;
    }

    // Ctrl+P — Quick file search (placeholder)
    if (ctrl && event.key === 'p') {
      event.preventDefault();
      this.onQuickOpen();
      return;
    }

    // Ctrl+W — Close active tab
    if (ctrl && event.key === 'w') {
      event.preventDefault();
      this.editorRef?.closeActiveTab();
      return;
    }

    // Ctrl+Tab — Cycle to next tab; Ctrl+Shift+Tab — previous tab
    if (ctrl && event.key === 'Tab') {
      event.preventDefault();
      this.editorRef?.cycleTab(event.shiftKey ? -1 : 1);
      return;
    }

    // Escape — Close settings if open
    if (event.key === 'Escape' && this.showSettings()) {
      this.closeSettings();
      return;
    }

    // Alt+F — Toggle Focus Mode
    if (event.altKey && event.key === 'f') {
      event.preventDefault();
      if (this.focusMode()) {
        this.endFocusMode();
      } else {
        this.startFocusMode();
      }
      return;
    }
  }

  /* Resize state */
  private isResizing = false;
  private resizeType: 'sidebar' | 'panel' | 'ai' | null = null;
  private resizeStartX = 0;
  private resizeStartY = 0;
  private resizeStartValue = 0;

  ngOnInit(): void {
    this.setupResizeListeners();
    this.moodService.startMonitoring();

    // Restore wallpaper via ThemeService (BackgroundComponent renders it globally)
    const savedWallpaper = localStorage.getItem('cortex.wallpaper.data');
    if (savedWallpaper) {
      this.themeService.setBackground({
        type: 'image',
        imageUrl: savedWallpaper,
        opacity: Number(localStorage.getItem('cortex.wallpaper.opacity')) || 15,
        blur: Number(localStorage.getItem('cortex.wallpaper.blur')) || 8,
        position: 'cover',
      });
    }

    // Load saved typography
    const fontFamily = localStorage.getItem('cortex.font.family');
    const fontSize = localStorage.getItem('cortex.font.size');
    const fontWeight = localStorage.getItem('cortex.font.weight');
    if (fontFamily) document.documentElement.style.setProperty('--font-mono', `'${fontFamily}', monospace`);
    if (fontSize) document.documentElement.style.setProperty('--editor-font-size', `${fontSize}px`);
    if (fontWeight) document.documentElement.style.setProperty('--editor-font-weight', fontWeight);

    // Auto-restore last opened project so the AI always has context on startup
    setTimeout(async () => {
      if (!this.currentProjectPath()) {
        const lastProject = localStorage.getItem('cortex.lastProject');
        if (lastProject) {
          await this.onProjectOpened(lastProject);
        }
      }
    }, 1000);
  }

  toggleSidebar(): void {
    this.showSidebar.update((v) => !v);
  }

  toggleBottomPanel(): void {
    this.showBottomPanel.update((v) => !v);
  }

  toggleAiPanel(): void {
    this.showAiPanel.update((v) => !v);
  }

  openSettings(): void {
    this.showSettings.set(true);
  }

  closeSettings(): void {
    this.showSettings.set(false);
  }

  /** Ctrl+P quick open — placeholder for future file search */
  onQuickOpen(): void {
    // TODO: implement quick file search in v0.2
    console.log('[Workbench] Quick open triggered (Ctrl+P) — not yet implemented');
  }

  async onFileSelected(path: string): Promise<void> {
    await this.editorRef?.openFilePath(path);
  }

  async onFolderOpened(path: string): Promise<void> {
    await this.sidebarRef?.openFolderPath(path);
    // openFolderPath triggers folderLoaded → onProjectOpened via sidebar event chain,
    // but we also call it directly here to handle the editor welcome-screen flow.
    await this.onProjectOpened(path);
  }

  async onProjectOpened(path: string): Promise<void> {
    this.currentProjectPath.set(path);
    this.currentProjectName.set(path.split(/[\\/]/).pop() ?? path);
    localStorage.setItem('cortex.lastProject', path);

    // Fetch top-level entries to give the AI project-wide awareness
    try {
      const result = await this.ipc.listDirectory({ path, recursive: false });
      const files = result.entries.map(
        (e) => (e.isDirectory ? '📁 ' : '📄 ') + e.name
      );
      this.projectFileList.set(files);
    } catch {
      this.projectFileList.set([]);
    }
  }

  onFileSaved(): void {
    if (this.savedMessageTimer) clearTimeout(this.savedMessageTimer);
    this.savedMessage.set('Saved ✓');
    this.savedMessageTimer = setTimeout(() => {
      this.savedMessage.set('');
    }, 2000);
  }

  onPanelMaximize(isMaximized: boolean): void {
    this.panelHeight.set(isMaximized ? Math.floor(window.innerHeight * 0.8) : 250);
  }

  onApplyEdit(edit: { filePath: string; content: string }): void {
    if (this.editorRef?.activeTab()?.path === edit.filePath) {
      this.editorRef.setContent(edit.content);
    }
  }

  /* ── Focus Mode methods ─────────────────────────────────────────────────────── */

  startFocusMode(): void {
    const objective = prompt('What are you working on?');
    if (!objective) return;
    this.focusObjective.set(objective);
    this.focusStartTime.set(Date.now());
    this.focusMode.set(true);

    // Update timer every minute
    const interval = setInterval(() => {
      if (!this.focusMode()) { clearInterval(interval); return; }
      const mins = Math.floor((Date.now() - this.focusStartTime()) / 60000);
      this.focusElapsed.set(`${mins}min`);
    }, 60000);
    this.focusElapsed.set('0min');
  }

  endFocusMode(): void {
    const mins = Math.floor((Date.now() - this.focusStartTime()) / 60000);
    this.focusMode.set(false);
    this.toast.success(`Focus session complete! ${mins} minutes on "${this.focusObjective()}"`);
  }

  /* ── Resize logic ───────────────────────────────────────────────────────────── */

  startSidebarResize(event: MouseEvent): void {
    this.isResizing = true;
    this.resizeType = 'sidebar';
    this.resizeStartX = event.clientX;
    this.resizeStartValue = this.sidebarWidth();
    event.preventDefault();
  }

  startPanelResize(event: MouseEvent): void {
    this.isResizing = true;
    this.resizeType = 'panel';
    this.resizeStartY = event.clientY;
    this.resizeStartValue = this.panelHeight();
    event.preventDefault();
  }

  startAiPanelResize(event: MouseEvent): void {
    this.isResizing = true;
    this.resizeType = 'ai';
    this.resizeStartX = event.clientX;
    this.resizeStartValue = this.aiPanelWidth();
    event.preventDefault();
  }

  private setupResizeListeners(): void {
    document.addEventListener('mousemove', (event) => {
      if (!this.isResizing) return;

      if (this.resizeType === 'sidebar') {
        const delta = event.clientX - this.resizeStartX;
        const newWidth = Math.max(160, Math.min(600, this.resizeStartValue + delta));
        this.sidebarWidth.set(newWidth);
      } else if (this.resizeType === 'panel') {
        const delta = this.resizeStartY - event.clientY;
        const newHeight = Math.max(80, Math.min(window.innerHeight * 0.8, this.resizeStartValue + delta));
        this.panelHeight.set(newHeight);
      } else if (this.resizeType === 'ai') {
        const delta = this.resizeStartX - event.clientX;
        const newWidth = Math.max(240, Math.min(600, this.resizeStartValue + delta));
        this.aiPanelWidth.set(newWidth);
      }
    });

    document.addEventListener('mouseup', () => {
      this.isResizing = false;
      this.resizeType = null;
    });
  }
}
