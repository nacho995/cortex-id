import { Injectable, signal, computed, effect, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface ThemeColors {
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgSurface: string;
  bgHover: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accentPrimary: string;
  accentSecondary: string;
  accentSuccess: string;
  accentWarning: string;
  accentError: string;
  borderColor: string;
  // Monaco syntax colors
  syntaxKeyword: string;
  syntaxString: string;
  syntaxComment: string;
  syntaxFunction: string;
  syntaxNumber: string;
  syntaxType: string;
  syntaxVariable: string;
}

export interface CortexTheme {
  id: string;
  name: string;
  isDark: boolean;
  colors: ThemeColors;
  monacoTheme: 'vs-dark' | 'vs';
}

export interface BackgroundConfig {
  type: 'none' | 'image' | 'animation';
  imageUrl?: string;
  animation?: 'matrix' | 'neural' | 'code-rain' | 'gradient-mesh' | 'minimal-grid';
  opacity: number;   // 0-100, default 15
  blur: number;      // 0-20, default 8
  position: 'center' | 'cover' | 'contain' | 'tile';
}

// ─── Theme Definitions ────────────────────────────────────────────────────────

export const THEMES: CortexTheme[] = [
  // ── Cortex Dark (Catppuccin Mocha) ──────────────────────────────────────────
  {
    id: 'cortex-dark',
    name: 'Cortex Dark',
    isDark: true,
    monacoTheme: 'vs-dark',
    colors: {
      bgPrimary: '#1e1e2e',
      bgSecondary: '#181825',
      bgTertiary: '#11111b',
      bgSurface: '#313244',
      bgHover: '#45475a',
      textPrimary: '#cdd6f4',
      textSecondary: '#a6adc8',
      textMuted: '#6c7086',
      accentPrimary: '#89b4fa',
      accentSecondary: '#74c7ec',
      accentSuccess: '#a6e3a1',
      accentWarning: '#f9e2af',
      accentError: '#f38ba8',
      borderColor: '#313244',
      syntaxKeyword: '#cba6f7',
      syntaxString: '#a6e3a1',
      syntaxComment: '#6c7086',
      syntaxFunction: '#89b4fa',
      syntaxNumber: '#fab387',
      syntaxType: '#f5c2e7',
      syntaxVariable: '#cdd6f4',
    },
  },

  // ── Cortex Light ────────────────────────────────────────────────────────────
  {
    id: 'cortex-light',
    name: 'Cortex Light',
    isDark: false,
    monacoTheme: 'vs',
    colors: {
      bgPrimary: '#ffffff',
      bgSecondary: '#f5f5f5',
      bgTertiary: '#e8e8e8',
      bgSurface: '#ebebeb',
      bgHover: '#dcdcdc',
      textPrimary: '#1a1a2e',
      textSecondary: '#555555',
      textMuted: '#999999',
      accentPrimary: '#2563eb',
      accentSecondary: '#0ea5e9',
      accentSuccess: '#16a34a',
      accentWarning: '#d97706',
      accentError: '#dc2626',
      borderColor: '#e0e0e0',
      syntaxKeyword: '#7c3aed',
      syntaxString: '#059669',
      syntaxComment: '#9ca3af',
      syntaxFunction: '#2563eb',
      syntaxNumber: '#d97706',
      syntaxType: '#0891b2',
      syntaxVariable: '#1a1a2e',
    },
  },

  // ── Cortex Midnight ─────────────────────────────────────────────────────────
  {
    id: 'cortex-midnight',
    name: 'Cortex Midnight',
    isDark: true,
    monacoTheme: 'vs-dark',
    colors: {
      bgPrimary: '#0a0a0f',
      bgSecondary: '#0d0d14',
      bgTertiary: '#060609',
      bgSurface: '#12121c',
      bgHover: '#1a1a28',
      textPrimary: '#e0e0e0',
      textSecondary: '#a0a0b0',
      textMuted: '#555566',
      accentPrimary: '#00d4ff',
      accentSecondary: '#0099cc',
      accentSuccess: '#00ff88',
      accentWarning: '#ffcc00',
      accentError: '#ff4466',
      borderColor: '#1a1a28',
      syntaxKeyword: '#00d4ff',
      syntaxString: '#00ff88',
      syntaxComment: '#555566',
      syntaxFunction: '#7b68ee',
      syntaxNumber: '#ffcc00',
      syntaxType: '#00ccaa',
      syntaxVariable: '#e0e0e0',
    },
  },

  // ── Cortex Dracula ──────────────────────────────────────────────────────────
  {
    id: 'cortex-dracula',
    name: 'Cortex Dracula',
    isDark: true,
    monacoTheme: 'vs-dark',
    colors: {
      bgPrimary: '#282a36',
      bgSecondary: '#21222c',
      bgTertiary: '#191a21',
      bgSurface: '#343746',
      bgHover: '#44475a',
      textPrimary: '#f8f8f2',
      textSecondary: '#c0c0d0',
      textMuted: '#6272a4',
      accentPrimary: '#bd93f9',
      accentSecondary: '#ff79c6',
      accentSuccess: '#50fa7b',
      accentWarning: '#f1fa8c',
      accentError: '#ff5555',
      borderColor: '#44475a',
      syntaxKeyword: '#ff79c6',
      syntaxString: '#f1fa8c',
      syntaxComment: '#6272a4',
      syntaxFunction: '#50fa7b',
      syntaxNumber: '#bd93f9',
      syntaxType: '#8be9fd',
      syntaxVariable: '#f8f8f2',
    },
  },

  // ── Cortex Monokai ──────────────────────────────────────────────────────────
  {
    id: 'cortex-monokai',
    name: 'Cortex Monokai',
    isDark: true,
    monacoTheme: 'vs-dark',
    colors: {
      bgPrimary: '#272822',
      bgSecondary: '#1e1f1c',
      bgTertiary: '#171816',
      bgSurface: '#3e3d32',
      bgHover: '#49483e',
      textPrimary: '#f8f8f2',
      textSecondary: '#cfcfc2',
      textMuted: '#75715e',
      accentPrimary: '#a6e22e',
      accentSecondary: '#66d9e8',
      accentSuccess: '#a6e22e',
      accentWarning: '#e6db74',
      accentError: '#f92672',
      borderColor: '#49483e',
      syntaxKeyword: '#f92672',
      syntaxString: '#e6db74',
      syntaxComment: '#75715e',
      syntaxFunction: '#a6e22e',
      syntaxNumber: '#ae81ff',
      syntaxType: '#66d9e8',
      syntaxVariable: '#f8f8f2',
    },
  },

  // ── Cortex Nord ─────────────────────────────────────────────────────────────
  {
    id: 'cortex-nord',
    name: 'Cortex Nord',
    isDark: true,
    monacoTheme: 'vs-dark',
    colors: {
      bgPrimary: '#2e3440',
      bgSecondary: '#292e39',
      bgTertiary: '#242933',
      bgSurface: '#3b4252',
      bgHover: '#434c5e',
      textPrimary: '#d8dee9',
      textSecondary: '#b0bac8',
      textMuted: '#616e88',
      accentPrimary: '#88c0d0',
      accentSecondary: '#81a1c1',
      accentSuccess: '#a3be8c',
      accentWarning: '#ebcb8b',
      accentError: '#bf616a',
      borderColor: '#3b4252',
      syntaxKeyword: '#81a1c1',
      syntaxString: '#a3be8c',
      syntaxComment: '#616e88',
      syntaxFunction: '#88c0d0',
      syntaxNumber: '#b48ead',
      syntaxType: '#8fbcbb',
      syntaxVariable: '#d8dee9',
    },
  },

  // ── Cortex Solarized ────────────────────────────────────────────────────────
  {
    id: 'cortex-solarized',
    name: 'Cortex Solarized',
    isDark: true,
    monacoTheme: 'vs-dark',
    colors: {
      bgPrimary: '#002b36',
      bgSecondary: '#073642',
      bgTertiary: '#00222b',
      bgSurface: '#0d3d4a',
      bgHover: '#1a4a58',
      textPrimary: '#839496',
      textSecondary: '#657b83',
      textMuted: '#586e75',
      accentPrimary: '#268bd2',
      accentSecondary: '#2aa198',
      accentSuccess: '#859900',
      accentWarning: '#b58900',
      accentError: '#dc322f',
      borderColor: '#0d3d4a',
      syntaxKeyword: '#859900',
      syntaxString: '#2aa198',
      syntaxComment: '#586e75',
      syntaxFunction: '#268bd2',
      syntaxNumber: '#d33682',
      syntaxType: '#6c71c4',
      syntaxVariable: '#839496',
    },
  },

  // ── Cortex GitHub ───────────────────────────────────────────────────────────
  {
    id: 'cortex-github',
    name: 'Cortex GitHub',
    isDark: false,
    monacoTheme: 'vs',
    colors: {
      bgPrimary: '#ffffff',
      bgSecondary: '#f6f8fa',
      bgTertiary: '#eaeef2',
      bgSurface: '#f0f2f5',
      bgHover: '#e8ecf0',
      textPrimary: '#1f2328',
      textSecondary: '#57606a',
      textMuted: '#6e7781',
      accentPrimary: '#0969da',
      accentSecondary: '#0550ae',
      accentSuccess: '#1a7f37',
      accentWarning: '#9a6700',
      accentError: '#cf222e',
      borderColor: '#d0d7de',
      syntaxKeyword: '#cf222e',
      syntaxString: '#0a3069',
      syntaxComment: '#6e7781',
      syntaxFunction: '#8250df',
      syntaxNumber: '#0550ae',
      syntaxType: '#953800',
      syntaxVariable: '#1f2328',
    },
  },

  // ── Cortex Cyberpunk ────────────────────────────────────────────────────────
  {
    id: 'cortex-cyberpunk',
    name: 'Cortex Cyberpunk',
    isDark: true,
    monacoTheme: 'vs-dark',
    colors: {
      bgPrimary: 'rgba(10, 10, 20, 0.75)',
      bgSecondary: 'rgba(8, 8, 18, 0.8)',
      bgTertiary: 'rgba(5, 5, 12, 0.85)',
      bgSurface: 'rgba(20, 20, 40, 0.7)',
      bgHover: 'rgba(30, 30, 60, 0.6)',
      textPrimary: '#e0e0e0',
      textSecondary: '#a0a0c0',
      textMuted: '#606080',
      accentPrimary: '#00ff88',
      accentSecondary: '#00d4ff',
      accentSuccess: '#00ff88',
      accentWarning: '#ffcc00',
      accentError: '#ff4466',
      borderColor: 'rgba(0, 255, 136, 0.15)',
      syntaxKeyword: '#ff6ac1',
      syntaxString: '#00ff88',
      syntaxComment: '#606080',
      syntaxFunction: '#00d4ff',
      syntaxNumber: '#ffcc00',
      syntaxType: '#ff9ac1',
      syntaxVariable: '#e0e0e0',
    },
  },
];

// ─── Default background config ────────────────────────────────────────────────

const DEFAULT_BACKGROUND: BackgroundConfig = {
  type: 'none',
  opacity: 15,
  blur: 0,
  position: 'cover',
};

const STORAGE_KEY_THEME = 'cortex-theme';
const STORAGE_KEY_BG = 'cortex-background';
const STORAGE_KEY_IMPORTED_THEMES = 'cortex-imported-themes';

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);

  /** Currently active theme */
  readonly activeTheme = signal<CortexTheme>(THEMES[0]);

  /** Imported themes (persisted to localStorage) */
  readonly importedThemes = signal<CortexTheme[]>([]);

  /** All available themes: built-in + imported */
  readonly allThemes = computed(() => [...THEMES, ...this.importedThemes()]);

  /** Background configuration */
  readonly backgroundConfig = signal<BackgroundConfig>(DEFAULT_BACKGROUND);

  /** Whether Monaco is ready to receive theme registrations */
  private monacoReady = false;

  /** Queued theme to register once Monaco is ready */
  private pendingMonacoTheme: CortexTheme | null = null;

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;

    // Load persisted imported themes first (so setTheme can find them)
    const savedImported = localStorage.getItem(STORAGE_KEY_IMPORTED_THEMES);
    if (savedImported) {
      try {
        const imported = JSON.parse(savedImported) as CortexTheme[];
        if (Array.isArray(imported)) {
          this.importedThemes.set(imported);
        }
      } catch {
        // ignore malformed JSON
      }
    }

    // Load persisted theme
    const savedThemeId = localStorage.getItem(STORAGE_KEY_THEME);
    const monokaiTheme = THEMES.find((t) => t.id === 'cortex-monokai') ?? THEMES[0];
    const initialTheme = savedThemeId
      ? (this.allThemes().find((t) => t.id === savedThemeId) ?? monokaiTheme)
      : monokaiTheme;

    // Load persisted background
    const savedBg = localStorage.getItem(STORAGE_KEY_BG);
    if (savedBg) {
      try {
        const bgConfig = JSON.parse(savedBg) as BackgroundConfig;
        this.backgroundConfig.set(bgConfig);
        this.applyBackgroundToDOM(bgConfig);
      } catch {
        // ignore malformed JSON
      }
    }

    // Apply initial theme (CSS vars only — Monaco not ready yet)
    this.activeTheme.set(initialTheme);
    this.applyTheme(initialTheme);

    // Reactively re-apply whenever theme changes
    effect(() => {
      const theme = this.activeTheme();
      this.applyTheme(theme);
    });
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Switch to a theme by id. Searches built-in and imported themes. Falls back to cortex-dark if not found. */
  setTheme(themeId: string): void {
    const theme = this.allThemes().find((t) => t.id === themeId) ?? THEMES[0];
    this.activeTheme.set(theme);
    // applyTheme is called reactively via effect, but we also call it here
    // to ensure synchronous application before the next CD cycle.
    this.applyTheme(theme);
    if (this.monacoReady) {
      this.registerMonacoTheme(theme);
    } else {
      this.pendingMonacoTheme = theme;
    }

    // Auto-set cyberpunk background when selecting cyberpunk theme
    if (theme.id === 'cortex-cyberpunk') {
      const currentBg = this.backgroundConfig();
      if (currentBg.type === 'none') {
        this.setBackground({
          type: 'image',
          imageUrl: 'https://images.unsplash.com/photo-1515705576963-95cad62945b6?w=1920&q=80',
          opacity: 12,
          blur: 0,
          position: 'cover',
        });
      }
    }
  }

  /**
   * Add an imported theme, persist it to localStorage, and auto-switch to it.
   * If a theme with the same id already exists, it will be replaced.
   */
  addImportedTheme(theme: CortexTheme): void {
    this.importedThemes.update(themes => {
      const filtered = themes.filter(t => t.id !== theme.id);
      return [...filtered, theme];
    });
    if (isPlatformBrowser(this.platformId)) {
      const toStore = this.importedThemes().map(t => ({
        id: t.id,
        name: t.name,
        isDark: t.isDark,
        monacoTheme: t.monacoTheme,
        colors: t.colors,
      }));
      localStorage.setItem(STORAGE_KEY_IMPORTED_THEMES, JSON.stringify(toStore));
    }
    // Auto-switch to the newly imported theme
    this.setTheme(theme.id);
  }

  /** Update background configuration and apply to DOM */
  setBackground(config: BackgroundConfig): void {
    this.backgroundConfig.set(config);
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.setItem(STORAGE_KEY_BG, JSON.stringify(config));
    this.applyBackgroundToDOM(config);
  }

  private applyBackgroundToDOM(config: BackgroundConfig): void {
    const body = document.body;
    const root = document.documentElement.style;

    if (config.type === 'image' && config.imageUrl) {
      // Use CSS custom properties so the ::before pseudo-element in styles.scss
      // can pick them up for opacity and blur rendering.
      root.setProperty('--bg-image-url', `url(${config.imageUrl})`);
      root.setProperty('--bg-opacity', String((config.opacity ?? 20) / 100));
      root.setProperty('--bg-blur', `${config.blur ?? 0}px`);

      // Clear any direct body background so the pseudo-element shows through
      body.style.backgroundImage = '';
      body.style.backgroundSize = '';
      body.style.backgroundPosition = '';
      body.style.backgroundRepeat = '';
      body.style.backgroundAttachment = '';

      body.classList.add('has-bg-image');
    } else {
      root.setProperty('--bg-image-url', 'none');
      root.setProperty('--bg-opacity', '0');
      root.setProperty('--bg-blur', '0px');

      body.style.backgroundImage = '';
      body.style.backgroundSize = '';
      body.style.backgroundPosition = '';
      body.style.backgroundRepeat = '';
      body.style.backgroundAttachment = '';

      body.classList.remove('has-bg-image');
    }
  }

  /**
   * Call this once Monaco is loaded (from EditorComponent).
   * Registers the current theme and flushes any pending registration.
   */
  notifyMonacoReady(): void {
    this.monacoReady = true;
    const theme = this.pendingMonacoTheme ?? this.activeTheme();
    this.registerMonacoTheme(theme);
    this.pendingMonacoTheme = null;
  }

  /**
   * Convert any CSS color (hex, rgba, rgb) to a 6 or 8 digit hex string.
   * Monaco only accepts hex colors, not rgba().
   */
  private toHex(color: string): string {
    if (!color) return '#000000';

    // Already hex
    if (color.startsWith('#')) return color;

    // rgba(r, g, b, a) or rgb(r, g, b)
    const rgbaMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
    if (rgbaMatch) {
      const r = parseInt(rgbaMatch[1]).toString(16).padStart(2, '0');
      const g = parseInt(rgbaMatch[2]).toString(16).padStart(2, '0');
      const b = parseInt(rgbaMatch[3]).toString(16).padStart(2, '0');
      if (rgbaMatch[4] !== undefined) {
        const a = Math.round(parseFloat(rgbaMatch[4]) * 255).toString(16).padStart(2, '0');
        return `#${r}${g}${b}${a}`;
      }
      return `#${r}${g}${b}`;
    }

    return color;
  }

  /**
   * Extract just the hex color part (6 chars) for Monaco token rules.
   * Token foreground colors must be 6-char hex without #.
   */
  private toHex6(color: string): string {
    const hex = this.toHex(color);
    // Remove # and take first 6 chars (no alpha for token rules)
    return hex.replace('#', '').substring(0, 6);
  }

  /** Register a custom Monaco theme and activate it */
  registerMonacoTheme(theme: CortexTheme): void {
    if (!this.monacoReady) {
      this.pendingMonacoTheme = theme;
      return;
    }

    try {
      const win = window as unknown as Record<string, unknown>;
      const monacoObj = win['monaco'] as typeof import('monaco-editor') | undefined;
      if (!monacoObj) return;

      // If this is an extension theme, VsixInstallerService already registered
      // the full tokenColors with monaco.editor.defineTheme(themeId, ...).
      // Just activate that theme instead of re-defining with limited rules.
      if (theme.id.startsWith('ext-')) {
        try {
          monacoObj.editor.setTheme(theme.id);
          console.log('[ThemeService] Activated extension Monaco theme:', theme.id);
          return;
        } catch {
          // Theme not yet registered (e.g., restored from localStorage after restart).
          // Fall through to define a basic theme below.
        }
      }

      monacoObj.editor.defineTheme('cortex-custom', {
        base: theme.monacoTheme,
        inherit: true,
        rules: [
          { token: 'keyword', foreground: this.toHex6(theme.colors.syntaxKeyword) },
          { token: 'keyword.operator', foreground: this.toHex6(theme.colors.syntaxKeyword) },
          { token: 'string', foreground: this.toHex6(theme.colors.syntaxString) },
          { token: 'string.escape', foreground: this.toHex6(theme.colors.syntaxString) },
          { token: 'comment', foreground: this.toHex6(theme.colors.syntaxComment), fontStyle: 'italic' },
          { token: 'comment.line', foreground: this.toHex6(theme.colors.syntaxComment), fontStyle: 'italic' },
          { token: 'comment.block', foreground: this.toHex6(theme.colors.syntaxComment), fontStyle: 'italic' },
          { token: 'type', foreground: this.toHex6(theme.colors.syntaxType) },
          { token: 'type.identifier', foreground: this.toHex6(theme.colors.syntaxType) },
          { token: 'entity.name.function', foreground: this.toHex6(theme.colors.syntaxFunction) },
          { token: 'support.function', foreground: this.toHex6(theme.colors.syntaxFunction) },
          { token: 'number', foreground: this.toHex6(theme.colors.syntaxNumber) },
          { token: 'number.float', foreground: this.toHex6(theme.colors.syntaxNumber) },
          { token: 'variable', foreground: this.toHex6(theme.colors.syntaxVariable) },
          { token: 'variable.other', foreground: this.toHex6(theme.colors.syntaxVariable) },
        ],
        colors: {
          'editor.background': this.toHex(theme.colors.bgPrimary),
          'editor.foreground': this.toHex(theme.colors.textPrimary),
          'editor.lineHighlightBackground': this.toHex(theme.colors.bgSurface),
          'editor.selectionBackground': this.toHex(theme.colors.accentPrimary) + '33',
          'editorCursor.foreground': this.toHex(theme.colors.accentPrimary),
          'editorLineNumber.foreground': this.toHex(theme.colors.textMuted),
          'editorLineNumber.activeForeground': this.toHex(theme.colors.textSecondary),
          'editorIndentGuide.background': this.toHex(theme.colors.borderColor),
          'editorIndentGuide.activeBackground': this.toHex(theme.colors.textMuted),
          'editor.selectionHighlightBackground': this.toHex(theme.colors.accentPrimary) + '22',
          'editorBracketMatch.background': this.toHex(theme.colors.accentPrimary) + '33',
          'editorBracketMatch.border': this.toHex(theme.colors.accentPrimary),
          'scrollbarSlider.background': this.toHex(theme.colors.bgHover) + '88',
          'scrollbarSlider.hoverBackground': this.toHex(theme.colors.bgHover),
          'scrollbarSlider.activeBackground': this.toHex(theme.colors.textMuted),
        },
      });

      monacoObj.editor.setTheme('cortex-custom');
    } catch (err) {
      console.warn('[ThemeService] Failed to register Monaco theme:', err);
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private applyTheme(theme: CortexTheme): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const root = document.documentElement.style;

    root.setProperty('--bg-primary', theme.colors.bgPrimary);
    root.setProperty('--bg-secondary', theme.colors.bgSecondary);
    root.setProperty('--bg-tertiary', theme.colors.bgTertiary);
    root.setProperty('--bg-surface', theme.colors.bgSurface);
    root.setProperty('--bg-hover', theme.colors.bgHover);
    root.setProperty('--text-primary', theme.colors.textPrimary);
    root.setProperty('--text-secondary', theme.colors.textSecondary);
    root.setProperty('--text-muted', theme.colors.textMuted);
    root.setProperty('--accent-primary', theme.colors.accentPrimary);
    root.setProperty('--accent-secondary', theme.colors.accentSecondary);
    root.setProperty('--accent-success', theme.colors.accentSuccess);
    root.setProperty('--accent-warning', theme.colors.accentWarning);
    root.setProperty('--accent-error', theme.colors.accentError);
    root.setProperty('--border-color', theme.colors.borderColor);

    // Keep border-subtle in sync (slightly lighter/darker than border)
    root.setProperty('--border-subtle', theme.colors.bgHover);

    // Mark dark/light on body for any CSS that needs it
    document.body.classList.toggle('theme-dark', theme.isDark);
    document.body.classList.toggle('theme-light', !theme.isDark);

    localStorage.setItem(STORAGE_KEY_THEME, theme.id);
  }
}
