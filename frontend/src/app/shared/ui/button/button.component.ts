import {
  ChangeDetectionStrategy,
  Component,
  Input,
  Output,
  EventEmitter,
} from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      [class]="buttonClasses"
      [disabled]="disabled || loading"
      [attr.aria-busy]="loading"
      (click)="onClick($event)"
    >
      @if (loading) {
        <span class="spinner" aria-hidden="true"></span>
      }
      <ng-content />
    </button>
  `,
  styles: [`
    :host {
      display: inline-flex;
    }

    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      border: none;
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-family: var(--font-sans);
      font-weight: 500;
      transition: background var(--transition-fast), opacity var(--transition-fast);
      white-space: nowrap;
      position: relative;

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      &:focus-visible {
        outline: 2px solid var(--accent-primary);
        outline-offset: 2px;
      }
    }

    /* Sizes */
    .btn-sm {
      padding: 3px 8px;
      font-size: 11px;
      height: 24px;
    }

    .btn-md {
      padding: 5px 12px;
      font-size: 13px;
      height: 30px;
    }

    .btn-lg {
      padding: 8px 16px;
      font-size: 14px;
      height: 36px;
    }

    /* Variants */
    .btn-primary {
      background: var(--accent-primary);
      color: var(--bg-tertiary);

      &:hover:not(:disabled) {
        background: color-mix(in srgb, var(--accent-primary) 85%, white);
      }
    }

    .btn-secondary {
      background: var(--bg-surface);
      color: var(--text-primary);
      border: 1px solid var(--border-color);

      &:hover:not(:disabled) {
        background: var(--bg-hover);
      }
    }

    .btn-ghost {
      background: transparent;
      color: var(--text-secondary);

      &:hover:not(:disabled) {
        background: var(--bg-hover);
        color: var(--text-primary);
      }
    }

    .btn-danger {
      background: var(--accent-error);
      color: var(--bg-tertiary);

      &:hover:not(:disabled) {
        background: color-mix(in srgb, var(--accent-error) 85%, white);
      }
    }

    /* Spinner */
    .spinner {
      width: 12px;
      height: 12px;
      border: 2px solid currentColor;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `],
})
export class ButtonComponent {
  @Input() variant: ButtonVariant = 'secondary';
  @Input() size: ButtonSize = 'md';
  @Input() disabled = false;
  @Input() loading = false;
  @Output() clicked = new EventEmitter<MouseEvent>();

  get buttonClasses(): string {
    return `btn-${this.variant} btn-${this.size}`;
  }

  onClick(event: MouseEvent): void {
    if (!this.disabled && !this.loading) {
      this.clicked.emit(event);
    }
  }
}
