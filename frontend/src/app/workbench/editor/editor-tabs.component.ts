import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import type { EditorTab } from './editor.component';

@Component({
  selector: 'app-editor-tabs',
  standalone: true,
  imports: [CommonModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tabs-bar" role="tablist">
      @for (tab of tabs; track tab.path) {
        <div
          class="tab"
          [class.active]="tab.path === activeTabPath"
          [class.dirty]="tab.isDirty"
          role="tab"
          [attr.aria-selected]="tab.path === activeTabPath"
          [title]="tab.path"
          (click)="tabClicked.emit(tab.path)"
          (mousedown)="onMouseDown($event, tab.path)"
          (auxclick)="onAuxClick($event, tab.path)"
        >
          <!-- Active tab gradient top border overlay -->
          @if (tab.path === activeTabPath) {
            <span class="active-border" aria-hidden="true"></span>
          }

          <!-- File icon -->
          <span class="tab-icon">
            <app-icon name="file" [size]="13" />
          </span>

          <!-- Tab name -->
          <span class="tab-name">{{ tab.name }}</span>

          <!-- Dirty indicator / close button -->
          <button
            class="tab-close"
            [class.is-dirty]="tab.isDirty"
            [attr.aria-label]="'Close ' + tab.name"
            (click)="onClose($event, tab.path)"
          >
            @if (tab.isDirty) {
              <span class="dirty-dot"></span>
            } @else {
              <app-icon name="close" [size]="12" />
            }
          </button>
        </div>
      }

      @if (tabs.length === 0) {
        <div class="tabs-empty">
          <span>No files open</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .tabs-bar {
      display: flex;
      align-items: stretch;
      background: var(--bg-secondary);
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      overflow-x: auto;
      overflow-y: hidden;
      height: var(--tab-height);
      flex-shrink: 0;

      &::-webkit-scrollbar {
        height: 2px;
      }

      &::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.15);
        border-radius: 0;
      }
    }

    .tab {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 0 12px;
      min-width: 110px;
      max-width: 200px;
      height: 100%;
      cursor: pointer;
      border-right: 1px solid rgba(255, 255, 255, 0.05);
      color: var(--text-muted);
      font-size: 12px;
      white-space: nowrap;
      position: relative;
      flex-shrink: 0;
      transition: background var(--transition-fast), color var(--transition-fast);
      user-select: none;

      &:hover {
        background: rgba(255, 255, 255, 0.04);
        color: var(--text-secondary);

        .tab-close {
          opacity: 1;
        }
      }

      &.active {
        background: var(--bg-primary);
        color: var(--text-primary);
        font-weight: 500;

        .tab-close {
          opacity: 1;
        }

        .tab-icon {
          color: var(--accent-primary);
          opacity: 0.8;
        }
      }
    }

    /* ── Premium gradient top border for active tab ─────────────────────────── */
    .active-border {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, var(--cortex-red, #FF0040), var(--cortex-green, #00FF88), var(--accent-secondary, #66d9ef));
      background-size: 300% 100%;
      animation: gradientShift 4s ease infinite;
      border-radius: 0;
    }

    @keyframes gradientShift {
      0%   { background-position: 0% 50%; }
      50%  { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }

    .tab-icon {
      display: flex;
      align-items: center;
      flex-shrink: 0;
      color: var(--text-muted);
      transition: color var(--transition-fast);
    }

    .tab-name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 12px;
    }

    .tab-close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      background: transparent;
      border: none;
      border-radius: var(--radius-sm);
      color: var(--text-muted);
      cursor: pointer;
      opacity: 0;
      flex-shrink: 0;
      padding: 0;
      transition: opacity var(--transition-fast), background var(--transition-fast), color var(--transition-fast);

      &:hover {
        background: rgba(249, 38, 114, 0.15);
        color: var(--accent-error);
      }

      &.is-dirty {
        opacity: 1;
      }
    }

    .dirty-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--accent-warning);
      display: block;
      box-shadow: 0 0 4px rgba(230, 219, 116, 0.5);
    }

    .tabs-empty {
      display: flex;
      align-items: center;
      padding: 0 16px;
      color: var(--text-muted);
      font-size: 11px;
      font-style: italic;
    }
  `],
})
export class EditorTabsComponent {
  @Input() tabs: EditorTab[] = [];
  @Input() activeTabPath = '';

  @Output() tabClicked = new EventEmitter<string>();
  @Output() tabClosed = new EventEmitter<string>();

  onMouseDown(event: MouseEvent, path: string): void {
    // Middle-click to close
    if (event.button === 1) {
      event.preventDefault();
      this.tabClosed.emit(path);
    }
  }

  onAuxClick(event: MouseEvent, path: string): void {
    if (event.button === 1) {
      event.preventDefault();
      this.tabClosed.emit(path);
    }
  }

  onClose(event: MouseEvent, path: string): void {
    event.stopPropagation();
    this.tabClosed.emit(path);
  }
}
