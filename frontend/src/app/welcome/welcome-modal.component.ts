import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IpcService } from '../core/ipc.service';
import { WebSocketService } from '../core/websocket.service';
import { ToastService } from '../shared/ui/toast/toast.service';
import {
  WsMessageType,
  type ApiKeySetPayload,
} from '@cortex-id/shared-types/ws/messages.types';

/**
 * WelcomeModalComponent — first-run onboarding modal.
 *
 * Shown when no API keys are configured and the user hasn't dismissed it.
 * Saves keys to localStorage (browser) or OS keychain (Electron) and
 * forwards them to the Java backend via WebSocket.
 */
@Component({
  selector: 'app-welcome-modal',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="welcome-backdrop" (click)="onBackdropClick($event)">
      <div class="welcome-modal" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
        <!-- Header -->
        <div class="welcome-header">
          <h1 id="welcome-title">
            Welcome to
            <span class="cortex-brand">CORTEX-ID</span>
          </h1>
          <p class="welcome-subtitle">
            AI-Powered IDE — Configure your first API key to get started
          </p>
        </div>

        <!-- Body -->
        <div class="welcome-body">
          <div class="provider-setup">
            <!-- Anthropic -->
            <div class="setup-provider">
              <div class="setup-label">
                <span class="provider-icon">🟣</span>
                <span>Anthropic API Key</span>
                <span class="recommended">Recommended</span>
              </div>
              <input
                type="password"
                class="setup-input"
                placeholder="sk-ant-..."
                [(ngModel)]="anthropicKey"
                autocomplete="off"
                spellcheck="false"
              />
            </div>

            <!-- OpenAI -->
            <div class="setup-provider">
              <div class="setup-label">
                <span class="provider-icon">🟠</span>
                <span>OpenAI API Key</span>
                <span class="optional">Optional</span>
              </div>
              <input
                type="password"
                class="setup-input"
                placeholder="sk-..."
                [(ngModel)]="openaiKey"
                autocomplete="off"
                spellcheck="false"
              />
            </div>

            <!-- Google -->
            <div class="setup-provider">
              <div class="setup-label">
                <span class="provider-icon">🔵</span>
                <span>Google API Key</span>
                <span class="optional">Optional</span>
              </div>
              <input
                type="password"
                class="setup-input"
                placeholder="AIza..."
                [(ngModel)]="googleKey"
                autocomplete="off"
                spellcheck="false"
              />
            </div>
          </div>

          <!-- Actions -->
          <div class="welcome-actions">
            <button
              class="start-btn"
              [disabled]="!hasAnyKey() || saving"
              (click)="saveAndStart()"
            >
              @if (saving) {
                <span class="btn-spinner"></span>
                Saving…
              } @else {
                Start using Cortex-ID →
              }
            </button>
            <button class="skip-btn" (click)="skip()">
              Skip for now (Ollama only)
            </button>
          </div>

          <p class="welcome-note">
            🔒 Keys are stored securely in your system keychain. Your code never leaves your machine.
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .welcome-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9000;
      animation: backdropFadeIn 0.3s ease;
    }

    .welcome-modal {
      width: 480px;
      max-width: 90vw;
      background: var(--bg-secondary, #1e1e2e);
      border: 1px solid var(--border-color, #313244);
      border-radius: var(--radius-lg, 12px);
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
      overflow: hidden;
      animation: modalSlideIn 0.3s ease;
    }

    /* ── Header ─────────────────────────────────────────────────────────────── */
    .welcome-header {
      padding: 32px 32px 16px;
      text-align: center;
    }

    .welcome-header h1 {
      font-size: 24px;
      font-weight: 300;
      color: var(--text-primary, #cdd6f4);
      margin: 0 0 8px;
      letter-spacing: 0.5px;
    }

    .cortex-brand {
      font-weight: 800;
      background: linear-gradient(90deg, var(--cortex-red, #FF0040), var(--cortex-green, #00FF88), var(--cortex-red, #FF0040));
      background-size: 200% auto;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: gradientShift 3s linear infinite;
      letter-spacing: 2px;
    }

    @keyframes gradientShift {
      0%   { background-position: 0% center; }
      100% { background-position: 200% center; }
    }

    .welcome-subtitle {
      font-size: 13px;
      color: var(--text-muted, #6c7086);
      margin: 0;
    }

    /* ── Body ───────────────────────────────────────────────────────────────── */
    .welcome-body {
      padding: 16px 32px 32px;
    }

    .provider-setup {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-bottom: 24px;
    }

    .setup-provider {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .setup-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-primary, #cdd6f4);
    }

    .provider-icon {
      font-size: 14px;
      line-height: 1;
    }

    .recommended {
      font-size: 10px;
      font-weight: 700;
      color: var(--accent-success, #a6e3a1);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-left: auto;
    }

    .optional {
      font-size: 10px;
      color: var(--text-muted, #6c7086);
      margin-left: auto;
    }

    .setup-input {
      width: 100%;
      padding: 10px 14px;
      background: var(--bg-tertiary, #181825);
      border: 1px solid var(--border-color, #313244);
      border-radius: var(--radius-sm, 4px);
      color: var(--text-primary, #cdd6f4);
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      font-size: 12px;
      box-sizing: border-box;
      transition: border-color 0.15s ease;
    }

    .setup-input::placeholder {
      color: var(--text-muted, #6c7086);
    }

    .setup-input:focus {
      border-color: var(--accent-primary, #89b4fa);
      outline: none;
    }

    /* ── Actions ────────────────────────────────────────────────────────────── */
    .welcome-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .start-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      padding: 12px;
      background: var(--cortex-gradient);
      border: none;
      border-radius: var(--radius-md, 6px);
      color: var(--bg-tertiary, #171816);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.15s ease;
    }

    .start-btn:hover:not(:disabled) {
      opacity: 0.9;
    }

    .start-btn:disabled {
      opacity: 0.4;
      cursor: default;
    }

    .btn-spinner {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255, 255, 255, 0.4);
      border-top-color: var(--text-primary, #f8f8f2);
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
      flex-shrink: 0;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .skip-btn {
      width: 100%;
      padding: 8px;
      background: transparent;
      border: none;
      color: var(--text-muted, #6c7086);
      font-size: 12px;
      cursor: pointer;
      transition: color 0.15s ease;
    }

    .skip-btn:hover {
      color: var(--text-primary, #cdd6f4);
    }

    .welcome-note {
      margin: 16px 0 0;
      font-size: 11px;
      color: var(--text-muted, #6c7086);
      text-align: center;
      line-height: 1.5;
    }

    /* ── Animations ─────────────────────────────────────────────────────────── */
    @keyframes backdropFadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    @keyframes modalSlideIn {
      from { opacity: 0; transform: translateY(20px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
  `],
})
export class WelcomeModalComponent {
  @Output() completed = new EventEmitter<void>();

  private readonly ipc = inject(IpcService);
  private readonly wsService = inject(WebSocketService);
  private readonly toast = inject(ToastService);

  anthropicKey = '';
  openaiKey = '';
  googleKey = '';
  saving = false;

  hasAnyKey(): boolean {
    return !!(
      this.anthropicKey.trim() ||
      this.openaiKey.trim() ||
      this.googleKey.trim()
    );
  }

  async saveAndStart(): Promise<void> {
    if (!this.hasAnyKey() || this.saving) return;
    this.saving = true;

    const entries: { provider: 'anthropic' | 'openai' | 'google'; key: string }[] = [];

    if (this.anthropicKey.trim()) {
      entries.push({ provider: 'anthropic', key: this.anthropicKey.trim() });
    }
    if (this.openaiKey.trim()) {
      entries.push({ provider: 'openai', key: this.openaiKey.trim() });
    }
    if (this.googleKey.trim()) {
      entries.push({ provider: 'google', key: this.googleKey.trim() });
    }

    try {
      for (const { provider, key } of entries) {
        // Persist via IPC (keychain in Electron, localStorage in browser)
        await this.ipc.setApiKey({ service: provider, key });

        // Forward to Java backend via WebSocket
        const payload: ApiKeySetPayload = { provider, apiKey: key };
        this.wsService.send(
          this.wsService.createMessage(WsMessageType.API_KEY_SET, payload)
        );
      }

      // Mark welcome as completed
      localStorage.setItem('cortex-welcome-completed', 'true');

      this.toast.success(`${entries.length} API key${entries.length > 1 ? 's' : ''} saved successfully`);
      this.completed.emit();
    } catch (err) {
      console.error('[WelcomeModal] Failed to save API keys:', err);
      this.toast.error('Failed to save API keys. Please try again.');
    } finally {
      this.saving = false;
    }
  }

  skip(): void {
    localStorage.setItem('cortex-welcome-completed', 'true');
    this.completed.emit();
  }

  /** Prevent closing by clicking the backdrop */
  onBackdropClick(event: MouseEvent): void {
    // Only close if clicking directly on the backdrop, not the modal
    if ((event.target as HTMLElement).classList.contains('welcome-backdrop')) {
      // Don't auto-close — user must explicitly skip or save
    }
  }
}
