import { Injectable, computed, signal } from '@angular/core';

// ── Types ──────────────────────────────────────────────────────────────────

export type SubtaskStatus = 'pending' | 'in-progress' | 'done' | 'error' | 'skipped';

export interface Subtask {
  id: string;
  title: string;
  description?: string;
  status: SubtaskStatus;
  agentId?: string;
  agentName?: string;
  agentIcon?: string;
  order: number;
}

// ── Service ────────────────────────────────────────────────────────────────

/**
 * OrchestratorService — signals-based service managing the orchestrator plan.
 *
 * Exposes:
 *   subtasks()   — ordered list of Subtask
 *   progress()   — 0–100 computed from done/total
 *   isComplete() — true when all tasks are done or skipped
 *   hasPlan()    — true when at least one subtask exists
 */
@Injectable({ providedIn: 'root' })
export class OrchestratorService {
  private readonly _subtasks = signal<Subtask[]>([]);

  // ── Public signals ────────────────────────────────────────────────────────

  readonly subtasks = this._subtasks.asReadonly();

  readonly hasPlan = computed(() => this._subtasks().length > 0);

  readonly progress = computed<number>(() => {
    const tasks = this._subtasks();
    if (tasks.length === 0) return 0;
    const done = tasks.filter(t => t.status === 'done' || t.status === 'skipped').length;
    return Math.round((done / tasks.length) * 100);
  });

  readonly isComplete = computed(() => {
    const tasks = this._subtasks();
    return tasks.length > 0 && tasks.every(t => t.status === 'done' || t.status === 'skipped' || t.status === 'error');
  });

  readonly doneCount = computed(() =>
    this._subtasks().filter(t => t.status === 'done').length
  );

  readonly totalCount = computed(() => this._subtasks().length);

  // ── Public API ────────────────────────────────────────────────────────────

  /** Replace the entire plan with a new set of subtasks. */
  setPlan(subtasks: Omit<Subtask, 'order'>[]): void {
    this._subtasks.set(
      subtasks.map((t, i) => ({ ...t, order: i }))
    );
  }

  /** Update a single subtask's status (and optionally other fields). */
  updateSubtask(id: string, patch: Partial<Subtask>): void {
    this._subtasks.update(tasks =>
      tasks.map(t => t.id === id ? { ...t, ...patch } : t)
    );
  }

  /** Clear all subtasks. */
  reset(): void {
    this._subtasks.set([]);
  }

  /**
   * Start a mock plan simulation matching the agent flow chain.
   * Called from chat-panel when user sends a message in agent mode.
   */
  startMockPlan(userMessage: string): void {
    const plan: Omit<Subtask, 'order'>[] = [
      {
        id: 'analyze',
        title: 'Analyze request',
        description: `Parse intent from: "${userMessage.slice(0, 60)}${userMessage.length > 60 ? '…' : ''}"`,
        status: 'in-progress',
        agentId: 'orchestrator',
        agentName: 'Orchestrator',
        agentIcon: '🧠',
      },
      {
        id: 'research',
        title: 'Research codebase',
        description: 'Index relevant files and gather context',
        status: 'pending',
        agentId: 'researcher',
        agentName: 'Researcher',
        agentIcon: '🔍',
      },
      {
        id: 'implement',
        title: 'Implement solution',
        description: 'Write code based on gathered context',
        status: 'pending',
        agentId: 'backend',
        agentName: 'Backend Agent',
        agentIcon: '⚙️',
      },
      {
        id: 'test',
        title: 'Write & run tests',
        description: 'Generate unit tests and verify correctness',
        status: 'pending',
        agentId: 'tester',
        agentName: 'Tester',
        agentIcon: '🧪',
      },
      {
        id: 'review',
        title: 'Code review',
        description: 'Check quality, security, and best practices',
        status: 'pending',
        agentId: 'reviewer',
        agentName: 'Reviewer',
        agentIcon: '👁️',
      },
    ];

    this.setPlan(plan);

    // Simulate progress matching agent-flow timing
    const updates: Array<{ delay: number; id: string; status: SubtaskStatus }> = [
      { delay: 1200, id: 'analyze', status: 'done' },
      { delay: 1800, id: 'research', status: 'in-progress' },
      { delay: 4800, id: 'research', status: 'done' },
      { delay: 4500, id: 'implement', status: 'in-progress' },
      { delay: 9500, id: 'implement', status: 'done' },
      { delay: 8000, id: 'test', status: 'in-progress' },
      { delay: 12500, id: 'test', status: 'done' },
      { delay: 11500, id: 'review', status: 'in-progress' },
      { delay: 15000, id: 'review', status: 'done' },
    ];

    for (const update of updates) {
      setTimeout(() => {
        this.updateSubtask(update.id, { status: update.status });
      }, update.delay);
    }
  }
}
