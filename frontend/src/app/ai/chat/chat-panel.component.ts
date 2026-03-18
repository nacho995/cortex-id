import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DecimalPipe, TitleCasePipe, UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { WebSocketService } from '../../core/websocket.service';
import { VoiceService } from '../../core/voice.service';
import { IpcService } from '../../core/ipc.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { ChatMessageComponent } from './chat-message.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { TokenBarComponent } from '../tokens/token-bar.component';
import { TokenMetricsService } from '../tokens/token-metrics.service';
import { AgentFlowService } from '../agents/agent-flow.service';
import { OrchestratorService } from '../orchestrator/orchestrator.service';
import { OrchestratorPlanComponent } from '../orchestrator/orchestrator-plan.component';
import { AgentMindMapComponent } from '../mind-map/agent-mind-map.component';
import {
  WsMessageType,
  type ChatMessagePayload,
  type StreamChunkPayload,
  type AgentStatusPayload,
  type ErrorPayload,
} from '@cortex-id/shared-types/ws/messages.types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  agentId?: string;
  isStreaming?: boolean;
}

export interface AgentStatus {
  agentId: string;
  name: string;
  status: 'idle' | 'thinking' | 'working' | 'done' | 'error';
  task?: string;
  progress?: number;
}

interface ModelOption {
  id: string;
  name: string;
  badgeColor: string;
  emoji: string;
  badge?: string;
  available: boolean;
}

interface ModelGroup {
  name: string;
  color: string;
  emoji: string;
  models: ModelOption[];
}

@Component({
  selector: 'app-chat-panel',
  standalone: true,
  imports: [DecimalPipe, TitleCasePipe, UpperCasePipe, FormsModule, ChatMessageComponent, IconComponent, TokenBarComponent, OrchestratorPlanComponent, AgentMindMapComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chat-panel">
      <!-- Header -->
      <div class="chat-header">
        <div class="chat-title">
          <app-icon name="chat" [size]="16" />
          <span>AI Chat</span>
        </div>

        <!-- Model Selector Button -->
        <button class="model-selector-btn" (click)="toggleModelSelector()">
          <span class="model-badge" [style.background]="activeModelBadgeColor()">
            {{ activeModelBadgeEmoji() }}
          </span>
          <span class="model-name">{{ activeModelName() }}</span>
          <app-icon name="chevron-down" [size]="12" />
        </button>
      </div>

      <!-- Token Metrics Bar -->
      <app-token-bar />

      <!-- Model Dropdown -->
      @if (showModelSelector()) {
        <div class="model-dropdown">
          <div class="model-dropdown-header">
            <span>Select Model</span>
            <button class="dropdown-close" (click)="showModelSelector.set(false)">
              <app-icon name="close" [size]="12" />
            </button>
          </div>

          @for (group of modelGroups; track group.name) {
            <div class="model-group">
              <div class="model-group-header">
                <span class="group-badge" [style.background]="group.color">{{ group.emoji }}</span>
                <span class="group-name">{{ group.name }}</span>
              </div>
              @for (model of group.models; track model.id) {
                <button
                  class="model-option"
                  [class.active]="activeModelId() === model.id"
                  (click)="selectModel(model)"
                >
                  <span class="model-option-name">{{ model.name }}</span>
                  @if (model.badge) {
                    <span class="model-option-badge" [class]="'badge-' + model.badge">
                      {{ model.badge | uppercase }}
                    </span>
                  }
                  @if (!model.available) {
                    <span class="model-configure">No key yet</span>
                  }
                </button>
              }
            </div>
          }
        </div>
      }

      <!-- Agent status bar -->
      @if (activeAgents().length > 0) {
        <div class="agent-status-bar">
          @for (agent of activeAgents(); track agent.agentId) {
            <div class="agent-chip" [class]="'agent-' + agent.status">
              <span class="agent-indicator"></span>
              <span class="agent-name">{{ agent.name }}</span>
              @if (agent.task) {
                <span class="agent-task">{{ agent.task }}</span>
              }
              @if (agent.progress !== undefined) {
                <div class="agent-progress">
                  <div
                    class="agent-progress-fill"
                    [style.width.%]="agent.progress"
                  ></div>
                </div>
              }
            </div>
          }
        </div>
      }

      <!-- Orchestrator Plan (Feature 4) — shown above messages when active -->
      @if (orchestrator.hasPlan()) {
        <app-orchestrator-plan />
      }

      <!-- Messages -->
      <div #messagesContainer class="messages-container">
        @if (messages().length === 0) {
          <div class="chat-empty">
            <app-icon name="chat" [size]="40" />
            <h3>Cortex AI</h3>
            <p>Ask me anything about your code. I can help you write, review, debug, and explain code.</p>
            <div class="suggestions">
              <button class="suggestion-btn" (click)="sendSuggestion('Explain this code')">
                Explain this code
              </button>
              <button class="suggestion-btn" (click)="sendSuggestion('Find bugs in this file')">
                Find bugs
              </button>
              <button class="suggestion-btn" (click)="sendSuggestion('Write unit tests')">
                Write tests
              </button>
            </div>
          </div>
        }

        @for (message of messages(); track message.id) {
          <app-chat-message [message]="message" />
        }

        @if (isStreaming()) {
          <div class="streaming-indicator">
            <div class="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <!-- Feature 6: Streaming token counter -->
            @if (streamingTokenEstimate() > 0) {
              <span class="streaming-token-count">
                ~{{ streamingTokenEstimate() | number }} tokens
              </span>
            }
          </div>
        }

        <!-- Feature 3: View Agent Map button — shown after task completion -->
        @if (showMindMapButton()) {
          <div class="mind-map-cta">
            <button class="mind-map-btn" (click)="showMindMap.set(true)">
              🗺️ View Agent Map
            </button>
          </div>
        }
      </div>

      <!-- Feature 3: Agent Mind Map Modal -->
      @if (showMindMap()) {
        <app-agent-mind-map (closed)="showMindMap.set(false)" />
      }

      <!-- Input area -->
      <div class="chat-input-area">
        <!-- Agent Mode Tabs + Duck + Level Slider -->
        <div class="mode-tabs">
          <button
            class="mode-tab"
            [class.active]="activeMode() === 'ask'"
            (click)="setMode('ask')"
            title="Ask questions about code — read-only, no changes"
          >
            <app-icon name="chat" [size]="13" />
            Ask
          </button>
          <button
            class="mode-tab"
            [class.active]="activeMode() === 'agent'"
            (click)="setMode('agent')"
            title="Autonomous agent — reads files, proposes changes, executes steps"
          >
            <app-icon name="terminal" [size]="13" />
            Agent
          </button>
          <button
            class="mode-tab"
            [class.active]="activeMode() === 'edit'"
            (click)="setMode('edit')"
            title="Direct edit — modifies the currently open file in Monaco"
          >
            <app-icon name="file" [size]="13" />
            Edit
          </button>

          <!-- Separator -->
          <div class="mode-separator"></div>

          <!-- INNOVACIÓN A: Rubber Duck Mode -->
          <button
            class="mode-tab duck-tab"
            [class.active]="rubberDuckMode()"
            (click)="toggleRubberDuck()"
            title="Rubber Duck — AI asks questions instead of giving answers"
          >
            🦆
          </button>


          <!-- INNOVACIÓN C: Explain Level Slider -->
          <div
            class="explain-level"
            title="Explanation detail: {{ explainLevel() < 30 ? 'Junior' : explainLevel() > 70 ? 'Senior' : 'Mid' }}"
          >
            <span class="level-label">{{ explainLevel() < 30 ? '👶' : explainLevel() > 70 ? '🧠' : '👤' }}</span>
            <input
              type="range"
              min="0"
              max="100"
              [value]="explainLevel()"
              (input)="explainLevel.set(+$any($event.target).value)"
              class="level-slider"
            />
          </div>
        </div>

        @if (voiceService.modelStatus() === 'loading') {
          <div class="voice-status">Loading speech model (first time only)...</div>
        }
        @if (voiceService.isListening()) {
          <div class="voice-transcript">
            @if (voiceService.transcript()) {
              "{{ voiceService.transcript() }}"
            } @else {
              Listening... speak now
            }
          </div>
        }
        @if (voiceService.isProcessing()) {
          <div class="voice-status">Transcribing...</div>
        }
        @if (voiceService.error()) {
          <div class="voice-error">{{ voiceService.error() }}</div>
        }

        <div class="input-wrapper">
          <textarea
            #inputEl
            class="chat-input"
            [(ngModel)]="inputText"
            [placeholder]="inputPlaceholder()"
            [disabled]="isStreaming()"
            rows="1"
            (keydown)="onKeyDown($event)"
            (input)="autoResize($event)"
          ></textarea>

          <button class="voice-btn"
            [class.listening]="voiceService.isListening()"
            [class.processing]="voiceService.isProcessing()"
            [disabled]="voiceService.modelStatus() === 'loading'"
            (click)="onVoiceClick()"
            title="Voice input (Alt+V)"
            aria-label="Voice input">
            @if (voiceService.isListening()) {
              <span class="voice-waves"><span></span><span></span><span></span></span>
            } @else if (voiceService.isProcessing()) {
              ⏳
            } @else if (voiceService.modelStatus() === 'loading') {
              ⌛
            } @else { 🎤 }
          </button>

          <button
            class="send-btn"
            [disabled]="!inputText.trim() || isStreaming()"
            (click)="sendMessage()"
            aria-label="Send message"
          >
            @if (isStreaming()) {
              <div class="send-spinner"></div>
            } @else {
              <app-icon name="send" [size]="16" />
            }
          </button>
        </div>

        <div class="input-hint">
          <span>Enter to send · Shift+Enter for new line · {{ activeMode() | titlecase }}</span>
          <button class="voice-toggle-btn" [class.active]="voiceService.voiceResponseEnabled()" (click)="toggleVoiceResponse()" [attr.aria-label]="voiceService.voiceResponseEnabled() ? 'Disable voice response' : 'Enable voice response'">{{ voiceService.voiceResponseEnabled() ? '🔊' : '🔇' }}</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .chat-panel {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--bg-secondary);
      overflow: hidden;
      position: relative;
    }

    /* Header */
    .chat-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      flex-shrink: 0;
      background: linear-gradient(180deg, var(--bg-secondary) 0%, color-mix(in srgb, var(--bg-secondary) 95%, var(--bg-primary)) 100%);
    }

    .chat-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-primary);
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }

    /* Model Selector */
    .model-selector-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: var(--radius-pill);
      color: var(--text-secondary);
      font-size: 11px;
      cursor: pointer;
      transition: all var(--transition-fast);
      font-family: var(--font-sans);

      &:hover {
        border-color: var(--accent-primary);
        background: rgba(166, 226, 46, 0.06);
        color: var(--text-primary);
      }
    }

    .model-badge {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      font-size: 10px;
    }

    .model-name { font-weight: 500; }

    /* Model Dropdown */
    .model-dropdown {
      position: absolute;
      top: 52px;
      right: 8px;
      width: 290px;
      max-height: 420px;
      background: color-mix(in srgb, var(--bg-surface) 95%, transparent);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg), 0 0 0 1px rgba(0, 0, 0, 0.2);
      z-index: 100;
      overflow-y: auto;
      animation: slideInDown 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .model-dropdown-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
      border-bottom: 1px solid var(--border-color);
    }

    .dropdown-close {
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 2px;
      border-radius: var(--radius-sm);

      &:hover { background: var(--bg-hover); color: var(--text-primary); }
    }

    .model-group { padding: 4px 0; }

    .model-group-header {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
    }

    .group-badge {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 8px;
    }

    .model-option {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 7px 14px 7px 34px;
      background: none;
      border: none;
      color: var(--text-primary);
      font-size: 12px;
      cursor: pointer;
      text-align: left;
      transition: background var(--transition-fast), color var(--transition-fast);
      font-family: var(--font-sans);

      &:hover:not(.disabled) { background: rgba(255, 255, 255, 0.06); }
      &.active {
        background: rgba(166, 226, 46, 0.12);
        color: var(--accent-primary);
        border-radius: 0;
        font-weight: 500;
      }
    }

    .model-option-name { flex: 1; }

    .model-option-badge {
      font-size: 9px;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 3px;
      text-transform: uppercase;
      letter-spacing: 0.03em;

      &.badge-premium { background: var(--accent-purple); color: var(--bg-tertiary); }
      &.badge-offline { background: var(--accent-success); color: var(--bg-tertiary); }
      &.badge-new { background: var(--accent-primary); color: var(--bg-tertiary); }
    }

    .model-configure {
      font-size: 10px;
      color: var(--accent-primary);
      margin-left: auto;
    }

    /* Agent status */
    .agent-status-bar {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 8px 12px;
      border-bottom: 1px solid var(--border-color);
      flex-shrink: 0;
    }

    .agent-chip {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      background: var(--bg-surface);
      border-radius: var(--radius-sm);
      font-size: 11px;

      &.agent-thinking .agent-indicator { background: var(--accent-warning); animation: pulse 1s infinite; }
      &.agent-working .agent-indicator { background: var(--accent-primary); animation: pulse 0.8s infinite; }
      &.agent-done .agent-indicator { background: var(--accent-success); }
      &.agent-error .agent-indicator { background: var(--accent-error); }
    }

    .agent-indicator {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--text-muted);
      flex-shrink: 0;
    }

    .agent-name {
      font-weight: 600;
      color: var(--text-secondary);
    }

    .agent-task {
      color: var(--text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
    }

    .agent-progress {
      width: 60px;
      height: 3px;
      background: var(--bg-hover);
      border-radius: 2px;
      overflow: hidden;
      flex-shrink: 0;
    }

    .agent-progress-fill {
      height: 100%;
      background: var(--accent-primary);
      border-radius: 2px;
      transition: width var(--transition-normal);
    }

    /* Messages */
    .messages-container {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
    }

    .chat-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px 20px;
      gap: 12px;
      color: var(--text-muted);
      text-align: center;

      h3 {
        font-size: 16px;
        font-weight: 600;
        color: var(--text-primary);
      }

      p {
        font-size: 12px;
        line-height: 1.6;
        max-width: 240px;
      }
    }

    .suggestions {
      display: flex;
      flex-direction: column;
      gap: 6px;
      width: 100%;
      margin-top: 8px;
    }

    .suggestion-btn {
      padding: 8px 14px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.07);
      border-radius: var(--radius-md);
      color: var(--text-secondary);
      font-size: 12px;
      cursor: pointer;
      text-align: left;
      transition: all var(--transition-fast);
      font-family: var(--font-sans);

      &:hover {
        background: rgba(166, 226, 46, 0.06);
        border-color: rgba(166, 226, 46, 0.2);
        color: var(--text-primary);
        transform: translateX(2px);
      }
    }

    /* Streaming indicator */
    .streaming-indicator {
      padding: 10px 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgba(166, 226, 46, 0.03);
      border-left: 2px solid rgba(166, 226, 46, 0.3);
      margin: 4px 8px;
      border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
      animation: fadeIn var(--transition-fast);
    }

    .typing-dots {
      display: flex;
      gap: 4px;
      align-items: center;

      span {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: var(--accent-primary);
        animation: typingBounce 1.4s infinite;

        &:nth-child(2) { animation-delay: 0.2s; }
        &:nth-child(3) { animation-delay: 0.4s; }
      }
    }

    @keyframes typingBounce {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.35; }
      30% { transform: translateY(-5px); opacity: 1; }
    }

    /* Feature 6: Streaming token counter */
    .streaming-token-count {
      font-size: 10px;
      font-family: var(--font-mono, monospace);
      color: var(--accent-primary);
      opacity: 0.8;
      animation: tokenFadeIn 0.3s ease;
    }

    @keyframes tokenFadeIn {
      from { opacity: 0; }
      to { opacity: 0.8; }
    }

    /* Feature 3: Mind map CTA */
    .mind-map-cta {
      padding: 8px 16px;
      display: flex;
      justify-content: center;
    }

    .mind-map-btn {
      padding: 6px 16px;
      background: var(--bg-surface);
      border: 1px solid var(--accent-primary);
      border-radius: var(--radius-md, 6px);
      color: var(--accent-primary);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease;
      animation: slideInUp 0.2s ease;

      &:hover {
        background: var(--accent-primary);
        color: var(--bg-tertiary);
      }
    }

    /* Input area */
    .chat-input-area {
      padding: 10px 12px;
      border-top: 1px solid var(--border-color);
      flex-shrink: 0;
    }

    /* Agent Mode Tabs */
    .mode-tabs {
      display: flex;
      align-items: center;
      gap: 2px;
      margin-bottom: 8px;
      background: rgba(0, 0, 0, 0.25);
      border-radius: var(--radius-lg);
      padding: 3px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .mode-tab {
      display: flex;
      align-items: center;
      gap: 5px;
      flex: 1;
      justify-content: center;
      padding: 5px 8px;
      background: transparent;
      border: none;
      border-radius: var(--radius-md);
      color: var(--text-muted);
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      transition: all var(--transition-fast);
      font-family: var(--font-sans);
      letter-spacing: 0.01em;

      &:hover {
        color: var(--text-primary);
        background: rgba(255, 255, 255, 0.04);
      }

      &.active {
        background: rgba(166, 226, 46, 0.1);
        color: var(--accent-primary);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(166, 226, 46, 0.15) inset;
        font-weight: 600;
      }
    }

    /* INNOVACIÓN A: Rubber Duck */
    .mode-separator {
      width: 1px;
      height: 20px;
      background: var(--border-color);
      margin: 0 4px;
      flex-shrink: 0;
    }

    .duck-tab {
      flex: 0 !important;
      padding: 5px 10px !important;
      font-size: 16px !important;

      &.active {
        background: rgba(255, 200, 0, 0.15) !important;
        border: 1px solid rgba(255, 200, 0, 0.3);
      }
    }

    /* INNOVACIÓN C: Explain Level Slider */
    .explain-level {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-left: auto;
      padding: 0 8px;
      flex-shrink: 0;

      .level-label { font-size: 14px; }

      .level-slider {
        width: 60px;
        height: 4px;
        accent-color: var(--accent-primary);
        cursor: pointer;
      }
    }

    .input-wrapper {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: var(--radius-lg);
      padding: 10px 12px;
      transition: border-color var(--transition-fast), box-shadow var(--transition-fast), background var(--transition-fast);

      &:focus-within {
        border-color: rgba(166, 226, 46, 0.4);
        background: rgba(166, 226, 46, 0.03);
        box-shadow: 0 0 0 3px rgba(166, 226, 46, 0.06);
      }
    }

    .chat-input {
      flex: 1;
      background: transparent;
      border: none;
      color: var(--text-primary);
      font-family: var(--font-sans);
      font-size: 13px;
      line-height: 1.6;
      resize: none;
      outline: none;
      max-height: 140px;
      overflow-y: auto;

      &::placeholder {
        color: var(--text-muted);
        font-style: italic;
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    .voice-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      background: transparent;
      border: 1px solid var(--border-color);
      border-radius: 50%;
      cursor: pointer;
      font-size: 14px;
      flex-shrink: 0;
      transition: all .15s ease;

      &:hover { border-color: var(--accent-primary); }

      &.listening {
        border-color: var(--cortex-red);
        background: rgba(255, 0, 64, 0.1);
        animation: pulseVoice 1.5s ease infinite;
      }

      &.processing {
        border-color: var(--accent-primary);
        background: rgba(166, 226, 46, 0.08);
        animation: pulseVoice 1.5s ease infinite;
        cursor: not-allowed;
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    .voice-waves {
      display: flex;
      align-items: center;
      gap: 2px;

      span {
        width: 2px;
        background: var(--cortex-red);
        border-radius: 2px;
        animation: waveA .8s ease infinite;

        &:nth-child(1) { height: 6px; animation-delay: 0s; }
        &:nth-child(2) { height: 12px; animation-delay: .15s; }
        &:nth-child(3) { height: 6px; animation-delay: .3s; }
      }
    }

    @keyframes waveA {
      0%, 100% { transform: scaleY(1); }
      50% { transform: scaleY(1.8); }
    }

    @keyframes pulseVoice {
      0%, 100% { box-shadow: 0 0 0 0 rgba(255, 0, 64, 0.3); }
      50% { box-shadow: 0 0 0 6px rgba(255, 0, 64, 0); }
    }

    .voice-transcript {
      padding: 6px 10px;
      background: rgba(255, 0, 64, 0.08);
      border: 1px solid rgba(255, 0, 64, 0.2);
      border-radius: var(--radius-sm);
      font-size: 12px;
      font-style: italic;
      color: var(--text-secondary);
      margin-bottom: 6px;
    }

    .voice-error {
      padding: 4px 12px;
      font-size: 11px;
      color: var(--accent-error);
      text-align: center;
    }

    .voice-status {
      padding: 4px 12px;
      font-size: 11px;
      color: var(--accent-primary);
      text-align: center;
      animation: pulse 1.5s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .voice-toggle-btn {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 12px;
      opacity: 0.5;

      &.active { opacity: 1; }
      &:hover { opacity: 0.8; }
    }

    .send-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: var(--cortex-gradient);
      border: none;
      border-radius: var(--radius-md);
      color: var(--bg-tertiary);
      cursor: pointer;
      flex-shrink: 0;
      transition: all var(--transition-fast);
      box-shadow: 0 2px 8px rgba(166, 226, 46, 0.2);

      &:disabled {
        opacity: 0.3;
        cursor: not-allowed;
        box-shadow: none;
      }

      &:not(:disabled):hover {
        transform: scale(1.08);
        box-shadow: 0 4px 12px rgba(166, 226, 46, 0.35);
      }

      &:not(:disabled):active {
        transform: scale(0.95);
      }
    }

    .send-spinner {
      width: 14px;
      height: 14px;
      border: 2px solid currentColor;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .input-hint {
      margin-top: 6px;
      font-size: 10px;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .duck-hint {
      color: rgba(255, 200, 0, 0.8);
      font-weight: 600;
    }

    @keyframes slideInUp {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `],
})
export class ChatPanelComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('inputEl') inputEl!: ElementRef<HTMLTextAreaElement>;

  /** Context injected from the workbench — current file, selection, project, full content */
  @Input() editorContext: {
    filePath?: string;
    selectedCode?: string;
    language?: string;
    projectPath?: string;
    fileContent?: string;
  } = {};

  /** Top-level file list of the open project — gives the AI project-wide awareness */
  @Input() projectFiles: string[] = [];

  @Output() applyEdit = new EventEmitter<{ filePath: string; content: string }>();
  @Output() fileCreated = new EventEmitter<string>(); // emits the full file path

  readonly wsService = inject(WebSocketService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();
  readonly voiceService = inject(VoiceService);
  private readonly ipc = inject(IpcService);
  private readonly toastService = inject(ToastService);
  private readonly tokenMetrics = inject(TokenMetricsService);
  readonly orchestrator = inject(OrchestratorService);
  private readonly agentFlow = inject(AgentFlowService);

  readonly messages = signal<ChatMessage[]>([]);
  readonly isStreaming = signal(false);
  readonly activeAgents = signal<AgentStatus[]>([]);

  // Feature 3: Mind map modal
  readonly showMindMap = signal(false);
  readonly showMindMapButton = computed(() =>
    !this.isStreaming() && this.agentFlow.nodes().length > 0
  );

  // Feature 6: Streaming token counter
  private streamingCharsCount = 0;
  readonly streamingTokenEstimate = signal(0);

  // Model selector
  readonly showModelSelector = signal(false);
  readonly activeModelId = signal('claude-sonnet-4-6');
  readonly activeMode = signal<'ask' | 'agent' | 'edit'>('ask');

  // INNOVACIÓN A: Rubber Duck Mode
  readonly rubberDuckMode = signal(false);

  // INNOVACIÓN C: Explain Level Slider (0=junior, 100=senior)
  readonly explainLevel = signal(50);


  private extractCodeBlock(content: string): string | null {
    const match = content.match(/```[\w]*\n([\s\S]*?)```/);
    return match ? match[1].trim() : null;
  }

  // Hardcoded for now — will come from WebSocket in future
  readonly allModels: ModelOption[] = [
    { id: 'claude-opus-4-6',    name: 'Cortex Max',     badgeColor: '#9b59b6', emoji: '🟣', badge: 'premium', available: true },
    { id: 'claude-sonnet-4-6',  name: 'Cortex Pro',     badgeColor: '#3498db', emoji: '🟣', available: true },
    { id: 'claude-haiku-4-5',   name: 'Cortex Fast',    badgeColor: '#2ecc71', emoji: '🟣', available: true },
    { id: 'gpt-4o',             name: 'GPT-4o',         badgeColor: '#f39c12', emoji: '🟠', available: false },
    { id: 'gpt-4o-mini',        name: 'GPT-4o Mini',    badgeColor: '#f5cba7', emoji: '🟠', available: false },
    { id: 'o3',                 name: 'O3 Reasoning',   badgeColor: '#e74c3c', emoji: '🟠', badge: 'premium', available: false },
    { id: 'codex-mini-latest',  name: 'Codex Mini',     badgeColor: '#f1c40f', emoji: '🟡', available: false },
    { id: 'gemini-2.5-pro',     name: 'Gemini 2.5 Pro', badgeColor: '#5dade2', emoji: '🔵', available: false },
    { id: 'gemini-2.5-flash',   name: 'Gemini Flash',   badgeColor: '#82e0aa', emoji: '🔵', available: false },
    { id: 'llama3',             name: 'Llama 3',        badgeColor: '#27ae60', emoji: '🟢', badge: 'offline', available: false },
    { id: 'codellama',          name: 'CodeLlama',      badgeColor: '#27ae60', emoji: '🟢', badge: 'offline', available: false },
  ];

  readonly modelGroups: ModelGroup[] = [
    {
      name: 'Anthropic',
      color: '#9b59b6',
      emoji: '🟣',
      models: this.allModels.filter(m => m.id.startsWith('claude')),
    },
    {
      name: 'OpenAI / Codex',
      color: '#f39c12',
      emoji: '🟠',
      models: this.allModels.filter(m => ['gpt-4o', 'gpt-4o-mini', 'o3', 'codex-mini-latest'].includes(m.id)),
    },
    {
      name: 'Google',
      color: '#5dade2',
      emoji: '🔵',
      models: this.allModels.filter(m => m.id.startsWith('gemini')),
    },
    {
      name: 'Local (Ollama)',
      color: '#27ae60',
      emoji: '🟢',
      models: this.allModels.filter(m => ['llama3', 'codellama'].includes(m.id)),
    },
  ];

  // Computed model display
  readonly activeModelName = computed(() => {
    const model = this.allModels.find(m => m.id === this.activeModelId());
    return model?.name ?? 'Select Model';
  });

  readonly activeModelBadgeColor = computed(() => {
    const model = this.allModels.find(m => m.id === this.activeModelId());
    return model?.badgeColor ?? '#888';
  });

  readonly activeModelBadgeEmoji = computed(() => {
    const model = this.allModels.find(m => m.id === this.activeModelId());
    return model?.emoji ?? '🤖';
  });

  readonly inputPlaceholder = computed(() => {
    if (this.rubberDuckMode()) return '🦆 Tell me what\'s confusing you...';
    switch (this.activeMode()) {
      case 'ask':   return 'Ask about your code...';
      case 'agent': return 'Describe a task for the agent...';
      case 'edit':  return 'Describe the edit to make...';
    }
  });

  inputText = '';
  private currentConversationId: string | undefined;
  private shouldScrollToBottom = false;
  private availabilityInterval: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.subscribeToMessages();
    // Restore last selected model from localStorage
    const savedModel = localStorage.getItem('cortex-active-model');
    if (savedModel && this.allModels.some(m => m.id === savedModel)) {
      this.activeModelId.set(savedModel);
      this.tokenMetrics.setActiveModel(savedModel);
    } else {
      // Sync default model to metrics service
      this.tokenMetrics.setActiveModel(this.activeModelId());
    }
    // Update model availability based on stored keys
    this.updateModelAvailability();

    // Re-check model availability every 5 seconds — catches key saves from Settings panel
    this.availabilityInterval = setInterval(() => {
      this.updateModelAvailability();
    }, 5000);

    // Re-sync provider keys after reconnection so backend keeps in-memory keys fresh
    this.wsService.connectionStatus$
      .pipe(takeUntil(this.destroy$))
      .subscribe((status) => {
        if (status === 'connected') {
          this.syncProviderKeysToBackend();
        }
      });

    // Also resync on init after WebSocket has time to connect
    setTimeout(() => {
      this.syncProviderKeysToBackend();
    }, 2000);
  }

  private getProviderFromModel(modelId: string): 'anthropic' | 'openai' | 'google' | null {
    if (modelId.startsWith('claude-')) return 'anthropic';
    if (modelId.startsWith('gpt-') || modelId.startsWith('o3') || modelId.startsWith('o4-') || modelId.startsWith('codex-')) return 'openai';
    if (modelId.startsWith('gemini-')) return 'google';
    return null;
  }

  private getApiKeyForActiveModel(): string | undefined {
    const provider = this.getProviderFromModel(this.activeModelId());
    if (!provider) return undefined;
    const key = localStorage.getItem(`cortex-api-key-${provider}`);
    return key || undefined;
  }

  private updateModelAvailability(): void {
    const providers = ['anthropic', 'openai', 'google'] as const;
    const hasKey: Record<string, boolean> = {};

    for (const p of providers) {
      hasKey[p] = !!localStorage.getItem(`cortex-api-key-${p}`);
    }

    // Update availability on each model
    for (const model of this.allModels) {
      const provider = this.getProviderFromModel(model.id);
      if (provider) {
        model.available = hasKey[provider] ?? false;
      }
      // Ollama models stay as-is (available: false by default until detected)
    }

    // Rebuild model groups to reflect updated availability
    this.modelGroups.forEach(group => {
      group.models = this.allModels.filter(m => {
        if (group.name === 'Anthropic') return m.id.startsWith('claude');
        if (group.name === 'OpenAI / Codex') return ['gpt-4o', 'gpt-4o-mini', 'o3', 'codex-mini-latest'].includes(m.id);
        if (group.name === 'Google') return m.id.startsWith('gemini');
        if (group.name === 'Local (Ollama)') return ['llama3', 'codellama'].includes(m.id);
        return false;
      });
    });
    this.cdr.markForCheck();
  }

  private syncProviderKeysToBackend(): void {
    const providers = ['anthropic', 'openai', 'google'] as const;
    for (const provider of providers) {
      const key = localStorage.getItem(`cortex-api-key-${provider}`);
      if (key) {
        this.wsService.send(
          this.wsService.createMessage(WsMessageType.API_KEY_SET, {
            provider,
            apiKey: key,
          }),
        );
        console.log(`[ChatPanel] Synced API key for ${provider} to backend`);
      }
    }
  }

  private subscribeToMessages(): void {
    /* Chat stream chunks */
    this.wsService
      .on<StreamChunkPayload>(WsMessageType.CHAT_STREAM_CHUNK)
      .pipe(takeUntil(this.destroy$))
      .subscribe((msg) => {
        const chunk = msg.payload;
        this.currentConversationId = chunk.conversationId;

        // Feature 6: Update streaming token estimate (~4 chars per token)
        this.streamingCharsCount += chunk.content.length;
        this.streamingTokenEstimate.set(Math.ceil(this.streamingCharsCount / 4));

        this.messages.update((msgs) => {
          const lastMsg = msgs[msgs.length - 1];
          if (lastMsg?.isStreaming) {
            return [
              ...msgs.slice(0, -1),
              { ...lastMsg, content: lastMsg.content + chunk.content },
            ];
          }
          return [
            ...msgs,
            {
              id: msg.id,
              role: 'assistant',
              content: chunk.content,
              timestamp: msg.timestamp,
              agentId: chunk.agentId,
              isStreaming: true,
            },
          ];
        });

        if (chunk.done) {
          // Reset streaming token counter when done
          this.streamingTokenEstimate.set(0);
          this.streamingCharsCount = 0;
          this.messages.update((msgs) => {
            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg?.isStreaming) {
              return [...msgs.slice(0, -1), { ...lastMsg, isStreaming: false }];
            }
            return msgs;
          });
          this.isStreaming.set(false);

          // Voice response: speak the last assistant message
          if (this.voiceService.voiceResponseEnabled()) {
            const msgs = this.messages();
            const lastAssistant = msgs[msgs.length - 1];
            if (lastAssistant?.role === 'assistant') {
              this.voiceService.speak(lastAssistant.content);
            }
          }

          // Agent mode: detect and execute <file> operations
          if (this.activeMode() === 'agent') {
            const msgs = this.messages();
            const lastAssistant = msgs[msgs.length - 1];
            if (lastAssistant?.role === 'assistant') {
              this.executeFileOperations(lastAssistant.content);
            }
          }

          // Edit mode: extract and apply code block
          if (this.activeMode() === 'edit') {
            setTimeout(() => {
              const msgs = this.messages();
              const last = [...msgs].reverse().find(m => m.role === 'assistant');
              if (last && this.editorContext.filePath) {
                const code = this.extractCodeBlock(last.content);
                if (code) {
                  this.applyEdit.emit({ filePath: this.editorContext.filePath, content: code });
                }
              }
            }, 200);
          }
        }

        this.shouldScrollToBottom = true;
        this.cdr.markForCheck();
      });

    /* Stream start */
    this.wsService
      .on<{ conversationId: string }>(WsMessageType.CHAT_STREAM_START)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.isStreaming.set(true);
        this.cdr.markForCheck();
      });

    /* Stream end */
    this.wsService
      .on<{ conversationId: string }>(WsMessageType.CHAT_STREAM_END)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.isStreaming.set(false);
        this.messages.update((msgs) => {
          const lastMsg = msgs[msgs.length - 1];
          if (lastMsg?.isStreaming) {
            return [...msgs.slice(0, -1), { ...lastMsg, isStreaming: false }];
          }
          return msgs;
        });
        this.cdr.markForCheck();
      });

    /* Errors */
    this.wsService
      .on<ErrorPayload>(WsMessageType.CHAT_ERROR)
      .pipe(takeUntil(this.destroy$))
      .subscribe((msg) => {
        this.isStreaming.set(false);
        this.messages.update((msgs) => [
          ...msgs,
          {
            id: msg.id,
            role: 'assistant' as const,
            content: `❌ **Error:** ${msg.payload.message}`,
            timestamp: msg.timestamp,
          },
        ]);
        this.shouldScrollToBottom = true;
        this.cdr.markForCheck();
      });

    /* Agent status */
    this.wsService
      .on<AgentStatusPayload>(WsMessageType.AGENT_STATUS)
      .pipe(takeUntil(this.destroy$))
      .subscribe((msg) => {
        const agent = msg.payload;
        this.activeAgents.update((agents) => {
          const idx = agents.findIndex((a) => a.agentId === agent.agentId);
          if (agent.status === 'done' || agent.status === 'error') {
            /* Remove after a delay */
            setTimeout(() => {
              this.activeAgents.update((a) =>
                a.filter((ag) => ag.agentId !== agent.agentId)
              );
              this.cdr.markForCheck();
            }, 2000);
          }
          if (idx === -1) {
            return [...agents, agent];
          }
          return agents.map((a) => (a.agentId === agent.agentId ? agent : a));
        });
        this.cdr.markForCheck();
      });
  }

  sendMessage(): void {
    const content = this.inputText.trim();
    if (!content || this.isStreaming()) return;

    // Get API key synchronously from localStorage
    const apiKey = this.getApiKeyForActiveModel();
    const provider = this.getProviderFromModel(this.activeModelId());

    // Add user message to UI immediately
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    this.messages.update(msgs => [...msgs, userMsg]);
    this.inputText = '';
    this.isStreaming.set(true);
    this.shouldScrollToBottom = true;

    // Feature 2 & 4: Start mock agent flow + orchestrator plan in agent mode
    if (this.activeMode() === 'agent') {
      this.agentFlow.startMockFlow();
      this.orchestrator.startMockPlan(content);
    }

    // Feature 6: Reset streaming token counter
    this.streamingCharsCount = 0;
    this.streamingTokenEstimate.set(0);

    // Reset textarea height
    if (this.inputEl?.nativeElement) {
      this.inputEl.nativeElement.style.height = 'auto';
    }

    // Check if key is needed but missing — show error, don't send
    if (provider && !apiKey) {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `⚠️ No API key configured for **${this.activeModelName()}**.\n\nGo to **⚙ Settings → AI Providers** → paste your API key → click Save.\n\nOr select a different model from the dropdown above.`,
        timestamp: Date.now(),
      };
      this.messages.update(msgs => [...msgs, errorMsg]);
      this.isStreaming.set(false);
      this.cdr.markForCheck();
      return;
    }

    // Build enriched message content with context
    let messageContent = content;

    // INNOVACIÓN A: Rubber Duck Mode prefix
    if (this.rubberDuckMode()) {
      messageContent = `[RUBBER_DUCK_MODE] ${messageContent}`;
    }

    // INNOVACIÓN C: Explain Level prefix
    if (this.explainLevel() < 30) {
      messageContent = `[EXPLAIN_LEVEL:junior] ${messageContent}`;
    } else if (this.explainLevel() > 70) {
      messageContent = `[EXPLAIN_LEVEL:senior] ${messageContent}`;
    }

    // Add project context info
    if (this.editorContext.projectPath) {
      messageContent += `\n\n[Project: ${this.editorContext.projectPath}]`;
    }
    if (this.editorContext.filePath) {
      messageContent += `\n[Current file: ${this.editorContext.filePath}]`;
    }
    if (this.editorContext.language) {
      messageContent += `\n[Language: ${this.editorContext.language}]`;
    }

    // Include project file list for AI project-wide awareness
    if (this.projectFiles.length > 0) {
      messageContent += `\n[Project files: ${this.projectFiles.slice(0, 30).join(', ')}]`;
    }

    // Agent mode: include full file content
    if (this.activeMode() === 'agent' && this.editorContext.fileContent) {
      messageContent += `\n\n--- CURRENT FILE (${this.editorContext.filePath}) ---\n${this.editorContext.fileContent}\n--- END FILE ---`;
    }

    // Edit mode: include file + instruction to return only modified code
    if (this.activeMode() === 'edit' && this.editorContext.fileContent) {
      messageContent += `\n\n--- FILE TO EDIT (${this.editorContext.filePath}) ---\n${this.editorContext.fileContent}\n--- END FILE ---\nReturn ONLY the complete modified file in a single code block.`;
    }

    // Track request for token metrics (input text captured before enrichment)
    this.tokenMetrics.trackRequest(messageContent);

    // Send via WebSocket — always include apiKey when available
    const payload: ChatMessagePayload = {
      content: messageContent,
      conversationId: this.currentConversationId,
      model: this.activeModelId(),
      mode: this.activeMode(),
      apiKey: apiKey || undefined,
      context: {
        filePath: this.editorContext.filePath || undefined,
        selectedCode: this.editorContext.selectedCode || undefined,
        language: this.editorContext.language || undefined,
      },
    };

    this.wsService.send(
      this.wsService.createMessage(WsMessageType.CHAT_MESSAGE, payload)
    );

    this.cdr.markForCheck();
  }

  sendSuggestion(text: string): void {
    this.inputText = text;
    this.sendMessage();
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  autoResize(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }

  toggleModelSelector(): void {
    this.showModelSelector.update(v => !v);
  }

  selectModel(model: ModelOption): void {
    // Allow selecting any model — key check happens at send time
    this.activeModelId.set(model.id);
    this.showModelSelector.set(false);
    localStorage.setItem('cortex-active-model', model.id);
    // Keep TokenMetricsService in sync with the active model
    this.tokenMetrics.setActiveModel(model.id);
  }

  setMode(mode: 'ask' | 'agent' | 'edit'): void {
    this.activeMode.set(mode);
  }

  toggleRubberDuck(): void {
    this.rubberDuckMode.update(v => !v);
  }

  async onVoiceClick(): Promise<void> {
    if (this.voiceService.isListening() || this.voiceService.isProcessing()) {
      this.voiceService.onEnd = () => {
        const text = this.voiceService.getFinalTranscript();
        if (text && text !== 'Processing speech...') {
          this.inputText = text;
          this.cdr.markForCheck();
        }
      };
      this.voiceService.stopListening();
    } else {
      this.voiceService.onEnd = () => {
        const text = this.voiceService.getFinalTranscript();
        if (text && text !== 'Processing speech...') {
          this.inputText = text;
          this.sendMessage();
          this.cdr.markForCheck();
        }
      };
      await this.voiceService.startListening();
    }
  }

  toggleVoiceResponse(): void {
    this.voiceService.voiceResponseEnabled.update(v => !v);
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  private scrollToBottom(): void {
    const container = this.messagesContainer?.nativeElement;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  private async executeFileOperations(content: string): Promise<void> {
    // Parse all <file path="..." action="create|modify|delete"> ... </file> tags
    const fileRegex =
      /<file\s+path="([^"]+)"\s+action="(create|modify|delete)">([\s\S]*?)<\/file>/g;
    let match: RegExpExecArray | null;
    const operations: { path: string; action: string; content: string }[] = [];

    while ((match = fileRegex.exec(content)) !== null) {
      operations.push({
        path: match[1],
        action: match[2],
        content: match[3].trim(),
      });
    }

    if (operations.length === 0) return;

    // Resolve project path — use editorContext, localStorage fallback, or home dir
    let projectPath = this.editorContext.projectPath || '';
    if (!projectPath) {
      projectPath = localStorage.getItem('cortex.lastProject') || '';
    }
    if (!projectPath) {
      // Last resort: use home directory
      try {
        const appInfo = await this.ipc.getAppInfo();
        projectPath = appInfo.dataPath?.replace('/.cortex-id', '') || '/tmp';
      } catch {
        projectPath = '/tmp';
      }
    }

    for (const op of operations) {
      const fullPath = op.path.startsWith('/')
        ? op.path
        : `${projectPath}/${op.path}`;

      try {
        if (op.action === 'create' || op.action === 'modify') {
          await this.ipc.writeFile({
            path: fullPath,
            content: op.content,
            createIfNotExists: true,
          });

          this.toastService.success(`${op.action === 'create' ? '📄 Created' : '✏️ Modified'}: ${op.path}`);

          // Notify workbench to open parent folder (if needed) and open the file
          this.fileCreated.emit(fullPath);

        } else if (op.action === 'delete') {
          // Delete via IPC
          await this.ipc.deletePath({ path: fullPath });
          this.toastService.info(`🗑️ Deleted: ${op.path}`);
        }
      } catch (err) {
        console.error(`[ChatPanel] File op failed: ${op.action} ${op.path}`, err);
        this.toastService.error(`❌ Failed to ${op.action}: ${op.path}`);
      }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.availabilityInterval !== null) {
      clearInterval(this.availabilityInterval);
    }
  }
}
