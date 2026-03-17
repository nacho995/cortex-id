import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FileExplorerComponent } from './file-explorer.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { TooltipDirective } from '../../shared/ui/tooltip/tooltip.directive';
import { ExtensionsService } from '../../core/extensions.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { AgentFlowService } from '../../ai/agents/agent-flow.service';
import { AgentFlowComponent } from '../../ai/agents/agent-flow.component';
import { LayoutService } from '../../core/layout.service';

type SidebarSection = 'explorer' | 'search' | 'git' | 'timeline' | 'extensions';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule, FileExplorerComponent, IconComponent, TooltipDirective, AgentFlowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sidebar">
      <!-- Activity bar icons -->
      <div class="activity-bar">
        <button
          class="activity-btn"
          [class.active]="activeSection() === 'explorer'"
          appTooltip="Explorer"
          tooltipPosition="right"
          (click)="setSection('explorer')"
        >
          <app-icon name="file" [size]="22" />
        </button>
        <button
          class="activity-btn"
          [class.active]="activeSection() === 'search'"
          appTooltip="Search"
          tooltipPosition="right"
          (click)="setSection('search')"
        >
          <app-icon name="search" [size]="22" />
        </button>
        <button
          class="activity-btn"
          [class.active]="activeSection() === 'git'"
          appTooltip="Source Control"
          tooltipPosition="right"
          (click)="setSection('git')"
        >
          <app-icon name="git" [size]="22" />
        </button>
        <button
          class="activity-btn"
          [class.active]="activeSection() === 'timeline'"
          appTooltip="Timeline"
          tooltipPosition="right"
          (click)="setSection('timeline')"
        >
          <app-icon name="git" [size]="22" />
        </button>
        <button
          class="activity-btn"
          [class.active]="activeSection() === 'extensions'"
          appTooltip="Extensions"
          tooltipPosition="right"
          (click)="setSection('extensions')"
        >
          <app-icon name="code" [size]="22" />
        </button>

        <div class="activity-spacer"></div>

        <button
          class="activity-btn settings-btn"
          appTooltip="Settings (Ctrl+,)"
          tooltipPosition="right"
          (click)="settingsRequested.emit()"
        >
          <app-icon name="settings" [size]="20" />
        </button>
      </div>

      <!-- Panel content -->
      <div class="sidebar-panel">
        @switch (activeSection()) {
          @case ('explorer') {
            <!-- Show AgentFlow when agents are active or in agent layout mode -->
            @if (agentFlowService.isActive() || layoutService.isAgentMode()) {
              <app-agent-flow />
            } @else {
              <app-file-explorer
                (fileSelected)="onFileSelected($event)"
                (folderLoaded)="onFolderLoaded($event)"
              />
            }
          }
          @case ('search') {
            <div class="section-placeholder">
              <app-icon name="search" [size]="32" />
              <p>Search</p>
              <span>Coming soon</span>
            </div>
          }
          @case ('git') {
            <div class="section-placeholder">
              <app-icon name="git" [size]="32" />
              <p>Source Control</p>
              <span>Coming soon</span>
            </div>
          }
          @case ('timeline') {
            <div class="section-placeholder">
              <div style="font-size: 32px">📅</div>
              <p>Cortex Timeline</p>
              <span>AI-powered commit history</span>
              <span style="font-size: 11px; color: var(--text-muted); margin-top: 8px;">Coming in v0.2</span>
            </div>
          }
          @case ('extensions') {
            <div class="extensions-panel">
              <div class="panel-header"><span>EXTENSIONS</span></div>
              <div style="padding:8px"><input type="text" class="ext-search" placeholder="Search VS Code extensions..." [(ngModel)]="extSearchQuery" (input)="searchExtensions()" /></div>
              @if (extensionsService.isSearching()) { <div class="ext-status">Searching Open VSX...</div> }
              <div style="overflow-y:auto;flex:1">
                @for (ext of extensionsService.searchResults(); track ext.id) {
                  <div class="ext-item">
                    <div class="ext-icon">
                      @if (ext.iconUrl) {
                        <img [src]="ext.iconUrl" width="32" height="32" (error)="onExtIconError($event)" loading="lazy" />
                      } @else {
                        <span class="ext-icon-fallback">📦</span>
                      }
                    </div>
                    <div class="ext-info"><div class="ext-name">{{ext.displayName}}</div><div class="ext-pub">{{ext.publisher}}</div><div class="ext-desc">{{ext.description}}</div></div>
                    <button class="ext-btn" [class.installed]="ext.installed" (click)="onExtAction(ext)">{{ext.installed ? '✓ Installed' : 'Install'}}</button>
                  </div>
                }
              </div>
              @if (!extSearchQuery) { <div class="ext-status">Search the Open VSX Registry</div> }
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    .sidebar {
      display: flex;
      height: 100%;
      background: var(--bg-secondary);
      border-right: 1px solid var(--border-color);
    }

    .activity-bar {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 48px;
      background: var(--bg-tertiary);
      border-right: 1px solid var(--border-color);
      padding: 4px 0;
      flex-shrink: 0;
    }

    .activity-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      background: transparent;
      border: none;
      border-radius: var(--radius-sm);
      color: var(--text-secondary);
      cursor: pointer;
      margin: 2px 0;
      position: relative;
      transition: color var(--transition-fast), background var(--transition-fast);

      &:hover {
        color: var(--text-primary);
        background: rgba(255, 255, 255, 0.08);
      }

      &.active {
        color: var(--accent-primary);
        background: rgba(255, 255, 255, 0.05);

        &::before {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 2px;
          height: 24px;
          background: var(--accent-primary);
          border-radius: 0 2px 2px 0;
        }
      }
    }

    .activity-spacer {
      flex: 1;
    }

    .settings-btn {
      color: var(--text-primary) !important;
      margin-bottom: 4px;

      &:hover {
        color: var(--accent-primary) !important;
        background: rgba(255, 255, 255, 0.1);
      }
    }

    .sidebar-panel {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .section-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      height: 100%;
      color: var(--text-muted);
      font-size: 12px;

      p {
        font-weight: 600;
        color: var(--text-secondary);
      }

      span {
        font-size: 11px;
      }
    }

    .panel-header {
      padding: 8px 12px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      text-transform: uppercase;
      border-bottom: 1px solid var(--border-color);
      flex-shrink: 0;
    }

    .extensions-panel {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .ext-search {
      width: 100%;
      padding: 6px 10px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      font-size: 12px;
      box-sizing: border-box;

      &::placeholder { color: var(--text-muted); }
      &:focus { border-color: var(--accent-primary); outline: none; }
    }

    .ext-status {
      padding: 16px;
      text-align: center;
      font-size: 12px;
      color: var(--text-muted);
    }

    .ext-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 8px 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);

      &:hover { background: rgba(255, 255, 255, 0.03); }
    }

    .ext-icon {
      width: 32px;
      height: 32px;
      flex-shrink: 0;
      border-radius: 4px;
      overflow: hidden;
      background: var(--bg-surface);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;

      img { width: 100%; height: 100%; object-fit: cover; }
    }

    .ext-icon-fallback {
      font-size: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
    }

    .ext-info {
      flex: 1;
      min-width: 0;

      .ext-name { font-size: 12px; font-weight: 600; color: var(--text-primary); }
      .ext-pub { font-size: 10px; color: var(--text-muted); }
      .ext-desc { font-size: 11px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    }

    .ext-btn {
      padding: 3px 10px;
      border: 1px solid var(--accent-primary);
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--accent-primary);
      font-size: 11px;
      cursor: pointer;
      flex-shrink: 0;

      &:hover { background: var(--accent-primary); color: var(--bg-tertiary); }
      &.installed { border-color: var(--accent-success, #00FF88); color: var(--accent-success, #00FF88); }
    }
  `],
})
export class SidebarComponent {
  @ViewChild(FileExplorerComponent) private fileExplorer?: FileExplorerComponent;
  @Output() fileSelected = new EventEmitter<string>();
  @Output() settingsRequested = new EventEmitter<void>();
  @Output() projectOpened = new EventEmitter<string>();

  readonly activeSection = signal<SidebarSection>('explorer');
  readonly extensionsService = inject(ExtensionsService);
  readonly agentFlowService = inject(AgentFlowService);
  readonly layoutService = inject(LayoutService);
  private readonly toastService = inject(ToastService);

  extSearchQuery = '';
  private extTimer: any;

  setSection(section: SidebarSection): void {
    this.activeSection.set(section);
  }

  onFileSelected(path: string): void {
    this.fileSelected.emit(path);
  }

  onFolderLoaded(path: string): void {
    this.projectOpened.emit(path);
  }

  searchExtensions(): void {
    clearTimeout(this.extTimer);
    this.extTimer = setTimeout(() => this.extensionsService.search(this.extSearchQuery), 300);
  }

  onExtAction(ext: any): void {
    if (ext.installed) {
      this.extensionsService.uninstall(ext.id);
      this.toastService.info(`Uninstalled ${ext.displayName}`);
    } else {
      this.extensionsService.install(ext);
      this.toastService.success(`Installed ${ext.displayName} — theme/grammar support coming soon`);
    }
  }

  onExtIconError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    const parent = img.parentElement;
    if (parent && !parent.querySelector('.ext-icon-fallback')) {
      const fallback = document.createElement('span');
      fallback.className = 'ext-icon-fallback';
      fallback.textContent = '📦';
      parent.appendChild(fallback);
    }
  }

  async openFolderPath(path: string): Promise<void> {
    this.activeSection.set('explorer');
    await this.fileExplorer?.openFolderPath(path);
  }

  async refresh(): Promise<void> {
    await this.fileExplorer?.refresh();
  }
}
