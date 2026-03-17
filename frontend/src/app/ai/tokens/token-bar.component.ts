import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TokenMetricsService } from './token-metrics.service';
import { TokenPricingService } from './token-pricing.service';

/**
 * TokenBarComponent — compact real-time token/cost metrics bar.
 *
 * Displays:
 *   [Model badge] [Input ↑ tokens] [Output ↓ tokens] [Cost $] [Session total]
 *
 * Colour coding via costLevel signal:
 *   free   → muted grey
 *   low    → green
 *   medium → amber/yellow
 *   high   → red
 *
 * Usage:
 *   <app-token-bar />
 *
 * The component is self-contained — it injects TokenMetricsService directly.
 * No @Input() needed.
 */
@Component({
  selector: 'app-token-bar',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="token-bar" [class]="'cost-' + metrics.costLevel()" role="status" aria-label="Token usage metrics">

      <!-- Model badge -->
      <span class="token-model-badge" [title]="modelDisplayName()">
        {{ modelEmoji() }}
        <span class="token-model-name">{{ modelShortName() }}</span>
      </span>

      <span class="token-divider" aria-hidden="true">·</span>

      @if (metrics.lastRequest(); as req) {
        <!-- Input tokens -->
        <span class="token-stat" title="Input tokens for last request">
          <span class="token-icon" aria-hidden="true">↑</span>
          <span class="token-value">{{ req.inputTokens | number }}</span>
          <span class="token-label">in</span>
        </span>

        <span class="token-divider" aria-hidden="true">·</span>

        <!-- Output tokens -->
        <span class="token-stat" title="Output tokens for last request">
          <span class="token-icon" aria-hidden="true">↓</span>
          <span class="token-value">{{ req.outputTokens | number }}</span>
          <span class="token-label">out</span>
        </span>

        <span class="token-divider" aria-hidden="true">·</span>

        <!-- Request cost -->
        <span
          class="token-cost"
          [class]="'cost-badge-' + metrics.costLevel()"
          title="Cost for last request{{ req.isEstimated ? ' (estimated)' : '' }}"
        >
          {{ metrics.lastRequestCostFormatted() }}
          @if (req.isEstimated) {
            <span class="token-estimated" title="Estimated — exact count pending">~</span>
          }
        </span>

        <span class="token-divider" aria-hidden="true">·</span>

        <!-- Session total -->
        <span class="token-session" title="Total session cost ({{ metrics.session().requestCount }} requests)">
          <span class="token-label">session</span>
          <span class="token-value">{{ metrics.sessionCostFormatted() }}</span>
        </span>

      } @else {
        <!-- No requests yet -->
        <span class="token-idle" aria-label="No requests yet">
          <span class="token-icon" aria-hidden="true">◦</span>
          <span class="token-label">No requests yet</span>
        </span>
      }

    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .token-bar {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      background: var(--bg-tertiary);
      border-bottom: 1px solid var(--border-color);
      font-size: 10px;
      font-family: var(--font-mono, monospace);
      color: var(--text-muted);
      min-height: 24px;
      flex-shrink: 0;
      overflow: hidden;
      transition: background 0.2s ease;

      /* Cost-level background tint */
      &.cost-low    { background: rgba(39, 174, 96, 0.06); }
      &.cost-medium { background: rgba(243, 156, 18, 0.06); }
      &.cost-high   { background: rgba(231, 76, 60, 0.08); }
    }

    /* Model badge */
    .token-model-badge {
      display: flex;
      align-items: center;
      gap: 3px;
      font-size: 10px;
      font-weight: 600;
      color: var(--text-secondary);
      white-space: nowrap;
    }

    .token-model-name {
      max-width: 70px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Divider */
    .token-divider {
      color: var(--border-color);
      user-select: none;
      flex-shrink: 0;
    }

    /* Stat group */
    .token-stat {
      display: flex;
      align-items: center;
      gap: 2px;
      white-space: nowrap;
    }

    .token-icon {
      font-size: 9px;
      opacity: 0.6;
    }

    .token-value {
      font-weight: 600;
      color: var(--text-primary);
    }

    .token-label {
      opacity: 0.6;
      font-size: 9px;
    }

    /* Cost badge */
    .token-cost {
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 3px;
      white-space: nowrap;
      transition: background 0.3s ease, color 0.3s ease;

      &.cost-badge-free   { color: var(--text-muted); }
      &.cost-badge-low    { color: #27ae60; background: rgba(39, 174, 96, 0.12); }
      &.cost-badge-medium { color: #f39c12; background: rgba(243, 156, 18, 0.12); }
      &.cost-badge-high   { color: #e74c3c; background: rgba(231, 76, 60, 0.12); animation: costPulse 2s ease infinite; }
    }

    /* Estimated indicator */
    .token-estimated {
      font-size: 9px;
      opacity: 0.7;
      margin-left: 1px;
    }

    /* Session total */
    .token-session {
      display: flex;
      align-items: center;
      gap: 3px;
      margin-left: auto;
      white-space: nowrap;
    }

    /* Idle state */
    .token-idle {
      display: flex;
      align-items: center;
      gap: 4px;
      opacity: 0.5;
    }

    /* High-cost pulse animation */
    @keyframes costPulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.7; }
    }
  `],
})
export class TokenBarComponent {
  readonly metrics = inject(TokenMetricsService);
  private readonly pricing = inject(TokenPricingService);

  /** Emoji for the active model's provider. */
  readonly modelEmoji = computed(() => {
    const modelId = this.metrics.activeModelId();
    if (modelId.startsWith('claude')) return '🟣';
    if (modelId.startsWith('gpt-') || modelId.startsWith('o3') || modelId.startsWith('codex')) return '🟠';
    if (modelId.startsWith('gemini')) return '🔵';
    return '🟢'; // Ollama
  });

  /** Short display name for the model (truncated for the bar). */
  readonly modelShortName = computed(() => {
    const info = this.pricing.getPricing(this.metrics.activeModelId());
    return info?.displayName ?? this.metrics.activeModelId();
  });

  /** Full display name for tooltip. */
  readonly modelDisplayName = computed(() => {
    const info = this.pricing.getPricing(this.metrics.activeModelId());
    if (!info) return this.metrics.activeModelId();
    const rate = info.provider === 'ollama'
      ? 'Free (local)'
      : `$${info.inputPer1M}/M in · $${info.outputPer1M}/M out`;
    return `${info.displayName} — ${rate}`;
  });
}
