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
import { CommonModule } from '@angular/common';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { IpcService } from '../../core/ipc.service';
import { IconComponent } from '../../shared/ui/icon/icon.component';

@Component({
  selector: 'app-terminal',
  standalone: true,
  imports: [CommonModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="terminal-wrapper">
      <!-- Terminal header -->
      <div class="terminal-header">
        <span class="terminal-title">
          <app-icon name="terminal" [size]="14" />
          TERMINAL
          @if (terminalId()) {
            <span class="terminal-pid">PID: {{ terminalPid() }}</span>
          }
        </span>
        <div class="terminal-actions">
          <button
            class="terminal-btn"
            title="New Terminal"
            (click)="createNewTerminal()"
          >
            <app-icon name="plus" [size]="14" />
          </button>
          <button
            class="terminal-btn"
            title="Clear Terminal"
            (click)="clearTerminal()"
          >
            <app-icon name="trash" [size]="14" />
          </button>
        </div>
      </div>

      <!-- xterm.js container -->
      <div #terminalContainer class="terminal-container" (contextmenu)="onContextMenu($event)"></div>

      @if (contextMenu()) {
        <div class="terminal-context-menu"
             [style.top.px]="contextMenu()!.y"
             [style.left.px]="contextMenu()!.x">
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

      @if (!terminalId() && !isCreating()) {
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

    .terminal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 12px;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      flex-shrink: 0;
      height: 30px;
    }

    .terminal-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      text-transform: uppercase;
    }

    .terminal-pid {
      font-size: 10px;
      color: var(--text-muted);
      font-weight: 400;
      letter-spacing: 0;
      text-transform: none;
    }

    .terminal-actions {
      display: flex;
      gap: 2px;
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

      &:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
      }
    }

    .terminal-container {
      flex: 1;
      overflow: hidden;
      padding: 4px;
    }

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
  @ViewChild('terminalContainer') terminalContainer!: ElementRef<HTMLDivElement>;

  private readonly ipc = inject(IpcService);

  readonly terminalId = signal('');
  readonly terminalPid = signal(0);
  readonly isCreating = signal(false);
  readonly contextMenu = signal<{ x: number; y: number } | null>(null);

  private xterm: Terminal | null = null;
  private fitAddon: FitAddon | null = null;
  private unsubscribeData: (() => void) | null = null;
  private unsubscribeExit: (() => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;

  ngAfterViewInit(): void {
    this.initXterm();
    this.createNewTerminal();
  }

  private initXterm(): void {
    this.xterm = new Terminal({
      theme: {
        background: '#11111b',
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

    this.fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    this.xterm.loadAddon(this.fitAddon);
    this.xterm.loadAddon(webLinksAddon);

    this.xterm.open(this.terminalContainer.nativeElement);
    this.fitAddon.fit();

    // Handle user input
    this.xterm.onData((data) => {
      const id = this.terminalId();
      if (id) {
        this.ipc.sendTerminalInput({ id, data });
      }
    });

    // Handle Ctrl+C (copy when selection exists, otherwise send to terminal)
    this.xterm.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      // Ctrl+C with selection → copy to clipboard
      if (event.ctrlKey && event.key === 'c' && event.type === 'keydown') {
        const selection = this.xterm?.getSelection();
        if (selection) {
          navigator.clipboard.writeText(selection);
          return false; // prevent sending to terminal
        }
        // No selection → let Ctrl+C go to terminal (SIGINT)
        return true;
      }

      // Ctrl+V → paste from clipboard
      if (event.ctrlKey && event.key === 'v' && event.type === 'keydown') {
        navigator.clipboard.readText().then(text => {
          const id = this.terminalId();
          if (id && text) {
            this.ipc.sendTerminalInput({ id, data: text });
          }
        });
        return false;
      }

      // Ctrl+Shift+C → always copy
      if (event.ctrlKey && event.shiftKey && event.key === 'C' && event.type === 'keydown') {
        const selection = this.xterm?.getSelection();
        if (selection) {
          navigator.clipboard.writeText(selection);
        }
        return false;
      }

      // Ctrl+Shift+V → always paste
      if (event.ctrlKey && event.shiftKey && event.key === 'V' && event.type === 'keydown') {
        navigator.clipboard.readText().then(text => {
          const id = this.terminalId();
          if (id && text) {
            this.ipc.sendTerminalInput({ id, data: text });
          }
        });
        return false;
      }

      return true;
    });

    // Observe container resize
    this.resizeObserver = new ResizeObserver(() => {
      this.onResize();
    });
    this.resizeObserver.observe(this.terminalContainer.nativeElement);
  }

  async createNewTerminal(): Promise<void> {
    if (this.isCreating()) return;
    this.isCreating.set(true);

    // Destroy existing session
    if (this.terminalId()) {
      this.ipc.destroyTerminal({ id: this.terminalId() });
      this.unsubscribeData?.();
      this.unsubscribeExit?.();
    }

    try {
      const dims = this.fitAddon?.proposeDimensions();
      const response = await this.ipc.createTerminal({
        cols: dims?.cols ?? 80,
        rows: dims?.rows ?? 24,
      });

      this.terminalId.set(response.id);
      this.terminalPid.set(response.pid);

      // Subscribe to terminal data
      this.unsubscribeData = this.ipc.onTerminalData((event) => {
        if (event.id === response.id) {
          this.xterm?.write(event.data);
        }
      });

      // Subscribe to terminal exit
      this.unsubscribeExit = this.ipc.onTerminalExit((event) => {
        if (event.id === response.id) {
          this.xterm?.write(`\r\n\x1b[31mProcess exited with code ${event.exitCode}\x1b[0m\r\n`);
          this.terminalId.set('');
        }
      });

      this.xterm?.clear();
    } catch (err) {
      console.error('[Terminal] Failed to create terminal:', err);
      this.xterm?.write('\r\n\x1b[31mFailed to create terminal session\x1b[0m\r\n');
    } finally {
      this.isCreating.set(false);
    }
  }

  clearTerminal(): void {
    this.xterm?.clear();
    this.contextMenu.set(null);
  }

  onContextMenu(event: MouseEvent): void {
    event.preventDefault();
    this.contextMenu.set({ x: event.clientX, y: event.clientY });

    // Close on next click anywhere
    const close = () => {
      this.contextMenu.set(null);
      document.removeEventListener('click', close);
    };
    setTimeout(() => document.addEventListener('click', close), 0);
  }

  copySelection(): void {
    const selection = this.xterm?.getSelection();
    if (selection) {
      navigator.clipboard.writeText(selection);
    }
    this.contextMenu.set(null);
  }

  pasteClipboard(): void {
    navigator.clipboard.readText().then(text => {
      const id = this.terminalId();
      if (id && text) {
        this.ipc.sendTerminalInput({ id, data: text });
      }
    });
    this.contextMenu.set(null);
  }

  selectAll(): void {
    this.xterm?.selectAll();
    this.contextMenu.set(null);
  }

  private onResize(): void {
    if (!this.fitAddon || !this.xterm) return;

    try {
      this.fitAddon.fit();
      const dims = this.fitAddon.proposeDimensions();
      const id = this.terminalId();

      if (id && dims) {
        this.ipc.resizeTerminal({ id, cols: dims.cols, rows: dims.rows });
      }
    } catch {
      // Ignore resize errors
    }
  }

  ngOnDestroy(): void {
    const id = this.terminalId();
    if (id) {
      this.ipc.destroyTerminal({ id });
    }

    this.unsubscribeData?.();
    this.unsubscribeExit?.();
    this.resizeObserver?.disconnect();
    this.xterm?.dispose();
  }
}
