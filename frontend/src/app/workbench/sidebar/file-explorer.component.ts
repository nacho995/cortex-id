import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
  signal,
  inject,
} from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { IpcService } from '../../core/ipc.service';
import { IconThemeService } from '../../core/icon-theme.service';
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
  imports: [FileIconPipe, IconComponent, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="file-explorer">
      <!-- Header -->
      <div class="explorer-header">
        <span class="explorer-title">EXPLORER</span>
        <div class="explorer-actions">
          <button
            class="action-btn"
            appTooltip="New File"
            (click)="newFileFromToolbar()"
          >
            <app-icon name="file" [size]="14" />
          </button>
          <button
            class="action-btn"
            appTooltip="New Folder"
            (click)="newFolderFromToolbar()"
          >
            <app-icon name="plus" [size]="14" />
          </button>
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
          <!-- Inline input for new file/folder -->
          @if (inlineInput()) {
            <div class="tree-item inline-input-row" [style.padding-left.px]="16">
              <span class="expand-arrow-placeholder"></span>
              <app-icon [name]="inlineInput()!.type === 'folder' ? 'folder' : 'file'" [size]="14" />
              <input
                #inlineInputEl
                class="inline-name-input"
                type="text"
                [placeholder]="inlineInput()!.type === 'folder' ? 'folder name...' : 'file name...'"
                (keydown.enter)="commitInlineInput(inlineInputEl.value)"
                (keydown.escape)="inlineInput.set(null)"
                (blur)="commitInlineInput(inlineInputEl.value)"
              />
            </div>
          }
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
              <span class="item-icon" [class]="iconThemeService.activeIconTheme() ? '' : (node.name | fileIcon: node.isDirectory)">
                @if (iconThemeService.activeIconTheme()) {
                  <span class="themed-icon"
                        [innerHTML]="getThemedIcon(node)"
                        [style.width.px]="14" [style.height.px]="14">
                  </span>
                } @else {
                  @if (node.isDirectory) {
                    <app-icon
                      [name]="node.isExpanded ? 'folder-open' : 'folder'"
                      [size]="14"
                    />
                  } @else {
                    <app-icon name="file" [size]="14" />
                  }
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

      /* File type icon colors */
      &.icon-ts, &.icon-tsx { color: #3178c6; }
      &.icon-js, &.icon-jsx { color: #f0db4f; }
      &.icon-html { color: #e44d26; }
      &.icon-css, &.icon-scss { color: #264de4; }
      &.icon-json { color: #a0a0a0; }
      &.icon-yaml, &.icon-toml { color: #cb171e; }
      &.icon-md { color: #519aba; }
      &.icon-python { color: #3572a5; }
      &.icon-java { color: #b07219; }
      &.icon-kotlin { color: #a97bff; }
      &.icon-rust { color: #dea584; }
      &.icon-go { color: #00add8; }
      &.icon-c, &.icon-cpp { color: #555555; }
      &.icon-shell { color: #89e051; }
      &.icon-git { color: #f05033; }
      &.icon-docker { color: #2496ed; }
      &.icon-image, &.icon-svg { color: #a074c4; }
      &.icon-npm { color: #cb3837; }
      &.icon-angular { color: #dd0031; }
      &.icon-gradle { color: #02303a; }
      &.icon-xml { color: #e37933; }
      &.icon-env { color: #ecd53f; }
      &.icon-eslint { color: #4b32c3; }
      &.icon-txt, &.icon-pdf { color: #999999; }
    }

    .themed-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 14px;
      height: 14px;
    }
    .themed-icon ::ng-deep svg {
      width: 100%;
      height: 100%;
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

    .inline-input-row {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .inline-name-input {
      flex: 1;
      background: var(--bg-surface);
      color: var(--text-primary);
      border: 1px solid var(--accent-primary);
      border-radius: 3px;
      padding: 2px 6px;
      font-size: 12px;
      font-family: inherit;
      outline: none;
      min-width: 0;
    }
  `],
})
export class FileExplorerComponent implements OnInit, OnDestroy {
  /** Single-click on a file — opens it (current behaviour) */
  @Output() fileSelected = new EventEmitter<string>();

  /** Double-click on a file — also opens it (kept for future preview-mode distinction) */
  @Output() fileOpened = new EventEmitter<string>();

  /** Emitted when a folder is successfully loaded (on init or user action) */
  @Output() folderLoaded = new EventEmitter<string>();

  private readonly ipc = inject(IpcService);
  readonly iconThemeService = inject(IconThemeService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly rootPath = signal('');
  readonly isLoading = signal(false);
  readonly selectedPath = signal('');
  readonly contextMenu = signal<{ x: number; y: number; node: TreeNode } | null>(null);

  private readonly treeData = signal<TreeNode[]>([]);
  readonly flatTree = signal<TreeNode[]>([]);
  /** Inline input for creating new files/folders at the top of the tree */
  readonly inlineInput = signal<{ type: 'file' | 'folder' } | null>(null);
  private fileWatcherCleanup: (() => void) | null = null;
  private refreshDebounce: ReturnType<typeof setTimeout> | null = null;

  get rootName(): () => string {
    return () => {
      const path = this.rootPath();
      return path ? path.split('/').pop() ?? path : '';
    };
  }

  getThemedIcon(node: TreeNode): SafeHtml {
    const svg = this.iconThemeService.getFileIcon(node.name, node.isDirectory ?? false, node.isExpanded ?? false);
    if (svg) return this.sanitizer.bypassSecurityTrustHtml(svg);
    return this.sanitizer.bypassSecurityTrustHtml('');
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
    this.startWatching(folderPath);
  }

  private startWatching(folderPath: string): void {
    this.fileWatcherCleanup?.();
    this.fileWatcherCleanup = this.ipc.onFileChange(() => {
      if (this.refreshDebounce) clearTimeout(this.refreshDebounce);
      this.refreshDebounce = setTimeout(() => this.refresh(), 300);
    });
    this.ipc.watchDirectory({ path: folderPath, recursive: true }).catch(() => {});
  }

  ngOnDestroy(): void {
    this.fileWatcherCleanup?.();
    if (this.refreshDebounce) clearTimeout(this.refreshDebounce);
  }

  async refresh(): Promise<void> {
    const root = this.rootPath();
    if (!root) return;

    // Snapshot expanded paths before reloading, sorted by depth so parents load first
    const expandedPaths = new Set(
      this.flatTree()
        .filter(n => n.isDirectory && n.isExpanded)
        .map(n => n.path),
    );

    // Rebuild the entire flat tree from scratch
    const newFlat: TreeNode[] = [];
    await this.buildFlatTree(root, 0, expandedPaths, newFlat);

    this.treeData.set(newFlat.filter(n => n.level === 0));
    this.flatTree.set(newFlat);
  }

  /**
   * Recursively builds a flat tree array by listing each directory level.
   * Directories that were previously expanded are re-expanded automatically.
   */
  private async buildFlatTree(
    dirPath: string,
    level: number,
    expandedPaths: Set<string>,
    out: TreeNode[],
  ): Promise<void> {
    const response = await this.ipc.listDirectory({ path: dirPath, recursive: false });

    const nodes: TreeNode[] = response.entries
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .map((entry) => ({
        ...entry,
        level,
        isExpanded: entry.isDirectory && expandedPaths.has(entry.path),
        children: undefined,
      }));

    for (const node of nodes) {
      out.push(node);
      if (node.isDirectory && node.isExpanded) {
        await this.buildFlatTree(node.path, level + 1, expandedPaths, out);
      }
    }
  }

  private async loadDirectory(dirPath: string, parentNode?: TreeNode): Promise<void> {
    this.isLoading.set(true);
    try {
      const response = await this.ipc.listDirectory({ path: dirPath, recursive: false });
      const level = parentNode ? parentNode.level + 1 : 0;

      const nodes: TreeNode[] = response.entries
        .sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
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
        this.flatTree.set(nodes);
      } else {
        /* Insert children after parent, removing old children at deeper levels */
        const flat = this.flatTree();
        const parentIdx = flat.findIndex((n) => n.path === parentNode.path);
        if (parentIdx !== -1) {
          // Find where this parent's children end
          let endIdx = parentIdx + 1;
          while (endIdx < flat.length && flat[endIdx].level > parentNode.level) {
            endIdx++;
          }
          const newFlat = [
            ...flat.slice(0, parentIdx + 1),
            ...nodes,
            ...flat.slice(endIdx),
          ];
          this.flatTree.set(newFlat);
        } else {
          // Parent not found — append to end (shouldn't happen)
          this.flatTree.set([...this.flatTree(), ...nodes]);
        }
      }
    } catch (err) {
      console.error('[FileExplorer] Failed to load directory:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  async onItemClick(node: TreeNode): Promise<void> {
    this.selectedPath.set(node.path);

    if (node.isDirectory) {
      const wasExpanded = node.isExpanded;

      if (!wasExpanded) {
        node.isExpanded = true;
        await this.loadDirectory(node.path, node);
      } else {
        /* Collapse: remove all descendant nodes (level > node.level) */
        const flat = this.flatTree();
        const idx = flat.findIndex((n) => n.path === node.path);
        if (idx !== -1) {
          let endIdx = idx + 1;
          while (endIdx < flat.length && flat[endIdx].level > node.level) {
            endIdx++;
          }
          const collapsed = { ...node, isExpanded: false };
          const newFlat = [
            ...flat.slice(0, idx),
            collapsed,
            ...flat.slice(endIdx),
          ];
          this.flatTree.set(newFlat);
        }
      }
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
    try {
      await this.ipc.writeFile({ path: targetPath, content: '', createIfNotExists: true });
      await this.expandAndRefresh(baseDir);
      this.fileSelected.emit(targetPath);
    } catch (err) {
      console.error('[FileExplorer] newFile failed:', err);
    }
  }

  async newFolder(): Promise<void> {
    const ctx = this.contextMenu();
    if (!ctx) return;
    const baseDir = ctx.node.isDirectory ? ctx.node.path : this.dirname(ctx.node.path);
    const folderName = prompt('New folder name');
    this.contextMenu.set(null);
    if (!folderName?.trim()) return;
    const targetPath = this.joinPath(baseDir, folderName.trim());
    try {
      await this.ipc.createDirectory({ path: targetPath, recursive: true });
      await this.expandAndRefresh(baseDir);
    } catch (err) {
      console.error('[FileExplorer] newFolder failed:', err);
    }
  }

  /**
   * Show an inline input for a new file. Opens a folder first if needed.
   */
  async newFileFromToolbar(): Promise<void> {
    if (!this.rootPath()) {
      await this.openFolder();
      if (!this.rootPath()) return;
    }
    this.inlineInput.set({ type: 'file' });
    // Focus the input after it renders
    setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>('.inline-name-input');
      el?.focus();
    }, 50);
  }

  /**
   * Show an inline input for a new folder. Opens a folder first if needed.
   */
  async newFolderFromToolbar(): Promise<void> {
    if (!this.rootPath()) {
      await this.openFolder();
      if (!this.rootPath()) return;
    }
    this.inlineInput.set({ type: 'folder' });
    setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>('.inline-name-input');
      el?.focus();
    }, 50);
  }

  /**
   * Commit the inline input — create the file or folder.
   */
  async commitInlineInput(name: string): Promise<void> {
    const input = this.inlineInput();
    this.inlineInput.set(null);
    if (!input || !name?.trim()) return;

    const root = this.rootPath();
    if (!root) return;

    const targetPath = this.joinPath(root, name.trim());
    try {
      if (input.type === 'folder') {
        await this.ipc.createDirectory({ path: targetPath, recursive: true });
      } else {
        await this.ipc.writeFile({ path: targetPath, content: '', createIfNotExists: true });
      }
      await this.refresh();
      if (input.type === 'file') {
        this.fileSelected.emit(targetPath);
        this.fileOpened.emit(targetPath);
      }
    } catch (err) {
      console.error(`[FileExplorer] Failed to create ${input.type}:`, err);
    }
  }

  async deleteItem(): Promise<void> {
    const ctx = this.contextMenu();
    if (!ctx) return;
    const ok = confirm(`Delete "${ctx.node.name}"?`);
    this.contextMenu.set(null);
    if (!ok) return;
    try {
      await this.ipc.deletePath({ path: ctx.node.path, recursive: true });
      await this.refresh();
    } catch (err) {
      console.error('[FileExplorer] deleteItem failed:', err);
    }
  }

  private async expandAndRefresh(dirPath: string): Promise<void> {
    const root = this.rootPath();
    if (!root) return;

    // Collect currently expanded paths + ensure the target dir is included
    const expandedPaths = new Set(
      this.flatTree()
        .filter(n => n.isDirectory && n.isExpanded)
        .map(n => n.path),
    );
    expandedPaths.add(dirPath);

    // Also expand all ancestor directories so the target is visible
    let ancestor = this.dirname(dirPath);
    while (ancestor && ancestor !== root && ancestor !== this.dirname(ancestor)) {
      expandedPaths.add(ancestor);
      ancestor = this.dirname(ancestor);
    }

    const newFlat: TreeNode[] = [];
    await this.buildFlatTree(root, 0, expandedPaths, newFlat);

    this.treeData.set(newFlat.filter(n => n.level === 0));
    this.flatTree.set(newFlat);
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
