import { Injectable } from '@angular/core';
import type { CortexTheme, ThemeColors } from './theme.service';

interface VSCodeThemeJson {
  name?: string;
  type?: 'dark' | 'light' | 'hc';
  colors?: Record<string, string>;
  tokenColors?: Array<{
    name?: string;
    scope?: string | string[];
    settings?: {
      foreground?: string;
      background?: string;
      fontStyle?: string;
    };
  }>;
}

@Injectable({ providedIn: 'root' })
export class VSCodeThemeParserService {

  /**
   * Parse a VS Code theme JSON file into a CortexTheme.
   * Maps VS Code color tokens to CortexTheme color slots.
   */
  parse(jsonContent: string, fileName: string): CortexTheme | null {
    try {
      const raw = JSON.parse(jsonContent) as VSCodeThemeJson;
      return this.convert(raw, fileName);
    } catch (e) {
      console.error('[VSCodeThemeParser] Failed to parse theme:', e);
      return null;
    }
  }

  private convert(raw: VSCodeThemeJson, fileName: string): CortexTheme {
    const colors = raw.colors ?? {};
    const isDark = raw.type !== 'light';
    const name = raw.name || fileName.replace(/\.json$/i, '').replace(/[-_]/g, ' ');
    const id = 'imported-' + name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    // Map VS Code editor colors → CortexTheme colors
    const themeColors: ThemeColors = {
      bgPrimary:      this.pick(colors, ['editor.background', 'background'], isDark ? '#1e1e1e' : '#ffffff'),
      bgSecondary:    this.pick(colors, ['sideBar.background', 'editorGroupHeader.tabsBackground', 'activityBar.background'], isDark ? '#181818' : '#f5f5f5'),
      bgTertiary:     this.pick(colors, ['titleBar.activeBackground', 'panel.background', 'activityBar.background'], isDark ? '#111111' : '#e8e8e8'),
      bgSurface:      this.pick(colors, ['editorWidget.background', 'input.background', 'dropdown.background'], isDark ? '#2d2d2d' : '#ebebeb'),
      bgHover:        this.pick(colors, ['list.hoverBackground', 'toolbar.hoverBackground'], isDark ? '#3d3d3d' : '#dcdcdc'),
      textPrimary:    this.pick(colors, ['editor.foreground', 'foreground'], isDark ? '#d4d4d4' : '#1a1a1a'),
      textSecondary:  this.pick(colors, ['descriptionForeground', 'sideBar.foreground'], isDark ? '#a0a0a0' : '#555555'),
      textMuted:      this.pick(colors, ['editorLineNumber.foreground', 'disabledForeground'], isDark ? '#666666' : '#999999'),
      accentPrimary:  this.pick(colors, ['focusBorder', 'button.background', 'textLink.foreground', 'progressBar.background'], isDark ? '#007acc' : '#2563eb'),
      accentSecondary: this.pick(colors, ['textLink.activeForeground', 'badge.background'], isDark ? '#0098ff' : '#0ea5e9'),
      accentSuccess:  this.pick(colors, ['gitDecoration.addedResourceForeground', 'terminal.ansiGreen'], isDark ? '#4ec94e' : '#16a34a'),
      accentWarning:  this.pick(colors, ['editorWarning.foreground', 'terminal.ansiYellow', 'list.warningForeground'], isDark ? '#cca700' : '#d97706'),
      accentError:    this.pick(colors, ['editorError.foreground', 'errorForeground', 'terminal.ansiRed'], isDark ? '#f14c4c' : '#dc2626'),
      borderColor:    this.pick(colors, ['panel.border', 'sideBar.border', 'editorGroup.border'], isDark ? '#333333' : '#e0e0e0'),
      // Syntax colors from tokenColors
      syntaxKeyword:  this.findTokenColor(raw.tokenColors, ['keyword', 'keyword.control', 'storage.type', 'storage.modifier'], isDark ? '#569cd6' : '#7c3aed'),
      syntaxString:   this.findTokenColor(raw.tokenColors, ['string', 'string.quoted', 'string.template'], isDark ? '#ce9178' : '#059669'),
      syntaxComment:  this.findTokenColor(raw.tokenColors, ['comment', 'comment.line', 'comment.block'], isDark ? '#6a9955' : '#9ca3af'),
      syntaxFunction: this.findTokenColor(raw.tokenColors, ['entity.name.function', 'support.function', 'meta.function-call'], isDark ? '#dcdcaa' : '#2563eb'),
      syntaxNumber:   this.findTokenColor(raw.tokenColors, ['constant.numeric', 'constant', 'number'], isDark ? '#b5cea8' : '#d97706'),
      syntaxType:     this.findTokenColor(raw.tokenColors, ['entity.name.type', 'support.type', 'storage.type', 'entity.name.class'], isDark ? '#4ec9b0' : '#0891b2'),
      syntaxVariable: this.findTokenColor(raw.tokenColors, ['variable', 'variable.other', 'variable.parameter'], isDark ? '#9cdcfe' : '#1a1a1a'),
    };

    return {
      id,
      name: 'Imported: ' + name,
      isDark,
      monacoTheme: isDark ? 'vs-dark' : 'vs',
      colors: themeColors,
    };
  }

  /** Pick the first matching color from a list of VS Code color keys. */
  private pick(colors: Record<string, string>, keys: string[], fallback: string): string {
    for (const key of keys) {
      const val = colors[key];
      if (val && val.startsWith('#')) return val;
    }
    return fallback;
  }

  /** Find a token color matching one of the given scopes. */
  private findTokenColor(
    tokenColors: VSCodeThemeJson['tokenColors'] | undefined,
    scopes: string[],
    fallback: string,
  ): string {
    if (!tokenColors) return fallback;
    for (const scope of scopes) {
      for (const tc of tokenColors) {
        const tcScopes = Array.isArray(tc.scope) ? tc.scope : tc.scope ? [tc.scope] : [];
        if (tcScopes.some(s => s === scope || s.startsWith(scope + '.'))) {
          const fg = tc.settings?.foreground;
          if (fg && fg.startsWith('#')) return fg;
        }
      }
    }
    return fallback;
  }
}
