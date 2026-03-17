import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgentFlowService, AgentNode, AgentNodeStatus } from '../agents/agent-flow.service';

interface MindMapNode {
  node: AgentNode;
  x: number;
  y: number;
  radius: number;
  color: string;
}

interface MindMapEdge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  fromId: string;
  toId: string;
}

/**
 * AgentMindMapComponent — modal overlay showing agent communication as a
 * circular mind-map. Nodes are sized by token count and color-coded by status.
 * Clicking a node shows its details.
 */
@Component({
  selector: 'app-agent-mind-map',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mindmap-backdrop" (click)="onBackdropClick($event)" role="dialog" aria-modal="true" aria-label="Agent Mind Map">
      <div class="mindmap-modal">
        <!-- Header -->
        <div class="mindmap-header">
          <span class="mindmap-title">🗺️ Agent Mind Map</span>
          <div class="mindmap-meta">
            <span class="meta-item">{{ agentFlow.nodes().length }} agents</span>
            <span class="meta-item">⚡ {{ agentFlow.totalTokens() | number }} tokens</span>
          </div>
          <button class="mindmap-close" (click)="closed.emit()" aria-label="Close mind map">✕</button>
        </div>

        <!-- SVG Canvas -->
        <div class="mindmap-canvas-wrapper">
          <svg
            class="mindmap-svg"
            viewBox="0 0 600 400"
            xmlns="http://www.w3.org/2000/svg"
          >
            <!-- Edges / connections -->
            @for (edge of edges(); track edge.fromId + edge.toId) {
              <line
                [attr.x1]="edge.x1"
                [attr.y1]="edge.y1"
                [attr.x2]="edge.x2"
                [attr.y2]="edge.y2"
                class="mindmap-edge"
              />
            }

            <!-- Nodes -->
            @for (mn of mapNodes(); track mn.node.id) {
              <g
                class="mindmap-node-group"
                [class]="'node-status-' + mn.node.status"
                (click)="selectNode(mn.node)"
                role="button"
                [attr.aria-label]="mn.node.name + ' - ' + mn.node.status"
              >
                <!-- Glow ring for active nodes -->
                @if (mn.node.status === 'thinking' || mn.node.status === 'working') {
                  <circle
                    [attr.cx]="mn.x"
                    [attr.cy]="mn.y"
                    [attr.r]="mn.radius + 6"
                    [attr.fill]="mn.color"
                    fill-opacity="0.15"
                    class="node-glow"
                  />
                }

                <!-- Main circle -->
                <circle
                  [attr.cx]="mn.x"
                  [attr.cy]="mn.y"
                  [attr.r]="mn.radius"
                  [attr.fill]="mn.color"
                  fill-opacity="0.25"
                  [attr.stroke]="mn.color"
                  stroke-width="2"
                  class="node-circle"
                  [class.selected]="selectedNode()?.id === mn.node.id"
                />

                <!-- Icon -->
                <text
                  [attr.x]="mn.x"
                  [attr.y]="mn.y - 4"
                  text-anchor="middle"
                  dominant-baseline="middle"
                  class="node-icon-text"
                  [attr.font-size]="mn.radius * 0.7"
                >{{ mn.node.icon }}</text>

                <!-- Name label -->
                <text
                  [attr.x]="mn.x"
                  [attr.y]="mn.y + mn.radius + 14"
                  text-anchor="middle"
                  class="node-label"
                >{{ mn.node.name }}</text>

                <!-- Token count -->
                @if (mn.node.tokens > 0) {
                  <text
                    [attr.x]="mn.x"
                    [attr.y]="mn.y + mn.radius + 26"
                    text-anchor="middle"
                    class="node-tokens-label"
                  >{{ mn.node.tokens | number }} tk</text>
                }
              </g>
            }
          </svg>
        </div>

        <!-- Selected node detail panel -->
        @if (selectedNode(); as node) {
          <div class="node-detail">
            <div class="detail-header">
              <span class="detail-icon">{{ node.icon }}</span>
              <span class="detail-name">{{ node.name }}</span>
              <span class="detail-badge" [class]="'badge-' + node.status">{{ node.status }}</span>
            </div>
            <div class="detail-task">{{ node.task }}</div>
            <div class="detail-stats">
              <span>⚡ {{ node.tokens | number }} tokens</span>
              @if (node.invokedBy) {
                <span>← invoked by {{ node.invokedBy }}</span>
              }
            </div>
          </div>
        }

        <!-- Legend -->
        <div class="mindmap-legend">
          <span class="legend-item thinking">● thinking</span>
          <span class="legend-item working">● working</span>
          <span class="legend-item done">● done</span>
          <span class="legend-item error">● error</span>
          <span class="legend-note">Node size = token count</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .mindmap-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 8500;
      animation: backdropIn 0.2s ease;
    }

    @keyframes backdropIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .mindmap-modal {
      width: 680px;
      max-width: 95vw;
      max-height: 90vh;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg, 12px);
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: modalIn 0.25s ease;
    }

    @keyframes modalIn {
      from { opacity: 0; transform: scale(0.95) translateY(10px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }

    /* ── Header ─────────────────────────────────────────────────────────────── */
    .mindmap-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      border-bottom: 1px solid var(--border-color);
      flex-shrink: 0;
    }

    .mindmap-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--text-primary);
    }

    .mindmap-meta {
      display: flex;
      gap: 12px;
      flex: 1;
    }

    .meta-item {
      font-size: 11px;
      color: var(--text-muted);
      font-family: var(--font-mono, monospace);
    }

    .mindmap-close {
      background: none;
      border: none;
      color: var(--text-muted);
      font-size: 16px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: var(--radius-sm);
      transition: color 0.15s ease, background 0.15s ease;

      &:hover { color: var(--text-primary); background: var(--bg-hover); }
    }

    /* ── SVG Canvas ──────────────────────────────────────────────────────────── */
    .mindmap-canvas-wrapper {
      flex: 1;
      overflow: hidden;
      padding: 8px;
      min-height: 300px;
    }

    .mindmap-svg {
      width: 100%;
      height: 100%;
      min-height: 280px;
    }

    /* Edges */
    .mindmap-edge {
      stroke: var(--border-color);
      stroke-width: 1.5;
      stroke-dasharray: 4 3;
      opacity: 0.6;
    }

    /* Node groups */
    .mindmap-node-group {
      cursor: pointer;
      transition: opacity 0.2s ease;

      &:hover { opacity: 0.85; }
    }

    .node-circle {
      transition: stroke-width 0.2s ease;

      &.selected {
        stroke-width: 3;
        filter: drop-shadow(0 0 8px currentColor);
      }
    }

    .node-glow {
      animation: glowPulse 1.5s ease infinite;
    }

    @keyframes glowPulse {
      0%, 100% { opacity: 0.15; r: attr(r); }
      50% { opacity: 0.3; }
    }

    .node-icon-text {
      pointer-events: none;
      user-select: none;
    }

    .node-label {
      fill: var(--text-secondary, #a6adc8);
      font-size: 10px;
      font-weight: 600;
      pointer-events: none;
      user-select: none;
    }

    .node-tokens-label {
      fill: var(--accent-primary, #89b4fa);
      font-size: 9px;
      font-family: monospace;
      pointer-events: none;
      user-select: none;
      opacity: 0.8;
    }

    /* Status-specific node colors via CSS classes on the group */
    .node-status-thinking .node-circle { stroke: #f39c12; }
    .node-status-working .node-circle { stroke: #00FF88; }
    .node-status-done .node-circle { stroke: #27ae60; }
    .node-status-error .node-circle { stroke: #e74c3c; }
    .node-status-idle .node-circle { stroke: var(--border-color); }

    /* ── Detail panel ────────────────────────────────────────────────────────── */
    .node-detail {
      padding: 10px 16px;
      border-top: 1px solid var(--border-color);
      background: var(--bg-surface);
      flex-shrink: 0;
      animation: slideUp 0.15s ease;
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .detail-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }

    .detail-icon { font-size: 16px; }

    .detail-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
      flex: 1;
    }

    .detail-badge {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 2px 6px;
      border-radius: 3px;

      &.badge-thinking { background: rgba(243, 156, 18, 0.2); color: #f39c12; }
      &.badge-working  { background: rgba(0, 255, 136, 0.15); color: #00FF88; }
      &.badge-done     { background: rgba(39, 174, 96, 0.15); color: #27ae60; }
      &.badge-error    { background: rgba(231, 76, 60, 0.15); color: #e74c3c; }
      &.badge-idle     { background: var(--bg-hover); color: var(--text-muted); }
    }

    .detail-task {
      font-size: 12px;
      color: var(--text-secondary);
      margin-bottom: 4px;
    }

    .detail-stats {
      display: flex;
      gap: 12px;
      font-size: 10px;
      color: var(--text-muted);
      font-family: var(--font-mono, monospace);
    }

    /* ── Legend ──────────────────────────────────────────────────────────────── */
    .mindmap-legend {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 16px;
      border-top: 1px solid var(--border-color);
      font-size: 10px;
      flex-shrink: 0;

      .legend-item {
        &.thinking { color: #f39c12; }
        &.working  { color: #00FF88; }
        &.done     { color: #27ae60; }
        &.error    { color: #e74c3c; }
      }

      .legend-note {
        margin-left: auto;
        color: var(--text-muted);
        font-style: italic;
      }
    }
  `],
})
export class AgentMindMapComponent {
  @Output() closed = new EventEmitter<void>();

  readonly agentFlow = inject(AgentFlowService);
  readonly selectedNode = signal<AgentNode | null>(null);

  /** Compute node positions in a circular layout. */
  readonly mapNodes = computed<MindMapNode[]>(() => {
    const nodes = this.agentFlow.nodes();
    if (nodes.length === 0) return [];

    const cx = 300;
    const cy = 190;
    const maxTokens = Math.max(...nodes.map(n => n.tokens), 1);

    return nodes.map((node, i) => {
      // Orchestrator in center, others in a circle
      const isOrchestrator = node.id === 'orchestrator';
      let x: number;
      let y: number;

      if (isOrchestrator) {
        x = cx;
        y = cy;
      } else {
        const nonOrch = nodes.filter(n => n.id !== 'orchestrator');
        const idx = nonOrch.findIndex(n => n.id === node.id);
        const count = nonOrch.length;
        const angle = (idx / count) * 2 * Math.PI - Math.PI / 2;
        const radius = 130;
        x = cx + radius * Math.cos(angle);
        y = cy + radius * Math.sin(angle);
      }

      // Node radius: 20–45 based on token count
      const tokenRatio = node.tokens / maxTokens;
      const nodeRadius = isOrchestrator ? 42 : 20 + tokenRatio * 22;

      return {
        node,
        x,
        y,
        radius: nodeRadius,
        color: this.statusColor(node.status),
      };
    });
  });

  /** Compute edges between nodes based on invokedBy relationships. */
  readonly edges = computed<MindMapEdge[]>(() => {
    const mnodes = this.mapNodes();
    const edges: MindMapEdge[] = [];

    for (const mn of mnodes) {
      if (mn.node.invokedBy) {
        const parent = mnodes.find(m => m.node.id === mn.node.invokedBy);
        if (parent) {
          edges.push({
            x1: parent.x,
            y1: parent.y,
            x2: mn.x,
            y2: mn.y,
            fromId: parent.node.id,
            toId: mn.node.id,
          });
        }
      }
    }

    return edges;
  });

  selectNode(node: AgentNode): void {
    this.selectedNode.update(current => current?.id === node.id ? null : node);
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('mindmap-backdrop')) {
      this.closed.emit();
    }
  }

  private statusColor(status: AgentNodeStatus): string {
    const colors: Record<AgentNodeStatus, string> = {
      idle: '#6c7086',
      thinking: '#f39c12',
      working: '#00FF88',
      done: '#27ae60',
      error: '#e74c3c',
    };
    return colors[status];
  }
}
