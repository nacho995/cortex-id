import { Injectable, inject, signal } from '@angular/core';
import { ThemeService, type CortexTheme, type ThemeColors } from './theme.service';

export interface VSXExtension {
  id: string;
  name: string;
  publisher: string;
  displayName: string;
  description: string;
  version: string;
  iconUrl?: string;
  installed: boolean;
  category?: string;
  downloadUrl?: string;
}

@Injectable({ providedIn: 'root' })
export class ExtensionsService {
  private readonly themeService = inject(ThemeService);
  
  readonly searchResults = signal<VSXExtension[]>([]);
  readonly isSearching = signal(false);
  readonly installedExtensions = signal<VSXExtension[]>(this.loadInstalled());
  readonly installProgress = signal<string>('');

  async search(query: string): Promise<void> {
    if (!query.trim()) { this.searchResults.set([]); return; }
    this.isSearching.set(true);
    try {
      const res = await fetch(`https://open-vsx.org/api/-/search?query=${encodeURIComponent(query)}&size=20&sortBy=relevance`);
      const data = await res.json();
      this.searchResults.set((data.extensions ?? []).map((e: any) => ({
        id: `${e.namespace}.${e.name}`,
        name: e.name,
        publisher: e.namespace,
        displayName: e.displayName || e.name,
        description: e.description || '',
        version: e.version,
        iconUrl: e.files?.icon,
        installed: this.isInstalled(`${e.namespace}.${e.name}`),
        category: e.categories?.[0] || '',
        downloadUrl: e.files?.download,
      })));
    } catch (err) {
      console.error('[Extensions] Search failed:', err);
      this.searchResults.set([]);
    } finally {
      this.isSearching.set(false);
    }
  }

  isInstalled(id: string): boolean {
    return this.installedExtensions().some(e => e.id === id);
  }

  async install(ext: VSXExtension): Promise<void> {
    this.installProgress.set(`Installing ${ext.displayName}...`);
    
    try {
      // Try to detect if it's a theme and fetch+apply it
      const isTheme = ext.category?.toLowerCase().includes('theme') 
        || ext.name.toLowerCase().includes('theme')
        || ext.description.toLowerCase().includes('theme')
        || ext.description.toLowerCase().includes('color');
      
      if (isTheme) {
        await this.installTheme(ext);
      }

      // Save to installed list
      const installed = [...this.installedExtensions(), { ...ext, installed: true }];
      this.installedExtensions.set(installed);
      this.saveInstalled(installed);
      
      // Update search results to reflect installed state
      this.searchResults.update(r => r.map(x => x.id === ext.id ? { ...x, installed: true } : x));
      
      this.installProgress.set(`${ext.displayName} installed!`);
      setTimeout(() => this.installProgress.set(''), 2000);
    } catch (err) {
      console.error('[Extensions] Install failed:', err);
      this.installProgress.set(`Failed to install ${ext.displayName}`);
      setTimeout(() => this.installProgress.set(''), 3000);
    }
  }

  uninstall(id: string): void {
    const installed = this.installedExtensions().filter(e => e.id !== id);
    this.installedExtensions.set(installed);
    this.saveInstalled(installed);
    this.searchResults.update(r => r.map(x => x.id === id ? { ...x, installed: false } : x));
  }

  private async installTheme(ext: VSXExtension): Promise<void> {
    const BUILTIN: Record<string, { name: string; vars: Record<string, string> }> = {
      'dracula-theme.theme-dracula': {
        name: 'Dracula',
        vars: {
          '--bg-primary': '#282a36', '--bg-secondary': '#1e1f29', '--bg-tertiary': '#191a21',
          '--bg-surface': '#44475a', '--bg-hover': '#44475a', '--text-primary': '#f8f8f2',
          '--text-secondary': '#cfcfc2', '--text-muted': '#6272a4', '--accent-primary': '#bd93f9',
          '--accent-secondary': '#8be9fd', '--accent-error': '#ff5555', '--accent-warning': '#ffb86c',
          '--accent-success': '#50fa7b', '--border-color': '#44475a', '--border-subtle': '#383a4a',
        },
      },
      'enkia.tokyo-night': {
        name: 'Tokyo Night',
        vars: {
          '--bg-primary': '#1a1b26', '--bg-secondary': '#16161e', '--bg-tertiary': '#13131a',
          '--bg-surface': '#24283b', '--bg-hover': '#2a2e45', '--text-primary': '#c0caf5',
          '--text-secondary': '#a9b1d6', '--text-muted': '#565f89', '--accent-primary': '#7aa2f7',
          '--accent-secondary': '#7dcfff', '--accent-error': '#f7768e', '--accent-warning': '#e0af68',
          '--accent-success': '#9ece6a', '--border-color': '#24283b', '--border-subtle': '#1f2335',
        },
      },
      'catppuccin.catppuccin-vsc': {
        name: 'Catppuccin Mocha',
        vars: {
          '--bg-primary': '#1e1e2e', '--bg-secondary': '#181825', '--bg-tertiary': '#11111b',
          '--bg-surface': '#313244', '--bg-hover': '#45475a', '--text-primary': '#cdd6f4',
          '--text-secondary': '#bac2de', '--text-muted': '#6c7086', '--accent-primary': '#cba6f7',
          '--accent-secondary': '#89dceb', '--accent-error': '#f38ba8', '--accent-warning': '#fab387',
          '--accent-success': '#a6e3a1', '--border-color': '#313244', '--border-subtle': '#45475a',
        },
      },
      'arcticicestudio.nord-visual-studio-code': {
        name: 'Nord',
        vars: {
          '--bg-primary': '#2e3440', '--bg-secondary': '#272c36', '--bg-tertiary': '#1f2430',
          '--bg-surface': '#3b4252', '--bg-hover': '#434c5e', '--text-primary': '#eceff4',
          '--text-secondary': '#d8dee9', '--text-muted': '#4c566a', '--accent-primary': '#88c0d0',
          '--accent-secondary': '#81a1c1', '--accent-error': '#bf616a', '--accent-warning': '#ebcb8b',
          '--accent-success': '#a3be8c', '--border-color': '#3b4252', '--border-subtle': '#434c5e',
        },
      },
      'github.github-vscode-theme': {
        name: 'GitHub Dark',
        vars: {
          '--bg-primary': '#0d1117', '--bg-secondary': '#161b22', '--bg-tertiary': '#010409',
          '--bg-surface': '#21262d', '--bg-hover': '#30363d', '--text-primary': '#c9d1d9',
          '--text-secondary': '#8b949e', '--text-muted': '#484f58', '--accent-primary': '#58a6ff',
          '--accent-secondary': '#79c0ff', '--accent-error': '#f85149', '--accent-warning': '#d29922',
          '--accent-success': '#3fb950', '--border-color': '#30363d', '--border-subtle': '#21262d',
        },
      },
    };

    const match = BUILTIN[ext.id]
      ?? Object.entries(BUILTIN).find(([key]) =>
        key.toLowerCase().includes(ext.name.toLowerCase())
        || ext.id.toLowerCase().includes(key.split('.')[1]?.toLowerCase() ?? ''),
      )?.[1];

    if (match) {
      const root = document.documentElement.style;
      Object.entries(match.vars).forEach(([k, v]) => root.setProperty(k, v));
      localStorage.setItem('cortex-ext-theme-vars', JSON.stringify(match.vars));
      localStorage.setItem('cortex-theme', 'ext-' + ext.id);
      this.installProgress.set(`Theme "${match.name}" applied!`);
      return;
    }

    try {
      const res = await fetch(`https://open-vsx.org/api/${ext.publisher}/${ext.name}/${ext.version}`);
      if (!res.ok) return;
      const meta = await res.json();
      const jsonUrl = meta.downloads?.['universal'] ?? meta.files?.download;
      if (!jsonUrl) return;
      const themeRes = await fetch(jsonUrl);
      if (!themeRes.ok) return;
      const themeJson = await themeRes.json();
      const cortexTheme = this.parseVSCodeTheme(themeJson, ext);
      if (cortexTheme) {
        this.themeService.addImportedTheme(cortexTheme);
      }
    } catch (err) {
      console.warn('[Extensions] Could not fetch remote theme:', err);
    }
  }

  private parseVSCodeTheme(raw: any, ext: VSXExtension): CortexTheme | null {
    try {
      const colors = raw.colors ?? {};
      const isDark = raw.type !== 'light';
      const name = raw.name || ext.displayName;
      const id = 'ext-' + ext.id.replace(/\./g, '-');

      const themeColors: ThemeColors = {
        bgPrimary:      this.pickColor(colors, ['editor.background'], isDark ? '#1e1e1e' : '#ffffff'),
        bgSecondary:    this.pickColor(colors, ['sideBar.background', 'editorGroupHeader.tabsBackground'], isDark ? '#181818' : '#f5f5f5'),
        bgTertiary:     this.pickColor(colors, ['titleBar.activeBackground', 'activityBar.background'], isDark ? '#111111' : '#e8e8e8'),
        bgSurface:      this.pickColor(colors, ['editorWidget.background', 'input.background'], isDark ? '#2d2d2d' : '#ebebeb'),
        bgHover:        this.pickColor(colors, ['list.hoverBackground'], isDark ? '#3d3d3d' : '#dcdcdc'),
        textPrimary:    this.pickColor(colors, ['editor.foreground', 'foreground'], isDark ? '#d4d4d4' : '#1a1a1a'),
        textSecondary:  this.pickColor(colors, ['descriptionForeground'], isDark ? '#a0a0a0' : '#555555'),
        textMuted:      this.pickColor(colors, ['editorLineNumber.foreground'], isDark ? '#666666' : '#999999'),
        accentPrimary:  this.pickColor(colors, ['focusBorder', 'button.background', 'textLink.foreground'], isDark ? '#007acc' : '#2563eb'),
        accentSecondary: this.pickColor(colors, ['textLink.activeForeground', 'badge.background'], isDark ? '#0098ff' : '#0ea5e9'),
        accentSuccess:  this.pickColor(colors, ['terminal.ansiGreen', 'gitDecoration.addedResourceForeground'], isDark ? '#4ec94e' : '#16a34a'),
        accentWarning:  this.pickColor(colors, ['editorWarning.foreground', 'terminal.ansiYellow'], isDark ? '#cca700' : '#d97706'),
        accentError:    this.pickColor(colors, ['editorError.foreground', 'terminal.ansiRed'], isDark ? '#f14c4c' : '#dc2626'),
        borderColor:    this.pickColor(colors, ['panel.border', 'sideBar.border'], isDark ? '#333333' : '#e0e0e0'),
        syntaxKeyword:  this.findTokenColor(raw.tokenColors, ['keyword', 'storage.type'], isDark ? '#569cd6' : '#7c3aed'),
        syntaxString:   this.findTokenColor(raw.tokenColors, ['string'], isDark ? '#ce9178' : '#059669'),
        syntaxComment:  this.findTokenColor(raw.tokenColors, ['comment'], isDark ? '#6a9955' : '#9ca3af'),
        syntaxFunction: this.findTokenColor(raw.tokenColors, ['entity.name.function', 'support.function'], isDark ? '#dcdcaa' : '#2563eb'),
        syntaxNumber:   this.findTokenColor(raw.tokenColors, ['constant.numeric'], isDark ? '#b5cea8' : '#d97706'),
        syntaxType:     this.findTokenColor(raw.tokenColors, ['entity.name.type', 'support.type'], isDark ? '#4ec9b0' : '#0891b2'),
        syntaxVariable: this.findTokenColor(raw.tokenColors, ['variable'], isDark ? '#9cdcfe' : '#1a1a1a'),
      };

      return { id, name, isDark, monacoTheme: isDark ? 'vs-dark' : 'vs', colors: themeColors };
    } catch {
      return null;
    }
  }

  private pickColor(colors: Record<string, string>, keys: string[], fallback: string): string {
    for (const key of keys) {
      const val = colors[key];
      if (val && val.startsWith('#')) return val;
    }
    return fallback;
  }

  private findTokenColor(tokenColors: any[] | undefined, scopes: string[], fallback: string): string {
    if (!tokenColors) return fallback;
    for (const scope of scopes) {
      for (const tc of tokenColors) {
        const tcScopes = Array.isArray(tc.scope) ? tc.scope : tc.scope ? [tc.scope] : [];
        if (tcScopes.some((s: string) => s === scope || s.startsWith(scope + '.'))) {
          const fg = tc.settings?.foreground;
          if (fg && fg.startsWith('#')) return fg;
        }
      }
    }
    return fallback;
  }

  private loadInstalled(): VSXExtension[] {
    try {
      const saved = localStorage.getItem('cortex.ext.installed.data');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  }

  private saveInstalled(extensions: VSXExtension[]): void {
    localStorage.setItem('cortex.ext.installed.data', JSON.stringify(extensions));
    // Also keep the ID list for backward compat
    localStorage.setItem('cortex.ext.installed', JSON.stringify(extensions.map(e => e.id)));
  }
}
