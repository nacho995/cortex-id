import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TerminalComponent } from '../terminal/terminal.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';

type PanelTab = 'terminal' | 'output' | 'problems';

interface PanelTabConfig {
  id: PanelTab;
  label: string;
  icon: 'terminal' | 'eye' | 'warning';
}

const PANEL_TABS: PanelTabConfig[] = [
  { id: 'terminal', label: 'Terminal', icon: 'terminal' },
  { id: 'output', label: 'Output', icon: 'eye' },
  { id: 'problems', label: 'Problems', icon: 'warning' },
];

@Component({
  selector: 'app-panels',
  standalone: true,
  imports: [CommonModule, TerminalComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="panels-container">
      <!-- Panel tab bar -->
      <div class="panel-tabs">
        @for (tab of panelTabs; track tab.id) {
          <button
            class="panel-tab"
            [class.active]="activePanel() === tab.id"
            (click)="setPanel(tab.id)"
          >
            <app-icon [name]="tab.icon" [size]="13" />
            {{ tab.label }}
          </button>
        }

        <div class="panel-tabs-spacer"></div>

        <!-- Panel actions -->
        <button class="panel-action" title="Maximize Panel" (click)="onToggleMaximizeClick()">
          <app-icon name="maximize" [size]="13" />
        </button>
        <button class="panel-action" title="Close Panel" (click)="onCloseClick()">
          <app-icon name="close" [size]="13" />
        </button>
      </div>

      <!-- Panel content -->
      <div class="panel-content">
        @switch (activePanel()) {
          @case ('terminal') {
            <app-terminal />
          }
          @case ('output') {
            <div class="panel-placeholder">
              <app-icon name="eye" [size]="24" />
              <p>Output</p>
              <span>Build and task output will appear here</span>
            </div>
          }
          @case ('problems') {
            <div class="panel-placeholder">
              <app-icon name="check" [size]="24" />
              <p>No problems detected</p>
              <span>Errors and warnings will appear here</span>
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    .panels-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--bg-secondary);
      border-top: 1px solid var(--border-color);
      overflow: hidden;
    }

    .panel-tabs {
      display: flex;
      align-items: center;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      height: 30px;
      flex-shrink: 0;
      padding: 0 4px;
    }

    .panel-tab {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 0 10px;
      height: 100%;
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--text-muted);
      font-size: 12px;
      cursor: pointer;
      white-space: nowrap;
      transition: color var(--transition-fast);

      &:hover {
        color: var(--text-secondary);
      }

      &.active {
        color: var(--text-primary);
        border-bottom-color: var(--accent-primary);
      }
    }

    .panel-tabs-spacer {
      flex: 1;
    }

    .panel-action {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      background: transparent;
      border: none;
      border-radius: var(--radius-sm);
      color: var(--text-muted);
      cursor: pointer;

      &:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
      }
    }

    .panel-content {
      flex: 1;
      overflow: hidden;
      position: relative;
    }

    .panel-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 8px;
      color: var(--text-muted);
      font-size: 12px;

      p {
        font-weight: 600;
        color: var(--text-secondary);
        font-size: 13px;
      }
    }
  `],
})
export class PanelsComponent {
  @Output() closeRequested = new EventEmitter<void>();
  @Output() maximizeRequested = new EventEmitter<boolean>();

  readonly panelTabs = PANEL_TABS;
  readonly activePanel = signal<PanelTab>('terminal');
  private readonly isMaximized = signal(false);

  setPanel(panel: PanelTab): void {
    this.activePanel.set(panel);
  }

  onCloseClick(): void {
    this.closeRequested.emit();
  }

  onToggleMaximizeClick(): void {
    this.isMaximized.update((v) => !v);
    this.maximizeRequested.emit(this.isMaximized());
  }
}
