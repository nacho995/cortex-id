import { Injectable, computed, signal } from '@angular/core';

// ── Types ──────────────────────────────────────────────────────────────────

export type AgentNodeStatus = 'idle' | 'thinking' | 'working' | 'done' | 'error';

export interface AgentNode {
  id: string;
  name: string;
  icon: string;
  status: AgentNodeStatus;
  task: string;
  tokens: number;
  invokedBy?: string;
  startedAt?: number;
  completedAt?: number;
}

// ── Service ────────────────────────────────────────────────────────────────

/**
 * AgentFlowService — signals-based service tracking active agent nodes.
 *
 * Exposes:
 *   nodes()          — current list of AgentNode
 *   isActive()       — true when at least one agent is running
 *   totalTokens()    — sum of tokens across all nodes
 *   elapsedSeconds() — seconds since the flow started
 *
 * The mock simulation is triggered via `startMockFlow()` from the chat panel.
 */
@Injectable({ providedIn: 'root' })
export class AgentFlowService {
  private readonly _nodes = signal<AgentNode[]>([]);
  private readonly _startedAt = signal<number | null>(null);
  private readonly _elapsedSeconds = signal(0);
  private elapsedInterval: ReturnType<typeof setInterval> | null = null;

  // ── Public signals ────────────────────────────────────────────────────────

  readonly nodes = this._nodes.asReadonly();

  readonly isActive = computed(() =>
    this._nodes().some(n => n.status === 'thinking' || n.status === 'working')
  );

  readonly totalTokens = computed(() =>
    this._nodes().reduce((sum, n) => sum + n.tokens, 0)
  );

  readonly elapsedSeconds = this._elapsedSeconds.asReadonly();

  readonly startedAt = this._startedAt.asReadonly();

  // ── Public API ────────────────────────────────────────────────────────────

  /** Reset all agent state. */
  reset(): void {
    this._nodes.set([]);
    this._startedAt.set(null);
    this._elapsedSeconds.set(0);
    if (this.elapsedInterval) {
      clearInterval(this.elapsedInterval);
      this.elapsedInterval = null;
    }
  }

  /** Update or insert a node by id. */
  upsertNode(node: Partial<AgentNode> & { id: string }): void {
    this._nodes.update(nodes => {
      const idx = nodes.findIndex(n => n.id === node.id);
      if (idx === -1) {
        return [...nodes, this.buildNode(node)];
      }
      return nodes.map((n, i) => i === idx ? { ...n, ...node } : n);
    });
  }

  /**
   * Start the mock agent simulation chain:
   * orchestrator → researcher → backend → tester → reviewer
   */
  startMockFlow(): void {
    this.reset();
    this._startedAt.set(Date.now());

    // Start elapsed timer
    this.elapsedInterval = setInterval(() => {
      const start = this._startedAt();
      if (start) {
        this._elapsedSeconds.set(Math.floor((Date.now() - start) / 1000));
      }
    }, 1000);

    const chain: Array<{ delay: number; node: Partial<AgentNode> & { id: string } }> = [
      {
        delay: 0,
        node: {
          id: 'orchestrator',
          name: 'Orchestrator',
          icon: '🧠',
          status: 'thinking',
          task: 'Analyzing request and planning subtasks…',
          tokens: 0,
        },
      },
      {
        delay: 1200,
        node: {
          id: 'orchestrator',
          status: 'working',
          task: 'Delegating to specialized agents',
          tokens: 320,
        },
      },
      {
        delay: 1800,
        node: {
          id: 'researcher',
          name: 'Researcher',
          icon: '🔍',
          status: 'thinking',
          task: 'Searching codebase for context…',
          tokens: 0,
          invokedBy: 'orchestrator',
        },
      },
      {
        delay: 3200,
        node: {
          id: 'researcher',
          status: 'working',
          task: 'Indexing relevant files',
          tokens: 850,
        },
      },
      {
        delay: 4500,
        node: {
          id: 'backend',
          name: 'Backend Agent',
          icon: '⚙️',
          status: 'thinking',
          task: 'Generating implementation…',
          tokens: 0,
          invokedBy: 'orchestrator',
        },
      },
      {
        delay: 4800,
        node: {
          id: 'researcher',
          status: 'done',
          task: 'Context gathered',
          tokens: 1240,
          completedAt: Date.now() + 4800,
        },
      },
      {
        delay: 6500,
        node: {
          id: 'backend',
          status: 'working',
          task: 'Writing code',
          tokens: 1800,
        },
      },
      {
        delay: 8000,
        node: {
          id: 'tester',
          name: 'Tester',
          icon: '🧪',
          status: 'thinking',
          task: 'Writing unit tests…',
          tokens: 0,
          invokedBy: 'backend',
        },
      },
      {
        delay: 9500,
        node: {
          id: 'backend',
          status: 'done',
          task: 'Implementation complete',
          tokens: 2600,
          completedAt: Date.now() + 9500,
        },
      },
      {
        delay: 10000,
        node: {
          id: 'tester',
          status: 'working',
          task: 'Running test suite',
          tokens: 900,
        },
      },
      {
        delay: 11500,
        node: {
          id: 'reviewer',
          name: 'Reviewer',
          icon: '👁️',
          status: 'thinking',
          task: 'Code review in progress…',
          tokens: 0,
          invokedBy: 'orchestrator',
        },
      },
      {
        delay: 12500,
        node: {
          id: 'tester',
          status: 'done',
          task: 'All tests passing ✓',
          tokens: 1400,
          completedAt: Date.now() + 12500,
        },
      },
      {
        delay: 13500,
        node: {
          id: 'reviewer',
          status: 'working',
          task: 'Checking quality & security',
          tokens: 600,
        },
      },
      {
        delay: 15000,
        node: {
          id: 'reviewer',
          status: 'done',
          task: 'Review complete — no issues found',
          tokens: 1100,
          completedAt: Date.now() + 15000,
        },
      },
      {
        delay: 15500,
        node: {
          id: 'orchestrator',
          status: 'done',
          task: 'Task completed successfully',
          tokens: 420,
          completedAt: Date.now() + 15500,
        },
      },
    ];

    for (const step of chain) {
      setTimeout(() => this.upsertNode(step.node), step.delay);
    }

    // Stop timer after flow completes
    setTimeout(() => {
      if (this.elapsedInterval) {
        clearInterval(this.elapsedInterval);
        this.elapsedInterval = null;
      }
    }, 16000);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private buildNode(partial: Partial<AgentNode> & { id: string }): AgentNode {
    return {
      name: partial.id,
      icon: '🤖',
      status: 'idle',
      task: '',
      tokens: 0,
      ...partial,
    };
  }
}
