import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  OnInit,
  Output,
  signal,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IpcService } from '../../core/ipc.service';
import { FileIconPipe } from './file-icon.pipe';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { TooltipDirective } from '../../shared/ui/tooltip/tooltip.directive';
import type { DirectoryEntry } from '@cortex-id/shared-types/ipc/file-system.types';

interface TreeNode extends DirectoryEntry {
  isExpanded?: boolean;
  level: number;
}

@Component({
  selector: 'app-file-explorer',
  standalone: true,
  imports: [CommonModule, FileIconPipe, IconComponent, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="file-explorer">
      <!-- Header -->
      <div class="explorer-header">
        <span class="explorer-title">EXPLORER</span>
        <div class="explorer-actions">
          <button
            class="action-btn"
            appTooltip="Open Folder"
            (click)="openFolder()"
          >
            <app-icon name="folder" [size]="14" />
          </button>
          <button
            class="action-btn"
            appTooltip="Refresh"
            (click)="refresh()"
          >
            <app-icon name="refresh" [size]="14" />
          </button>
        </div>
      </div>

      <!-- Root path display -->
      @if (rootPath()) {
        <div class="root-path" [title]="rootPath()">
          <app-icon name="folder-open" [size]="14" />
          <span class="root-name">{{ rootName() }}</span>
        </div>
      }

      <!-- Tree -->
      <div class="tree-container">
        @if (isLoading()) {
          <div class="loading-state">
            <app-icon name="loading" [size]="16" />
            <span>Loading...</span>
          </div>
        } @else if (!rootPath()) {
          <div class="empty-state">
            <app-icon name="folder" [size]="32" />
            <p>No folder open</p>
            <button class="open-btn" (click)="openFolder()">Open Folder</button>
          </div>
        } @else if (flatTree().length === 0) {
          <div class="empty-state">
            <p>Empty folder</p>
          </div>
        } @else {
          @for (node of flatTree(); track node.path) {
            <div
              class="tree-item"
              [class.is-directory]="node.isDirectory"
              [class.is-expanded]="node.isExpanded"
              [class.is-selected]="selectedPath() === node.path"
              [style.padding-left.px]="16 + node.level * 16"
              (click)="onItemClick(node)"
              (dblclick)="onItemDblClick(node)"
              (contextmenu)="onContextMenu($event, node)"
            >
              <!-- Expand arrow for directories -->
              @if (node.isDirectory) {
                <span class="expand-arrow">
                  <app-icon
                    [name]="node.isExpanded ? 'chevron-down' : 'chevron-right'"
                    [size]="12"
                  />
                </span>
              } @else {
                <span class="expand-arrow-placeholder"></span>
              }

              <!-- File/folder icon -->
              <span class="item-icon" [class]="node.name | fileIcon: node.isDirectory">
                @if (node.isDirectory) {
                  <app-icon
                    [name]="node.isExpanded ? 'folder-open' : 'folder'"
                    [size]="14"
                  />
                } @else {
                  <app-icon name="file" [size]="14" />
                }
              </span>

              <!-- Name -->
              <span class="item-name" [title]="node.name">{{ node.name }}</span>
            </div>
          }
        }
      </div>

      <!-- Context menu -->
      @if (contextMenu()) {
        <div
          class="context-menu"
          [style.top.px]="contextMenu()!.y"
          [style.left.px]="contextMenu()!.x"
        >
          <button class="context-item" (click)="newFile()">New File</button>
          <button class="context-item" (click)="newFolder()">New Folder</button>
          <div class="context-separator"></div>
          <button class="context-item danger" (click)="deleteItem()">Delete</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .file-explorer {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
      position: relative;
    }

    .explorer-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.1em;
      color: var(--text-muted);
      text-transform: uppercase;
      flex-shrink: 0;

      /* Show actions only on hover */
      .explorer-actions {
        opacity: 0;
        transition: opacity var(--transition-fast);
      }

      &:hover .explorer-actions {
        opacity: 1;
      }
    }

    .explorer-actions {
      display: flex;
      gap: 2px;
    }

    .action-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      background: transparent;
      border: none;
      border-radius: var(--radius-sm);
      color: var(--text-secondary);
      cursor: pointer;
      transition: background var(--transition-fast), color var(--transition-fast);

      &:hover {
        background: rgba(255, 255, 255, 0.08);
        color: var(--text-primary);
      }
    }

    .root-path {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      font-size: 11px;
      font-weight: 600;
      color: var(--text-secondary);
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      flex-shrink: 0;
      background: rgba(255, 255, 255, 0.02);
    }

    .root-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .tree-container {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
    }

    .tree-item {
      display: flex;
      align-items: center;
      gap: 4px;
      height: 22px;
      cursor: pointer;
      user-select: none;
      color: var(--text-secondary);
      border-radius: 0;
      padding-right: 8px;
      position: relative;
      transition: background var(--transition-fast), color var(--transition-fast);

      /* Indentation guide lines (VS Code style) */
      &::before {
        content: '';
        position: absolute;
        left: calc(var(--indent-level, 0) * 16px + 24px);
        top: 0;
        bottom: 0;
        width: 1px;
        background: rgba(255, 255, 255, 0.05);
        pointer-events: none;
      }

      &:hover {
        background: rgba(255, 255, 255, 0.05);
        color: var(--text-primary);

        .item-name {
          color: var(--text-primary);
        }
      }

      &.is-selected {
        background: rgba(166, 226, 46, 0.08);
        color: var(--text-primary);

        &::after {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 2px;
          background: var(--accent-primary);
          border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
        }
      }

      &.is-directory {
        color: var(--text-primary);
        font-weight: 500;
      }
    }

    .expand-arrow {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      flex-shrink: 0;
      color: var(--text-muted);
      transition: transform var(--transition-fast), color var(--transition-fast);

      .is-expanded & {
        color: var(--text-secondary);
      }
    }

    .expand-arrow-placeholder {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }

    .item-icon {
      display: flex;
      align-items: center;
      flex-shrink: 0;
      color: var(--text-muted);
      transition: color var(--transition-fast);

      .is-directory & {
        color: var(--accent-warning);
      }

      .is-selected & {
        color: var(--accent-primary);
      }
    }

    .item-name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 13px;
      transition: color var(--transition-fast);
    }

    .loading-state,
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 32px 16px;
      color: var(--text-muted);
      font-size: 12px;
      text-align: center;
    }

    .open-btn {
      margin-top: 8px;
      padding: 6px 12px;
      background: var(--accent-primary);
      color: var(--bg-tertiary);
      border: none;
      border-radius: var(--radius-sm);
      font-size: 12px;
      cursor: pointer;
      font-weight: 500;

      &:hover {
        opacity: 0.9;
      }
    }

    /* Context menu */
    .context-menu {
      position: fixed;
      background: color-mix(in srgb, var(--bg-surface) 95%, transparent);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
      z-index: 1000;
      min-width: 168px;
      padding: 4px;
      animation: scaleIn 0.12s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .context-item {
      display: block;
      width: 100%;
      padding: 6px 12px;
      background: transparent;
      border: none;
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      font-size: 12px;
      text-align: left;
      cursor: pointer;
      transition: background var(--transition-fast);
      font-family: var(--font-sans);

      &:hover {
        background: rgba(255, 255, 255, 0.07);
      }

      &.danger {
        color: var(--accent-error);

        &:hover {
          background: rgba(249, 38, 114, 0.1);
        }
      }
    }

    .context-separator {
      height: 1px;
      background: rgba(255, 255, 255, 0.06);
      margin: 4px 0;
    }
  `],
})
export class FileExplorerComponent implements OnInit {
  /** Single-click on a file — opens it (current behaviour) */
  @Output() fileSelected = new EventEmitter<string>();

  /** Double-click on a file — also opens it (kept for future preview-mode distinction) */
  @Output() fileOpened = new EventEmitter<string>();

  /** Emitted when a folder is successfully loaded (on init or user action) */
  @Output() folderLoaded = new EventEmitter<string>();

  private readonly ipc = inject(IpcService);

  readonly rootPath = signal('');
  readonly isLoading = signal(false);
  readonly selectedPath = signal('');
  readonly contextMenu = signal<{ x: number; y: number; node: TreeNode } | null>(null);

  private readonly treeData = signal<TreeNode[]>([]);
  readonly flatTree = signal<TreeNode[]>([]);

  get rootName(): () => string {
    return () => {
      const path = this.rootPath();
      return path ? path.split('/').pop() ?? path : '';
    };
  }

  ngOnInit(): void {
    /* Close context menu on outside click */
    document.addEventListener('click', () => this.contextMenu.set(null));
  }

  async openFolder(): Promise<void> {
    try {
      const result = await this.ipc.openDialog({
        title: 'Open Folder',
        properties: ['openDirectory'],
      });

      if (!result.canceled && result.filePaths.length > 0) {
        await this.openFolderPath(result.filePaths[0]);
      }
    } catch (err) {
      console.error('[FileExplorer] openFolder failed:', err);
    }
  }

  async openFolderPath(folderPath: string): Promise<void> {
    this.flatTree.set([]);
    this.selectedPath.set('');
    this.rootPath.set(folderPath);
    await this.loadDirectory(folderPath);
    this.folderLoaded.emit(folderPath);
  }

  async refresh(): Promise<void> {
    if (this.rootPath()) {
      await this.loadDirectory(this.rootPath());
    }
  }

  private async loadDirectory(path: string, parentNode?: TreeNode): Promise<void> {
    this.isLoading.set(true);
    try {
      const response = await this.ipc.listDirectory({ path, recursive: false });
      const level = parentNode ? parentNode.level + 1 : 0;

      const nodes: TreeNode[] = response.entries
        .sort((a, b) => {
          /* Directories first, then files */
          if (a.isDirectory !== b.isDirectory) {
            return a.isDirectory ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        })
        .map((entry) => ({
          ...entry,
          level,
          isExpanded: false,
          children: undefined,
        }));

      if (!parentNode) {
        this.treeData.set(nodes);
      } else {
        /* Insert children after parent in flat tree */
        const flat = this.flatTree();
        const parentIdx = flat.findIndex((n) => n.path === parentNode.path);
        if (parentIdx !== -1) {
          const newFlat = [
            ...flat.slice(0, parentIdx + 1),
            ...nodes,
            ...flat.slice(parentIdx + 1).filter((n) => n.level <= parentNode.level),
          ];
          this.flatTree.set(newFlat);
          return;
        }
      }

      this.flatTree.set(nodes);
    } catch (err) {
      console.error('[FileExplorer] Failed to load directory:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  async onItemClick(node: TreeNode): Promise<void> {
    this.selectedPath.set(node.path);

    if (node.isDirectory) {
      node.isExpanded = !node.isExpanded;

      if (node.isExpanded) {
        await this.loadDirectory(node.path, node);
      } else {
        /* Collapse: remove children from flat tree */
        const flat = this.flatTree();
        const idx = flat.findIndex((n) => n.path === node.path);
        if (idx !== -1) {
          const newFlat = [
            ...flat.slice(0, idx + 1),
            ...flat.slice(idx + 1).filter((n) => n.level <= node.level),
          ];
          this.flatTree.set(newFlat);
        }
      }

      /* Force update */
      this.flatTree.update((f) => [...f]);
    } else {
      this.fileSelected.emit(node.path);
    }
  }

  onItemDblClick(node: TreeNode): void {
    if (!node.isDirectory) {
      this.fileOpened.emit(node.path);
    }
  }

  onContextMenu(event: MouseEvent, node: TreeNode): void {
    event.preventDefault();
    this.contextMenu.set({ x: event.clientX, y: event.clientY, node });
  }

  async newFile(): Promise<void> {
    const ctx = this.contextMenu();
    if (!ctx) return;
    const baseDir = ctx.node.isDirectory ? ctx.node.path : this.dirname(ctx.node.path);
    const fileName = prompt('New file name');
    this.contextMenu.set(null);
    if (!fileName?.trim()) return;
    const targetPath = this.joinPath(baseDir, fileName.trim());
    await this.ipc.writeFile({ path: targetPath, content: '', createIfNotExists: true });
    await this.refresh();
  }

  async newFolder(): Promise<void> {
    const ctx = this.contextMenu();
    if (!ctx) return;
    const baseDir = ctx.node.isDirectory ? ctx.node.path : this.dirname(ctx.node.path);
    const folderName = prompt('New folder name');
    this.contextMenu.set(null);
    if (!folderName?.trim()) return;
    const targetPath = this.joinPath(baseDir, folderName.trim());
    await this.ipc.createDirectory({ path: targetPath, recursive: true });
    await this.refresh();
  }

  async deleteItem(): Promise<void> {
    const ctx = this.contextMenu();
    if (!ctx) return;
    const ok = confirm(`Delete "${ctx.node.name}"?`);
    this.contextMenu.set(null);
    if (!ok) return;
    await this.ipc.deletePath({ path: ctx.node.path, recursive: true });
    await this.refresh();
  }

  private dirname(fullPath: string): string {
    const sep = fullPath.includes('\\') ? '\\' : '/';
    const normalized = fullPath.replace(/[\\/]+$/, '');
    const parts = normalized.split(/[\\/]/);
    parts.pop();
    return parts.join(sep) || sep;
  }

  private joinPath(base: string, name: string): string {
    const sep = base.includes('\\') ? '\\' : '/';
    const normalizedBase = base.endsWith('/') || base.endsWith('\\') ? base.slice(0, -1) : base;
    return `${normalizedBase}${sep}${name}`;
  }
}
