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
      background: #1a3a2a;
      color: #a6e3a1;
      border: 1px solid #2d5a3d;
    }

    .toast-error {
      background: #3a1a1a;
      color: #f38ba8;
      border: 1px solid #5a2d2d;
    }

    .toast-info {
      background: #1a2a3a;
      color: #89b4fa;
      border: 1px solid #2d3d5a;
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
