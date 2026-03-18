import { Injectable, OnDestroy } from '@angular/core';
import {
  Subject,
  Observable,
  BehaviorSubject,
  timer,
  EMPTY,
} from 'rxjs';
import {
  webSocket,
  WebSocketSubject,
} from 'rxjs/webSocket';
import {
  catchError,
  filter,
  map,
  retry,
  share,
  takeUntil,
  tap,
} from 'rxjs/operators';
import { environment } from '../../environments/environment';
import type {
  WsMessage,
  AnyWsMessage,
} from '@cortex-id/shared-types/ws/messages.types';
import { WsMessageType } from '@cortex-id/shared-types/ws/messages.types';

export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

/**
 * WebSocket Service — manages the persistent connection to the Java backend.
 *
 * Features:
 * - Auto-reconnect with exponential backoff
 * - Typed message sending and receiving
 * - Connection status observable
 * - Heartbeat ping/pong
 */
@Injectable({ providedIn: 'root' })
export class WebSocketService implements OnDestroy {
  private socket$: WebSocketSubject<AnyWsMessage> | null = null;
  private messages$: Observable<AnyWsMessage> | null = null;
  private readonly destroy$ = new Subject<void>();

  private readonly connectionStatus = new BehaviorSubject<ConnectionStatus>('disconnected');
  readonly connectionStatus$ = this.connectionStatus.asObservable();

  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly baseReconnectDelay = 1000;

  constructor() {
    this.connect();
  }

  private connect(): void {
    this.socket$ = webSocket<AnyWsMessage>({
      url: environment.backendUrl,
      openObserver: {
        next: () => {
          console.log('[WebSocketService] Connected to backend');
          this.connectionStatus.next('connected');
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.sendSavedApiKeys();
        },
      },
      closeObserver: {
        next: () => {
          console.log('[WebSocketService] Disconnected from backend');
          this.connectionStatus.next('disconnected');
        },
      },
    });

    this.messages$ = this.socket$.pipe(
      tap({
        error: (err) => {
          console.error('[WebSocketService] Error:', err);
          this.connectionStatus.next('reconnecting');
        },
      }),
      retry({
        count: this.maxReconnectAttempts,
        delay: (_, retryCount) => {
          this.reconnectAttempts = retryCount;
          const delay = Math.min(
            this.baseReconnectDelay * Math.pow(2, retryCount - 1),
            30000
          );
          console.log(`[WebSocketService] Reconnecting in ${delay}ms (attempt ${retryCount})`);
          this.connectionStatus.next('reconnecting');
          return timer(delay);
        },
      }),
      catchError((err) => {
        console.error('[WebSocketService] Max reconnect attempts reached:', err);
        this.connectionStatus.next('disconnected');
        return EMPTY;
      }),
      share(),
    );

    // Subscribe to keep the connection alive
    this.messages$.subscribe();
  }

  /**
   * Send a typed message to the backend.
   */
  send<T>(message: WsMessage<T>): void {
    if (!this.socket$) {
      console.warn('[WebSocketService] Cannot send — not connected');
      return;
    }
    this.socket$.next(message as AnyWsMessage);
  }

  /**
   * Listen for messages of a specific type.
   */
  on<T>(type: WsMessageType): Observable<WsMessage<T>> {
    if (!this.messages$) {
      return EMPTY as Observable<WsMessage<T>>;
    }
    return this.messages$.pipe(
      filter((msg) => msg.type === type),
      map((msg) => msg as unknown as WsMessage<T>),
    );
  }

  /**
   * Create a typed message envelope.
   */
  createMessage<T>(type: WsMessageType, payload: T): WsMessage<T> {
    return {
      type,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      payload,
    };
  }

  private startHeartbeat(): void {
    timer(30000, 30000)
      .pipe(
        takeUntil(this.destroy$),
        filter(() => this.connectionStatus.value === 'connected'),
      )
      .subscribe(() => {
        this.send(this.createMessage(WsMessageType.HEALTH_PING, {}));
      });
  }

  private sendSavedApiKeys(): void {
    const providers = ['anthropic', 'openai', 'google'];
    providers.forEach(provider => {
      // Use the canonical key format: cortex-api-key-{provider}
      const key = localStorage.getItem(`cortex-api-key-${provider}`);
      if (key) {
        this.send(this.createMessage(WsMessageType.API_KEY_SET, {
          provider,
          apiKey: key,
        }));
        console.log(`[WebSocketService] Restored API key for ${provider}`);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.socket$?.complete();
  }
}
