import { Injectable, inject } from '@angular/core';
import JSZip from 'jszip';
import { ThemeService, type CortexTheme, type ThemeColors } from './theme.service';
import { IconThemeService, type IconThemeData } from './icon-theme.service';
import { ToastService } from '../shared/ui/toast/toast.service';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface VsixInstallResult {
  success: boolean;
  contributes: VsixContributions;
}

export interface VsixContributions {
  themes?: number;
  iconThemes?: number;
  snippets?: number;
  grammars?: number;
  commands?: number;
  languages?: number;
}

interface SnippetDef {
  prefix: string | string[];
  body: string | string[];
  description?: string;
}

interface StoredGrammar {
  language: string;
  scopeName: string;
  grammar: Record<string, unknown>;
}

// ─── Storage keys ────────────────────────────────────────────────────────────

const STORAGE_SNIPPETS_PREFIX = 'cortex.ext.snippets.';
const STORAGE_GRAMMARS_PREFIX = 'cortex.ext.grammars.';

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class VsixInstallerService {
  private readonly themeService = inject(ThemeService);
  private readonly iconThemeService = inject(IconThemeService);
  private readonly toastService = inject(ToastService);

  // ══════════════════════════════════════════════════════════════════════════
  // Public API
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Downloads, extracts, and applies a VS Code extension from Open VSX.
   * Handles themes, snippets, and grammars.
   */
  async installFromOpenVsx(
    publisher: string,
    name: string,
    version: string,
    displayName: string,
  ): Promise<VsixInstallResult> {
    const extId = `${publisher}.${name}`;

    // ── Step 1: Fetch metadata ──────────────────────────────────────────
    const metaUrl = `https://open-vsx.org/api/${publisher}/${name}/${version}`;
    console.log('[VsixInstaller] Fetching metadata:', metaUrl);

    const metaRes = await fetch(metaUrl);
    if (!metaRes.ok) {
      throw new Error(`Metadata fetch failed: ${metaRes.status} ${metaRes.statusText}`);
    }
    const meta = await metaRes.json();

    const vsixUrl: string =
      meta.files?.download
      ?? meta.downloads?.['universal']
      ?? '';

    if (!vsixUrl) {
      throw new Error(`No VSIX download URL found for ${extId}`);
    }
    console.log('[VsixInstaller] VSIX URL:', vsixUrl);

    // ── Step 2: Download the VSIX (ZIP) ─────────────────────────────────
    const vsixRes = await fetch(vsixUrl);
    if (!vsixRes.ok) {
      throw new Error(`VSIX download failed: ${vsixRes.status}`);
    }
    const vsixBuffer = await vsixRes.arrayBuffer();
    console.log(`[VsixInstaller] Downloaded: ${(vsixBuffer.byteLength / 1024).toFixed(1)} KB`);

    // ── Step 3: Extract ZIP and read extension/package.json ─────────────
    const zip = await JSZip.loadAsync(vsixBuffer);

    const pkgFile = zip.file('extension/package.json');
    if (!pkgFile) {
      throw new Error('extension/package.json not found in VSIX');
    }

    const pkgText = await pkgFile.async('text');
    const pkg = JSON.parse(pkgText);
    const contributes = pkg.contributes ?? {};
    console.log('[VsixInstaller] Contribution types:', Object.keys(contributes));

    // ── Step 4: Process each contribution type ──────────────────────────
    const counts: VsixContributions = {};

    // 4a. Color themes
    const themes: Array<{ label?: string; uiTheme?: string; path?: string }> =
      contributes.themes ?? contributes.colorThemes ?? [];
    if (themes.length > 0) {
      counts.themes = themes.length;
      await this.installThemes(extId, displayName, zip, themes);
    }

    // 4b. Icon themes
    const iconThemes: Array<{ id?: string; label?: string; path?: string }> =
      [...(contributes.iconThemes ?? []), ...(contributes.productIconThemes ?? [])];
    if (iconThemes.length > 0) {
      counts.iconThemes = iconThemes.length;
      await this.installIconThemes(extId, zip, iconThemes);
    }

    // 4c. Snippets
    const snippetEntries: Array<{ language?: string; path?: string }> =
      contributes.snippets ?? [];
    if (snippetEntries.length > 0) {
      counts.snippets = await this.installSnippets(extId, zip, snippetEntries);
    }

    // 4d. Grammars
    const grammarEntries: Array<{ language?: string; scopeName?: string; path?: string }> =
      contributes.grammars ?? [];
    if (grammarEntries.length > 0) {
      counts.grammars = grammarEntries.length;
      await this.installGrammars(extId, zip, grammarEntries);
    }

    // 4e. Languages (metadata only)
    const languages: Array<{ id?: string; aliases?: string[]; extensions?: string[] }> =
      contributes.languages ?? [];
    if (languages.length > 0) {
      counts.languages = languages.length;
      console.log('[VsixInstaller] Language declarations:', languages.map(l => l.id));
    }

    // 4f. Commands (metadata only)
    const commands: Array<{ command?: string; title?: string }> =
      contributes.commands ?? [];
    if (commands.length > 0) {
      counts.commands = commands.length;
      console.log('[VsixInstaller] Commands (metadata only):', commands.map(c => c.command));
    }

    return { success: true, contributes: counts };
  }

  /**
   * Re-registers snippets from localStorage for all given extension IDs.
   * Call on startup once Monaco is ready.
   */
  reregisterSnippets(extensionIds: string[]): void {
    for (const extId of extensionIds) {
      const stored = this.loadSnippetsFromStorage(extId);
      if (stored) {
        this.applySnippetsToMonaco(stored);
      }
    }
  }

  /**
   * Returns stored snippets for an extension from localStorage.
   */
  getSnippetsFromStorage(extId: string): Record<string, Record<string, SnippetDef>> | null {
    return this.loadSnippetsFromStorage(extId);
  }

  /**
   * Returns stored grammars for an extension from localStorage.
   */
  getGrammarsFromStorage(extId: string): StoredGrammar[] | null {
    return this.loadGrammarsFromStorage(extId);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Theme installation
  // ══════════════════════════════════════════════════════════════════════════

  private async installThemes(
    extId: string,
    displayName: string,
    zip: JSZip,
    themes: Array<{ label?: string; uiTheme?: string; path?: string }>,
  ): Promise<void> {
    console.log('[VsixInstaller] Installing themes:', themes.map(t => t.label));

    for (const themeEntry of themes) {
      const relativePath = (themeEntry.path ?? '').replace(/^\.\//, '');
      const zipPath = `extension/${relativePath}`;

      const themeFile = zip.file(zipPath);
      if (!themeFile) {
        console.warn(`[VsixInstaller] Theme file not found: ${zipPath}`);
        continue;
      }

      try {
        const rawText = await themeFile.async('text');
        const cleanJson = this.stripJsonComments(rawText);
        const themeJson = JSON.parse(cleanJson);

        // Register with Monaco editor (full tokenColor rules)
        this.registerMonacoThemeFromVSCode(extId, themeJson);

        // Convert to CortexTheme for UI colors
        const cortexTheme = this.convertToCortexTheme(themeJson, extId, displayName, themeEntry.label);
        if (cortexTheme) {
          this.themeService.addImportedTheme(cortexTheme);
          console.log('[VsixInstaller] Theme applied:', cortexTheme.name);
        }

        // Only auto-apply the first theme
        break;
      } catch (parseErr) {
        console.warn(`[VsixInstaller] Failed to parse ${zipPath}:`, parseErr);
      }
    }
  }

  /**
   * Registers a VS Code theme with Monaco using the full tokenColors array.
   */
  private registerMonacoThemeFromVSCode(extId: string, themeJson: any): void {
    const monacoObj = this.getMonaco();
    if (!monacoObj) return;

    const isDark = (themeJson.type ?? 'dark') !== 'light';
    const themeId = 'ext-' + extId.replace(/\./g, '-');
    const tokenColors: any[] = themeJson.tokenColors ?? [];

    try {
      monacoObj.editor.defineTheme(themeId, {
        base: isDark ? 'vs-dark' : 'vs',
        inherit: true,
        rules: tokenColors.flatMap((tc: any) => {
          const scopes = Array.isArray(tc.scope) ? tc.scope : [tc.scope || ''];
          return scopes.map((scope: string) => ({
            token: scope,
            foreground: tc.settings?.foreground?.replace('#', ''),
            fontStyle: tc.settings?.fontStyle,
          }));
        }).filter((r: any) => r.token),
        colors: themeJson.colors || {},
      });

      console.log(`[VsixInstaller] Monaco theme registered: ${themeId}`);
    } catch (err) {
      console.warn('[VsixInstaller] Failed to register Monaco theme:', err);
    }
  }

  /**
   * Converts a VS Code theme JSON to a CortexTheme (for UI colors).
   */
  private convertToCortexTheme(
    themeJson: any,
    extId: string,
    displayName: string,
    labelOverride?: string,
  ): CortexTheme | null {
    try {
      const colors = themeJson.colors ?? {};
      const isDark = (themeJson.type ?? themeJson.uiTheme ?? 'dark') !== 'light';
      const name = labelOverride || themeJson.name || displayName;
      const id = 'ext-' + extId.replace(/\./g, '-');

      const themeColors: ThemeColors = {
        bgPrimary:      this.pickColor(colors, ['editor.background'], isDark ? '#1e1e1e' : '#ffffff'),
        bgSecondary:    this.pickColor(colors, ['sideBar.background', 'editorGroupHeader.tabsBackground'], isDark ? '#181818' : '#f5f5f5'),
        bgTertiary:     this.pickColor(colors, ['titleBar.activeBackground', 'activityBar.background'], isDark ? '#111111' : '#e8e8e8'),
        bgSurface:      this.pickColor(colors, ['input.background', 'editorWidget.background'], isDark ? '#2d2d2d' : '#ebebeb'),
        bgHover:        this.pickColor(colors, ['list.hoverBackground'], isDark ? '#3d3d3d' : '#dcdcdc'),
        textPrimary:    this.pickColor(colors, ['editor.foreground', 'foreground'], isDark ? '#d4d4d4' : '#1a1a1a'),
        textSecondary:  this.pickColor(colors, ['descriptionForeground'], isDark ? '#a0a0a0' : '#555555'),
        textMuted:      this.pickColor(colors, ['editorLineNumber.foreground'], isDark ? '#666666' : '#999999'),
        accentPrimary:  this.pickColor(colors, ['button.background', 'focusBorder'], isDark ? '#007acc' : '#2563eb'),
        accentSecondary: this.pickColor(colors, ['textLink.foreground', 'textLink.activeForeground', 'badge.background'], isDark ? '#0098ff' : '#0ea5e9'),
        accentSuccess:  this.pickColor(colors, ['terminal.ansiGreen', 'gitDecoration.addedResourceForeground'], isDark ? '#4ec94e' : '#16a34a'),
        accentWarning:  this.pickColor(colors, ['editorWarning.foreground', 'terminal.ansiYellow'], isDark ? '#cca700' : '#d97706'),
        accentError:    this.pickColor(colors, ['editorError.foreground', 'terminal.ansiRed'], isDark ? '#f14c4c' : '#dc2626'),
        borderColor:    this.pickColor(colors, ['panel.border', 'sideBar.border'], isDark ? '#333333' : '#e0e0e0'),
        syntaxKeyword:  this.findTokenColor(themeJson.tokenColors, ['keyword', 'storage.type'], isDark ? '#569cd6' : '#7c3aed'),
        syntaxString:   this.findTokenColor(themeJson.tokenColors, ['string'], isDark ? '#ce9178' : '#059669'),
        syntaxComment:  this.findTokenColor(themeJson.tokenColors, ['comment'], isDark ? '#6a9955' : '#9ca3af'),
        syntaxFunction: this.findTokenColor(themeJson.tokenColors, ['entity.name.function', 'support.function'], isDark ? '#dcdcaa' : '#2563eb'),
        syntaxNumber:   this.findTokenColor(themeJson.tokenColors, ['constant.numeric'], isDark ? '#b5cea8' : '#d97706'),
        syntaxType:     this.findTokenColor(themeJson.tokenColors, ['entity.name.type', 'support.type'], isDark ? '#4ec9b0' : '#0891b2'),
        syntaxVariable: this.findTokenColor(themeJson.tokenColors, ['variable'], isDark ? '#9cdcfe' : '#1a1a1a'),
      };

      return { id, name, isDark, monacoTheme: isDark ? 'vs-dark' : 'vs', colors: themeColors };
    } catch {
      return null;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Icon theme installation
  // ══════════════════════════════════════════════════════════════════════════

  private async installIconThemes(
    extId: string,
    zip: JSZip,
    iconThemes: Array<{ id?: string; label?: string; path?: string }>,
  ): Promise<void> {
    for (const iconTheme of iconThemes) {
      const relativePath = (iconTheme.path ?? '').replace(/^\.\//, '');
      const zipPath = `extension/${relativePath}`;

      const iconFile = zip.file(zipPath);
      if (!iconFile) {
        console.warn(`[VsixInstaller] Icon theme file not found: ${zipPath}`);
        continue;
      }

      try {
        const rawText = await iconFile.async('text');
        const cleanJson = this.stripJsonComments(rawText);
        const iconDef = JSON.parse(cleanJson);

        // Build resolved icon theme data with actual SVG content
        const themeData = await this.buildIconThemeData(
          extId,
          iconTheme.id ?? extId,
          iconTheme.label ?? 'Icon Theme',
          zip,
          zipPath,
          iconDef,
        );

        if (themeData) {
          this.iconThemeService.setIconTheme(themeData);
          console.log(`[VsixInstaller] Icon theme applied: ${iconTheme.label}`);
        }

        // Only apply the first icon theme
        break;
      } catch (err) {
        console.warn(`[VsixInstaller] Failed to parse icon theme ${zipPath}:`, err);
      }
    }
  }

  /**
   * Builds an IconThemeData by reading SVG files from the VSIX zip.
   * Resolves iconPath references relative to the JSON file location.
   */
  private async buildIconThemeData(
    extId: string,
    themeId: string,
    label: string,
    zip: JSZip,
    jsonZipPath: string,
    iconDef: any,
  ): Promise<IconThemeData | null> {
    const iconDefinitions: Record<string, { iconPath?: string }> = iconDef.iconDefinitions ?? {};
    const jsonDir = jsonZipPath.substring(0, jsonZipPath.lastIndexOf('/'));

    // Read all referenced SVG files into a cache: definitionKey → SVG content
    const svgCache: Record<string, string> = {};
    const readPromises: Promise<void>[] = [];

    for (const [defKey, def] of Object.entries(iconDefinitions)) {
      if (!def.iconPath) continue;

      readPromises.push(
        (async () => {
          const resolvedPath = this.resolveIconPath(jsonDir, def.iconPath!);
          const svgFile = zip.file(resolvedPath);
          if (svgFile) {
            try {
              svgCache[defKey] = await svgFile.async('text');
            } catch {
              // Could not read SVG — skip
            }
          }
        })(),
      );
    }

    await Promise.all(readPromises);
    console.log(`[VsixInstaller] Read ${Object.keys(svgCache).length} SVG icons from VSIX`);

    // Helper to resolve a definition key to SVG content
    const getSvg = (key: string | undefined): string => {
      if (!key) return '';
      return svgCache[key] ?? '';
    };

    // Build fileExtensions map: ext → SVG content
    const fileExtensions: Record<string, string> = {};
    for (const [ext, defKey] of Object.entries(iconDef.fileExtensions ?? {})) {
      const svg = getSvg(defKey as string);
      if (svg) fileExtensions[ext] = svg;
    }

    // Build fileNames map: filename → SVG content
    const fileNames: Record<string, string> = {};
    for (const [name, defKey] of Object.entries(iconDef.fileNames ?? {})) {
      const svg = getSvg(defKey as string);
      if (svg) fileNames[name.toLowerCase()] = svg;
    }

    // Build folderNames map: foldername → SVG content
    const folderNames: Record<string, string> = {};
    for (const [name, defKey] of Object.entries(iconDef.folderNames ?? {})) {
      const svg = getSvg(defKey as string);
      if (svg) folderNames[name.toLowerCase()] = svg;
    }

    // Build folderNamesExpanded map: foldername → SVG content (expanded)
    const folderNamesExpanded: Record<string, string> = {};
    for (const [name, defKey] of Object.entries(iconDef.folderNamesExpanded ?? {})) {
      const svg = getSvg(defKey as string);
      if (svg) folderNamesExpanded[name.toLowerCase()] = svg;
    }

    // Default icons
    const defaultFileIcon = getSvg(iconDef.file as string);
    const defaultFolderIcon = getSvg(iconDef.folder as string);
    const defaultFolderOpenIcon = getSvg(iconDef.folderExpanded as string) || defaultFolderIcon;

    return {
      id: themeId,
      label,
      defaultFileIcon,
      defaultFolderIcon,
      defaultFolderOpenIcon,
      fileExtensions,
      fileNames,
      folderNames,
      folderNamesExpanded,
    };
  }

  /**
   * Resolves an iconPath relative to the JSON file's directory within the zip.
   * e.g. jsonDir="extension/dist", iconPath="./../icons/file.svg"
   *   → "extension/icons/file.svg"
   */
  private resolveIconPath(jsonDir: string, iconPath: string): string {
    // Split both into segments
    const baseParts = jsonDir.split('/');
    const pathParts = iconPath.split('/');

    for (const part of pathParts) {
      if (part === '.' || part === '') {
        continue;
      } else if (part === '..') {
        baseParts.pop();
      } else {
        baseParts.push(part);
      }
    }

    return baseParts.join('/');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Snippet installation
  // ══════════════════════════════════════════════════════════════════════════

  private async installSnippets(
    extId: string,
    zip: JSZip,
    snippetEntries: Array<{ language?: string; path?: string }>,
  ): Promise<number> {
    const allSnippets: Record<string, Record<string, SnippetDef>> = {};
    let totalCount = 0;

    for (const entry of snippetEntries) {
      const lang = entry.language ?? 'plaintext';
      const relativePath = (entry.path ?? '').replace(/^\.\//, '');
      const zipPath = `extension/${relativePath}`;

      const snippetFile = zip.file(zipPath);
      if (!snippetFile) {
        console.warn(`[VsixInstaller] Snippet file not found: ${zipPath}`);
        continue;
      }

      try {
        const rawText = await snippetFile.async('text');
        const cleanJson = this.stripJsonComments(rawText);
        const snippetDefs: Record<string, SnippetDef> = JSON.parse(cleanJson);

        if (!allSnippets[lang]) allSnippets[lang] = {};
        for (const [snippetName, def] of Object.entries(snippetDefs)) {
          if (def && (def.prefix || def.body)) {
            allSnippets[lang][snippetName] = {
              prefix: def.prefix,
              body: def.body,
              description: def.description,
            };
            totalCount++;
          }
        }
        console.log(`[VsixInstaller] Extracted ${Object.keys(snippetDefs).length} snippets for: ${lang}`);
      } catch (err) {
        console.warn(`[VsixInstaller] Failed to parse snippet file ${zipPath}:`, err);
      }
    }

    if (totalCount > 0) {
      this.saveSnippetsToStorage(extId, allSnippets);
      this.applySnippetsToMonaco(allSnippets);
      console.log(`[VsixInstaller] ${totalCount} snippet(s) installed`);
    }

    return totalCount;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Grammar installation
  // ══════════════════════════════════════════════════════════════════════════

  private async installGrammars(
    extId: string,
    zip: JSZip,
    grammarEntries: Array<{ language?: string; scopeName?: string; path?: string }>,
  ): Promise<void> {
    const storedGrammars: StoredGrammar[] = [];

    for (const entry of grammarEntries) {
      const lang = entry.language ?? '';
      const scopeName = entry.scopeName ?? '';
      const relativePath = (entry.path ?? '').replace(/^\.\//, '');
      const zipPath = `extension/${relativePath}`;

      const grammarFile = zip.file(zipPath);
      if (!grammarFile) {
        console.warn(`[VsixInstaller] Grammar file not found: ${zipPath}`);
        continue;
      }

      try {
        const rawText = await grammarFile.async('text');

        let grammarDef: Record<string, unknown>;
        if (relativePath.endsWith('.json') || relativePath.endsWith('.tmLanguage.json')) {
          const cleanJson = this.stripJsonComments(rawText);
          grammarDef = JSON.parse(cleanJson);
        } else if (relativePath.endsWith('.tmLanguage') || relativePath.endsWith('.plist')) {
          grammarDef = { raw: rawText, format: 'plist' };
        } else {
          try {
            grammarDef = JSON.parse(rawText);
          } catch {
            grammarDef = { raw: rawText, format: 'unknown' };
          }
        }

        storedGrammars.push({ language: lang, scopeName, grammar: grammarDef });
        console.log(`[VsixInstaller] Grammar extracted: ${scopeName} (${lang})`);
      } catch (err) {
        console.warn(`[VsixInstaller] Failed to parse grammar ${zipPath}:`, err);
      }
    }

    if (storedGrammars.length > 0) {
      this.saveGrammarsToStorage(extId, storedGrammars);
      console.log(`[VsixInstaller] ${storedGrammars.length} grammar(s) stored`);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Monaco snippet integration
  // ══════════════════════════════════════════════════════════════════════════

  private applySnippetsToMonaco(
    snippetsByLang: Record<string, Record<string, SnippetDef>>,
  ): void {
    const monacoObj = this.getMonaco();
    if (!monacoObj) return;

    for (const [lang, snippets] of Object.entries(snippetsByLang)) {
      const monacoLang = this.mapLanguageId(lang);

      try {
        monacoObj.languages.registerCompletionItemProvider(monacoLang, {
          provideCompletionItems: (model: any, position: any) => {
            const word = model.getWordUntilPosition(position);
            const range = {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: word.startColumn,
              endColumn: word.endColumn,
            };

            const suggestions = Object.entries(snippets).map(([snippetName, def]) => {
              const prefixes = Array.isArray(def.prefix) ? def.prefix : [def.prefix];
              const bodyText = Array.isArray(def.body) ? def.body.join('\n') : def.body;

              return {
                label: prefixes[0] ?? snippetName,
                kind: monacoObj.languages.CompletionItemKind.Snippet,
                documentation: def.description ?? snippetName,
                insertText: bodyText,
                insertTextRules: monacoObj.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                detail: `Snippet: ${snippetName}`,
                range,
              };
            });

            return { suggestions };
          },
        });
        console.log(`[VsixInstaller] Registered ${Object.keys(snippets).length} snippet(s) for: ${monacoLang}`);
      } catch (err) {
        console.warn(`[VsixInstaller] Failed to register snippets for ${monacoLang}:`, err);
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Helpers
  // ══════════════════════════════════════════════════════════════════════════

  private getMonaco(): typeof import('monaco-editor') | null {
    const win = window as unknown as Record<string, unknown>;
    return (win['monaco'] as typeof import('monaco-editor')) ?? null;
  }

  private mapLanguageId(vscodeLang: string): string {
    const map: Record<string, string> = {
      javascriptreact: 'javascript',
      typescriptreact: 'typescript',
      jsonc: 'json',
      shellscript: 'shell',
      makefile: 'restructuredtext',
    };
    return map[vscodeLang] ?? vscodeLang;
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

  /**
   * Strip JSONC comments using a state-machine approach to avoid corrupting
   * strings that contain // or /* sequences.
   */
  private stripJsonComments(text: string): string {
    let result = '';
    let i = 0;
    let inString = false;
    let escape = false;

    while (i < text.length) {
      const ch = text[i];
      const next = text[i + 1];

      if (inString) {
        result += ch;
        if (escape) {
          escape = false;
        } else if (ch === '\\') {
          escape = true;
        } else if (ch === '"') {
          inString = false;
        }
        i++;
        continue;
      }

      // Not inside a string
      if (ch === '"') {
        inString = true;
        result += ch;
        i++;
        continue;
      }

      // Line comment
      if (ch === '/' && next === '/') {
        // Skip until end of line
        i += 2;
        while (i < text.length && text[i] !== '\n') i++;
        continue;
      }

      // Block comment
      if (ch === '/' && next === '*') {
        i += 2;
        while (i < text.length) {
          if (text[i] === '*' && text[i + 1] === '/') {
            i += 2;
            break;
          }
          i++;
        }
        continue;
      }

      result += ch;
      i++;
    }

    // Also remove trailing commas before } or ]
    return result.replace(/,(\s*[}\]])/g, '$1');
  }

  // ── Storage helpers ───────────────────────────────────────────────────────

  private saveSnippetsToStorage(
    extId: string,
    snippets: Record<string, Record<string, SnippetDef>>,
  ): void {
    try {
      localStorage.setItem(STORAGE_SNIPPETS_PREFIX + extId, JSON.stringify(snippets));
    } catch {
      console.warn(`[VsixInstaller] Failed to save snippets for ${extId}`);
    }
  }

  private loadSnippetsFromStorage(
    extId: string,
  ): Record<string, Record<string, SnippetDef>> | null {
    try {
      const raw = localStorage.getItem(STORAGE_SNIPPETS_PREFIX + extId);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private saveGrammarsToStorage(extId: string, grammars: StoredGrammar[]): void {
    try {
      localStorage.setItem(STORAGE_GRAMMARS_PREFIX + extId, JSON.stringify(grammars));
    } catch {
      console.warn(`[VsixInstaller] Failed to save grammars for ${extId}`);
    }
  }

  private loadGrammarsFromStorage(extId: string): StoredGrammar[] | null {
    try {
      const raw = localStorage.getItem(STORAGE_GRAMMARS_PREFIX + extId);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}
