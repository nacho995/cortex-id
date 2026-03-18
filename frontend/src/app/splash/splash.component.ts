import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
  signal,
} from '@angular/core';

@Component({
  selector: 'app-splash',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="splash" [class.fade-out]="fadeOut()">
      <!-- Floating particles background -->
      <div class="particles-bg">
        @for (i of particles; track i) {
          <div
            class="particle"
            [style.--delay]="i * 0.15 + 's'"
            [style.--x]="randomX(i) + '%'"
            [style.--y]="randomY(i) + '%'"
            [style.--size]="randomSize(i) + 'px'"
            [style.--duration]="(3 + (i % 4)) + 's'"
          ></div>
        }
      </div>

      <!-- Main content -->
      <div class="splash-content">
        <!-- Animated logo -->
        <div class="logo-text" aria-label="Cortex-ID">
          <span class="letter" style="--i:0; color: var(--cortex-red, #FF0040)">C</span>
          <span class="letter" style="--i:1; color: var(--cortex-green, #00FF88)">O</span>
          <span class="letter" style="--i:2; color: var(--cortex-red, #FF0040)">R</span>
          <span class="letter" style="--i:3">T</span>
          <span class="letter" style="--i:4">E</span>
          <span class="letter" style="--i:5">X</span>
          <span class="letter-dash" style="--i:6">-</span>
          <span class="letter" style="--i:7; color: var(--cortex-green, #00FF88)">I</span>
          <span class="letter" style="--i:8; color: var(--cortex-red, #FF0040)">D</span>
        </div>

        <p class="subtitle">AI-Powered IDE</p>

        <!-- Progress bar -->
        <div class="progress-bar" role="progressbar" [attr.aria-valuenow]="progress()">
          <div class="progress-fill" [style.width.%]="progress()"></div>
        </div>

        <p class="status-text">{{ statusText() }}</p>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .splash {
      position: fixed;
      inset: 0;
      background: #000000;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      transition: opacity 0.6s ease, transform 0.6s ease;

      &.fade-out {
        opacity: 0;
        transform: scale(1.02);
        pointer-events: none;
      }
    }

    /* ── Particles ──────────────────────────────────────────────────────────── */
    .particles-bg {
      position: absolute;
      inset: 0;
      overflow: hidden;
    }

    .particle {
      position: absolute;
      left: var(--x);
      top: var(--y);
      width: var(--size);
      height: var(--size);
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.15);
      animation: floatParticle var(--duration) ease-in-out infinite;
      animation-delay: var(--delay);
    }

    @keyframes floatParticle {
      0%, 100% {
        transform: translateY(0) translateX(0);
        opacity: 0.2;
      }
      50% {
        transform: translateY(-20px) translateX(10px);
        opacity: 0.6;
      }
    }

    /* ── Content ────────────────────────────────────────────────────────────── */
    .splash-content {
      text-align: center;
      z-index: 1;
      position: relative;
    }

    /* ── Logo ───────────────────────────────────────────────────────────────── */
    .logo-text {
      display: flex;
      justify-content: center;
      align-items: baseline;
      gap: 2px;
    }

    .letter {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 56px;
      font-weight: 800;
      color: #ffffff;
      opacity: 0;
      animation: letterIn 0.5s ease forwards;
      animation-delay: calc(var(--i) * 0.08s);
      text-shadow: 0 0 30px currentColor;
      line-height: 1;
    }

    .letter-dash {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 56px;
      font-weight: 300;
      color: #555;
      opacity: 0;
      animation: letterIn 0.5s ease forwards;
      animation-delay: calc(var(--i) * 0.08s);
      line-height: 1;
    }

    @keyframes letterIn {
      from {
        opacity: 0;
        transform: translateY(20px) scale(0.8);
        filter: blur(4px);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
        filter: blur(0);
      }
    }

    /* ── Subtitle ───────────────────────────────────────────────────────────── */
    .subtitle {
      margin-top: 16px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      color: #666;
      opacity: 0;
      animation: fadeInEl 0.8s ease 1s forwards;
      letter-spacing: 4px;
      text-transform: uppercase;
    }

    /* ── Progress bar ───────────────────────────────────────────────────────── */
    .progress-bar {
      width: 200px;
      height: 2px;
      background: #1a1a1a;
      border-radius: 1px;
      margin: 32px auto 0;
      overflow: hidden;
      opacity: 0;
      animation: fadeInEl 0.5s ease 1.2s forwards;
    }

    .progress-fill {
      height: 100%;
      background: var(--cortex-gradient, linear-gradient(90deg, #FF0040, #00FF88));
      border-radius: 1px;
      transition: width 0.3s ease;
    }

    /* ── Status text ────────────────────────────────────────────────────────── */
    .status-text {
      margin-top: 12px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 11px;
      color: #444;
      opacity: 0;
      animation: fadeInEl 0.5s ease 1.4s forwards;
      min-height: 16px;
    }

    @keyframes fadeInEl {
      to { opacity: 1; }
    }
  `],
})
export class SplashComponent implements OnInit, OnDestroy {
  @Output() loaded = new EventEmitter<void>();

  readonly progress = signal(0);
  readonly statusText = signal('Initializing...');
  readonly fadeOut = signal(false);

  /** 30 floating particles — deterministic indices */
  readonly particles = Array.from({ length: 30 }, (_, i) => i);

  private timers: ReturnType<typeof setTimeout>[] = [];

  /** Deterministic pseudo-random helpers (SSR-safe, no Math.random) */
  randomX(i: number): number {
    return (i * 37 + 13) % 100;
  }

  randomY(i: number): number {
    return (i * 53 + 7) % 100;
  }

  randomSize(i: number): number {
    return 1 + (i % 3);
  }

  ngOnInit(): void {
    this.runLoadingSequence();
  }

  ngOnDestroy(): void {
    this.timers.forEach(clearTimeout);
  }

  private schedule(fn: () => void, delay: number): void {
    this.timers.push(setTimeout(fn, delay));
  }

  private runLoadingSequence(): void {
    // Phase 1: 0 → 30 "Loading modules" (starts after letter animations ~1.4s)
    this.schedule(() => {
      this.statusText.set('Loading modules...');
      this.animateProgress(0, 30, 400);
    }, 1500);

    // Phase 2: 30 → 60 "Connecting to backend"
    this.schedule(() => {
      this.statusText.set('Connecting to backend...');
      this.animateProgress(30, 60, 500);
    }, 2100);

    // Phase 3: 60 → 90 "Initializing workspace"
    this.schedule(() => {
      this.statusText.set('Initializing workspace...');
      this.animateProgress(60, 90, 400);
    }, 2800);

    // Phase 4: 90 → 100 "Ready"
    this.schedule(() => {
      this.statusText.set('Ready');
      this.animateProgress(90, 100, 300);
    }, 3400);

    // Trigger fade-out after completion
    this.schedule(() => {
      this.fadeOut.set(true);
      // Emit after fade-out animation (600ms)
      this.schedule(() => this.loaded.emit(), 650);
    }, 3900);
  }

  private animateProgress(from: number, to: number, duration: number): void {
    const steps = 20;
    const stepDuration = duration / steps;
    const increment = (to - from) / steps;

    for (let i = 0; i <= steps; i++) {
      const value = Math.round(from + increment * i);
      this.schedule(() => this.progress.set(value), i * stepDuration);
    }
  }
}
