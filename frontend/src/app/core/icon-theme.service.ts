import { Injectable, signal } from '@angular/core';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface IconThemeData {
  id: string;
  label: string;
  defaultFileIcon: string;       // SVG content for default file
  defaultFolderIcon: string;     // SVG content for default folder
  defaultFolderOpenIcon: string; // SVG content for expanded folder
  fileExtensions: Record<string, string>;       // ext → SVG content
  fileNames: Record<string, string>;            // filename → SVG content
  folderNames: Record<string, string>;          // foldername → SVG content
  folderNamesExpanded: Record<string, string>;  // foldername → SVG content (expanded)
}

// ─── Storage key ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'cortex.iconTheme';

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class IconThemeService {
  /** Signal with the currently active icon theme data. */
  readonly activeIconTheme = signal<IconThemeData | null>(null);

  constructor() {
    this.loadFromStorage();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Public API
  // ══════════════════════════════════════════════════════════════════════════

  /** Set a new icon theme (called during VSIX install). */
  setIconTheme(data: IconThemeData): void {
    this.activeIconTheme.set(data);
    this.saveToStorage(data);
    console.log(`[IconTheme] Active icon theme set: ${data.label}`);
  }

  /** Clear the active icon theme. */
  clearIconTheme(): void {
    this.activeIconTheme.set(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
    console.log('[IconTheme] Icon theme cleared');
  }

  /**
   * Get the SVG content for a file or folder.
   *
   * For directories: checks folderNames[name] first, then falls back to
   * defaultFolderIcon / defaultFolderOpenIcon.
   *
   * For files: checks fileNames[filename] first, then fileExtensions[ext],
   * then defaultFileIcon.
   *
   * Returns the SVG string, or null if no icon theme is active.
   */
  getFileIcon(filename: string, isDirectory: boolean, isExpanded: boolean): string | null {
    const theme = this.activeIconTheme();
    if (!theme) return null;

    const lower = filename.toLowerCase();

    if (isDirectory) {
      if (isExpanded) {
        const expandedIcon = theme.folderNamesExpanded[lower];
        if (expandedIcon) return expandedIcon;
        const closedIcon = theme.folderNames[lower];
        if (closedIcon) return closedIcon;
        return theme.defaultFolderOpenIcon || theme.defaultFolderIcon || null;
      } else {
        const folderIcon = theme.folderNames[lower];
        if (folderIcon) return folderIcon;
        return theme.defaultFolderIcon || null;
      }
    }

    // File: check exact filename first
    const fileNameIcon = theme.fileNames[lower];
    if (fileNameIcon) return fileNameIcon;

    // Check extension (last segment after dot)
    const lastDot = filename.lastIndexOf('.');
    if (lastDot !== -1) {
      const ext = filename.slice(lastDot + 1).toLowerCase();
      const extIcon = theme.fileExtensions[ext];
      if (extIcon) return extIcon;
    }

    return theme.defaultFileIcon || null;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Storage helpers
  // ══════════════════════════════════════════════════════════════════════════

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data: IconThemeData = JSON.parse(raw);
      if (data && data.id) {
        this.activeIconTheme.set(data);
        console.log(`[IconTheme] Restored icon theme from storage: ${data.label}`);
      }
    } catch (err) {
      console.warn('[IconTheme] Failed to load icon theme from storage:', err);
    }
  }

  private saveToStorage(data: IconThemeData): void {
    try {
      const json = JSON.stringify(data);
      localStorage.setItem(STORAGE_KEY, json);
      console.log(`[IconTheme] Saved icon theme to localStorage (${(json.length / 1024).toFixed(1)} KB)`);
    } catch (err) {
      // localStorage full — try to store a subset with just the most common extensions
      console.warn('[IconTheme] localStorage quota exceeded, saving reduced icon theme');
      this.saveReducedToStorage(data);
    }
  }

  private saveReducedToStorage(data: IconThemeData): void {
    const commonExts = [
      'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs',
      'html', 'css', 'scss', 'sass', 'less',
      'json', 'yaml', 'yml', 'toml', 'xml',
      'md', 'txt', 'py', 'java', 'kt', 'rs', 'go',
      'c', 'cpp', 'h', 'hpp', 'sh', 'bash',
      'png', 'jpg', 'svg', 'gif', 'webp',
      'vue', 'svelte', 'rb', 'php', 'swift',
    ];

    const reducedExtensions: Record<string, string> = {};
    for (const ext of commonExts) {
      if (data.fileExtensions[ext]) {
        reducedExtensions[ext] = data.fileExtensions[ext];
      }
    }

    const commonFileNames = [
      'package.json', 'package-lock.json', 'tsconfig.json',
      '.gitignore', 'dockerfile', 'docker-compose.yml',
      'readme.md', 'license', 'makefile', 'angular.json',
    ];

    const reducedFileNames: Record<string, string> = {};
    for (const fn of commonFileNames) {
      if (data.fileNames[fn]) {
        reducedFileNames[fn] = data.fileNames[fn];
      }
    }

    const reduced: IconThemeData = {
      id: data.id,
      label: data.label,
      defaultFileIcon: data.defaultFileIcon,
      defaultFolderIcon: data.defaultFolderIcon,
      defaultFolderOpenIcon: data.defaultFolderOpenIcon,
      fileExtensions: reducedExtensions,
      fileNames: reducedFileNames,
      folderNames: {},
      folderNamesExpanded: {},
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reduced));
      console.log('[IconTheme] Saved reduced icon theme to localStorage');
    } catch {
      console.warn('[IconTheme] Failed to save even reduced icon theme — storage full');
    }
  }
}
