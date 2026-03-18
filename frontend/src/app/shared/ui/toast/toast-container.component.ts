import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { ToastService } from './toast.service';

/**
 * ToastContainerComponent — renders active toasts in the bottom-right corner.
 *
 * Add once to app.component.ts template:
 *   <app-toast-container />
 */
@Component({
  selector: 'app-toast-container',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-container" aria-live="polite" aria-atomic="false">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast" [class]="'toast-' + toast.type" role="alert">
          <span class="toast-icon">
            {{ toast.type === 'success' ? '✓' : toast.type === 'error' ? '✗' : 'ℹ' }}
          </span>
          <span class="toast-message">{{ toast.message }}</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      bottom: 40px;
      right: 16px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
    }

    .toast {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      border-radius: var(--radius-md, 6px);
      font-size: 13px;
      animation: toastSlideIn 0.2s ease;
      box-shadow: var(--shadow-lg, 0 8px 24px rgba(0,0,0,0.4));
      min-width: 250px;
      max-width: 400px;
      pointer-events: auto;
    }

    .toast-success {
      background: color-mix(in srgb, var(--accent-success) 15%, var(--bg-tertiary));
      color: var(--accent-success);
      border: 1px solid color-mix(in srgb, var(--accent-success) 30%, var(--bg-tertiary));
    }

    .toast-error {
      background: color-mix(in srgb, var(--accent-error) 15%, var(--bg-tertiary));
      color: var(--accent-error);
      border: 1px solid color-mix(in srgb, var(--accent-error) 30%, var(--bg-tertiary));
    }

    .toast-info {
      background: color-mix(in srgb, var(--accent-secondary) 15%, var(--bg-tertiary));
      color: var(--accent-secondary);
      border: 1px solid color-mix(in srgb, var(--accent-secondary) 30%, var(--bg-tertiary));
    }

    .toast-icon {
      font-weight: bold;
      font-size: 15px;
      flex-shrink: 0;
    }

    .toast-message {
      flex: 1;
      line-height: 1.4;
    }

    @keyframes toastSlideIn {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `],
})
export class ToastContainerComponent {
  readonly toastService = inject(ToastService);
}
