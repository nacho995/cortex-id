import {
  ChangeDetectionStrategy,
  Component,
  Input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import type { ChatMessage } from './chat-panel.component';

@Component({
  selector: 'app-chat-message',
  standalone: true,
  imports: [CommonModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="message" [class.user]="message.role === 'user'" [class.assistant]="message.role === 'assistant'">
      <!-- Avatar -->
      <div class="message-avatar">
        @if (message.role === 'user') {
          <span class="avatar-user">U</span>
        } @else {
          <span class="avatar-ai">
            <app-icon name="agent" [size]="14" />
          </span>
        }
      </div>

      <!-- Content -->
      <div class="message-body">
        <!-- Header -->
        <div class="message-header">
          <span class="message-role">
            {{ message.role === 'user' ? 'You' : (message.agentId ?? 'Cortex AI') }}
          </span>
          <span class="message-time">{{ formatTime(message.timestamp) }}</span>
        </div>

        <!-- Message content with basic markdown -->
        <div class="message-content" [innerHTML]="renderContent(message.content)"></div>
      </div>
    </div>
  `,
  styles: [`
    .message {
      display: flex;
      gap: 10px;
      padding: 12px 16px;
      animation: slideInUp var(--transition-normal);

      &:hover {
        background: rgba(255, 255, 255, 0.02);
      }

      &.user {
        .message-avatar .avatar-user {
          background: var(--accent-primary);
          color: var(--bg-tertiary);
        }
      }

      &.assistant {
        .message-avatar .avatar-ai {
          background: var(--accent-purple);
          color: var(--bg-tertiary);
        }
      }
    }

    .message-avatar {
      flex-shrink: 0;
      width: 28px;
      height: 28px;
      margin-top: 2px;
    }

    .avatar-user,
    .avatar-ai {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      font-size: 12px;
      font-weight: 700;
    }

    .message-body {
      flex: 1;
      min-width: 0;
    }

    .message-header {
      display: flex;
      align-items: baseline;
      gap: 8px;
      margin-bottom: 4px;
    }

    .message-role {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
    }

    .message-time {
      font-size: 10px;
      color: var(--text-muted);
    }

    .message-content {
      font-size: 13px;
      line-height: 1.6;
      color: var(--text-primary);
      word-break: break-word;

      ::ng-deep {
        p {
          margin-bottom: 8px;

          &:last-child {
            margin-bottom: 0;
          }
        }

        code {
          font-family: var(--font-mono);
          font-size: 12px;
          background: var(--bg-surface);
          padding: 1px 5px;
          border-radius: var(--radius-sm);
          color: var(--accent-secondary);
        }

        pre {
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 12px;
          overflow-x: auto;
          margin: 8px 0;
          position: relative;

          code {
            background: transparent;
            padding: 0;
            color: var(--text-primary);
            font-size: 12px;
          }
        }

        strong {
          font-weight: 600;
          color: var(--text-primary);
        }

        em {
          font-style: italic;
          color: var(--text-secondary);
        }

        ul, ol {
          padding-left: 20px;
          margin: 8px 0;
        }

        li {
          margin-bottom: 4px;
        }

        blockquote {
          border-left: 3px solid var(--accent-primary);
          padding-left: 12px;
          color: var(--text-secondary);
          margin: 8px 0;
        }
      }
    }
  `],
})
export class ChatMessageComponent {
  @Input({ required: true }) message!: ChatMessage;

  readonly copied = signal(false);

  formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  renderContent(content: string): string {
    // Basic markdown rendering
    let html = this.escapeHtml(content);

    // Code blocks (``` ... ```)
    html = html.replace(
      /```(\w+)?\n?([\s\S]*?)```/g,
      (_match, lang, code) =>
        `<pre><code class="language-${lang ?? 'plaintext'}">${code.trim()}</code></pre>`
    );

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Unordered lists
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

    // Blockquotes
    html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

    // Paragraphs (double newlines)
    html = html
      .split(/\n\n+/)
      .map((para) => {
        if (para.startsWith('<pre>') || para.startsWith('<ul>') || para.startsWith('<blockquote>')) {
          return para;
        }
        return `<p>${para.replace(/\n/g, '<br>')}</p>`;
      })
      .join('');

    return html;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
