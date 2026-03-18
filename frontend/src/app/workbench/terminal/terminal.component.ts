import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { IpcService } from '../../core/ipc.service';
import { ThemeService } from '../../core/theme.service';
import { IconComponent } from '../../shared/ui/icon/icon.component';

interface TerminalSession {
  id: string;
  pid: number;
  name: string;
  xterm: Terminal;
  fitAddon: FitAddon;
  unsubData?: () => void;
  unsubExit?: () => void;
}

@Component({
  selector: 'app-terminal',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="terminal-wrapper" (click)="onWrapperClick($event)">
      <!-- Terminal header with tabs -->
      <div class="terminal-header">
        <div class="terminal-tabs">
          @for (term of terminals(); track term.id; let i = $index) {
            <button
              class="term-tab"
              [class.active]="activeIndex() === i"
              (click)="switchTab(i)"
            >
              <app-icon name="terminal" [size]="12" />
              {{ term.name }}
              <span
                class="tab-close"
                (click)="closeTerminal(i); $event.stopPropagation()"
                title="Close terminal"
              >×</span>
            </button>
          }
          <button
            class="term-tab add-tab"
            (click)="createNewTerminal()"
            title="New Terminal"
          >
            <app-icon name="plus" [size]="12" />
          </button>
        </div>
        <div class="terminal-actions">
          <button
            class="terminal-btn"
            title="Clear Terminal"
            (click)="clearTerminal()"
          >
            <app-icon name="trash" [size]="14" />
          </button>
        </div>
      </div>

      <!-- Multiple xterm containers, one per session -->
      <div class="terminal-containers" (contextmenu)="onContextMenu($event)">
        @for (term of terminals(); track term.id; let i = $index) {
          <div
            class="term-container"
            [class.visible]="activeIndex() === i"
            [attr.data-terminal-id]="term.id"
          ></div>
        }
      </div>

      @if (contextMenu()) {
        <div
          class="terminal-context-menu"
          [style.top.px]="contextMenu()!.y"
          [style.left.px]="contextMenu()!.x"
        >
          <button class="context-item" (click)="copySelection()">
            <app-icon name="copy" [size]="14" />
            Copy
            <span class="shortcut">Ctrl+C</span>
          </button>
          <button class="context-item" (click)="pasteClipboard()">
            <app-icon name="paste" [size]="14" />
            Paste
            <span class="shortcut">Ctrl+V</span>
          </button>
          <div class="context-separator"></div>
          <button class="context-item" (click)="selectAll()">
            Select All
          </button>
          <button class="context-item" (click)="clearTerminal()">
            Clear
          </button>
        </div>
      }

      @if (terminals().length === 0 && !isCreating()) {
        <div class="terminal-placeholder">
          <app-icon name="terminal" [size]="32" />
          <p>No terminal session</p>
          <button class="create-btn" (click)="createNewTerminal()">
            Create Terminal
          </button>
        </div>
      }

      @if (isCreating()) {
        <div class="terminal-placeholder">
          <app-icon name="loading" [size]="24" />
          <p>Starting terminal...</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .terminal-wrapper {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--bg-tertiary);
      overflow: hidden;
    }

    :host-context(body.has-bg-image) .terminal-wrapper,
    :host-context(body.has-bg-image) .terminal-placeholder {
      background: transparent !important;
    }

    .terminal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: color-mix(in srgb, var(--bg-secondary) 90%, var(--bg-tertiary));
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      border-top: 2px solid rgba(166, 226, 46, 0.15);
      flex-shrink: 0;
      height: 32px;
      padding-right: 8px;
    }

    /* ── Tab bar ── */
    .terminal-tabs {
      display: flex;
      align-items: center;
      gap: 1px;
      flex: 1;
      overflow-x: auto;
      min-width: 0;
      height: 100%;

      /* Hide scrollbar but keep scrollability */
      scrollbar-width: none;
      &::-webkit-scrollbar { display: none; }
    }

    .term-tab {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--text-muted);
      font-size: 11px;
      font-family: inherit;
      cursor: pointer;
      white-space: nowrap;
      height: 100%;
      transition: color 0.15s, background 0.15s, border-color 0.15s;

      &:hover {
        color: var(--text-primary);
        background: rgba(255, 255, 255, 0.03);
      }

      &.active {
        color: var(--text-primary);
        border-bottom-color: var(--accent-primary);
        background: rgba(166, 226, 46, 0.04);
      }

      &.add-tab {
        padding: 4px 8px;
        color: var(--text-muted);
        border-bottom-color: transparent;

        &:hover {
          color: var(--accent-primary);
          background: rgba(166, 226, 46, 0.06);
        }
      }
    }

    .tab-close {
      font-size: 15px;
      line-height: 1;
      color: var(--text-muted);
      margin-left: 4px;
      border-radius: 3px;
      width: 16px;
      height: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.12s, color 0.12s;

      &:hover {
        background: rgba(255, 255, 255, 0.1);
        color: var(--accent-error, #f38ba8);
      }
    }

    /* ── Actions (clear button) ── */
    .terminal-actions {
      display: flex;
      gap: 2px;
      flex-shrink: 0;
    }

    .terminal-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      background: transparent;
      border: none;
      border-radius: var(--radius-sm);
      color: var(--text-muted);
      cursor: pointer;
      transition: background var(--transition-fast), color var(--transition-fast);

      &:hover {
        background: rgba(255, 255, 255, 0.07);
        color: var(--text-primary);
      }
    }

    /* ── Terminal containers ── */
    .terminal-containers {
      flex: 1;
      position: relative;
      overflow: hidden;
    }

    .term-container {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      padding: 4px 6px;
      display: none;

      &.visible {
        display: block;
      }
    }

    /* ── Placeholder ── */
    .terminal-placeholder {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      color: var(--text-muted);
      font-size: 13px;
      background: var(--bg-tertiary);
    }

    .create-btn {
      padding: 6px 16px;
      background: var(--accent-primary);
      color: var(--bg-tertiary);
      border: none;
      border-radius: var(--radius-sm);
      font-size: 13px;
      cursor: pointer;
      font-weight: 500;

      &:hover {
        opacity: 0.9;
      }
    }

    /* ── Context menu ── */
    .terminal-context-menu {
      position: fixed;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg);
      z-index: 1000;
      min-width: 180px;
      padding: 4px;
    }

    .context-item {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 6px 12px;
      background: transparent;
      border: none;
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      font-size: 13px;
      text-align: left;
      cursor: pointer;

      &:hover {
        background: var(--bg-hover);
      }

      .shortcut {
        margin-left: auto;
        font-size: 11px;
        color: var(--text-muted);
      }
    }

    .context-separator {
      height: 1px;
      background: var(--border-color);
      margin: 4px 0;
    }
  `],
})
export class TerminalComponent implements AfterViewInit, OnDestroy {
  /** Kept for backward compatibility — not used in the multi-tab approach */
  @ViewChild('terminalContainer') terminalContainer?: ElementRef<HTMLDivElement>;

  private readonly ipc = inject(IpcService);
  private readonly themeService = inject(ThemeService);
  private readonly elementRef = inject(ElementRef);

  // ── State ──────────────────────────────────────────────────────────────────
  readonly terminals = signal<TerminalSession[]>([]);
  readonly activeIndex = signal(0);
  readonly isCreating = signal(false);
  readonly contextMenu = signal<{ x: number; y: number } | null>(null);

  private terminalCounter = 0;
  private resizeObserver: ResizeObserver | null = null;

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngAfterViewInit(): void {
    this.createNewTerminal();

    // Observe the host element for resize events and refit the active terminal
    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(this.elementRef.nativeElement);
  }

  ngOnDestroy(): void {
    // Destroy all sessions
    for (const session of this.terminals()) {
      this.destroySession(session);
    }
    this.resizeObserver?.disconnect();
  }

  // ── Terminal management ────────────────────────────────────────────────────

  async createNewTerminal(): Promise<void> {
    if (this.isCreating()) return;
    this.isCreating.set(true);
    this.terminalCounter++;

    const hasBgImage = this.themeService.backgroundConfig().type === 'image';
    const terminalBackground = hasBgImage ? 'transparent' : '#11111b';

    try {
      const xterm = new Terminal({
        theme: {
          background: terminalBackground,
          foreground: '#cdd6f4',
          cursor: '#f5e0dc',
          cursorAccent: '#11111b',
          selectionBackground: 'rgba(137, 180, 250, 0.3)',
          black: '#45475a',
          red: '#f38ba8',
          green: '#a6e3a1',
          yellow: '#f9e2af',
          blue: '#89b4fa',
          magenta: '#f5c2e7',
          cyan: '#94e2d5',
          white: '#bac2de',
          brightBlack: '#585b70',
          brightRed: '#f38ba8',
          brightGreen: '#a6e3a1',
          brightYellow: '#f9e2af',
          brightBlue: '#89b4fa',
          brightMagenta: '#f5c2e7',
          brightCyan: '#94e2d5',
          brightWhite: '#a6adc8',
        },
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        fontSize: 13,
        lineHeight: 1.4,
        cursorBlink: true,
        cursorStyle: 'block',
        scrollback: 5000,
        allowTransparency: true,
        rightClickSelectsWord: true,
        allowProposedApi: true,
      });

      const fitAddon = new FitAddon();
      xterm.loadAddon(fitAddon);
      xterm.loadAddon(new WebLinksAddon());

      // Propose dimensions before the PTY is created
      const dims = fitAddon.proposeDimensions?.() ?? { cols: 80, rows: 24 };
      const response = await this.ipc.createTerminal({
        cols: dims.cols ?? 80,
        rows: dims.rows ?? 24,
      });

      const session: TerminalSession = {
        id: response.id,
        pid: response.pid,
        name: `Terminal ${this.terminalCounter}`,
        xterm,
        fitAddon,
      };

      // IPC: receive data from PTY → write to xterm
      session.unsubData = this.ipc.onTerminalData((e) => {
        if (e.id === session.id) xterm.write(e.data);
      });

      // IPC: PTY process exited
      session.unsubExit = this.ipc.onTerminalExit((e) => {
        if (e.id === session.id) {
          xterm.write(`\r\n\x1b[31mProcess exited with code ${e.exitCode}\x1b[0m\r\n`);
        }
      });

      // xterm user input → IPC → PTY
      xterm.onData((data) => {
        this.ipc.sendTerminalInput({ id: session.id, data });
      });

      // Keyboard shortcuts (copy/paste)
      xterm.attachCustomKeyEventHandler((event: KeyboardEvent) => {
        return this.handleKeyEvent(event, session);
      });

      // Add session to the array and make it active
      this.terminals.update(t => [...t, session]);
      this.activeIndex.set(this.terminals().length - 1);

      // Attach xterm to its DOM container after Angular renders it
      setTimeout(() => {
        const containers = this.elementRef.nativeElement.querySelectorAll('.term-container') as NodeListOf<HTMLElement>;
        const container = containers[containers.length - 1];
        if (container) {
          xterm.open(container);
          fitAddon.fit();
        }
      }, 50);

    } catch (err) {
      console.error('[Terminal] Failed to create terminal:', err);
    } finally {
      this.isCreating.set(false);
    }
  }

  switchTab(index: number): void {
    this.activeIndex.set(index);
    // Refit after the container becomes visible
    setTimeout(() => {
      const session = this.terminals()[index];
      if (session) {
        try {
          session.fitAddon.fit();
          const dims = session.fitAddon.proposeDimensions();
          if (dims) {
            this.ipc.resizeTerminal({ id: session.id, cols: dims.cols, rows: dims.rows });
          }
        } catch {
          // Ignore resize errors during tab switch
        }
      }
    }, 50);
  }

  closeTerminal(index: number): void {
    const terms = [...this.terminals()];
    const session = terms[index];
    if (!session) return;

    this.destroySession(session);
    terms.splice(index, 1);
    this.terminals.set(terms);

    // Adjust active index so it stays in bounds
    if (terms.length === 0) {
      this.activeIndex.set(0);
    } else if (this.activeIndex() >= terms.length) {
      this.activeIndex.set(terms.length - 1);
    }
  }

  /** Send a command string to the active terminal, followed by Enter. */
  sendCommand(command: string): void {
    const session = this.terminals()[this.activeIndex()];
    if (session) {
      this.ipc.sendTerminalInput({ id: session.id, data: command + '\r' });
    }
  }

  clearTerminal(): void {
    const session = this.terminals()[this.activeIndex()];
    if (session) session.xterm.clear();
    this.contextMenu.set(null);
  }

  // ── Context menu ───────────────────────────────────────────────────────────

  onContextMenu(event: MouseEvent): void {
    event.preventDefault();
    this.contextMenu.set({ x: event.clientX, y: event.clientY });

    const close = () => {
      this.contextMenu.set(null);
      document.removeEventListener('click', close);
    };
    setTimeout(() => document.addEventListener('click', close), 0);
  }

  onWrapperClick(_event: MouseEvent): void {
    if (this.contextMenu()) {
      this.contextMenu.set(null);
    }
  }

  copySelection(): void {
    const session = this.terminals()[this.activeIndex()];
    const selection = session?.xterm.getSelection();
    if (selection) navigator.clipboard.writeText(selection);
    this.contextMenu.set(null);
  }

  pasteClipboard(): void {
    const session = this.terminals()[this.activeIndex()];
    if (!session) return;
    navigator.clipboard.readText().then(text => {
      if (text) this.ipc.sendTerminalInput({ id: session.id, data: text });
    });
    this.contextMenu.set(null);
  }

  selectAll(): void {
    const session = this.terminals()[this.activeIndex()];
    session?.xterm.selectAll();
    this.contextMenu.set(null);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private handleKeyEvent(event: KeyboardEvent, session: TerminalSession): boolean {
    // Ctrl+C with selection → copy; without selection → SIGINT (pass through)
    if (event.ctrlKey && event.key === 'c' && event.type === 'keydown') {
      const selection = session.xterm.getSelection();
      if (selection) {
        navigator.clipboard.writeText(selection);
        return false;
      }
      return true;
    }

    // Ctrl+V → paste from clipboard
    if (event.ctrlKey && event.key === 'v' && event.type === 'keydown') {
      navigator.clipboard.readText().then(text => {
        if (text) this.ipc.sendTerminalInput({ id: session.id, data: text });
      });
      return false;
    }

    // Ctrl+Shift+C → always copy
    if (event.ctrlKey && event.shiftKey && event.key === 'C' && event.type === 'keydown') {
      const selection = session.xterm.getSelection();
      if (selection) navigator.clipboard.writeText(selection);
      return false;
    }

    // Ctrl+Shift+V → always paste
    if (event.ctrlKey && event.shiftKey && event.key === 'V' && event.type === 'keydown') {
      navigator.clipboard.readText().then(text => {
        if (text) this.ipc.sendTerminalInput({ id: session.id, data: text });
      });
      return false;
    }

    return true;
  }

  private destroySession(session: TerminalSession): void {
    session.unsubData?.();
    session.unsubExit?.();
    session.xterm.dispose();
    this.ipc.destroyTerminal({ id: session.id });
  }

  private onResize(): void {
    const session = this.terminals()[this.activeIndex()];
    if (!session) return;

    try {
      session.fitAddon.fit();
      const dims = session.fitAddon.proposeDimensions();
      if (dims) {
        this.ipc.resizeTerminal({ id: session.id, cols: dims.cols, rows: dims.rows });
      }
    } catch {
      // Ignore resize errors
    }
  }
}
