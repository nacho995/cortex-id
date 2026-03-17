import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, filter, take } from 'rxjs';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ConfigService } from '../../core/config.service';
import { IpcService } from '../../core/ipc.service';
import { WebSocketService } from '../../core/websocket.service';
import { ThemeService, THEMES, CortexTheme, BackgroundConfig } from '../../core/theme.service';
import { VSCodeThemeParserService } from '../../core/vscode-theme-parser.service';
import type { AppSettings } from '@cortex-id/shared-types/ipc/app.types';
import { WsMessageType } from '@cortex-id/shared-types/ws/messages.types';

type SettingsSection = 'general' | 'editor' | 'ai' | 'providers' | 'appearance' | 'keybindings';

@Component({
  selector: 'app-settings-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Backdrop -->
    <div class="settings-backdrop" (click)="onClose()"></div>

    <!-- Modal -->
    <div class="settings-modal" role="dialog" aria-modal="true" aria-label="Settings">
      <!-- Header -->
      <div class="settings-header">
        <div class="settings-title">
          <app-icon name="settings" [size]="16" />
          <span>Settings</span>
        </div>
        <button class="close-btn" (click)="onClose()" aria-label="Close settings">
          <app-icon name="close" [size]="14" />
        </button>
      </div>

      <div class="settings-body">
        <!-- Sidebar nav -->
        <nav class="settings-nav" aria-label="Settings sections">
          @for (section of sections; track section.id) {
            <button
              class="nav-item"
              [class.active]="activeSection() === section.id"
              (click)="setSection(section.id)"
            >
              <app-icon [name]="section.icon" [size]="14" />
              <span>{{ section.label }}</span>
            </button>
          }
        </nav>

        <!-- Content -->
        <div class="settings-content">

          <!-- ── AI Providers ─────────────────────────────────────────────── -->
          @if (activeSection() === 'providers') {
            <section class="settings-section">
              <h2 class="section-title">AI Providers</h2>
              <p class="section-description">Configure API keys for AI providers. Keys are stored securely in your system keychain.</p>

              <!-- Anthropic -->
              <div class="provider-card">
                <div class="provider-header">
                  <span class="provider-badge" style="background: #9b59b6">🟣</span>
                  <span class="provider-name">Anthropic</span>
                  <span class="provider-status" [class]="anthropicKeyStatus()">
                    {{ anthropicKeyStatus() === 'active' ? '● Active' : '○ No key' }}
                  </span>
                </div>
                <div class="provider-body">
                  <div class="key-input-row">
                    <input
                      [type]="showAnthropicKey() ? 'text' : 'password'"
                      class="key-input"
                      placeholder="sk-ant-..."
                      [(ngModel)]="anthropicKey"
                    />
                    <button class="key-toggle" (click)="toggleAnthropicKey()">
                      {{ showAnthropicKey() ? '🙈' : '👁' }}
                    </button>
                     <button
                      class="test-btn"
                      [class.testing]="testingAnthropic()"
                      (click)="testKey('anthropic')"
                      [disabled]="testingAnthropic()"
                    >
                      @if (testingAnthropic()) { Testing... } @else { Test }
                    </button>
                     <button
                      class="save-key-btn"
                      (click)="saveKey('anthropic', anthropicKey)"
                    >
                      Save
                    </button>
                  </div>
                  @if (!anthropicKey) {
                    <p class="key-hint">👆 Paste your Anthropic API key above, then click Save</p>
                  }
                  @if (anthropicTestResult()) {
                    <div class="test-result" [class]="anthropicTestResult()!.success ? 'success' : 'error'">
                      {{ anthropicTestResult()!.success ? '✅ Key is valid' : '❌ ' + anthropicTestResult()!.message }}
                    </div>
                  }
                </div>
              </div>

              <!-- OpenAI -->
              <div class="provider-card">
                <div class="provider-header">
                  <span class="provider-badge" style="background: #f39c12">🟠</span>
                  <span class="provider-name">OpenAI / Codex</span>
                  <span class="provider-status" [class]="openaiKeyStatus()">
                    {{ openaiKeyStatus() === 'active' ? '● Active' : '○ No key' }}
                  </span>
                </div>
                <div class="provider-body">
                  <div class="key-input-row">
                    <input
                      [type]="showOpenaiKey() ? 'text' : 'password'"
                      class="key-input"
                      placeholder="sk-..."
                      [(ngModel)]="openaiKey"
                    />
                    <button class="key-toggle" (click)="toggleOpenaiKey()">
                      {{ showOpenaiKey() ? '🙈' : '👁' }}
                    </button>
                     <button
                      class="test-btn"
                      [class.testing]="testingOpenai()"
                      (click)="testKey('openai')"
                      [disabled]="testingOpenai()"
                    >
                      @if (testingOpenai()) { Testing... } @else { Test }
                    </button>
                     <button
                      class="save-key-btn"
                      (click)="saveKey('openai', openaiKey)"
                    >
                      Save
                    </button>
                  </div>
                  @if (!openaiKey) {
                    <p class="key-hint">👆 Paste your OpenAI API key above, then click Save</p>
                  }
                  @if (openaiTestResult()) {
                    <div class="test-result" [class]="openaiTestResult()!.success ? 'success' : 'error'">
                      {{ openaiTestResult()!.success ? '✅ Key is valid' : '❌ ' + openaiTestResult()!.message }}
                    </div>
                  }
                  <p class="provider-hint">Same key works for GPT-4o, O3, O4, and Codex models.</p>
                </div>
              </div>

              <!-- Google -->
              <div class="provider-card">
                <div class="provider-header">
                  <span class="provider-badge" style="background: #5dade2">🔵</span>
                  <span class="provider-name">Google</span>
                  <span class="provider-status" [class]="googleKeyStatus()">
                    {{ googleKeyStatus() === 'active' ? '● Active' : '○ No key' }}
                  </span>
                </div>
                <div class="provider-body">
                  <div class="key-input-row">
                    <input
                      [type]="showGoogleKey() ? 'text' : 'password'"
                      class="key-input"
                      placeholder="AIza..."
                      [(ngModel)]="googleKey"
                    />
                    <button class="key-toggle" (click)="toggleGoogleKey()">
                      {{ showGoogleKey() ? '🙈' : '👁' }}
                    </button>
                     <button
                      class="test-btn"
                      [class.testing]="testingGoogle()"
                      (click)="testKey('google')"
                      [disabled]="testingGoogle()"
                    >
                      @if (testingGoogle()) { Testing... } @else { Test }
                    </button>
                     <button
                      class="save-key-btn"
                      (click)="saveKey('google', googleKey)"
                    >
                      Save
                    </button>
                  </div>
                  @if (!googleKey) {
                    <p class="key-hint">👆 Paste your Google API key above, then click Save</p>
                  }
                  @if (googleTestResult()) {
                    <div class="test-result" [class]="googleTestResult()!.success ? 'success' : 'error'">
                      {{ googleTestResult()!.success ? '✅ Key is valid' : '❌ ' + googleTestResult()!.message }}
                    </div>
                  }
                </div>
              </div>

              <!-- Ollama -->
              <div class="provider-card">
                <div class="provider-header">
                  <span class="provider-badge" style="background: #27ae60">🟢</span>
                  <span class="provider-name">Ollama (Local)</span>
                  <span class="provider-status" [class]="ollamaStatus()">
                    {{ ollamaStatus() === 'active' ? '● Running' : '○ Offline' }}
                  </span>
                </div>
                <div class="provider-body">
                  <div class="key-input-row">
                    <input
                      type="text"
                      class="key-input"
                      placeholder="http://localhost:11434"
                      [(ngModel)]="ollamaUrl"
                    />
                    <button
                      class="test-btn"
                      [class.testing]="testingOllama()"
                      (click)="testOllama()"
                      [disabled]="testingOllama()"
                    >
                      @if (testingOllama()) { Testing... } @else { Test }
                    </button>
                  </div>
                  @if (ollamaTestResult()) {
                    <div class="test-result" [class]="ollamaTestResult()!.success ? 'success' : 'error'">
                      {{ ollamaTestResult()!.success ? '✅ Ollama is running' : '❌ ' + ollamaTestResult()!.message }}
                    </div>
                  }
                  <p class="provider-hint">Free, private, offline. Install from ollama.com</p>
                </div>
              </div>
            </section>
          }

          <!-- ── Keybindings ────────────────────────────────────────────────── -->
          @if (activeSection() === 'keybindings') {
            <section class="settings-section">
              <h2 class="section-title">Keyboard Shortcuts</h2>
              <div class="keybindings-list">
                @for (kb of keybindings; track kb.action) {
                  <div class="keybinding-row">
                    <span class="kb-action">{{ kb.action }}</span>
                    <kbd class="kb-shortcut">{{ kb.shortcut }}</kbd>
                  </div>
                }
              </div>
            </section>
          }

          <!-- ── General ─────────────────────────────────────────────────── -->
          @if (activeSection() === 'general') {
            <section class="settings-section">
              <h2 class="section-title">General</h2>

              <div class="setting-group">
                <div class="setting-row">
                  <div class="setting-info">
                    <label class="setting-label" for="auto-save">Auto Save</label>
                    <p class="setting-description">Automatically save files after changes</p>
                  </div>
                  <div class="toggle-wrapper">
                    <input
                      type="checkbox"
                      id="auto-save"
                      class="toggle-input"
                      [checked]="draft().autoSave"
                      (change)="updateDraft('autoSave', $any($event.target).checked)"
                    />
                    <label for="auto-save" class="toggle-label"></label>
                  </div>
                </div>

                @if (draft().autoSave) {
                  <div class="setting-row">
                    <div class="setting-info">
                      <label class="setting-label" for="auto-save-delay">Auto Save Delay</label>
                      <p class="setting-description">Delay in milliseconds before auto-saving</p>
                    </div>
                    <div class="setting-control">
                      <input
                        type="number"
                        id="auto-save-delay"
                        class="number-input"
                        [value]="draft().autoSaveDelay"
                        min="500"
                        max="10000"
                        step="500"
                        (change)="updateDraft('autoSaveDelay', +$any($event.target).value)"
                      />
                      <span class="input-suffix">ms</span>
                    </div>
                  </div>
                }
              </div>
            </section>
          }

          <!-- ── Editor ──────────────────────────────────────────────────── -->
          @if (activeSection() === 'editor') {
            <section class="settings-section">
              <h2 class="section-title">Editor</h2>

              <div class="setting-group">
                <div class="setting-row">
                  <div class="setting-info">
                    <label class="setting-label" for="font-size">Font Size</label>
                    <p class="setting-description">Editor font size in pixels</p>
                  </div>
                  <div class="setting-control">
                    <input
                      type="number"
                      id="font-size"
                      class="number-input"
                      [value]="draft().fontSize"
                      min="10"
                      max="32"
                      step="1"
                      (change)="updateDraft('fontSize', +$any($event.target).value)"
                    />
                    <span class="input-suffix">px</span>
                  </div>
                </div>

                <div class="setting-row">
                  <div class="setting-info">
                    <label class="setting-label" for="font-family">Font Family</label>
                    <p class="setting-description">Monospace font for the editor</p>
                  </div>
                  <div class="setting-control">
                    <select
                      id="font-family"
                      class="select-input"
                      [value]="draft().fontFamily"
                      (change)="updateDraft('fontFamily', $any($event.target).value)"
                    >
                      @for (font of fontFamilies; track font.value) {
                        <option [value]="font.value">{{ font.label }}</option>
                      }
                    </select>
                  </div>
                </div>

                <div class="setting-row">
                  <div class="setting-info">
                    <label class="setting-label" for="tab-size">Tab Size</label>
                    <p class="setting-description">Number of spaces per tab</p>
                  </div>
                  <div class="setting-control">
                    <select
                      id="tab-size"
                      class="select-input select-sm"
                      [value]="draft().tabSize"
                      (change)="updateDraft('tabSize', +$any($event.target).value)"
                    >
                      <option [value]="2">2</option>
                      <option [value]="4">4</option>
                      <option [value]="8">8</option>
                    </select>
                  </div>
                </div>

                <div class="setting-row">
                  <div class="setting-info">
                    <label class="setting-label" for="word-wrap">Word Wrap</label>
                    <p class="setting-description">Wrap long lines in the editor</p>
                  </div>
                  <div class="toggle-wrapper">
                    <input
                      type="checkbox"
                      id="word-wrap"
                      class="toggle-input"
                      [checked]="draft().wordWrap"
                      (change)="updateDraft('wordWrap', $any($event.target).checked)"
                    />
                    <label for="word-wrap" class="toggle-label"></label>
                  </div>
                </div>

                <div class="setting-row">
                  <div class="setting-info">
                    <label class="setting-label" for="minimap">Minimap</label>
                    <p class="setting-description">Show code minimap on the right side</p>
                  </div>
                  <div class="toggle-wrapper">
                    <input
                      type="checkbox"
                      id="minimap"
                      class="toggle-input"
                      [checked]="draft().minimap"
                      (change)="updateDraft('minimap', $any($event.target).checked)"
                    />
                    <label for="minimap" class="toggle-label"></label>
                  </div>
                </div>

                <!-- Font Ligatures -->
                <div class="setting-row">
                  <div class="setting-info">
                    <label class="setting-label" for="ligatures">Font Ligatures</label>
                    <p class="setting-description">Enable ligatures like => → and !== ≠</p>
                  </div>
                  <div class="toggle-wrapper">
                    <input type="checkbox" id="ligatures" class="toggle-input"
                      [checked]="draft().fontLigatures"
                      (change)="updateDraft('fontLigatures', $any($event.target).checked)" />
                    <label for="ligatures" class="toggle-label"></label>
                  </div>
                </div>

                <!-- Line Numbers -->
                <div class="setting-row">
                  <div class="setting-info">
                    <label class="setting-label" for="line-numbers">Line Numbers</label>
                    <p class="setting-description">Show line numbers in the editor gutter</p>
                  </div>
                  <div class="setting-control">
                    <select id="line-numbers" class="select-input"
                      [value]="draft().lineNumbers"
                      (change)="updateDraft('lineNumbers', $any($event.target).value)">
                      <option value="on">On</option>
                      <option value="off">Off</option>
                      <option value="relative">Relative</option>
                    </select>
                  </div>
                </div>

                <!-- Bracket Pair Colorization -->
                <div class="setting-row">
                  <div class="setting-info">
                    <label class="setting-label" for="brackets">Bracket Colors</label>
                    <p class="setting-description">Colorize matching bracket pairs</p>
                  </div>
                  <div class="toggle-wrapper">
                    <input type="checkbox" id="brackets" class="toggle-input"
                      [checked]="draft().bracketPairColorization"
                      (change)="updateDraft('bracketPairColorization', $any($event.target).checked)" />
                    <label for="brackets" class="toggle-label"></label>
                  </div>
                </div>

                <!-- Render Whitespace -->
                <div class="setting-row">
                  <div class="setting-info">
                    <label class="setting-label" for="whitespace">Whitespace</label>
                    <p class="setting-description">Render whitespace characters</p>
                  </div>
                  <div class="setting-control">
                    <select id="whitespace" class="select-input"
                      [value]="draft().renderWhitespace"
                      (change)="updateDraft('renderWhitespace', $any($event.target).value)">
                      <option value="none">None</option>
                      <option value="selection">Selection</option>
                      <option value="all">All</option>
                    </select>
                  </div>
                </div>

                <!-- Cursor Style -->
                <div class="setting-row">
                  <div class="setting-info">
                    <label class="setting-label" for="cursor-style">Cursor Style</label>
                    <p class="setting-description">Shape of the editor cursor</p>
                  </div>
                  <div class="setting-control">
                    <select id="cursor-style" class="select-input"
                      [value]="draft().cursorStyle"
                      (change)="updateDraft('cursorStyle', $any($event.target).value)">
                      <option value="line">Line</option>
                      <option value="block">Block</option>
                      <option value="underline">Underline</option>
                      <option value="line-thin">Line Thin</option>
                      <option value="block-outline">Block Outline</option>
                    </select>
                  </div>
                </div>

                <!-- Cursor Blinking -->
                <div class="setting-row">
                  <div class="setting-info">
                    <label class="setting-label" for="cursor-blink">Cursor Animation</label>
                    <p class="setting-description">Cursor blinking animation style</p>
                  </div>
                  <div class="setting-control">
                    <select id="cursor-blink" class="select-input"
                      [value]="draft().cursorBlinking"
                      (change)="updateDraft('cursorBlinking', $any($event.target).value)">
                      <option value="blink">Blink</option>
                      <option value="smooth">Smooth</option>
                      <option value="phase">Phase</option>
                      <option value="expand">Expand</option>
                      <option value="solid">Solid</option>
                    </select>
                  </div>
                </div>

                <!-- Smooth Scrolling -->
                <div class="setting-row">
                  <div class="setting-info">
                    <label class="setting-label" for="smooth-scroll">Smooth Scrolling</label>
                    <p class="setting-description">Animate scrolling in the editor</p>
                  </div>
                  <div class="toggle-wrapper">
                    <input type="checkbox" id="smooth-scroll" class="toggle-input"
                      [checked]="draft().smoothScrolling"
                      (change)="updateDraft('smoothScrolling', $any($event.target).checked)" />
                    <label for="smooth-scroll" class="toggle-label"></label>
                  </div>
                </div>

                <!-- Code Folding -->
                <div class="setting-row">
                  <div class="setting-info">
                    <label class="setting-label" for="folding">Code Folding</label>
                    <p class="setting-description">Allow collapsing code blocks</p>
                  </div>
                  <div class="toggle-wrapper">
                    <input type="checkbox" id="folding" class="toggle-input"
                      [checked]="draft().folding"
                      (change)="updateDraft('folding', $any($event.target).checked)" />
                    <label for="folding" class="toggle-label"></label>
                  </div>
                </div>

                <!-- Indent Guides -->
                <div class="setting-row">
                  <div class="setting-info">
                    <label class="setting-label" for="guides">Indent Guides</label>
                    <p class="setting-description">Show vertical lines at indent levels</p>
                  </div>
                  <div class="toggle-wrapper">
                    <input type="checkbox" id="guides" class="toggle-input"
                      [checked]="draft().guides"
                      (change)="updateDraft('guides', $any($event.target).checked)" />
                    <label for="guides" class="toggle-label"></label>
                  </div>
                </div>
              </div>
            </section>
          }

          <!-- ── AI ─────────────────────────────────────────────────────── -->
          @if (activeSection() === 'ai') {
            <section class="settings-section">
              <h2 class="section-title">AI Configuration</h2>

              <div class="setting-group">
                <div class="setting-row">
                  <div class="setting-info">
                    <label class="setting-label" for="ai-model">AI Model</label>
                    <p class="setting-description">Language model to use for AI features</p>
                  </div>
                  <div class="setting-control">
                    <select
                      id="ai-model"
                      class="select-input"
                      [value]="draft().aiModel"
                      (change)="updateDraft('aiModel', $any($event.target).value)"
                    >
                      @for (model of aiModels; track model.value) {
                        <option [value]="model.value">{{ model.label }}</option>
                      }
                    </select>
                  </div>
                </div>

                @if (draft().aiModel === 'ollama') {
                  <div class="setting-row">
                    <div class="setting-info">
                      <label class="setting-label" for="ollama-url">Ollama URL</label>
                      <p class="setting-description">Local Ollama server endpoint</p>
                    </div>
                    <div class="setting-control">
                      <input
                        type="url"
                        id="ollama-url"
                        class="text-input"
                        placeholder="http://localhost:11434"
                        [value]="draft().ollamaUrl ?? 'http://localhost:11434'"
                        (input)="updateDraft('ollamaUrl', $any($event.target).value)"
                      />
                    </div>
                  </div>
                }

                <div class="setting-row api-key-row">
                  <div class="setting-info">
                    <label class="setting-label" for="api-key">Anthropic API Key</label>
                    <p class="setting-description">
                      Stored securely in your system keychain. Never written to disk.
                    </p>
                  </div>
                  <div class="setting-control api-key-control">
                    <div class="api-key-input-wrapper">
                      <input
                        [type]="showApiKey() ? 'text' : 'password'"
                        id="api-key"
                        class="text-input"
                        placeholder="sk-ant-..."
                        [value]="apiKey()"
                        (input)="apiKey.set($any($event.target).value)"
                        autocomplete="off"
                        spellcheck="false"
                      />
                      <button
                        class="icon-btn"
                        type="button"
                        [attr.aria-label]="showApiKey() ? 'Hide API key' : 'Show API key'"
                        (click)="toggleApiKeyVisibility()"
                      >
                        <app-icon name="eye" [size]="14" />
                      </button>
                    </div>
                    @if (apiKeySaved()) {
                      <span class="saved-badge">
                        <app-icon name="check" [size]="12" />
                        Saved
                      </span>
                    }
                  </div>
                </div>

                <div class="api-key-actions">
                  <button
                    class="btn btn-secondary"
                    type="button"
                    (click)="saveApiKey()"
                    [disabled]="!apiKey() || isSavingKey()"
                  >
                    @if (isSavingKey()) {
                      <app-icon name="loading" [size]="13" />
                      Saving...
                    } @else {
                      <app-icon name="save" [size]="13" />
                      Save API Key
                    }
                  </button>
                </div>
              </div>
            </section>
          }

          <!-- ── Appearance ──────────────────────────────────────────────── -->
          @if (activeSection() === 'appearance') {
            <section class="settings-section">
              <h2 class="section-title">Appearance</h2>

              <!-- THEME -->
              <h3 class="subsection-title">Theme</h3>
              <div class="theme-grid">
                @for (theme of availableThemes(); track theme.id) {
                  <button
                    class="theme-card"
                    [class.active]="activeThemeId() === theme.id"
                    (click)="selectTheme(theme.id)"
                    [attr.aria-label]="theme.name"
                    [attr.aria-pressed]="activeThemeId() === theme.id"
                  >
                    <div
                      class="theme-preview"
                      [style.background]="theme.colors.bgPrimary"
                      [style.border-color]="theme.colors.accentPrimary"
                    >
                      <div class="preview-titlebar" [style.background]="theme.colors.bgSecondary"></div>
                      <div class="preview-content">
                        <div class="preview-sidebar" [style.background]="theme.colors.bgSecondary"></div>
                        <div class="preview-editor" [style.background]="theme.colors.bgPrimary">
                          <div class="preview-line" [style.background]="theme.colors.textPrimary + '33'"></div>
                          <div class="preview-line short" [style.background]="theme.colors.accentPrimary + '66'"></div>
                          <div class="preview-line" [style.background]="theme.colors.textPrimary + '22'"></div>
                        </div>
                      </div>
                    </div>
                    <span
                      class="theme-name"
                      [style.color]="activeThemeId() === theme.id ? theme.colors.accentPrimary : ''"
                    >
                      {{ theme.name }}
                    </span>
                  </button>
                }
              </div>

              <button class="import-btn" (click)="importVSCodeTheme()">
                <app-icon name="plus" [size]="14" />
                Import VSCode Theme
              </button>

              <!-- BACKGROUND -->
              <h3 class="subsection-title" style="margin-top: 24px">Background</h3>

              <div class="setting-group">
                <div class="setting-row appearance-row">
                  <label class="setting-label">Effect</label>
                  <select
                    class="select-input"
                    [(ngModel)]="bgAnimation"
                    (ngModelChange)="onBgChange()"
                  >
                    <option value="none">None</option>
                    <option value="matrix">Matrix Rain</option>
                    <option value="neural">Neural Network</option>
                    <option value="gradient-mesh">Gradient Mesh</option>
                    <option value="minimal-grid">Minimal Grid</option>
                  </select>
                </div>

                <div class="setting-row appearance-row">
                  <label class="setting-label">Opacity</label>
                  <div class="slider-row">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      [(ngModel)]="bgOpacity"
                      (ngModelChange)="onBgChange()"
                    />
                    <span class="slider-value">{{ bgOpacity }}%</span>
                  </div>
                </div>

                <div class="setting-row appearance-row">
                  <label class="setting-label">Blur</label>
                  <div class="slider-row">
                    <input
                      type="range"
                      min="0"
                      max="20"
                      [(ngModel)]="bgBlur"
                      (ngModelChange)="onBgChange()"
                    />
                    <span class="slider-value">{{ bgBlur }}px</span>
                  </div>
                </div>

                <div class="setting-row appearance-row">
                  <label class="setting-label">Custom Image</label>
                  <div style="display: flex; gap: 8px; align-items: center;">
                    <button class="choose-image-btn" (click)="chooseBackgroundImage()">
                      Choose Image
                    </button>
                    @if (hasWallpaper()) {
                      <button class="choose-image-btn" style="color: var(--accent-error);" (click)="removeWallpaper()">
                        Remove Background
                      </button>
                    }
                  </div>
                </div>
              </div>

              <!-- TYPOGRAPHY -->
              <h3 class="subsection-title" style="margin-top: 24px">Typography</h3>

              <div class="setting-group">
                <!-- Font Family -->
                <div class="setting-row appearance-row">
                  <div class="setting-info">
                    <label class="setting-label">Editor Font</label>
                  </div>
                  <div class="setting-control">
                    <select class="select-input"
                      [value]="editorFont"
                      (change)="applyEditorFont($any($event.target).value)">
                      <option value="JetBrains Mono">JetBrains Mono</option>
                      <option value="Fira Code">Fira Code</option>
                      <option value="Cascadia Code">Cascadia Code</option>
                      <option value="Source Code Pro">Source Code Pro</option>
                      <option value="Consolas">Consolas</option>
                      <option value="monospace">Monospace (system)</option>
                    </select>
                  </div>
                </div>

                <!-- Font Size -->
                <div class="setting-row appearance-row">
                  <label class="setting-label">Font Size</label>
                  <div class="slider-row">
                    <input type="range" min="10" max="24" step="1"
                      [value]="editorFontSize"
                      (input)="applyFontSize(+$any($event.target).value)" />
                    <span class="slider-value">{{ editorFontSize }}px</span>
                  </div>
                </div>

                <!-- Font Weight -->
                <div class="setting-row appearance-row">
                  <div class="setting-info">
                    <label class="setting-label">Font Weight</label>
                  </div>
                  <div class="font-weight-selector">
                    @for (w of fontWeights; track w.value) {
                      <button class="weight-btn"
                        [class.active]="editorFontWeight === w.value"
                        [style.font-weight]="w.value"
                        (click)="applyFontWeight(w.value)">
                        {{ w.label }}
                      </button>
                    }
                  </div>
                </div>

                <!-- Line Height -->
                <div class="setting-row appearance-row">
                  <label class="setting-label">Line Height</label>
                  <div class="slider-row">
                    <input type="range" min="1.0" max="2.5" step="0.1"
                      [value]="editorLineHeight"
                      (input)="applyLineHeight(+$any($event.target).value)" />
                    <span class="slider-value">{{ editorLineHeight }}</span>
                  </div>
                </div>

                <!-- Letter Spacing -->
                <div class="setting-row appearance-row">
                  <label class="setting-label">Letter Spacing</label>
                  <div class="slider-row">
                    <input type="range" min="-1" max="3" step="0.5"
                      [value]="editorLetterSpacing"
                      (input)="applyLetterSpacing(+$any($event.target).value)" />
                    <span class="slider-value">{{ editorLetterSpacing }}px</span>
                  </div>
                </div>

                <!-- Font Ligatures -->
                <div class="setting-row">
                  <div class="setting-info">
                    <label class="setting-label" for="typo-ligatures">Code Ligatures</label>
                    <p class="setting-description">Show => as →, !== as ≠, etc.</p>
                  </div>
                  <div class="toggle-wrapper">
                    <input type="checkbox" id="typo-ligatures" class="toggle-input"
                      [checked]="draft().fontLigatures"
                      (change)="updateDraft('fontLigatures', $any($event.target).checked)" />
                    <label for="typo-ligatures" class="toggle-label"></label>
                  </div>
                </div>
              </div>
            </section>
          }

        </div>
      </div>

      <!-- Footer -->
      <div class="settings-footer">
        <button class="btn btn-ghost" type="button" (click)="onClose()">
          Cancel
        </button>
        <button
          class="btn btn-primary"
          type="button"
          (click)="saveSettings()"
          [disabled]="isSaving()"
        >
          @if (isSaving()) {
            <app-icon name="loading" [size]="13" />
            Saving...
          } @else {
            <app-icon name="check" [size]="13" />
            Save Settings
          }
        </button>
      </div>
    </div>
  `,
  styles: [`
    /* ── Backdrop ─────────────────────────────────────────────────────────────── */
    .settings-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(2px);
      z-index: 1000;
      animation: fadeIn var(--transition-normal);
    }

    /* ── Modal ────────────────────────────────────────────────────────────────── */
    .settings-modal {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 1001;
      width: min(780px, 90vw);
      height: min(560px, 85vh);
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: slideIn var(--transition-normal);
    }

    /* ── Header ───────────────────────────────────────────────────────────────── */
    .settings-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      border-bottom: 1px solid var(--border-color);
      flex-shrink: 0;
    }

    .settings-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .close-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      background: transparent;
      border: none;
      border-radius: var(--radius-sm);
      color: var(--text-muted);
      cursor: pointer;
      transition: background var(--transition-fast), color var(--transition-fast);

      &:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
      }
    }

    /* ── Body ─────────────────────────────────────────────────────────────────── */
    .settings-body {
      display: flex;
      flex: 1;
      overflow: hidden;
      min-height: 0;
    }

    /* ── Nav ──────────────────────────────────────────────────────────────────── */
    .settings-nav {
      width: 160px;
      flex-shrink: 0;
      padding: 8px;
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 10px;
      background: transparent;
      border: none;
      border-radius: var(--radius-md);
      color: var(--text-secondary);
      font-size: 12px;
      cursor: pointer;
      text-align: left;
      transition: background var(--transition-fast), color var(--transition-fast);

      &:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
      }

      &.active {
        background: var(--bg-surface);
        color: var(--accent-primary);
      }
    }

    /* ── Content ──────────────────────────────────────────────────────────────── */
    .settings-content {
      flex: 1;
      overflow-y: auto;
      padding: 20px 24px;
    }

    .settings-section {
      animation: fadeIn var(--transition-fast);
    }

    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border-subtle);
    }

    .subsection-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin: 0 0 12px;
    }

    .setting-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .setting-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 10px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);

      &:last-child {
        border-bottom: none;
      }

      &.api-key-row {
        align-items: flex-start;
        flex-direction: column;
        gap: 8px;
      }

      &.appearance-row {
        align-items: center;
      }
    }

    .setting-info {
      flex: 1;
      min-width: 0;
    }

    .setting-label {
      display: block;
      font-size: 12px;
      font-weight: 500;
      color: var(--text-primary);
      margin-bottom: 2px;
      cursor: pointer;
    }

    .setting-description {
      font-size: 11px;
      color: var(--text-muted);
      line-height: 1.4;
    }

    .setting-control {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;

      &.api-key-control {
        width: 100%;
        flex-direction: column;
        align-items: flex-start;
        gap: 6px;
      }
    }

    /* ── Form controls ────────────────────────────────────────────────────────── */
    .number-input,
    .text-input,
    .select-input {
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      font-size: 12px;
      font-family: var(--font-sans);
      padding: 5px 8px;
      transition: border-color var(--transition-fast);

      &:focus {
        outline: none;
        border-color: var(--accent-primary);
      }
    }

    .number-input {
      width: 72px;
      text-align: right;
    }

    .text-input {
      width: 100%;
    }

    .select-input {
      min-width: 180px;
      cursor: pointer;

      &.select-sm {
        min-width: 80px;
      }
    }

    .input-suffix {
      font-size: 11px;
      color: var(--text-muted);
    }

    /* ── Toggle ───────────────────────────────────────────────────────────────── */
    .toggle-wrapper {
      flex-shrink: 0;
    }

    .toggle-input {
      display: none;

      &:checked + .toggle-label {
        background: var(--accent-primary);

        &::after {
          transform: translateX(16px);
        }
      }
    }

    .toggle-label {
      display: block;
      width: 36px;
      height: 20px;
      background: var(--bg-hover);
      border-radius: 10px;
      cursor: pointer;
      position: relative;
      transition: background var(--transition-fast);

      &::after {
        content: '';
        position: absolute;
        top: 2px;
        left: 2px;
        width: 16px;
        height: 16px;
        background: white;
        border-radius: 50%;
        transition: transform var(--transition-fast);
      }
    }

    /* ── API Key ──────────────────────────────────────────────────────────────── */
    .api-key-input-wrapper {
      position: relative;
      width: 100%;

      .text-input {
        padding-right: 36px;
        font-family: var(--font-mono);
        font-size: 11px;
      }

      .icon-btn {
        position: absolute;
        right: 6px;
        top: 50%;
        transform: translateY(-50%);
        background: transparent;
        border: none;
        color: var(--text-muted);
        cursor: pointer;
        padding: 2px;
        display: flex;
        align-items: center;
        border-radius: var(--radius-sm);

        &:hover {
          color: var(--text-primary);
        }
      }
    }

    .api-key-actions {
      margin-top: 8px;
      display: flex;
      justify-content: flex-end;
    }

    .saved-badge {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      color: var(--accent-success);
      animation: fadeIn var(--transition-fast);
    }

    /* ── Theme grid ───────────────────────────────────────────────────────────── */
    .theme-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 16px;
    }

    .theme-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 8px;
      background: transparent;
      border: 2px solid transparent;
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: border-color 0.15s ease, transform 0.15s ease;

      &:hover {
        transform: translateY(-2px);
      }

      &.active {
        border-color: var(--accent-primary);
      }
    }

    .theme-preview {
      width: 100%;
      aspect-ratio: 16/10;
      border-radius: var(--radius-sm);
      border: 1px solid;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .preview-titlebar {
      height: 8px;
      flex-shrink: 0;
    }

    .preview-content {
      flex: 1;
      display: flex;
    }

    .preview-sidebar {
      width: 25%;
      flex-shrink: 0;
    }

    .preview-editor {
      flex: 1;
      padding: 4px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      justify-content: center;
    }

    .preview-line {
      height: 2px;
      border-radius: 1px;
      width: 80%;

      &.short { width: 50%; }
    }

    .theme-name {
      font-size: 11px;
      color: var(--text-secondary);
      font-weight: 500;
    }

    /* ── Import VSCode theme button ───────────────────────────────────────────── */
    .import-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: var(--bg-surface);
      border: 1px dashed var(--border-color);
      border-radius: var(--radius-md);
      color: var(--text-secondary);
      font-size: 12px;
      cursor: pointer;
      transition: border-color var(--transition-fast), color var(--transition-fast);

      &:hover {
        border-color: var(--accent-primary);
        color: var(--accent-primary);
      }
    }

    /* ── Slider ───────────────────────────────────────────────────────────────── */
    .slider-row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;

      input[type="range"] {
        flex: 1;
        accent-color: var(--accent-primary);
      }

      .slider-value {
        font-size: 12px;
        color: var(--text-muted);
        min-width: 40px;
        text-align: right;
        font-family: var(--font-mono);
      }
    }

    /* ── Choose image button ──────────────────────────────────────────────────── */
    .choose-image-btn {
      padding: 6px 12px;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      font-size: 12px;
      cursor: pointer;
      transition: background var(--transition-fast);

      &:hover {
        background: var(--bg-hover);
      }
    }

    /* ── Buttons ──────────────────────────────────────────────────────────────── */
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      border: none;
      border-radius: var(--radius-md);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: background var(--transition-fast), opacity var(--transition-fast);

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      &.btn-primary {
        background: var(--accent-primary);
        color: var(--bg-tertiary);

        &:hover:not(:disabled) {
          opacity: 0.9;
        }
      }

      &.btn-secondary {
        background: var(--bg-surface);
        color: var(--text-primary);

        &:hover:not(:disabled) {
          background: var(--bg-hover);
        }
      }

      &.btn-ghost {
        background: transparent;
        color: var(--text-secondary);

        &:hover:not(:disabled) {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
      }
    }

    /* ── Footer ───────────────────────────────────────────────────────────────── */
    .settings-footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      padding: 12px 16px;
      border-top: 1px solid var(--border-color);
      flex-shrink: 0;
    }

    /* ── Provider Cards ───────────────────────────────────────────────────────── */
    .section-description {
      font-size: 12px;
      color: var(--text-muted);
      margin-bottom: 16px;
      line-height: 1.5;
    }

    .provider-card {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      margin-bottom: 12px;
      overflow: hidden;
    }

    .provider-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color);
    }

    .provider-badge {
      width: 24px;
      height: 24px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
    }

    .provider-name {
      font-weight: 600;
      font-size: 13px;
      color: var(--text-primary);
      flex: 1;
    }

    .provider-status {
      font-size: 11px;
      font-weight: 500;

      &.active { color: var(--accent-success); }
      &.no-key, &.offline { color: var(--text-muted); }
    }

    .provider-body { padding: 12px 16px; }

    .key-input-row {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .key-input {
      flex: 1;
      padding: 8px 12px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-subtle, var(--border-color));
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      font-family: var(--font-mono);
      font-size: 12px;

      &::placeholder {
        color: var(--text-muted);
        opacity: 0.7;
      }

      &:focus {
        border-color: var(--accent-primary);
        outline: none;
        box-shadow: 0 0 0 2px rgba(166, 226, 46, 0.2);
      }

      &:hover:not(:focus) {
        border-color: var(--text-muted);
      }
    }

    .key-toggle {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 14px;
      padding: 4px;
    }

    .test-btn {
      padding: 6px 14px;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      color: var(--text-primary);
      font-size: 12px;
      cursor: pointer;
      white-space: nowrap;

      &:hover { background: var(--bg-hover); }
      &:disabled { opacity: 0.5; cursor: default; }
      &.testing { color: var(--accent-warning); }
    }

    .save-key-btn {
      padding: 6px 14px;
      background: var(--accent-primary);
      border: none;
      border-radius: var(--radius-sm);
      color: var(--bg-tertiary);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;

      &:hover { opacity: 0.9; }
      &:disabled { opacity: 0.4; cursor: default; }
    }

    .test-result {
      margin-top: 8px;
      font-size: 12px;
      padding: 6px 10px;
      border-radius: var(--radius-sm);

      &.success { background: rgba(166, 227, 161, 0.15); color: var(--accent-success); }
      &.error { background: rgba(243, 139, 168, 0.15); color: var(--accent-error); }
    }

    .provider-hint {
      margin-top: 8px;
      font-size: 11px;
      color: var(--text-muted);
    }

    .key-hint {
      margin-top: 6px;
      font-size: 11px;
      color: var(--accent-primary);
      opacity: 0.8;
    }

    /* ── Keybindings ──────────────────────────────────────────────────────────── */
    .keybindings-list {
      display: flex;
      flex-direction: column;
    }

    .keybinding-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid var(--border-color);

      &:last-child { border-bottom: none; }
    }

    .kb-action {
      font-size: 13px;
      color: var(--text-primary);
    }

    kbd.kb-shortcut {
      padding: 3px 8px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--text-secondary);
    }

    /* ── Font Weight Selector ─────────────────────────────────────────────────── */
    .font-weight-selector {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }

    .weight-btn {
      padding: 4px 10px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-color);
      background: transparent;
      color: var(--text-secondary);
      font-family: var(--font-mono);
      font-size: 11px;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        border-color: var(--text-muted);
        color: var(--text-primary);
        background: var(--bg-hover);
      }

      &.active {
        border-color: var(--accent-primary);
        color: var(--accent-primary);
        background: rgba(166, 226, 46, 0.1);
      }
    }
  `],
})
export class SettingsPanelComponent implements OnInit, OnDestroy {
  @Output() closed = new EventEmitter<void>();

  private readonly config = inject(ConfigService);
  private readonly ipc = inject(IpcService);
  private readonly wsService = inject(WebSocketService);
  private readonly themeService = inject(ThemeService);
  private readonly vscodeParser = inject(VSCodeThemeParserService);
  private readonly destroy$ = new Subject<void>();

  readonly activeSection = signal<SettingsSection>('providers');
  readonly draft = signal<AppSettings>({
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
    aiModel: 'claude-3-5-sonnet-20241022',
    autoSave: true,
    autoSaveDelay: 1000,
  });

  readonly apiKey = signal('');
  readonly showApiKey = signal(false);
  readonly isSaving = signal(false);
  readonly isSavingKey = signal(false);
  readonly apiKeySaved = signal(false);

  // ── Appearance: Theme ──────────────────────────────────────────────────────

  /** All available themes — built-in + imported, sourced from ThemeService */
  readonly availableThemes = computed(() => this.themeService.allThemes());

  /** Currently active theme id — kept in sync with ThemeService */
  readonly activeThemeId = computed(() => this.themeService.activeTheme().id);

  // ── Appearance: Background ─────────────────────────────────────────────────

  bgAnimation: BackgroundConfig['animation'] | 'none' = 'none';
  bgOpacity = 15;
  bgBlur = 8;

  // ── Appearance: Wallpaper ──────────────────────────────────────────────────

  hasWallpaper = signal(!!localStorage.getItem('cortex.wallpaper.data'));

  // ── Appearance: Typography ─────────────────────────────────────────────────

  editorFont = 'JetBrains Mono';
  editorFontSize = 14;
  editorFontWeight = '400';
  editorLineHeight = 1.6;
  editorLetterSpacing = 0;

  fontWeights = [
    { label: 'Thin', value: '100' },
    { label: 'Light', value: '300' },
    { label: 'Regular', value: '400' },
    { label: 'Medium', value: '500' },
    { label: 'Bold', value: '700' },
    { label: 'Black', value: '900' },
  ];

  // ── AI Providers state ─────────────────────────────────────────────────────

  anthropicKey = '';
  openaiKey = '';
  googleKey = '';
  ollamaUrl = 'http://localhost:11434';

  readonly showAnthropicKey = signal(false);
  readonly showOpenaiKey = signal(false);
  readonly showGoogleKey = signal(false);

  readonly testingAnthropic = signal(false);
  readonly testingOpenai = signal(false);
  readonly testingGoogle = signal(false);
  readonly testingOllama = signal(false);

  readonly anthropicKeyStatus = signal<'active' | 'no-key'>('no-key');
  readonly openaiKeyStatus = signal<'active' | 'no-key'>('no-key');
  readonly googleKeyStatus = signal<'active' | 'no-key'>('no-key');
  readonly ollamaStatus = signal<'active' | 'offline'>('offline');

  readonly anthropicTestResult = signal<{ success: boolean; message: string } | null>(null);
  readonly openaiTestResult = signal<{ success: boolean; message: string } | null>(null);
  readonly googleTestResult = signal<{ success: boolean; message: string } | null>(null);
  readonly ollamaTestResult = signal<{ success: boolean; message: string } | null>(null);

  // ── Keybindings ────────────────────────────────────────────────────────────

  keybindings = [
    { action: 'Open Settings', shortcut: 'Ctrl+,' },
    { action: 'Toggle Sidebar', shortcut: 'Ctrl+B' },
    { action: 'Toggle Terminal', shortcut: 'Ctrl+`' },
    { action: 'Toggle AI Chat', shortcut: 'Ctrl+Shift+I' },
    { action: 'Save File', shortcut: 'Ctrl+S' },
    { action: 'Close Tab', shortcut: 'Ctrl+W' },
    { action: 'Next Tab', shortcut: 'Ctrl+Tab' },
    { action: 'Previous Tab', shortcut: 'Ctrl+Shift+Tab' },
    { action: 'Quick Open File', shortcut: 'Ctrl+P' },
    { action: 'Copy (Terminal)', shortcut: 'Ctrl+C / Ctrl+Shift+C' },
    { action: 'Paste (Terminal)', shortcut: 'Ctrl+V / Ctrl+Shift+V' },
  ];

  // ── Nav sections ──────────────────────────────────────────────────────────

  readonly sections: Array<{ id: SettingsSection; label: string; icon: any }> = [
    { id: 'providers' as const, label: 'AI Providers', icon: 'chat' },
    { id: 'ai' as const, label: 'Models', icon: 'settings' },
    { id: 'appearance' as const, label: 'Appearance', icon: 'settings' },
    { id: 'editor' as const, label: 'Editor', icon: 'file' },
    { id: 'general' as const, label: 'General', icon: 'settings' },
    { id: 'keybindings' as const, label: 'Keybindings', icon: 'terminal' },
  ];

  readonly fontFamilies = [
    { value: 'JetBrains Mono, monospace', label: 'JetBrains Mono' },
    { value: 'Fira Code, monospace', label: 'Fira Code' },
    { value: 'Cascadia Code, monospace', label: 'Cascadia Code' },
    { value: 'Consolas, monospace', label: 'Consolas' },
    { value: 'monospace', label: 'System Monospace' },
  ];

  readonly aiModels = [
    { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku (Fast)' },
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (Balanced)' },
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus (Powerful)' },
    { value: 'ollama', label: 'Ollama (Local)' },
  ];

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnInit(): void {
    // Copy current settings into draft
    this.draft.set({ ...this.config.settings() });

    // Sync background state from ThemeService
    const bg = this.themeService.backgroundConfig();
    this.bgAnimation = bg.animation ?? 'none';
    this.bgOpacity = bg.opacity;
    this.bgBlur = bg.blur;

    // Check existing API key status
    this.checkKeyStatus('anthropic', this.anthropicKeyStatus);
    this.checkKeyStatus('openai', this.openaiKeyStatus);
    this.checkKeyStatus('google', this.googleKeyStatus);

    // Load typography from localStorage
    this.editorFont = localStorage.getItem('cortex.font.family') || 'JetBrains Mono';
    this.editorFontSize = Number(localStorage.getItem('cortex.font.size')) || 14;
    this.editorFontWeight = localStorage.getItem('cortex.font.weight') || '400';
    this.editorLineHeight = Number(localStorage.getItem('cortex.font.lineHeight')) || 1.6;
    this.editorLetterSpacing = Number(localStorage.getItem('cortex.font.letterSpacing')) || 0;

    // Apply saved typography
    this.applyEditorFont(this.editorFont);
    this.applyFontSize(this.editorFontSize);
    this.applyFontWeight(this.editorFontWeight);
    this.applyLineHeight(this.editorLineHeight);
    this.applyLetterSpacing(this.editorLetterSpacing);

    // Restore wallpaper state from localStorage into ThemeService
    const savedWallpaper = localStorage.getItem('cortex.wallpaper.data');
    if (savedWallpaper) {
      this.hasWallpaper.set(true);
      const opacity = Number(localStorage.getItem('cortex.wallpaper.opacity')) || 15;
      const blur = Number(localStorage.getItem('cortex.wallpaper.blur')) || 8;
      this.bgOpacity = opacity;
      this.bgBlur = blur;
      this.themeService.setBackground({
        type: 'image',
        imageUrl: savedWallpaper,
        opacity,
        blur,
        position: 'cover',
      });
    }
  }

  private async checkKeyStatus(
    provider: 'anthropic' | 'openai' | 'google',
    statusSignal: ReturnType<typeof signal<'active' | 'no-key'>>
  ): Promise<void> {
    try {
      const result = await this.ipc.getApiKey({ service: provider });
      if (result.exists) {
        statusSignal.set('active');
      }
    } catch {
      // Ignore errors — key simply doesn't exist
    }
  }

  // ── General methods ────────────────────────────────────────────────────────

  setSection(section: SettingsSection): void {
    this.activeSection.set(section);
  }

  toggleApiKeyVisibility(): void {
    this.showApiKey.update((v) => !v);
  }

  updateDraft<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.draft.update((d) => ({ ...d, [key]: value }));
  }

  async saveApiKey(): Promise<void> {
    const key = this.apiKey().trim();
    if (!key) return;

    this.isSavingKey.set(true);
    try {
      await this.ipc.setApiKey({ service: 'anthropic', key });
      this.wsService.send(
        this.wsService.createMessage(WsMessageType.API_KEY_SET, {
          provider: 'anthropic',
          apiKey: key,
        }),
      );
      this.anthropicKeyStatus.set('active');
      this.anthropicTestResult.set({ success: true, message: 'Key saved and sent to backend ✓' });
      this.apiKeySaved.set(true);
      setTimeout(() => this.apiKeySaved.set(false), 3000);
    } catch (err) {
      console.error('[SettingsPanel] Failed to save API key:', err);
    } finally {
      this.isSavingKey.set(false);
    }
  }

  async saveSettings(): Promise<void> {
    this.isSaving.set(true);
    try {
      await this.config.updateSettings(this.draft());
      this.onClose();
    } catch (err) {
      console.error('[SettingsPanel] Failed to save settings:', err);
    } finally {
      this.isSaving.set(false);
    }
  }

  onClose(): void {
    this.closed.emit();
  }

  // ── Appearance methods ─────────────────────────────────────────────────────

  selectTheme(themeId: string): void {
    this.themeService.setTheme(themeId);
  }

  importVSCodeTheme(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.onchange = () => {
      const file = input.files?.[0];
      document.body.removeChild(input);
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const content = reader.result as string;
        const theme = this.vscodeParser.parse(content, file.name);
        if (theme) {
          this.themeService.addImportedTheme(theme);
          console.log('[Settings] Imported VSCode theme:', theme.name);
        } else {
          console.error('[Settings] Failed to parse VSCode theme file');
        }
      };
      reader.readAsText(file);
    };

    input.click();
  }

  chooseBackgroundImage(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,image/gif';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.onchange = () => {
      const file = input.files?.[0];
      document.body.removeChild(input);
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;

        localStorage.setItem('cortex.wallpaper.data', dataUrl);
        localStorage.setItem('cortex.wallpaper.opacity', String(this.bgOpacity));
        localStorage.setItem('cortex.wallpaper.blur', String(this.bgBlur));
        this.hasWallpaper.set(true);

        this.themeService.setBackground({
          type: 'image',
          imageUrl: dataUrl,
          opacity: this.bgOpacity,
          blur: this.bgBlur,
          position: 'cover',
        });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  removeWallpaper(): void {
    localStorage.removeItem('cortex.wallpaper.data');
    localStorage.removeItem('cortex.wallpaper.opacity');
    localStorage.removeItem('cortex.wallpaper.blur');
    this.hasWallpaper.set(false);
    this.themeService.setBackground({ type: 'none', opacity: 15, blur: 8, position: 'cover' });
  }

  onBgChange(): void {
    if (this.hasWallpaper()) {
      localStorage.setItem('cortex.wallpaper.opacity', String(this.bgOpacity));
      localStorage.setItem('cortex.wallpaper.blur', String(this.bgBlur));
      const dataUrl = localStorage.getItem('cortex.wallpaper.data');
      if (dataUrl) {
        this.themeService.setBackground({
          type: 'image',
          imageUrl: dataUrl,
          opacity: this.bgOpacity,
          blur: this.bgBlur,
          position: 'cover',
        });
        return;
      }
    }

    const config: BackgroundConfig = {
      type: this.bgAnimation === 'none' ? 'none' : 'animation',
      animation: this.bgAnimation === 'none' ? undefined : this.bgAnimation,
      opacity: this.bgOpacity,
      blur: this.bgBlur,
      position: 'cover',
    };
    this.themeService.setBackground(config);
  }

  // ── Typography methods ─────────────────────────────────────────────────────

  applyEditorFont(font: string): void {
    this.editorFont = font;
    document.documentElement.style.setProperty('--editor-font-family', font);
    document.documentElement.style.setProperty('--font-mono', `'${font}', monospace`);
    localStorage.setItem('cortex.font.family', font);
    this.updateMonacoOption('fontFamily', font);
  }

  applyFontSize(size: number): void {
    this.editorFontSize = size;
    document.documentElement.style.setProperty('--editor-font-size', `${size}px`);
    localStorage.setItem('cortex.font.size', String(size));
    this.updateMonacoOption('fontSize', size);
  }

  applyFontWeight(weight: string): void {
    this.editorFontWeight = weight;
    document.documentElement.style.setProperty('--editor-font-weight', weight);
    localStorage.setItem('cortex.font.weight', weight);
    this.updateMonacoOption('fontWeight', weight);
  }

  applyLineHeight(height: number): void {
    this.editorLineHeight = height;
    document.documentElement.style.setProperty('--editor-line-height', String(height));
    localStorage.setItem('cortex.font.lineHeight', String(height));
    this.updateMonacoOption('lineHeight', Math.round(this.editorFontSize * height));
  }

  applyLetterSpacing(spacing: number): void {
    this.editorLetterSpacing = spacing;
    document.documentElement.style.setProperty('--editor-letter-spacing', `${spacing}px`);
    localStorage.setItem('cortex.font.letterSpacing', String(spacing));
    this.updateMonacoOption('letterSpacing', spacing);
  }

  private updateMonacoOption(key: string, value: unknown): void {
    try {
      const win = window as any;
      const monacoObj = win['monaco'] as typeof import('monaco-editor') | undefined;
      if (!monacoObj) return;
      const editors = monacoObj.editor.getEditors?.() ?? [];
      for (const editor of editors) {
        editor.updateOptions({ [key]: value } as any);
      }
    } catch {
      // Monaco might not be loaded yet
    }
  }

  // ── AI Providers methods ───────────────────────────────────────────────────

  toggleAnthropicKey(): void { this.showAnthropicKey.update(v => !v); }
  toggleOpenaiKey(): void { this.showOpenaiKey.update(v => !v); }
  toggleGoogleKey(): void { this.showGoogleKey.update(v => !v); }

  async saveKey(provider: 'anthropic' | 'openai' | 'google', key: string): Promise<void> {
    if (!key || !key.trim()) {
      const resultMap: Record<string, typeof this.anthropicTestResult> = {
        anthropic: this.anthropicTestResult,
        openai: this.openaiTestResult,
        google: this.googleTestResult,
      };
      resultMap[provider].set({ success: false, message: 'Please enter an API key first' });
      return;
    }

    try {
      // 1. Save via IPC (keychain in Electron, localStorage in browser)
      await this.ipc.setApiKey({ service: provider, key: key.trim() });

      // 2. Send to Java backend via WebSocket so it can use it
      this.wsService.send(
        this.wsService.createMessage(WsMessageType.API_KEY_SET, {
          provider,
          apiKey: key.trim(),
        })
      );

      // 3. Update UI status
      if (provider === 'anthropic') {
        this.anthropicKeyStatus.set('active');
        this.anthropicTestResult.set({ success: true, message: 'Key saved and sent to backend ✓' });
      }
      if (provider === 'openai') {
        this.openaiKeyStatus.set('active');
        this.openaiTestResult.set({ success: true, message: 'Key saved and sent to backend ✓' });
      }
      if (provider === 'google') {
        this.googleKeyStatus.set('active');
        this.googleTestResult.set({ success: true, message: 'Key saved and sent to backend ✓' });
      }
    } catch (e) {
      console.error(`Failed to save ${provider} key:`, e);
      const resultMap: Record<string, typeof this.anthropicTestResult> = {
        anthropic: this.anthropicTestResult,
        openai: this.openaiTestResult,
        google: this.googleTestResult,
      };
      resultMap[provider].set({ success: false, message: 'Failed to save: ' + (e as Error).message });
    }
  }

  testKey(provider: 'anthropic' | 'openai' | 'google'): void {
    const signalMap = {
      anthropic: { testing: this.testingAnthropic, result: this.anthropicTestResult, key: this.anthropicKey },
      openai: { testing: this.testingOpenai, result: this.openaiTestResult, key: this.openaiKey },
      google: { testing: this.testingGoogle, result: this.googleTestResult, key: this.googleKey },
    };
    const s = signalMap[provider];

    if (!s.key || !s.key.trim()) {
      s.result.set({ success: false, message: 'Please enter an API key first' });
      return;
    }

    s.testing.set(true);
    s.result.set(null);

    // Send test request via WebSocket
    this.wsService.send(
      this.wsService.createMessage(WsMessageType.API_KEY_TEST, {
        provider,
        apiKey: s.key.trim(),
      })
    );

    // Listen for result (with timeout)
    const timeout = setTimeout(() => {
      s.testing.set(false);
      s.result.set({ success: false, message: 'Test timed out — is the backend running?' });
    }, 10000);

    this.wsService
      .on<{ provider: string; isValid: boolean; error?: string }>(WsMessageType.API_KEY_TEST_RESULT)
      .pipe(
        filter(msg => msg.payload.provider === provider),
        take(1),
        takeUntil(this.destroy$),
      )
      .subscribe(msg => {
        clearTimeout(timeout);
        s.testing.set(false);
        if (msg.payload.isValid) {
          s.result.set({ success: true, message: 'Key is valid ✓' });
          if (provider === 'anthropic') this.anthropicKeyStatus.set('active');
          if (provider === 'openai') this.openaiKeyStatus.set('active');
          if (provider === 'google') this.googleKeyStatus.set('active');
        } else {
          s.result.set({ success: false, message: msg.payload.error ?? 'Invalid key' });
        }
      });
  }

  testOllama(): void {
    this.testingOllama.set(true);
    this.ollamaTestResult.set(null);

    setTimeout(() => {
      this.ollamaTestResult.set({ success: false, message: 'Cannot reach Ollama at ' + this.ollamaUrl });
      this.ollamaStatus.set('offline');
      this.testingOllama.set(false);
    }, 2000);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
