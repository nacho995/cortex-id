import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrchestratorService, SubtaskStatus } from './orchestrator.service';

/**
 * OrchestratorPlanComponent — interactive todo-list showing the orchestrator's
 * plan with a progress bar, status icons, and agent assignments.
 *
 * Displayed above messages in the chat panel when a plan is active.
 */
@Component({
  selector: 'app-orchestrator-plan',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="plan-panel">
      <!-- Header with progress -->
      <div class="plan-header">
        <span class="plan-title">📋 Orchestrator Plan</span>
        <span class="plan-progress-text">
          {{ orchestrator.doneCount() }}/{{ orchestrator.totalCount() }}
        </span>
        @if (orchestrator.isComplete()) {
          <span class="plan-complete-badge">✓ Complete</span>
        }
      </div>

      <!-- Progress bar -->
      <div class="plan-progress-bar" role="progressbar"
        [attr.aria-valuenow]="orchestrator.progress()"
        aria-valuemin="0"
        aria-valuemax="100">
        <div
          class="plan-progress-fill"
          [style.width.%]="orchestrator.progress()"
          [class.complete]="orchestrator.isComplete()"
        ></div>
      </div>

      <!-- Subtask list -->
      <div class="plan-tasks">
        @for (task of orchestrator.subtasks(); track task.id) {
          <div class="plan-task" [class]="'task-' + task.status">
            <!-- Status icon -->
            <span class="task-status-icon" [title]="task.status">
              {{ statusIcon(task.status) }}
            </span>

            <!-- Task info -->
            <div class="task-info">
              <div class="task-title">{{ task.title }}</div>
              @if (task.description) {
                <div class="task-desc">{{ task.description }}</div>
              }
            </div>

            <!-- Agent badge -->
            @if (task.agentIcon && task.agentName) {
              <div class="task-agent" [title]="task.agentName">
                <span class="agent-icon">{{ task.agentIcon }}</span>
                <span class="agent-name">{{ task.agentName }}</span>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .plan-panel {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md, 6px);
      margin: 8px 12px;
      overflow: hidden;
      flex-shrink: 0;
    }

    /* ── Header ─────────────────────────────────────────────────────────────── */
    .plan-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-bottom: 1px solid var(--border-color);
    }

    .plan-title {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: var(--text-primary);
      text-transform: uppercase;
      flex: 1;
    }

    .plan-progress-text {
      font-size: 10px;
      font-family: var(--font-mono, monospace);
      color: var(--text-muted);
    }

    .plan-complete-badge {
      font-size: 9px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 3px;
      background: rgba(39, 174, 96, 0.15);
      color: #27ae60;
      text-transform: uppercase;
    }

    /* ── Progress bar ────────────────────────────────────────────────────────── */
    .plan-progress-bar {
      height: 3px;
      background: var(--bg-hover);
      overflow: hidden;
    }

    .plan-progress-fill {
      height: 100%;
      background: var(--accent-primary);
      border-radius: 0 2px 2px 0;
      transition: width 0.4s ease;

      &.complete {
        background: #27ae60;
      }
    }

    /* ── Task list ───────────────────────────────────────────────────────────── */
    .plan-tasks {
      padding: 4px 0;
      max-height: 200px;
      overflow-y: auto;
    }

    .plan-task {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 6px 12px;
      transition: background 0.15s ease;

      &:hover { background: var(--bg-hover); }

      &.task-in-progress {
        background: rgba(0, 255, 136, 0.04);
        border-left: 2px solid var(--accent-primary);
      }

      &.task-done {
        opacity: 0.65;
      }

      &.task-error {
        background: rgba(231, 76, 60, 0.04);
        border-left: 2px solid #e74c3c;
      }
    }

    .task-status-icon {
      font-size: 13px;
      flex-shrink: 0;
      margin-top: 1px;
      line-height: 1;
    }

    .task-info {
      flex: 1;
      min-width: 0;
    }

    .task-title {
      font-size: 12px;
      font-weight: 500;
      color: var(--text-primary);
      line-height: 1.3;

      .task-done & {
        text-decoration: line-through;
        color: var(--text-muted);
      }
    }

    .task-desc {
      font-size: 10px;
      color: var(--text-muted);
      margin-top: 2px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .task-agent {
      display: flex;
      align-items: center;
      gap: 3px;
      flex-shrink: 0;
      font-size: 10px;
      color: var(--text-muted);
      background: var(--bg-tertiary);
      padding: 2px 6px;
      border-radius: 3px;
    }

    .agent-icon { font-size: 11px; }
    .agent-name { font-size: 9px; font-weight: 500; }
  `],
})
export class OrchestratorPlanComponent {
  readonly orchestrator = inject(OrchestratorService);

  statusIcon(status: SubtaskStatus): string {
    const icons: Record<SubtaskStatus, string> = {
      pending: '○',
      'in-progress': '⟳',
      done: '✓',
      error: '✕',
      skipped: '—',
    };
    return icons[status];
  }
}
