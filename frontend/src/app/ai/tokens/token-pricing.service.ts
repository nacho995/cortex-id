import { Injectable } from '@angular/core';

/**
 * Token pricing per 1M tokens (input / output) in USD.
 * Sources: official provider pricing pages (March 2026).
 */
export interface ModelPricing {
  /** Model identifier — must match allModels IDs in chat-panel.component.ts */
  modelId: string;
  /** Display name for the model */
  displayName: string;
  /** Cost per 1M input tokens in USD */
  inputPer1M: number;
  /** Cost per 1M output tokens in USD */
  outputPer1M: number;
  /** Provider identifier */
  provider: 'anthropic' | 'openai' | 'google' | 'ollama';
}

/**
 * TokenPricingService — static pricing table for all 11 supported models.
 *
 * Usage:
 *   const pricing = inject(TokenPricingService);
 *   const cost = pricing.calculateCost('claude-sonnet-4-6', 1200, 800);
 */
@Injectable({ providedIn: 'root' })
export class TokenPricingService {
  private readonly pricingTable: ReadonlyMap<string, ModelPricing>;

  constructor() {
    const models: ModelPricing[] = [
      // ── Anthropic ──────────────────────────────────────────────────────────
      {
        modelId: 'claude-opus-4-6',
        displayName: 'Cortex Max',
        inputPer1M: 15.00,
        outputPer1M: 75.00,
        provider: 'anthropic',
      },
      {
        modelId: 'claude-sonnet-4-6',
        displayName: 'Cortex Pro',
        inputPer1M: 3.00,
        outputPer1M: 15.00,
        provider: 'anthropic',
      },
      {
        modelId: 'claude-haiku-4-5',
        displayName: 'Cortex Fast',
        inputPer1M: 0.80,
        outputPer1M: 4.00,
        provider: 'anthropic',
      },
      // ── OpenAI ────────────────────────────────────────────────────────────
      {
        modelId: 'gpt-4o',
        displayName: 'GPT-4o',
        inputPer1M: 5.00,
        outputPer1M: 15.00,
        provider: 'openai',
      },
      {
        modelId: 'gpt-4o-mini',
        displayName: 'GPT-4o Mini',
        inputPer1M: 0.15,
        outputPer1M: 0.60,
        provider: 'openai',
      },
      {
        modelId: 'o3',
        displayName: 'O3 Reasoning',
        inputPer1M: 10.00,
        outputPer1M: 40.00,
        provider: 'openai',
      },
      {
        modelId: 'codex-mini-latest',
        displayName: 'Codex Mini',
        inputPer1M: 1.50,
        outputPer1M: 6.00,
        provider: 'openai',
      },
      // ── Google ────────────────────────────────────────────────────────────
      {
        modelId: 'gemini-2.5-pro',
        displayName: 'Gemini 2.5 Pro',
        inputPer1M: 3.50,
        outputPer1M: 10.50,
        provider: 'google',
      },
      {
        modelId: 'gemini-2.5-flash',
        displayName: 'Gemini Flash',
        inputPer1M: 0.075,
        outputPer1M: 0.30,
        provider: 'google',
      },
      // ── Ollama (local — free) ─────────────────────────────────────────────
      {
        modelId: 'llama3',
        displayName: 'Llama 3',
        inputPer1M: 0,
        outputPer1M: 0,
        provider: 'ollama',
      },
      {
        modelId: 'codellama',
        displayName: 'CodeLlama',
        inputPer1M: 0,
        outputPer1M: 0,
        provider: 'ollama',
      },
    ];

    this.pricingTable = new Map(models.map(m => [m.modelId, m]));
  }

  /**
   * Get pricing info for a model. Returns undefined if model is unknown.
   */
  getPricing(modelId: string): ModelPricing | undefined {
    return this.pricingTable.get(modelId);
  }

  /**
   * Calculate cost in USD for a given number of input and output tokens.
   *
   * @param modelId - Model identifier
   * @param inputTokens - Number of input tokens consumed
   * @param outputTokens - Number of output tokens generated
   * @returns Cost in USD, or 0 if model is unknown / free
   */
  calculateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    const pricing = this.pricingTable.get(modelId);
    if (!pricing) return 0;

    const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
    const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;
    return inputCost + outputCost;
  }

  /**
   * Format a cost value as a human-readable string.
   * Uses sub-cent notation for very small amounts.
   *
   * @example
   *   formatCost(0.000123) → '$0.0001'
   *   formatCost(0.0234)   → '$0.023'
   *   formatCost(1.234)    → '$1.23'
   */
  formatCost(usd: number): string {
    if (usd === 0) return 'Free';
    if (usd < 0.0001) return '<$0.0001';
    if (usd < 0.01) return `$${usd.toFixed(4)}`;
    if (usd < 1) return `$${usd.toFixed(3)}`;
    return `$${usd.toFixed(2)}`;
  }

  /**
   * Estimate token count from raw text using the ~4 chars/token heuristic.
   * Useful for streaming scenarios where exact counts aren't available yet.
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Returns all models in the pricing table.
   */
  getAllModels(): ModelPricing[] {
    return Array.from(this.pricingTable.values());
  }
}
