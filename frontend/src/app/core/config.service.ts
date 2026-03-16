import { Injectable, signal, computed, effect } from '@angular/core';
import { IpcService } from './ipc.service';
import type { AppSettings, ThemeMode } from '@cortex-id/shared-types/ipc/app.types';

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  fontSize: 14,
  fontFamily: 'JetBrains Mono, monospace',
  tabSize: 2,
  wordWrap: false,
  minimap: true,
  fontLigatures: true,
  lineNumbers: 'on',
  bracketPairColorization: true,
  renderWhitespace: 'selection',
  cursorBlinking: 'smooth',
  cursorStyle: 'line',
  smoothScrolling: true,
  folding: true,
  guides: true,
  scrollBeyondLastLine: false,
  aiModel: 'claude-sonnet-4-6',
  autoSave: true,
  autoSaveDelay: 1000,
};

/**
 * Configuration Service — manages application settings with signal-based state.
 *
 * Loads settings from IPC on init, persists changes via IPC,
 * and applies theme changes to the document body.
 */
@Injectable({ providedIn: 'root' })
export class ConfigService {
  private readonly _settings = signal<AppSettings>(DEFAULT_SETTINGS);
  private readonly _isLoaded = signal(false);

  readonly settings = this._settings.asReadonly();
  readonly isLoaded = this._isLoaded.asReadonly();

  readonly theme = computed(() => this._settings().theme);
  readonly fontSize = computed(() => this._settings().fontSize);
  readonly fontFamily = computed(() => this._settings().fontFamily);
  readonly tabSize = computed(() => this._settings().tabSize);
  readonly wordWrap = computed(() => this._settings().wordWrap);
  readonly minimap = computed(() => this._settings().minimap);
  readonly aiModel = computed(() => this._settings().aiModel);
  readonly autoSave = computed(() => this._settings().autoSave);

  constructor(private readonly ipc: IpcService) {
    this.loadSettings();

    // Apply theme whenever it changes
    effect(() => {
      this.applyTheme(this._settings().theme);
    });
  }

  private async loadSettings(): Promise<void> {
    try {
      const settings = await this.ipc.getSettings();
      this._settings.set(settings);
    } catch (err) {
      console.error('[ConfigService] Failed to load settings:', err);
    } finally {
      this._isLoaded.set(true);
    }
  }

  async updateSettings(partial: Partial<AppSettings>): Promise<void> {
    const updated = { ...this._settings(), ...partial };
    this._settings.set(updated);
    try {
      await this.ipc.setSettings(partial);
    } catch (err) {
      console.error('[ConfigService] Failed to save settings:', err);
    }
  }

  private applyTheme(theme: ThemeMode): void {
    const body = document.body;
    body.classList.remove('theme-dark', 'theme-light');

    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      body.classList.add(prefersDark ? 'theme-dark' : 'theme-light');
    } else {
      body.classList.add(`theme-${theme}`);
    }
  }
}
