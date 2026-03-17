import {
  Injectable,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { WebSocketService } from '../../core/websocket.service';
import { TokenPricingService } from './token-pricing.service';
import {
  WsMessageType,
  type ChatResponsePayload,
  type StreamChunkPayload,
} from '@cortex-id/shared-types/ws/messages.types';

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

/** Metrics for a single AI request (one user message → one response). */
export interface RequestMetrics {
  /** Unique request identifier (WS message id). */
  requestId: string;
  /** Model used for this request. */
  modelId: string;
  /** Input tokens consumed (exact from backend, or estimated during streaming). */
  inputTokens: number;
  /** Output tokens generated (exact from backend, or estimated during streaming). */
  outputTokens: number;
  /** Total cost in USD. */
  costUsd: number;
  /** Whether the token counts are exact (from backend) or estimated. */
  isEstimated: boolean;
  /** Unix timestamp when the request completed. */
  completedAt: number;
}

/** Aggregated metrics for the current session. */
export interface SessionMetrics {
  /** Total input tokens across all requests. */
  totalInputTokens: number;
  /** Total output tokens across all requests. */
  totalOutputTokens: number;
  /** Total cost in USD for the session. */
  totalCostUsd: number;
  /** Number of completed requests. */
  requestCount: number;
}

/** Cost level for UI colour coding. */
export type CostLevel = 'free' | 'low' | 'medium' | 'high';

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * TokenMetricsService — tracks per-request and session-level token usage.
 *
 * Strategy:
 * 1. During streaming: estimate output tokens from chunk length (~4 chars/token).
 * 2. On CHAT_STREAM_END / CHAT_RESPONSE: replace estimates with exact counts
 *    when the backend provides `tokensUsed`.
 * 3. Exposes signals for reactive UI updates (no BehaviorSubject).
 *
 * Usage:
 *   const metrics = inject(TokenMetricsService);
 *   metrics.lastRequest()   // RequestMetrics | null
 *   metrics.session()       // SessionMetrics
 *   metrics.costLevel()     // 'free' | 'low' | 'medium' | 'high'
 */
@Injectable({ providedIn: 'root' })
export class TokenMetricsService implements OnDestroy {
  private readonly ws = inject(WebSocketService);
  private readonly pricing = inject(TokenPricingService);
  private readonly destroy$ = new Subject<void>();

  // ── Internal state ────────────────────────────────────────────────────────

  /** Currently active model (set externally by chat panel). */
  private readonly _activeModelId = signal<string>('claude-sonnet-4-6');

  /** Accumulated output text during streaming (for estimation). */
  private streamingOutputBuffer = '';

  /** Input text of the current request (for estimation). */
  private currentInputText = '';

  /** Metrics for the last completed request. */
  private readonly _lastRequest = signal<RequestMetrics | null>(null);

  /** All completed requests in this session. */
  private readonly _requests = signal<RequestMetrics[]>([]);

  // ── Public signals ────────────────────────────────────────────────────────

  /** Metrics for the most recent completed request. Null before first request. */
  readonly lastRequest = this._lastRequest.asReadonly();

  /** Active model identifier (mirrors chat panel selection). */
  readonly activeModelId = this._activeModelId.asReadonly();

  /** Aggregated session metrics (computed from all requests). */
  readonly session = computed<SessionMetrics>(() => {
    const reqs = this._requests();
    return reqs.reduce<SessionMetrics>(
      (acc, r) => ({
        totalInputTokens: acc.totalInputTokens + r.inputTokens,
        totalOutputTokens: acc.totalOutputTokens + r.outputTokens,
        totalCostUsd: acc.totalCostUsd + r.costUsd,
        requestCount: acc.requestCount + 1,
      }),
      { totalInputTokens: 0, totalOutputTokens: 0, totalCostUsd: 0, requestCount: 0 },
    );
  });

  /**
   * Cost level for the last request — drives UI colour coding.
   *
   * Thresholds (per request):
   *   free   → $0
   *   low    → < $0.01
   *   medium → < $0.10
   *   high   → >= $0.10
   */
  readonly costLevel = computed<CostLevel>(() => {
    const req = this._lastRequest();
    if (!req || req.costUsd === 0) return 'free';
    if (req.costUsd < 0.01) return 'low';
    if (req.costUsd < 0.10) return 'medium';
    return 'high';
  });

  /** Formatted cost string for the last request. */
  readonly lastRequestCostFormatted = computed(() => {
    const req = this._lastRequest();
    if (!req) return '—';
    return this.pricing.formatCost(req.costUsd);
  });

  /** Formatted total session cost. */
  readonly sessionCostFormatted = computed(() =>
    this.pricing.formatCost(this.session().totalCostUsd),
  );

  constructor() {
    this.subscribeToWebSocket();
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Called by the chat panel when the user selects a different model.
   */
  setActiveModel(modelId: string): void {
    this._activeModelId.set(modelId);
  }

  /**
   * Called by the chat panel just before sending a message.
   * Captures the input text for token estimation during streaming.
   */
  trackRequest(inputText: string): void {
    this.currentInputText = inputText;
    this.streamingOutputBuffer = '';
  }

  /**
   * Reset session metrics (e.g. when starting a new conversation).
   */
  resetSession(): void {
    this._requests.set([]);
    this._lastRequest.set(null);
    this.streamingOutputBuffer = '';
    this.currentInputText = '';
  }

  // ── WebSocket subscriptions ───────────────────────────────────────────────

  private subscribeToWebSocket(): void {
    // Accumulate streaming output for estimation
    this.ws
      .on<StreamChunkPayload>(WsMessageType.CHAT_STREAM_CHUNK)
      .pipe(takeUntil(this.destroy$))
      .subscribe((msg) => {
        this.streamingOutputBuffer += msg.payload.content;

        // On final chunk: record estimated metrics if backend didn't send exact counts
        if (msg.payload.done) {
          this.recordEstimatedMetrics(msg.id);
        }
      });

    // Non-streaming response with exact token counts
    this.ws
      .on<ChatResponsePayload>(WsMessageType.CHAT_RESPONSE)
      .pipe(takeUntil(this.destroy$))
      .subscribe((msg) => {
        const { model, tokensUsed } = msg.payload;
        if (tokensUsed) {
          this.recordExactMetrics(msg.id, model, tokensUsed.input, tokensUsed.output);
        } else {
          // Backend didn't send counts — fall back to estimation
          this.recordEstimatedMetrics(msg.id);
        }
      });
  }

  private recordExactMetrics(
    requestId: string,
    modelId: string,
    inputTokens: number,
    outputTokens: number,
  ): void {
    const costUsd = this.pricing.calculateCost(modelId, inputTokens, outputTokens);
    const metrics: RequestMetrics = {
      requestId,
      modelId,
      inputTokens,
      outputTokens,
      costUsd,
      isEstimated: false,
      completedAt: Date.now(),
    };
    this.commitMetrics(metrics);
  }

  private recordEstimatedMetrics(requestId: string): void {
    const modelId = this._activeModelId();
    const inputTokens = this.pricing.estimateTokens(this.currentInputText);
    const outputTokens = this.pricing.estimateTokens(this.streamingOutputBuffer);
    const costUsd = this.pricing.calculateCost(modelId, inputTokens, outputTokens);

    const metrics: RequestMetrics = {
      requestId,
      modelId,
      inputTokens,
      outputTokens,
      costUsd,
      isEstimated: true,
      completedAt: Date.now(),
    };
    this.commitMetrics(metrics);
  }

  private commitMetrics(metrics: RequestMetrics): void {
    this._lastRequest.set(metrics);
    this._requests.update(reqs => [...reqs, metrics]);
    // Reset buffers
    this.streamingOutputBuffer = '';
    this.currentInputText = '';
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
