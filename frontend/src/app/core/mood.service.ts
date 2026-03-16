import { Injectable, inject, signal } from '@angular/core';
import { ToastService } from '../shared/ui/toast/toast.service';

@Injectable({ providedIn: 'root' })
export class MoodService {
  private readonly toast = inject(ToastService);
  private sessionStart = Date.now();
  private errorCount = 0;
  private lastErrorTime = 0;
  private moodCheckInterval: ReturnType<typeof setInterval> | null = null;

  readonly enabled = signal(true);

  startMonitoring(): void {
    this.sessionStart = Date.now();

    // Check every 30 minutes
    this.moodCheckInterval = setInterval(() => {
      if (!this.enabled()) return;
      this.checkWellbeing();
    }, 30 * 60 * 1000);
  }

  recordError(): void {
    this.errorCount++;
    this.lastErrorTime = Date.now();

    if (!this.enabled()) return;

    // 5+ errors in 10 minutes
    if (this.errorCount >= 5) {
      const elapsed = (Date.now() - this.lastErrorTime) / 60000;
      if (elapsed < 10) {
        this.toast.info('💡 Stuck on errors? Sometimes stepping away for 5 minutes helps. Want me to explain differently?');
        this.errorCount = 0;
      }
    }
  }

  private checkWellbeing(): void {
    const hoursWorked = (Date.now() - this.sessionStart) / 3600000;

    if (hoursWorked >= 3) {
      this.toast.info(`💪 ${Math.floor(hoursWorked)}h coding! Great work. Consider a break?`);
      this.sessionStart = Date.now(); // Reset to not nag every 30min
    }
  }

  stopMonitoring(): void {
    if (this.moodCheckInterval) {
      clearInterval(this.moodCheckInterval);
    }
  }
}
