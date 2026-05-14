/**
 * Working Memory — manages the current context window content.
 *
 * Working memory maps directly to the LLM's context window.
 * It maintains a ring-buffer of recent messages and handles
 * eviction with recursive summarization when the buffer grows too large.
 */

import type {
  WorkingMemoryEntry,
  WorkingMemoryConfig,
  MemoryId,
} from '../types.ts';

/** Default configuration */
const DEFAULT_CONFIG: WorkingMemoryConfig = {
  maxTokens: 80_000,
  evictionRatio: 0.7,
};

/**
 * Working Memory Manager
 *
 * Responsibilities:
 * - Maintain a bounded ring-buffer of recent messages
 * - Track token estimates for eviction decisions
 * - Provide summarization of evicted content for downstream layers
 */
export class WorkingMemory {
  private entries: WorkingMemoryEntry[] = [];
  private readonly config: WorkingMemoryConfig;
  private idCounter = 0;

  constructor(config: Partial<WorkingMemoryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Add an entry to working memory */
  push(entry: Omit<WorkingMemoryEntry, 'id'>): WorkingMemoryEntry {
    const fullEntry: WorkingMemoryEntry = {
      ...entry,
      id: `wm_${++this.idCounter}_${Date.now()}`,
    };
    this.entries.push(fullEntry);
    return fullEntry;
  }

  /** Get all current entries (read-only snapshot) */
  getAll(): readonly WorkingMemoryEntry[] {
    return this.entries;
  }

  /** Get the last N entries */
  getRecent(count: number): readonly WorkingMemoryEntry[] {
    return this.entries.slice(-count);
  }

  /** Estimate total tokens in working memory */
  estimateTotalTokens(): number {
    return this.entries.reduce((sum, e) => sum + e.tokenEstimate, 0);
  }

  /**
   * Check if eviction is needed and perform it if so.
   * Returns the evicted entries (for summarization by the memory orchestrator).
   */
  evictIfNeeded(): WorkingMemoryEntry[] {
    const totalTokens = this.estimateTotalTokens();
    if (totalTokens <= this.config.maxTokens) {
      return [];
    }

    // Calculate how many entries to evict
    const evictCount = Math.ceil(this.entries.length * this.config.evictionRatio);
    if (evictCount >= this.entries.length) {
      // Don't evict everything — keep at least the last 5 entries
      const keepMin = Math.min(5, this.entries.length);
      const evicted = this.entries.slice(0, this.entries.length - keepMin);
      this.entries = this.entries.slice(-keepMin);
      return evicted;
    }

    const evicted = this.entries.slice(0, evictCount);
    this.entries = this.entries.slice(evictCount);
    return evicted;
  }

  /** Clear all entries */
  clear(): void {
    this.entries = [];
  }

  /** Get entry count */
  get size(): number {
    return this.entries.length;
  }

  /** Generate a summary string from entries (for downstream context injection) */
  static summarizeEntries(entries: readonly WorkingMemoryEntry[]): string {
    if (entries.length === 0) return '';
    return entries
      .map(e => `[${e.role}] ${e.content.slice(0, 200)}`)
      .join('\n');
  }

  /**
   * Build a context string from current working memory entries
   * suitable for injection into an LLM prompt.
   */
  buildContextString(maxTokens?: number): string {
    const limit = maxTokens ?? this.config.maxTokens;
    let tokenBudget = limit;
    const selected: string[] = [];

    // Work backwards from most recent
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const entry = this.entries[i]!;
      if (entry.tokenEstimate > tokenBudget) break;
      selected.unshift(entry.content);
      tokenBudget -= entry.tokenEstimate;
    }

    return selected.join('\n\n');
  }
}
