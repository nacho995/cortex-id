import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { ThemeService } from '../../../core/theme.service';
import type { BackgroundConfig } from '../../../core/theme.service';

/**
 * BackgroundComponent — renders decorative background effects behind the IDE.
 *
 * Covers the full viewport with pointer-events: none so it never interferes
 * with user interaction. All animations use only `transform` and `opacity`
 * for GPU-accelerated compositing.
 *
 * Supported types:
 *  - none          → renders nothing
 *  - image         → static/blurred image
 *  - animation     → one of: matrix | neural | code-rain | gradient-mesh | minimal-grid
 */
@Component({
  selector: 'app-background',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (config().type !== 'none') {
      <div
        class="bg-host"
        [style.opacity]="config().opacity / 100"
        [style.--bg-blur]="config().blur + 'px'"
        [attr.data-type]="config().type"
        [attr.data-animation]="config().animation"
        aria-hidden="true"
      >
        <!-- ── Image ─────────────────────────────────────────────────────── -->
        @if (config().type === 'image' && config().imageUrl) {
          <div
            class="bg-image"
            [style.background-image]="'url(' + config().imageUrl + ')'"
            [style.background-size]="imageBgSize()"
            [style.background-position]="'center'"
            [style.background-repeat]="config().position === 'tile' ? 'repeat' : 'no-repeat'"
            [style.filter]="'blur(' + config().blur + 'px)'"
          ></div>
        }

        <!-- ── Matrix ────────────────────────────────────────────────────── -->
        @if (config().type === 'animation' && config().animation === 'matrix') {
          <div class="bg-matrix">
            @for (col of matrixColumns; track col) {
              <div class="matrix-col" [style.animation-delay]="col.delay + 's'" [style.left]="col.left + '%'">
                <span class="matrix-chars">{{ col.chars }}</span>
              </div>
            }
          </div>
        }

        <!-- ── Code Rain ─────────────────────────────────────────────────── -->
        @if (config().type === 'animation' && config().animation === 'code-rain') {
          <div class="bg-code-rain">
            @for (col of codeRainColumns; track col) {
              <div class="rain-col" [style.animation-delay]="col.delay + 's'" [style.left]="col.left + '%'" [style.animation-duration]="col.duration + 's'">
                <span class="rain-text">{{ col.text }}</span>
              </div>
            }
          </div>
        }

        <!-- ── Gradient Mesh ──────────────────────────────────────────────── -->
        @if (config().type === 'animation' && config().animation === 'gradient-mesh') {
          <div class="bg-gradient-mesh">
            <div class="blob blob-1"></div>
            <div class="blob blob-2"></div>
            <div class="blob blob-3"></div>
            <div class="blob blob-4"></div>
          </div>
        }

        <!-- ── Minimal Grid ───────────────────────────────────────────────── -->
        @if (config().type === 'animation' && config().animation === 'minimal-grid') {
          <div class="bg-minimal-grid">
            <div class="grid-lines"></div>
            <div class="grid-pulse"></div>
          </div>
        }

        <!-- ── Neural ─────────────────────────────────────────────────────── -->
        @if (config().type === 'animation' && config().animation === 'neural') {
          <div class="bg-neural">
            @for (node of neuralNodes; track node) {
              <div
                class="neural-node"
                [style.left]="node.x + '%'"
                [style.top]="node.y + '%'"
                [style.animation-delay]="node.delay + 's'"
                [style.animation-duration]="node.duration + 's'"
              ></div>
            }
            @for (line of neuralLines; track line) {
              <div
                class="neural-line"
                [style.left]="line.x1 + '%'"
                [style.top]="line.y1 + '%'"
                [style.width]="line.length + '%'"
                [style.transform]="'rotate(' + line.angle + 'deg)'"
                [style.animation-delay]="line.delay + 's'"
              ></div>
            }
          </div>
        }
      </div>
    }
  `,
  styles: [`
    /* ── Host ─────────────────────────────────────────────────────────────────── */
    :host {
      display: contents;
    }

    .bg-host {
      position: fixed;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      overflow: hidden;
    }

    /* ── Image ────────────────────────────────────────────────────────────────── */
    .bg-image {
      position: absolute;
      inset: -20px;
      width: calc(100% + 40px);
      height: calc(100% + 40px);
    }

    /* ── Matrix ───────────────────────────────────────────────────────────────── */
    .bg-matrix {
      position: absolute;
      inset: 0;
      overflow: hidden;
    }

    .matrix-col {
      position: absolute;
      top: -100%;
      width: 20px;
      display: flex;
      flex-direction: column;
      animation: matrixFall 8s linear infinite;
      will-change: transform, opacity;
    }

    .matrix-chars {
      font-family: var(--font-mono);
      font-size: 14px;
      color: var(--cortex-green);
      white-space: pre;
      line-height: 1.4;
      writing-mode: vertical-rl;
      text-orientation: upright;
      letter-spacing: 2px;
    }

    @keyframes matrixFall {
      0% {
        transform: translateY(0);
        opacity: 0;
      }
      5% {
        opacity: 1;
      }
      90% {
        opacity: 1;
      }
      100% {
        transform: translateY(200vh);
        opacity: 0;
      }
    }

    /* ── Code Rain ────────────────────────────────────────────────────────────── */
    .bg-code-rain {
      position: absolute;
      inset: 0;
      overflow: hidden;
    }

    .rain-col {
      position: absolute;
      top: -120%;
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--accent-primary);
      white-space: pre;
      line-height: 1.6;
      animation: codeRainFall 12s linear infinite;
      will-change: transform, opacity;
    }

    .rain-text {
      display: block;
    }

    @keyframes codeRainFall {
      0% {
        transform: translateY(0);
        opacity: 0;
      }
      8% {
        opacity: 0.8;
      }
      85% {
        opacity: 0.8;
      }
      100% {
        transform: translateY(220vh);
        opacity: 0;
      }
    }

    /* ── Gradient Mesh ────────────────────────────────────────────────────────── */
    .bg-gradient-mesh {
      position: absolute;
      inset: 0;
      overflow: hidden;
    }

    .blob {
      position: absolute;
      border-radius: 50%;
      filter: blur(80px);
      will-change: transform, opacity;
    }

    .blob-1 {
      width: 45vw;
      height: 45vw;
      background: var(--accent-primary);
      top: -10%;
      left: -10%;
      animation: blobFloat1 18s ease-in-out infinite;
    }

    .blob-2 {
      width: 35vw;
      height: 35vw;
      background: var(--accent-secondary);
      top: 30%;
      right: -5%;
      animation: blobFloat2 22s ease-in-out infinite;
    }

    .blob-3 {
      width: 30vw;
      height: 30vw;
      background: var(--accent-error);
      bottom: -5%;
      left: 20%;
      animation: blobFloat3 16s ease-in-out infinite;
    }

    .blob-4 {
      width: 25vw;
      height: 25vw;
      background: var(--accent-success);
      bottom: 20%;
      right: 25%;
      animation: blobFloat4 20s ease-in-out infinite;
    }

    @keyframes blobFloat1 {
      0%, 100% { transform: translate(0, 0) scale(1); }
      33%       { transform: translate(5vw, 8vh) scale(1.05); }
      66%       { transform: translate(-3vw, 4vh) scale(0.95); }
    }

    @keyframes blobFloat2 {
      0%, 100% { transform: translate(0, 0) scale(1); }
      40%       { transform: translate(-6vw, -5vh) scale(1.08); }
      70%       { transform: translate(4vw, 6vh) scale(0.92); }
    }

    @keyframes blobFloat3 {
      0%, 100% { transform: translate(0, 0) scale(1); }
      30%       { transform: translate(8vw, -4vh) scale(1.1); }
      60%       { transform: translate(-4vw, -8vh) scale(0.9); }
    }

    @keyframes blobFloat4 {
      0%, 100% { transform: translate(0, 0) scale(1); }
      50%       { transform: translate(-5vw, 5vh) scale(1.06); }
    }

    /* ── Minimal Grid ─────────────────────────────────────────────────────────── */
    .bg-minimal-grid {
      position: absolute;
      inset: 0;
    }

    .grid-lines {
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(var(--border-color) 1px, transparent 1px),
        linear-gradient(90deg, var(--border-color) 1px, transparent 1px);
      background-size: 40px 40px;
    }

    .grid-pulse {
      position: absolute;
      inset: 0;
      background: radial-gradient(
        ellipse 60% 60% at 50% 50%,
        transparent 40%,
        var(--bg-primary) 100%
      );
      animation: gridPulse 6s ease-in-out infinite;
      will-change: opacity;
    }

    @keyframes gridPulse {
      0%, 100% { opacity: 0.6; }
      50%       { opacity: 1; }
    }

    /* ── Neural ───────────────────────────────────────────────────────────────── */
    .bg-neural {
      position: absolute;
      inset: 0;
    }

    .neural-node {
      position: absolute;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--accent-primary);
      transform: translate(-50%, -50%);
      animation: neuralPulse 4s ease-in-out infinite;
      will-change: transform, opacity;
    }

    .neural-line {
      position: absolute;
      height: 1px;
      background: linear-gradient(
        90deg,
        transparent,
        var(--accent-primary),
        transparent
      );
      transform-origin: left center;
      animation: neuralLineFlash 5s ease-in-out infinite;
      will-change: opacity;
    }

    @keyframes neuralPulse {
      0%, 100% {
        transform: translate(-50%, -50%) scale(1);
        opacity: 0.6;
      }
      50% {
        transform: translate(-50%, -50%) scale(1.8);
        opacity: 1;
      }
    }

    @keyframes neuralLineFlash {
      0%, 100% { opacity: 0.1; }
      50%       { opacity: 0.5; }
    }
  `],
})
export class BackgroundComponent {
  private readonly themeService = inject(ThemeService);

  readonly config = this.themeService.backgroundConfig;

  /** Translate position config to CSS background-size */
  readonly imageBgSize = computed(() => {
    const pos = this.config().position;
    if (pos === 'cover' || pos === 'contain') return pos;
    if (pos === 'tile') return 'auto';
    return 'auto'; // center
  });

  // ── Static data for animations ────────────────────────────────────────────

  /** 20 matrix columns with random positions and delays */
  readonly matrixColumns = Array.from({ length: 20 }, (_, i) => ({
    left: (i / 20) * 100 + Math.random() * 4,
    delay: -(Math.random() * 8),
    chars: this.randomMatrixChars(30),
  }));

  /** 15 code-rain columns */
  readonly codeRainColumns = Array.from({ length: 15 }, (_, i) => ({
    left: (i / 15) * 100 + Math.random() * 5,
    delay: -(Math.random() * 12),
    duration: 10 + Math.random() * 6,
    text: this.randomCodeSnippet(),
  }));

  /** 18 neural nodes */
  readonly neuralNodes = Array.from({ length: 18 }, () => ({
    x: 5 + Math.random() * 90,
    y: 5 + Math.random() * 90,
    delay: -(Math.random() * 4),
    duration: 3 + Math.random() * 3,
  }));

  /** 24 neural connection lines */
  readonly neuralLines = Array.from({ length: 24 }, () => ({
    x1: Math.random() * 80,
    y1: Math.random() * 80,
    length: 5 + Math.random() * 20,
    angle: Math.random() * 360,
    delay: -(Math.random() * 5),
  }));

  // ── Helpers ───────────────────────────────────────────────────────────────

  private randomMatrixChars(count: number): string {
    const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEF';
    return Array.from({ length: count }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('\n');
  }

  private randomCodeSnippet(): string {
    const snippets = [
      'const x = () => {',
      'import { signal }',
      'function render() {',
      'export default class',
      'async/await Promise',
      'interface ThemeColors',
      'type BackgroundConfig',
      '@Injectable()',
      'computed(() => {})',
      'effect(() => {})',
    ];
    return snippets[Math.floor(Math.random() * snippets.length)];
  }
}
