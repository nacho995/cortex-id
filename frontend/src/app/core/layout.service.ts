import { Injectable, computed, signal } from '@angular/core';

export type LayoutMode = 'agent' | 'editor';

/**
 * LayoutService — global signal-based service for the IDE layout mode.
 *
 * Agent mode:  [AgentFlow sidebar | Chat center | Editor right]
 * Editor mode: [FileExplorer sidebar | Editor center | Chat right] (default)
 *
 * Persists selection to localStorage.
 */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  private readonly _mode = signal<LayoutMode>(this.loadSavedMode());

  // ── Public signals ────────────────────────────────────────────────────────

  readonly mode = this._mode.asReadonly();

  readonly isAgentMode = computed(() => this._mode() === 'agent');
  readonly isEditorMode = computed(() => this._mode() === 'editor');

  // ── Public API ────────────────────────────────────────────────────────────

  setMode(mode: LayoutMode): void {
    this._mode.set(mode);
    localStorage.setItem('cortex-layout-mode', mode);
  }

  toggle(): void {
    this.setMode(this._mode() === 'agent' ? 'editor' : 'agent');
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private loadSavedMode(): LayoutMode {
    const saved = localStorage.getItem('cortex-layout-mode');
    return saved === 'agent' ? 'agent' : 'editor';
  }
}
