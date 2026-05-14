/**
 * @cody-agent/memory
 *
 * Brain-inspired 7-layer cognitive memory system for Cody Agent.
 *
 * Layers:
 *   L0 Working       → Context window management (ring buffer + eviction, in-memory)
 *   L1 Short-term    → Session continuity (session.jsonl, unchanged)
 *   L2 Episodic      → Experiences with emotion weight + FSRS scheduling (SQLite)
 *   L3 Semantic      → Facts + Knowledge Graph + Hebbian dynamics (SQLite + KG)
 *   L4 Procedural    → Skills with success-rate weighting (SQLite)
 *   L5 Core          → Identity/goals/preferences — never decays (SQLite)
 *   L6 Cross-context → Entity deduplication across domains (SQLite triples)
 *
 * Storage: Single SQLite file with FTS5 + vec0 virtual tables.
 * Embedding: all-MiniLM-L6-v2 (384-dim) via Transformers.js v4 (fully local).
 *
 * Algorithms: 12 neuroscience-inspired pure functions:
 *   FSRS, Ebbinghaus, Hebbian, Homeostatic, Emotional modulation,
 *   Sleep replay, Synaptic pruning, Miller's 7±2, Global Workspace,
 *   Information gain, Curiosity, RRF fusion.
 *
 * Usage:
 * ```ts
 * import { CodyMemoryOrchestrator } from '@cody-agent/memory';
 *
 * const memory = new CodyMemoryOrchestrator('/path/to/data', 'workspace-id');
 * await memory.initialize();
 *
 * // Record experience
 * await memory.recordEpisode({ task: '...', outcome: 'success', ... });
 *
 * // Get context for prompt enrichment (multi-signal fusion)
 * const context = await memory.buildMemoryContextBlock('user message');
 * ```
 */

// Main orchestrator
export { CodyMemoryOrchestrator } from './memory-orchestrator-v2.ts';

// ── Database Layer ────────────────────────────────────────────────
export { CodyMemoryDB, EMBEDDING_DIMENSION } from './db/index.ts';

// ── Embedding Provider ────────────────────────────────────────────
export { LocalEmbeddingProvider } from './embedding/index.ts';

// ── Algorithms Suite (12 neuroscience-inspired pure functions) ────
export {
  // FSRS Spaced Repetition
  calculateRetrievability,
  fsrsOnSuccess,
  fsrsOnFailure,
  // Ebbinghaus Forgetting
  calculateDecay,
  // Hebbian Learning
  hebbianStrengthen,
  hebbianDecay,
  homeostaticNormalize,
  // Sleep Consolidation
  selectForReplay,
  simulateReplay,
  pruneWeakConnections,
  // Emotional Weight
  calculateEmotionalWeight,
  // Multi-Signal Fusion
  reciprocalRankFusion,
  // Working Memory Capacity
  selectWorkingMemoryItems,
} from './algorithms/index.ts';

export type {
  FSRSCard,
  FSRSResult,
  DecayResult,
  ReplayCandidate,
  ReplayResult,
  RankedItem,
} from './algorithms/index.ts';

// ── Types ─────────────────────────────────────────────────────────
export type {
  MemoryId,
  Importance,
  MemorySource,
  // Working
  WorkingMemoryEntry,
  WorkingMemoryConfig,
  // Episodic
  Episode,
  EpisodeOutcome,
  TrajectoryStep,
  EpisodicMemoryConfig,
  // Semantic
  SemanticEntry,
  SemanticEntryType,
  SemanticMemoryConfig,
  UserProfile,
  KnowledgeTriple,
  // Procedural
  ProceduralEntry,
  SkillMetrics,
  ProceduralMemoryConfig,
  // Vector
  VectorIndex,
  VectorRecord,
  VectorSearchResult,
  EmbeddingProvider,
  // Consolidation
  ConsolidationAction,
  ConsolidationConfig,
  ConsolidationReport,
  // L5 Core Memory
  CoreMemoryEntry,
  // L6 Cross-Context
  CrossContextEntity,
  // Orchestrator
  CodyMemoryConfig,
  MemoryContextInjection,
  MemoryStats as MemoryStatsType,
} from './types.ts';

export { defaultCodyMemoryConfig } from './types.ts';

// ── Working Memory (L0, in-memory ring buffer) ────────────────────
export { WorkingMemory } from './working/index.ts';
