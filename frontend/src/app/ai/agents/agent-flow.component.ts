import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgentFlowService, AgentNode, AgentNodeStatus } from './agent-flow.service';

/**
 * AgentFlowComponent — shows active agents as status cards with connector lines,
 * a live timer, and a total token counter.
 *
 * Displayed in the sidebar when agents are active (Feature 2).
 */
@Component({
  selector: 'app-agent-flow',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="agent-flow">
      <!-- Header -->
      <div class="flow-header">
        <span class="flow-title">🤖 Agent Flow</span>
        <div class="flow-meta">
          <span class="flow-timer" title="Elapsed time">⏱ {{ formattedElapsed() }}</span>
          <span class="flow-tokens" title="Total tokens used">
            ⚡ {{ agentFlow.totalTokens() | number }}
          </span>
        </div>
      </div>

      <!-- Agent nodes -->
      <div class="flow-nodes">
        @for (node of agentFlow.nodes(); track node.id; let last = $last) {
          <!-- Node card -->
          <div class="agent-node" [class]="'status-' + node.status">
            <div class="node-header">
              <span class="node-icon">{{ node.icon }}</span>
              <span class="node-name">{{ node.name }}</span>
              <span class="node-status-badge" [class]="'badge-' + node.status">
                {{ statusLabel(node.status) }}
              </span>
            </div>

            <div class="node-task">{{ node.task }}</div>

            <div class="node-footer">
              @if (node.invokedBy) {
                <span class="node-invoked-by">← {{ node.invokedBy }}</span>
              }
              @if (node.tokens > 0) {
                <span class="node-tokens">{{ node.tokens | number }} tk</span>
              }
              @if (node.status === 'thinking' || node.status === 'working') {
                <span class="node-pulse"></span>
              }
            </div>

            @if (node.status === 'thinking' || node.status === 'working') {
              <div class="node-progress-bar">
                <div class="node-progress-fill" [class]="'fill-' + node.status"></div>
              </div>
            }
          </div>

          <!-- Connector line between nodes -->
          @if (!last) {
            <div class="flow-connector">
              <div class="connector-line"></div>
              <div class="connector-arrow">▼</div>
            </div>
          }
        }

        @if (agentFlow.nodes().length === 0) {
          <div class="flow-empty">
            <span class="empty-icon">🤖</span>
            <p>No agents active</p>
            <span>Send a message to start</span>
          </div>
        }
      </div>

      <!-- Summary footer -->
      @if (completedCount() > 0) {
        <div class="flow-summary">
          <span class="summary-done">✓ {{ completedCount() }} done</span>
          @if (activeCount() > 0) {
            <span class="summary-active">● {{ activeCount() }} active</span>
          }
          <span class="summary-total">{{ agentFlow.totalTokens() | number }} tokens</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .agent-flow {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }

    /* ── Header ─────────────────────────────────────────────────────────────── */
    .flow-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      border-bottom: 1px solid var(--border-color);
      flex-shrink: 0;
    }

    .flow-title {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: var(--text-primary);
      text-transform: uppercase;
    }

    .flow-meta {
      display: flex;
      gap: 8px;
      font-size: 10px;
      font-family: var(--font-mono, monospace);
      color: var(--text-muted);
    }

    .flow-timer { color: var(--accent-warning, #f39c12); }
    .flow-tokens { color: var(--accent-primary); }

    /* ── Nodes ───────────────────────────────────────────────────────────────── */
    .flow-nodes {
      flex: 1;
      overflow-y: auto;
      padding: 12px 10px;
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    .agent-node {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md, 6px);
      padding: 10px 12px;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
      position: relative;
      overflow: hidden;

      &.status-thinking {
        border-color: rgba(243, 156, 18, 0.4);
        box-shadow: 0 0 8px rgba(243, 156, 18, 0.1);
      }

      &.status-working {
        border-color: rgba(0, 255, 136, 0.4);
        box-shadow: 0 0 8px rgba(0, 255, 136, 0.1);
      }

      &.status-done {
        border-color: rgba(39, 174, 96, 0.3);
        opacity: 0.75;
      }

      &.status-error {
        border-color: rgba(231, 76, 60, 0.4);
      }
    }

    .node-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 6px;
    }

    .node-icon { font-size: 14px; flex-shrink: 0; }

    .node-name {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-primary);
      flex: 1;
    }

    .node-status-badge {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 1px 5px;
      border-radius: 3px;

      &.badge-thinking { background: rgba(243, 156, 18, 0.2); color: #f39c12; }
      &.badge-working  { background: rgba(0, 255, 136, 0.15); color: #00FF88; }
      &.badge-done     { background: rgba(39, 174, 96, 0.15); color: #27ae60; }
      &.badge-error    { background: rgba(231, 76, 60, 0.15); color: #e74c3c; }
      &.badge-idle     { background: var(--bg-hover); color: var(--text-muted); }
    }

    .node-task {
      font-size: 11px;
      color: var(--text-secondary);
      line-height: 1.4;
      margin-bottom: 6px;
    }

    .node-footer {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
    }

    .node-invoked-by {
      color: var(--text-muted);
      font-style: italic;
      flex: 1;
    }

    .node-tokens {
      font-family: var(--font-mono, monospace);
      color: var(--accent-primary);
      font-size: 10px;
    }

    .node-pulse {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--accent-primary);
      animation: nodePulse 1s ease infinite;
      flex-shrink: 0;
    }

    @keyframes nodePulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.8); }
    }

    /* Progress bar */
    .node-progress-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: var(--bg-hover);
      overflow: hidden;
    }

    .node-progress-fill {
      height: 100%;
      border-radius: 2px;

      &.fill-thinking {
        background: #f39c12;
        width: 40%;
        animation: progressThinking 1.5s ease infinite;
      }

      &.fill-working {
        background: var(--accent-primary);
        width: 70%;
        animation: progressWorking 2s ease infinite;
      }
    }

    @keyframes progressThinking {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(300%); }
    }

    @keyframes progressWorking {
      0% { width: 30%; }
      50% { width: 80%; }
      100% { width: 30%; }
    }

    /* ── Connector ───────────────────────────────────────────────────────────── */
    .flow-connector {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2px 0;
    }

    .connector-line {
      width: 1px;
      height: 10px;
      background: var(--border-color);
    }

    .connector-arrow {
      font-size: 8px;
      color: var(--text-muted);
      line-height: 1;
    }

    /* ── Empty state ─────────────────────────────────────────────────────────── */
    .flow-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 32px 16px;
      color: var(--text-muted);
      text-align: center;

      .empty-icon { font-size: 32px; }
      p { font-size: 12px; font-weight: 600; color: var(--text-secondary); margin: 0; }
      span { font-size: 11px; }
    }

    /* ── Summary ─────────────────────────────────────────────────────────────── */
    .flow-summary {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-top: 1px solid var(--border-color);
      font-size: 10px;
      flex-shrink: 0;

      .summary-done { color: #27ae60; font-weight: 600; }
      .summary-active { color: var(--accent-primary); font-weight: 600; }
      .summary-total { margin-left: auto; color: var(--text-muted); font-family: var(--font-mono, monospace); }
    }
  `],
})
export class AgentFlowComponent {
  readonly agentFlow = inject(AgentFlowService);

  readonly completedCount = computed(() =>
    this.agentFlow.nodes().filter(n => n.status === 'done').length
  );

  readonly activeCount = computed(() =>
    this.agentFlow.nodes().filter(n => n.status === 'thinking' || n.status === 'working').length
  );

  readonly formattedElapsed = computed(() => {
    const s = this.agentFlow.elapsedSeconds();
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  });

  statusLabel(status: AgentNodeStatus): string {
    const labels: Record<AgentNodeStatus, string> = {
      idle: 'idle',
      thinking: 'thinking',
      working: 'working',
      done: 'done',
      error: 'error',
    };
    return labels[status];
  }
}
