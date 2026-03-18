import {
  ChangeDetectionStrategy,
  Component,
  Input,
  signal,
} from '@angular/core';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import type { ChatMessage } from './chat-panel.component';

@Component({
  selector: 'app-chat-message',
  standalone: true,
  imports: [IconComponent],
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

        .file-op-block {
          border-radius: var(--radius-md);
          border: 1px solid var(--border-color);
          margin: 10px 0;
          overflow: hidden;
          font-family: var(--font-mono);

          &.file-op-create { border-left: 3px solid var(--accent-success, #27ae60); }
          &.file-op-modify { border-left: 3px solid var(--accent-primary); }
          &.file-op-delete { border-left: 3px solid var(--accent-error, #e74c3c); }
        }

        .file-op-header {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          background: var(--bg-surface);
          border-bottom: 1px solid var(--border-color);
          font-size: 12px;
        }

        .file-op-icon { font-size: 13px; }

        .file-op-label {
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          font-size: 10px;
          letter-spacing: 0.05em;
        }

        .file-op-path {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--accent-secondary, #00FF88);
          background: transparent;
          padding: 0;
        }

        .file-op-code {
          margin: 0;
          padding: 10px 12px;
          background: var(--bg-tertiary);
          border-radius: 0;
          border: none;
          max-height: 300px;
          overflow-y: auto;

          code {
            background: transparent;
            padding: 0;
            color: var(--text-primary);
            font-size: 12px;
          }
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
    // Agent mode: replace <file> tags with styled blocks BEFORE escaping HTML
    const FILE_PLACEHOLDER_PREFIX = '\x00FILE_BLOCK_';
    const filePlaceholders: string[] = [];
    const fileRegex =
      /<file\s+path="([^"]+)"\s+action="(create|modify|delete)">([\s\S]*?)<\/file>/g;

    const preprocessed = content.replace(
      fileRegex,
      (_match, path: string, action: string, code: string) => {
        const icon =
          action === 'create' ? '📄' : action === 'modify' ? '✏️' : '🗑️';
        const label = action.charAt(0).toUpperCase() + action.slice(1);
        const escapedPath = path
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        const escapedCode = code
          .trim()
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        const block =
          `<div class="file-op-block file-op-${action}">` +
          `<div class="file-op-header"><span class="file-op-icon">${icon}</span>` +
          `<span class="file-op-label">${label}</span>` +
          `<code class="file-op-path">${escapedPath}</code></div>` +
          `<pre class="file-op-code"><code>${escapedCode}</code></pre>` +
          `</div>`;
        const idx = filePlaceholders.push(block) - 1;
        return `${FILE_PLACEHOLDER_PREFIX}${idx}\x00`;
      }
    );

    // Basic markdown rendering
    let html = this.escapeHtml(preprocessed);

    // Restore file block placeholders (they were escaped — unescape the markers)
    html = html.replace(
      new RegExp(
        this.escapeHtml(FILE_PLACEHOLDER_PREFIX) + '(\\d+)' + this.escapeHtml('\x00'),
        'g'
      ),
      (_m, idx) => filePlaceholders[Number(idx)] ?? ''
    );

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
