import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

/**
 * ToastService — lightweight notification system.
 *
 * Usage:
 *   inject(ToastService).success('File saved!');
 *   inject(ToastService).error('Connection failed');
 *   inject(ToastService).info('Indexing started…');
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);

  show(message: string, type: 'success' | 'error' | 'info' = 'info', duration = 3000): void {
    const id = crypto.randomUUID();
    const toast: Toast = { id, message, type };
    this.toasts.update(t => [...t, toast]);

    setTimeout(() => {
      this.toasts.update(t => t.filter(x => x.id !== id));
    }, duration);
  }

  success(message: string, duration = 3000): void {
    this.show(message, 'success', duration);
  }

  error(message: string, duration = 5000): void {
    this.show(message, 'error', duration);
  }

  info(message: string, duration = 3000): void {
    this.show(message, 'info', duration);
  }
}
