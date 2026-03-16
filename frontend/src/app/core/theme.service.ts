import { Injectable, signal, effect, inject, PLATFORM_ID } from '@angular/core';
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
];

// ─── Default background config ────────────────────────────────────────────────

const DEFAULT_BACKGROUND: BackgroundConfig = {
  type: 'none',
  opacity: 15,
  blur: 8,
  position: 'cover',
};

const STORAGE_KEY_THEME = 'cortex-theme';
const STORAGE_KEY_BG = 'cortex-background';

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);

  /** Currently active theme */
  readonly activeTheme = signal<CortexTheme>(THEMES[0]);

  /** Background configuration */
  readonly backgroundConfig = signal<BackgroundConfig>(DEFAULT_BACKGROUND);

  /** Whether Monaco is ready to receive theme registrations */
  private monacoReady = false;

  /** Queued theme to register once Monaco is ready */
  private pendingMonacoTheme: CortexTheme | null = null;

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;

    // Load persisted theme
    const savedThemeId = localStorage.getItem(STORAGE_KEY_THEME);
    const monokaiTheme = THEMES.find((t) => t.id === 'cortex-monokai') ?? THEMES[0];
    const initialTheme = savedThemeId
      ? (THEMES.find((t) => t.id === savedThemeId) ?? monokaiTheme)
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

  /** Switch to a theme by id. Falls back to cortex-dark if not found. */
  setTheme(themeId: string): void {
    const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];
    this.activeTheme.set(theme);
    // applyTheme is called reactively via effect, but we also call it here
    // to ensure synchronous application before the next CD cycle.
    this.applyTheme(theme);
    if (this.monacoReady) {
      this.registerMonacoTheme(theme);
    } else {
      this.pendingMonacoTheme = theme;
    }
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
    if (config.type === 'image' && config.imageUrl) {
      body.style.backgroundImage = `url(${config.imageUrl})`;
      body.style.backgroundSize = 'cover';
      body.style.backgroundPosition = 'center';
      body.style.backgroundRepeat = 'no-repeat';
      body.style.backgroundAttachment = 'fixed';
      body.classList.add('has-bg-image');
    } else {
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

      monacoObj.editor.defineTheme('cortex-custom', {
        base: theme.monacoTheme,
        inherit: true,
        rules: [
          { token: 'keyword', foreground: theme.colors.syntaxKeyword.replace('#', '') },
          { token: 'keyword.operator', foreground: theme.colors.syntaxKeyword.replace('#', '') },
          { token: 'string', foreground: theme.colors.syntaxString.replace('#', '') },
          { token: 'string.escape', foreground: theme.colors.syntaxString.replace('#', '') },
          { token: 'comment', foreground: theme.colors.syntaxComment.replace('#', '') },
          { token: 'comment.line', foreground: theme.colors.syntaxComment.replace('#', '') },
          { token: 'comment.block', foreground: theme.colors.syntaxComment.replace('#', '') },
          { token: 'type', foreground: theme.colors.syntaxType.replace('#', '') },
          { token: 'type.identifier', foreground: theme.colors.syntaxType.replace('#', '') },
          { token: 'entity.name.function', foreground: theme.colors.syntaxFunction.replace('#', '') },
          { token: 'support.function', foreground: theme.colors.syntaxFunction.replace('#', '') },
          { token: 'number', foreground: theme.colors.syntaxNumber.replace('#', '') },
          { token: 'number.float', foreground: theme.colors.syntaxNumber.replace('#', '') },
          { token: 'variable', foreground: theme.colors.syntaxVariable.replace('#', '') },
          { token: 'variable.other', foreground: theme.colors.syntaxVariable.replace('#', '') },
        ],
        colors: {
          'editor.background': theme.colors.bgPrimary,
          'editor.foreground': theme.colors.textPrimary,
          'editor.lineHighlightBackground': theme.colors.bgSurface,
          'editor.selectionBackground': theme.colors.accentPrimary + '33',
          'editorCursor.foreground': theme.colors.accentPrimary,
          'editorLineNumber.foreground': theme.colors.textMuted,
          'editorLineNumber.activeForeground': theme.colors.textSecondary,
          'editorIndentGuide.background': theme.colors.borderColor,
          'editorIndentGuide.activeBackground': theme.colors.textMuted,
          'editor.selectionHighlightBackground': theme.colors.accentPrimary + '22',
          'editorBracketMatch.background': theme.colors.accentPrimary + '33',
          'editorBracketMatch.border': theme.colors.accentPrimary,
          'scrollbarSlider.background': theme.colors.bgHover + '88',
          'scrollbarSlider.hoverBackground': theme.colors.bgHover,
          'scrollbarSlider.activeBackground': theme.colors.textMuted,
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
