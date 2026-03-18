import { Injectable, inject, signal } from '@angular/core';
import { ThemeService } from './theme.service';
import { VsixInstallerService, type VsixContributions } from './vsix-installer.service';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface SnippetDef {
  prefix: string | string[];
  body: string | string[];
  description?: string;
}

/** Counts of each contribution type extracted from a VSIX */
export interface ExtensionContributes {
  themes?: number;
  iconThemes?: number;
  snippets?: number;
  grammars?: number;
  commands?: number;
  languages?: number;
}

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
  /** Parsed from VSIX package.json contributes */
  contributes?: ExtensionContributes;
  /** true if VSIX was downloaded and parsed */
  vsixExtracted?: boolean;
}

/** A stored TextMate grammar definition */
interface StoredGrammar {
  language: string;
  scopeName: string;
  grammar: Record<string, unknown>;
}

// ─── Storage keys ────────────────────────────────────────────────────────────

const STORAGE_INSTALLED_DATA = 'cortex.ext.installed.data';
const STORAGE_INSTALLED_IDS = 'cortex.ext.installed';
const STORAGE_SNIPPETS_PREFIX = 'cortex.ext.snippets.';
const STORAGE_GRAMMARS_PREFIX = 'cortex.ext.grammars.';

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class ExtensionsService {
  private readonly themeService = inject(ThemeService);
  private readonly vsixInstaller = inject(VsixInstallerService);

  readonly searchResults = signal<VSXExtension[]>([]);
  readonly isSearching = signal(false);
  readonly installedExtensions = signal<VSXExtension[]>(this.loadInstalled());
  readonly installProgress = signal<string>('');

  // ── Initialization ───────────────────────────────────────────────────────

  /**
   * Re-registers snippets from all installed extensions with Monaco.
   * Call this from app startup once Monaco is ready.
   */
  init(): void {
    const installed = this.installedExtensions();
    const extIds = installed.map(e => e.id);
    this.vsixInstaller.reregisterSnippets(extIds);
    console.log(`[Extensions] Initialized — ${installed.length} extension(s) loaded`);
  }

  // ── Search ───────────────────────────────────────────────────────────────

  async search(query: string): Promise<void> {
    if (!query.trim()) { this.searchResults.set([]); return; }
    this.isSearching.set(true);
    try {
      const res = await fetch(
        `https://open-vsx.org/api/-/search?query=${encodeURIComponent(query)}&size=20&sortBy=relevance`,
      );
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

  // ── Install pipeline ─────────────────────────────────────────────────────

  async install(ext: VSXExtension): Promise<void> {
    this.installProgress.set(`Downloading ${ext.displayName}...`);

    try {
      const result = await this.vsixInstaller.installFromOpenVsx(
        ext.publisher, ext.name, ext.version, ext.displayName,
      );

      if (result.success) {
        const updatedExt: VSXExtension = {
          ...ext,
          installed: true,
          contributes: result.contributes as ExtensionContributes,
          vsixExtracted: true,
        };

        const existing = this.installedExtensions().filter(e => e.id !== ext.id);
        this.installedExtensions.set([...existing, updatedExt]);
        this.saveInstalled([...existing, updatedExt]);
        this.searchResults.update(r =>
          r.map(x => x.id === ext.id ? { ...x, installed: true } : x),
        );

        const summary = this.getContributionSummary(updatedExt);
        this.installProgress.set(`${ext.displayName} installed!${summary ? ' ' + summary : ''}`);
        setTimeout(() => this.installProgress.set(''), 4000);
      }
    } catch (err) {
      console.error('[Extensions] Install failed:', err);
      this.installProgress.set(`Failed to install ${ext.displayName}`);
      setTimeout(() => this.installProgress.set(''), 3000);
    }
  }

  // ── Apply an already-installed theme ───────────────────────────────────

  /**
   * Apply an already-installed theme extension without re-downloading.
   * Falls back to a full re-install if the theme isn't found in imported themes.
   */
  async applyTheme(ext: VSXExtension): Promise<void> {
    const themeId = 'ext-' + ext.id.replace(/\./g, '-');
    const existing = this.themeService.allThemes().find(t => t.id === themeId);
    if (existing) {
      this.themeService.setTheme(themeId);
      this.installProgress.set(`${ext.displayName} applied!`);
      setTimeout(() => this.installProgress.set(''), 2000);
    } else {
      // Theme data was lost (e.g. localStorage cleared) — re-install via VSIX
      await this.install(ext);
    }
  }

  // ── Uninstall ──────────────────────────────────────────────────────────

  uninstall(id: string): void {
    try {
      localStorage.removeItem(STORAGE_SNIPPETS_PREFIX + id);
      localStorage.removeItem(STORAGE_GRAMMARS_PREFIX + id);
      localStorage.removeItem('cortex.ext.icontheme.' + id);
    } catch { /* ignore */ }

    const installed = this.installedExtensions().filter(e => e.id !== id);
    this.installedExtensions.set(installed);
    this.saveInstalled(installed);
    this.searchResults.update(r => r.map(x => x.id === id ? { ...x, installed: false } : x));
  }

  // ── Snippet API ────────────────────────────────────────────────────────

  /**
   * Register snippets for an extension, storing them in localStorage and
   * applying them to Monaco.
   */
  registerSnippets(extId: string, snippets: Record<string, SnippetDef>): void {
    const wrapped: Record<string, Record<string, SnippetDef>> = { _all: snippets };
    try {
      localStorage.setItem(STORAGE_SNIPPETS_PREFIX + extId, JSON.stringify(wrapped));
    } catch { /* ignore */ }
  }

  /**
   * Returns all snippets from all installed extensions, grouped by language.
   */
  getAllSnippets(): Record<string, Record<string, SnippetDef>> {
    const result: Record<string, Record<string, SnippetDef>> = {};
    for (const ext of this.installedExtensions()) {
      const stored = this.vsixInstaller.getSnippetsFromStorage(ext.id);
      if (!stored) continue;
      for (const [lang, snippetMap] of Object.entries(stored)) {
        if (!result[lang]) result[lang] = {};
        Object.assign(result[lang], snippetMap);
      }
    }
    return result;
  }

  // ── Grammar API ────────────────────────────────────────────────────────

  /**
   * Returns grammar scope names for a given language from all installed extensions.
   */
  getGrammarsForLanguage(langId: string): StoredGrammar[] {
    const result: StoredGrammar[] = [];
    for (const ext of this.installedExtensions()) {
      const stored = this.vsixInstaller.getGrammarsFromStorage(ext.id);
      if (!stored) continue;
      for (const g of stored) {
        if (g.language === langId) {
          result.push(g);
        }
      }
    }
    return result;
  }

  // ── Contribution summary ───────────────────────────────────────────────

  /**
   * Returns a human-readable summary of what an extension contributes.
   */
  getContributionSummary(ext: VSXExtension): string {
    const c = ext.contributes;
    if (!c) return '';

    const parts: string[] = [];
    if (c.themes) parts.push(`${c.themes} theme${c.themes > 1 ? 's' : ''}`);
    if (c.iconThemes) parts.push(`${c.iconThemes} icon theme${c.iconThemes > 1 ? 's' : ''}`);
    if (c.snippets) parts.push(`${c.snippets} snippet${c.snippets > 1 ? 's' : ''}`);
    if (c.grammars) parts.push(`${c.grammars} grammar${c.grammars > 1 ? 's' : ''}`);
    if (c.languages) parts.push(`${c.languages} language${c.languages > 1 ? 's' : ''}`);
    if (c.commands) parts.push(`${c.commands} command${c.commands > 1 ? 's' : ''}`);

    return parts.length > 0 ? parts.join(', ') : '';
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Private: Storage helpers
  // ═══════════════════════════════════════════════════════════════════════

  private loadInstalled(): VSXExtension[] {
    try {
      const saved = localStorage.getItem(STORAGE_INSTALLED_DATA);
      if (!saved) return [];
      const all: VSXExtension[] = JSON.parse(saved);
      const seen = new Map<string, VSXExtension>();
      for (const ext of all) seen.set(ext.id, ext);
      return [...seen.values()];
    } catch { return []; }
  }

  private saveInstalled(extensions: VSXExtension[]): void {
    localStorage.setItem(STORAGE_INSTALLED_DATA, JSON.stringify(extensions));
    localStorage.setItem(STORAGE_INSTALLED_IDS, JSON.stringify(extensions.map(e => e.id)));
  }
}
