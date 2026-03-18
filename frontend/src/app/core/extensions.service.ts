import { Injectable, inject, signal } from '@angular/core';
import JSZip from 'jszip';
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

  /**
   * Downloads the VSIX package from Open VSX, extracts the theme JSON from inside
   * the ZIP archive, parses it into a CortexTheme and applies it immediately.
   *
   * Why VSIX? Open VSX only exposes a handful of pre-extracted files via its
   * /file/ endpoint (package.json, README, icon…). The actual theme JSON files
   * (e.g. extension/themes/dracula.json) live inside the VSIX ZIP and are NOT
   * individually accessible via HTTP. We therefore download the whole VSIX
   * (~50–500 KB), unzip it in-memory with JSZip, and read the theme file.
   */
  private async installTheme(ext: VSXExtension): Promise<void> {
    try {
      // ── Step 1: Resolve the exact version and VSIX download URL ─────────────
      console.log(`[Extensions] Installing theme: ${ext.displayName} (${ext.publisher}/${ext.name})`);
      this.installProgress.set(`Fetching metadata for ${ext.displayName}…`);

      const metaUrl = `https://open-vsx.org/api/${ext.publisher}/${ext.name}/${ext.version}`;
      console.log('[Extensions] Fetching metadata from:', metaUrl);

      const metaRes = await fetch(metaUrl);
      if (!metaRes.ok) {
        console.error('[Extensions] Metadata fetch failed:', metaRes.status, metaRes.statusText);
        return;
      }
      const meta = await metaRes.json();

      // The VSIX download URL is under files.download or downloads.universal
      const vsixUrl: string | undefined =
        meta.files?.download ?? meta.downloads?.['universal'];

      if (!vsixUrl) {
        console.error('[Extensions] No VSIX download URL found in metadata:', meta.files);
        return;
      }
      console.log('[Extensions] VSIX URL:', vsixUrl);

      // ── Step 2: Download the VSIX (ZIP) ─────────────────────────────────────
      this.installProgress.set(`Downloading ${ext.displayName}…`);
      console.log('[Extensions] Downloading VSIX…');

      const vsixRes = await fetch(vsixUrl);
      if (!vsixRes.ok) {
        console.error('[Extensions] VSIX download failed:', vsixRes.status);
        return;
      }
      const vsixBuffer = await vsixRes.arrayBuffer();
      console.log(`[Extensions] VSIX downloaded: ${(vsixBuffer.byteLength / 1024).toFixed(1)} KB`);

      // ── Step 3: Unzip and read extension/package.json ────────────────────────
      this.installProgress.set(`Extracting ${ext.displayName}…`);
      const zip = await JSZip.loadAsync(vsixBuffer);

      const pkgFile = zip.file('extension/package.json');
      if (!pkgFile) {
        console.error('[Extensions] extension/package.json not found in VSIX');
        return;
      }

      const pkgText = await pkgFile.async('text');
      const pkg = JSON.parse(pkgText);
      console.log('[Extensions] extension/package.json parsed OK');

      const themes: Array<{ label?: string; uiTheme?: string; path?: string }> =
        pkg.contributes?.themes ?? [];

      if (themes.length === 0) {
        console.warn('[Extensions] No themes found in contributes.themes');
        return;
      }

      console.log('[Extensions] Available themes in VSIX:', themes.map(t => t.label));

      // ── Step 4: Extract the first (primary) theme JSON ───────────────────────
      let themeJson: Record<string, unknown> | null = null;
      let appliedThemeEntry: typeof themes[0] | null = null;

      for (const themeEntry of themes) {
        // path is relative to the extension root, e.g. "./themes/dracula.json"
        // Inside the VSIX it lives at "extension/themes/dracula.json"
        const relativePath = (themeEntry.path ?? '').replace(/^\.\//, '');
        const zipPath = `extension/${relativePath}`;

        console.log(`[Extensions] Trying theme file: ${zipPath}`);
        const themeFile = zip.file(zipPath);

        if (!themeFile) {
          console.warn(`[Extensions] File not found in ZIP: ${zipPath}`);
          continue;
        }

        try {
          const rawText = await themeFile.async('text');

          // VS Code themes are often JSONC (JSON with comments + trailing commas).
          // Strip them before parsing.
          const cleanJson = rawText
            .replace(/\/\/[^\n]*/g, '')          // remove // line comments
            .replace(/\/\*[\s\S]*?\*\//g, '')    // remove /* block comments */
            .replace(/,(\s*[}\]])/g, '$1');       // remove trailing commas

          themeJson = JSON.parse(cleanJson);
          appliedThemeEntry = themeEntry;
          console.log(
            `[Extensions] Theme JSON loaded from ${zipPath}:`,
            Object.keys(themeJson as object),
          );
          break;
        } catch (parseErr) {
          console.warn(`[Extensions] Failed to parse ${zipPath}:`, parseErr);
        }
      }

      // ── Step 5: Convert to CortexTheme and apply ─────────────────────────────
      if (!themeJson) {
        console.error('[Extensions] Could not extract any theme JSON from VSIX');
        return;
      }

      const cortexTheme = this.parseVSCodeTheme(themeJson, ext, appliedThemeEntry?.label);
      if (!cortexTheme) {
        console.error('[Extensions] parseVSCodeTheme returned null — unexpected theme format');
        return;
      }

      this.themeService.addImportedTheme(cortexTheme);
      console.log('[Extensions] Theme applied successfully:', cortexTheme.name, cortexTheme.colors);
    } catch (err) {
      console.error('[Extensions] Theme installation error:', err);
    }
  }

  private parseVSCodeTheme(
    raw: any,
    ext: VSXExtension,
    labelOverride?: string,
  ): CortexTheme | null {
    try {
      const colors = raw.colors ?? {};
      const isDark = (raw.type ?? raw.uiTheme ?? 'dark') !== 'light';
      const name = labelOverride || raw.name || ext.displayName;
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
