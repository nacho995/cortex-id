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
    try {
      // Fetch extension details from Open VSX to get the package URL
      const detailRes = await fetch(`https://open-vsx.org/api/${ext.publisher}/${ext.name}/${ext.version}`);
      const detail = await detailRes.json();
      
      // Try to get the package/theme JSON
      let themeJson: any = null;
      
      // Option 1: Try fetching the theme directly from files
      if (detail.files?.['package.json']) {
        const pkgRes = await fetch(detail.files['package.json']);
        const pkg = await pkgRes.json();
        
        // Extract theme contributions
        const themes = pkg.contributes?.themes;
        if (themes && themes.length > 0) {
          const themePath = themes[0].path;
          // Construct theme file URL
          const baseUrl = detail.files['package.json'].replace('/package.json', '');
          const themeUrl = baseUrl + '/' + themePath;
          
          try {
            const themeRes = await fetch(themeUrl);
            themeJson = await themeRes.json();
          } catch {
            // Theme file not directly accessible, try alternative
          }
        }
      }
      
      // Option 2: If we couldn't get the actual theme, create one from the extension metadata
      if (!themeJson) {
        // Generate a reasonable theme from the extension name/description
        console.log('[Extensions] Could not fetch theme JSON, using fallback');
        return; // Don't apply if we can't get the actual theme
      }
      
      // Parse VS Code theme JSON into CortexTheme
      const cortexTheme = this.parseVSCodeTheme(themeJson, ext);
      if (cortexTheme) {
        this.themeService.addImportedTheme(cortexTheme);
        console.log('[Extensions] Theme applied:', cortexTheme.name);
      }
    } catch (err) {
      console.warn('[Extensions] Could not fetch theme data:', err);
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
