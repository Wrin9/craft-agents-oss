/**
 * Cody Agent — Unified Cognitive Agent
 *
 * This is the main entry point that wires together all cognitive subsystems:
 * - Memory (four-layer: Working / Episodic / Semantic / Procedural)
 * - Evolve (LTK-Evolve continuous learning engine)
 * - Proactive (background thinking and proactive suggestions)
 * - Evolution (self-evolution, meta-learning, performance tracking)
 *
 * Usage:
 * ```ts
 * import { createCodyAgent } from '@cody-agent/core';
 *
 * const cody = await createCodyAgent({
 *   workspaceDataDir: '/path/to/workspace/data',
 *   workspaceId: 'my-workspace',
 * });
 *
 * // Record a completed task
 * await cody.recordExperience({
 *   task: 'Fix login bug',
 *   approach: 'Read error logs, identified null pointer, added null check',
 *   outcome: 'success',
 *   ...
 * });
 *
 * // Get enriched context for a user message
 * const contextBlock = await cody.getMemoryContext('Fix the signup flow');
 * // → Inject contextBlock into the LLM system prompt
 * ```
 */

import {
  CodyMemoryOrchestrator,
  type CodyMemoryConfig,
  type MemoryStats,
  type Episode,
  type EpisodeOutcome,
  type TrajectoryStep,
  type MemoryContextInjection,
} from '@cody-agent/memory';
import { LTKEvolveEngine, type EvolveEngineConfig, type ReflectionResult } from '@cody-agent/evolve';
import { BackgroundThinker, type ProactiveEngineConfig, type ProactiveSuggestion } from '@cody-agent/proactive';
import { CodyEvolutionEngine, type EvolutionConfig, type EvolutionSummary } from '@cody-agent/evolution';

// ============================================================================
// Configuration
// ============================================================================

/** Top-level configuration for the Cody Agent cognitive system */
export interface CodyAgentConfig {
  /** Path to workspace data directory */
  workspaceDataDir: string;
  /** Workspace ID */
  workspaceId: string;
  /** Memory system config (optional — uses defaults if not specified) */
  memory?: Partial<CodyMemoryConfig>;
  /** Evolve engine config (optional) */
  evolve?: Partial<EvolveEngineConfig>;
  /** Proactive thinking config (optional) */
  proactive?: Partial<ProactiveEngineConfig>;
  /** Evolution config (optional) */
  evolution?: Partial<EvolutionConfig>;
}

// ============================================================================
// Cody Agent
// ============================================================================

/**
 * CodyAgent — the unified cognitive agent.
 *
 * This class is the single entry point for all cognitive features.
 * It manages the lifecycle of all subsystems and provides a simple API.
 */
export class CodyAgent {
  readonly memory: CodyMemoryOrchestrator;
  readonly evolve: LTKEvolveEngine;
  readonly thinker: BackgroundThinker;
  readonly evolution: CodyEvolutionEngine;

  private initialized = false;

  constructor(config: CodyAgentConfig) {
    // 1. Initialize memory system
    this.memory = new CodyMemoryOrchestrator(
      config.workspaceDataDir,
      config.workspaceId,
      config.memory,
    );

    // 2. Initialize evolve engine (depends on memory)
    this.evolve = new LTKEvolveEngine(this.memory, config.evolve);

    // 3. Initialize proactive thinker (depends on memory + evolve)
    this.thinker = new BackgroundThinker(this.memory, this.evolve, config.proactive);

    // 4. Initialize evolution engine (depends on all above)
    this.evolution = new CodyEvolutionEngine(
      this.memory,
      this.evolve,
      this.thinker,
      config.evolution,
      config.workspaceDataDir,
    );
  }

  // ── Lifecycle ───────────────────────────────────────────────────

  /** Initialize all subsystems and start background processes */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.memory.initialize();
    this.evolve.start();
    this.thinker.start();
    this.evolution.start();

    this.initialized = true;
  }

  /** Shutdown all subsystems gracefully */
  async shutdown(): Promise<void> {
    if (!this.initialized) return;

    this.evolution.stop();
    this.thinker.stop();
    this.evolve.stop();
    await this.memory.shutdown();

    this.initialized = false;
  }

  /** Check if the agent is initialized */
  get isActive(): boolean {
    return this.initialized;
  }

  // ── High-Level API ──────────────────────────────────────────────

  /**
   * Record a completed task as an experience.
   * This is the primary input to the learning system.
   */
  async recordExperience(input: {
    sessionId: string;
    task: string;
    approach: string;
    outcome: EpisodeOutcome;
    trajectory?: TrajectoryStep[];
    userFeedback?: 'positive' | 'negative' | 'neutral';
    selfAssessment?: number;
    lessonsLearned?: string[];
    tags?: string[];
    durationMs?: number;
  }): Promise<void> {
    // Record in episodic memory
    const episode = await this.memory.recordEpisode(input);

    // Feed to evolve engine for immediate reflection
    const reflection = await this.evolve.processEpisode(episode);
    if (reflection) {
      await this.evolve.applyReflectionResult(reflection);
    }
  }

  /**
   * Get memory-enriched context for a user prompt.
   * Returns a formatted block to inject into the LLM system prompt.
   */
  async getMemoryContext(userMessage: string): Promise<string> {
    return this.memory.buildMemoryContextBlock(userMessage);
  }

  /**
   * Get structured context injection (for programmatic use).
   */
  async getContextInjection(userMessage: string): Promise<MemoryContextInjection> {
    return this.memory.getContextForPrompt(userMessage);
  }

  /**
   * Store a user preference.
   */
  async setUserPreference(key: string, value: string): Promise<void> {
    await this.memory.setUserPreference(key, value);
  }

  /**
   * Store a knowledge fact.
   */
  async storeKnowledge(subject: string, content: string, confidence?: number): Promise<void> {
    await this.memory.storeFact(subject, content, confidence);
  }

  // ── Proactive API ───────────────────────────────────────────────

  /** Get pending proactive suggestions */
  getProactiveSuggestions(): ProactiveSuggestion[] {
    return this.thinker.getSuggestions();
  }

  /** Dismiss a proactive suggestion */
  dismissSuggestion(id: string): boolean {
    return this.thinker.dismissSuggestion(id);
  }

  /** Accept a proactive suggestion */
  acceptSuggestion(id: string): boolean {
    return this.thinker.acceptSuggestion(id);
  }

  // ── Evolution API ───────────────────────────────────────────────

  /** Get the current evolution summary */
  getEvolutionSummary(): EvolutionSummary {
    return this.evolution.getSummary();
  }

  /** Get the latest performance snapshot */
  getPerformance() {
    return this.evolution.getLatestPerformance();
  }

  /** Get pending self-modifications */
  getPendingModifications() {
    return this.evolution.getPendingModifications();
  }

  /** Approve a self-modification */
  approveModification(id: string): boolean {
    return this.evolution.approveModification(id);
  }

  /** Reject a self-modification */
  rejectModification(id: string): boolean {
    return this.evolution.rejectModification(id);
  }

  // ── Stats & Debug ───────────────────────────────────────────────

  /** Get memory statistics */
  async getMemoryStats(): Promise<MemoryStats> {
    return this.memory.getStats();
  }

  /** Get a comprehensive status report */
  async getStatus(): Promise<CodyAgentStatus> {
    const memoryStats = await this.memory.getStats();
    const evolutionSummary = this.evolution.getSummary();

    return {
      initialized: this.initialized,
      memory: memoryStats,
      evolution: evolutionSummary,
      thinkerRunning: this.thinker.isThinkerRunning,
      pendingThoughts: this.thinker.thoughtQueueSize,
      pendingSuggestions: this.thinker.suggestionCount,
      experienceCount: this.evolve.experienceCount,
    };
  }
}

// ============================================================================
// Status & Factory
// ============================================================================

export interface CodyAgentStatus {
  initialized: boolean;
  memory: MemoryStats;
  evolution: EvolutionSummary;
  thinkerRunning: boolean;
  pendingThoughts: number;
  pendingSuggestions: number;
  experienceCount: number;
}

/**
 * Create and initialize a Cody Agent.
 * Convenience factory function.
 */
export async function createCodyAgent(config: CodyAgentConfig): Promise<CodyAgent> {
  const agent = new CodyAgent(config);
  await agent.initialize();
  return agent;
}
