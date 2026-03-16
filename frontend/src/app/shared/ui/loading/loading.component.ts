import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loading',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="loading-container" [class.fullscreen]="fullscreen">
      <div class="spinner-wrapper">
        <div class="spinner">
          <div class="spinner-ring"></div>
          <div class="spinner-ring spinner-ring-2"></div>
          <div class="spinner-ring spinner-ring-3"></div>
        </div>
        @if (message) {
          <p class="loading-message">{{ message }}</p>
        }
      </div>
    </div>
  `,
  styles: [`
    .loading-container {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;

      &.fullscreen {
        position: fixed;
        inset: 0;
        background: var(--bg-primary);
        z-index: 9999;
        animation: fadeIn var(--transition-normal);
      }
    }

    .spinner-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }

    /* ── Spinner ──────────────────────────────────────────────────────────────── */
    .spinner {
      position: relative;
      width: 40px;
      height: 40px;
    }

    .spinner-ring {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 2px solid transparent;
      animation: spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
      border-top-color: var(--accent-primary);
    }

    .spinner-ring-2 {
      inset: 6px;
      border-top-color: var(--accent-purple);
      animation-delay: -0.15s;
    }

    .spinner-ring-3 {
      inset: 12px;
      border-top-color: var(--accent-teal);
      animation-delay: -0.3s;
    }

    .loading-message {
      font-size: 12px;
      color: var(--text-muted);
      text-align: center;
      animation: pulse 2s ease-in-out infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `],
})
export class LoadingComponent {
  /** Optional message shown below the spinner */
  @Input() message = '';

  /** When true, covers the entire viewport */
  @Input() fullscreen = false;
}
