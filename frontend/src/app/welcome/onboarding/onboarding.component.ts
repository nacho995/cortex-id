import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LayoutService } from '../../core/layout.service';

export type LayoutMode = 'agent' | 'editor';

/**
 * OnboardingComponent — first-launch modal that lets the user choose
 * between Agent mode (chat-first) and Editor mode (code-first).
 *
 * Saves the selection to localStorage and emits `completed` when done.
 */
@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="onboarding-backdrop" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div class="onboarding-modal">
        <!-- Header -->
        <div class="onboarding-header">
          <div class="onboarding-logo">
            <span class="cortex-brand">CORTEX-ID</span>
          </div>
          <h2 id="onboarding-title">Choose your workflow</h2>
          <p class="onboarding-subtitle">
            You can change this anytime from the toolbar
          </p>
        </div>

        <!-- Mode cards -->
        <div class="mode-cards">
          <!-- Agent Mode -->
          <button
            class="mode-card"
            [class.selected]="selectedMode() === 'agent'"
            (click)="selectMode('agent')"
            aria-label="Select Agent mode"
          >
            <div class="card-icon">🤖</div>
            <div class="card-title">Agent Mode</div>
            <div class="card-subtitle">Chat-first</div>
            <div class="card-description">
              AI agents work autonomously. Chat is front and center.
              Perfect for complex tasks and multi-step workflows.
            </div>
            <div class="card-layout-preview">
              <div class="preview-block agents">Agents</div>
              <div class="preview-block chat active">Chat</div>
              <div class="preview-block editor">Editor</div>
            </div>
            @if (selectedMode() === 'agent') {
              <div class="card-check">✓</div>
            }
          </button>

          <!-- Editor Mode -->
          <button
            class="mode-card"
            [class.selected]="selectedMode() === 'editor'"
            (click)="selectMode('editor')"
            aria-label="Select Editor mode"
          >
            <div class="card-icon">💻</div>
            <div class="card-title">Editor Mode</div>
            <div class="card-subtitle">Code-first</div>
            <div class="card-description">
              Classic IDE layout. Editor is front and center.
              AI chat is available on the right when needed.
            </div>
            <div class="card-layout-preview">
              <div class="preview-block files">Files</div>
              <div class="preview-block editor active">Editor</div>
              <div class="preview-block chat">Chat</div>
            </div>
            @if (selectedMode() === 'editor') {
              <div class="card-check">✓</div>
            }
          </button>
        </div>

        <!-- Actions -->
        <div class="onboarding-actions">
          <button
            class="start-btn"
            [disabled]="!selectedMode()"
            (click)="confirm()"
          >
            Start with {{ selectedMode() === 'agent' ? 'Agent' : 'Editor' }} Mode →
          </button>
          <button class="skip-btn" (click)="skip()">
            Skip — use default (Editor Mode)
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .onboarding-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.85);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9500;
      animation: backdropIn 0.3s ease;
    }

    @keyframes backdropIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .onboarding-modal {
      width: 640px;
      max-width: 95vw;
      background: var(--bg-secondary, #1e1e2e);
      border: 1px solid var(--border-color, #313244);
      border-radius: var(--radius-lg, 12px);
      box-shadow: 0 32px 80px rgba(0, 0, 0, 0.7);
      overflow: hidden;
      animation: modalIn 0.3s ease;
    }

    @keyframes modalIn {
      from { opacity: 0; transform: translateY(20px) scale(0.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    /* ── Header ─────────────────────────────────────────────────────────────── */
    .onboarding-header {
      padding: 28px 32px 20px;
      text-align: center;
      border-bottom: 1px solid var(--border-color, #313244);
    }

    .onboarding-logo {
      margin-bottom: 12px;
    }

    .cortex-brand {
      font-size: 20px;
      font-weight: 800;
      background: linear-gradient(90deg, #FF0040, #00FF88, #FF0040);
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

    h2 {
      font-size: 20px;
      font-weight: 600;
      color: var(--text-primary, #cdd6f4);
      margin: 0 0 6px;
    }

    .onboarding-subtitle {
      font-size: 12px;
      color: var(--text-muted, #6c7086);
      margin: 0;
    }

    /* ── Mode cards ──────────────────────────────────────────────────────────── */
    .mode-cards {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      padding: 20px 24px;
    }

    .mode-card {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 20px 16px;
      background: var(--bg-surface, #181825);
      border: 2px solid var(--border-color, #313244);
      border-radius: var(--radius-lg, 12px);
      cursor: pointer;
      text-align: center;
      transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease;

      &:hover {
        border-color: rgba(137, 180, 250, 0.4);
        transform: translateY(-2px);
      }

      &.selected {
        border-color: var(--accent-primary, #89b4fa);
        box-shadow: 0 0 20px rgba(137, 180, 250, 0.15);
      }
    }

    .card-icon {
      font-size: 32px;
      line-height: 1;
    }

    .card-title {
      font-size: 15px;
      font-weight: 700;
      color: var(--text-primary, #cdd6f4);
    }

    .card-subtitle {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--accent-primary, #89b4fa);
    }

    .card-description {
      font-size: 11px;
      color: var(--text-muted, #6c7086);
      line-height: 1.5;
    }

    /* Layout preview */
    .card-layout-preview {
      display: flex;
      gap: 3px;
      width: 100%;
      margin-top: 4px;
    }

    .preview-block {
      flex: 1;
      height: 28px;
      border-radius: 3px;
      background: var(--bg-tertiary, #181825);
      border: 1px solid var(--border-color, #313244);
      font-size: 8px;
      font-weight: 600;
      color: var(--text-muted, #6c7086);
      display: flex;
      align-items: center;
      justify-content: center;
      text-transform: uppercase;
      letter-spacing: 0.05em;

      &.active {
        background: rgba(137, 180, 250, 0.1);
        border-color: var(--accent-primary, #89b4fa);
        color: var(--accent-primary, #89b4fa);
        flex: 2;
      }
    }

    .card-check {
      position: absolute;
      top: 10px;
      right: 10px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--accent-primary, #89b4fa);
      color: var(--bg-tertiary, #181825);
      font-size: 11px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* ── Actions ─────────────────────────────────────────────────────────────── */
    .onboarding-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 0 24px 24px;
    }

    .start-btn {
      width: 100%;
      padding: 12px;
      background: linear-gradient(90deg, #FF0040, #00FF88);
      border: none;
      border-radius: var(--radius-md, 6px);
      color: white;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.15s ease;

      &:hover:not(:disabled) { opacity: 0.9; }
      &:disabled { opacity: 0.4; cursor: default; }
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

      &:hover { color: var(--text-primary, #cdd6f4); }
    }
  `],
})
export class OnboardingComponent {
  @Output() completed = new EventEmitter<LayoutMode>();

  private readonly layoutService = inject(LayoutService);

  readonly selectedMode = signal<LayoutMode | null>(null);

  selectMode(mode: LayoutMode): void {
    this.selectedMode.set(mode);
  }

  confirm(): void {
    const mode = this.selectedMode();
    if (!mode) return;
    this.layoutService.setMode(mode);
    localStorage.setItem('cortex-onboarding-completed', 'true');
    localStorage.setItem('cortex-layout-mode', mode);
    this.completed.emit(mode);
  }

  skip(): void {
    this.layoutService.setMode('editor');
    localStorage.setItem('cortex-onboarding-completed', 'true');
    localStorage.setItem('cortex-layout-mode', 'editor');
    this.completed.emit('editor');
  }
}
