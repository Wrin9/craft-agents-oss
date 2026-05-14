/**
 * Cody Memory — Unified Type Definitions
 *
 * Brain-inspired 7-layer cognitive memory architecture:
 *   L0 Working       → current attention / context window (in-memory)
 *   L1 Short-term    → session continuity (session.jsonl)
 *   L2 Episodic      → experiences with emotion weight + FSRS scheduling (SQLite)
 *   L3 Semantic      → facts + knowledge graph + Hebbian dynamics (SQLite + KG)
 *   L4 Procedural    → skills with success-rate weighting (SQLite)
 *   L5 Core          → identity/goals/preferences — never decays (SQLite)
 *   L6 Cross-context → entity deduplication across domains (SQLite triples)
 *
 * Storage: Single SQLite file with FTS5 + vec0 virtual tables.
 * Embedding: all-MiniLM-L6-v2 (384-dim) via Transformers.js v4 (fully local).
 */

// ============================================================================
// Common
// ============================================================================

/** Unique ID for any memory entry */
export type MemoryId = string;

/** Importance score (0–1) used by consolidation / decay */
export type Importance = number;

/** Source of a memory entry */
export type MemorySource = 'user' | 'agent' | 'system' | 'evolution';

// ============================================================================
// Working Memory
// ============================================================================

/**
 * A single item in the working memory ring-buffer.
 * Working memory maps directly to the LLM context window.
 */
export interface WorkingMemoryEntry {
  id: MemoryId;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: number;
  /** Token count estimate for eviction decisions */
  tokenEstimate: number;
  /** Optional metadata attached by the memory orchestrator */
  meta?: Record<string, unknown>;
}

/** Configuration for working memory */
export interface WorkingMemoryConfig {
  /** Maximum tokens before eviction triggers (default: 80000) */
  maxTokens: number;
  /** Percentage of oldest messages to evict in one pass (default: 0.7) */
  evictionRatio: number;
}

// ============================================================================
// Episodic Memory
// ============================================================================

/** Outcome of a recorded episode */
export type EpisodeOutcome = 'success' | 'partial' | 'failure';

/**
 * An episode — a specific interaction or task execution that was recorded.
 * Inspired by ELL framework's trajectory storage.
 */
export interface Episode {
  id: MemoryId;
  /** ISO timestamp */
  timestamp: string;
  /** Session ID this episode belongs to */
  sessionId: string;
  /** Workspace ID */
  workspaceId: string;
  /** What task was being performed */
  task: string;
  /** The approach / strategy used */
  approach: string;
  /** Was it successful? */
  outcome: EpisodeOutcome;
  /** Full trajectory (tool calls, reasoning steps) */
  trajectory: TrajectoryStep[];
  /** User feedback if available */
  userFeedback?: 'positive' | 'negative' | 'neutral';
  /** Self-assessment score 1–10 */
  selfAssessment?: number;
  /** Key lessons extracted */
  lessonsLearned: string[];
  /** Vector embedding for semantic retrieval */
  embedding?: number[];
  /** Access count (for consolidation) */
  accessCount: number;
  /** Last access timestamp */
  lastAccessedAt: string;
  /** Importance score (0–1) */
  importance: Importance;
  /** Tags for categorization */
  tags: string[];
  /** Duration in ms */
  durationMs: number;
}

/** A single step in a task trajectory */
export interface TrajectoryStep {
  type: 'think' | 'tool_call' | 'tool_result' | 'message' | 'decision';
  content: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: string;
  timestamp: string;
}

/** Episodic memory config */
export interface EpisodicMemoryConfig {
  /** Maximum episodes to keep before consolidation (default: 10000) */
  maxEpisodes: number;
  /** Similarity threshold for retrieval (default: 0.7) */
  similarityThreshold: number;
  /** Number of results to return from search (default: 10) */
  defaultSearchLimit: number;
}

// ============================================================================
// Semantic Memory
// ============================================================================

/**
 * A semantic memory entry — a fact, concept, or user preference.
 */
export interface SemanticEntry {
  id: MemoryId;
  timestamp: string;
  /** Type of semantic knowledge */
  type: SemanticEntryType;
  /** The key / subject of this knowledge */
  subject: string;
  /** The value / content */
  content: string;
  /** Confidence score 0–1 */
  confidence: number;
  /** Source of this knowledge */
  source: MemorySource;
  /** Related entry IDs */
  relatedIds: MemoryId[];
  /** Vector embedding */
  embedding?: number[];
  /** Access count */
  accessCount: number;
  /** Importance */
  importance: Importance;
  /** Tags */
  tags: string[];
}

export type SemanticEntryType =
  | 'user_preference'     // User's preferred style, format, language
  | 'user_habit'          // User's behavioral patterns
  | 'fact'                // A factual piece of knowledge
  | 'concept'             // A concept or entity definition
  | 'relationship'        // A relationship between entities
  | 'rule'                // A rule or constraint
  | 'insight'             // An insight or pattern discovered
  | 'context';            // Contextual knowledge about a project/domain

/** User profile aggregated from semantic memory */
export interface UserProfile {
  /** Preferred name */
  name?: string;
  /** Preferred language */
  language?: string;
  /** Preferred response style */
  responseStyle?: 'concise' | 'detailed' | 'technical' | 'casual';
  /** Known preferences (key → value) */
  preferences: Map<string, string>;
  /** Common task patterns */
  taskPatterns: string[];
  /** Domain expertise areas */
  expertise: string[];
  /** Last updated */
  updatedAt: string;
}

/** Knowledge graph triple */
export interface KnowledgeTriple {
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  source: MemorySource;
  timestamp: string;
}

/** Semantic memory config */
export interface SemanticMemoryConfig {
  similarityThreshold: number;
  defaultSearchLimit: number;
}

// ============================================================================
// Procedural Memory
// ============================================================================

/**
 * A procedural memory entry — a reusable skill or workflow pattern.
 * Inspired by Hermes Agent's skill system.
 */
export interface ProceduralEntry {
  id: MemoryId;
  /** Skill name (unique within workspace) */
  name: string;
  /** When to trigger this skill */
  trigger: string;
  /** The procedure / approach */
  procedure: string;
  /** Source: hand-written or auto-generated */
  origin: 'manual' | 'auto_generated' | 'evolved';
  /** Quality metrics */
  metrics: SkillMetrics;
  /** Version (incremented on refinement) */
  version: number;
  /** Parent skill this evolved from */
  evolvedFrom?: MemoryId;
  /** Generation in evolution chain */
  evolutionGeneration: number;
  /** Vector embedding */
  embedding?: number[];
  /** Tags */
  tags: string[];
  /** Timestamps */
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
}

/** Skill quality metrics */
export interface SkillMetrics {
  /** How many times this skill was used */
  useCount: number;
  /** Success rate (0–1) */
  successRate: number;
  /** Average execution time in ms */
  avgDurationMs: number;
  /** User acceptance rate (0–1) */
  acceptanceRate: number;
  /** Number of refinements */
  refinementCount: number;
}

/** Procedural memory config */
export interface ProceduralMemoryConfig {
  /** Minimum success rate to keep a skill active (default: 0.3) */
  minSuccessRate: number;
  /** Maximum skills to keep (default: 500) */
  maxSkills: number;
  /** Minimum use count before auto-promotion (default: 3) */
  minUseCountForPromotion: number;
}

// ============================================================================
// Vector Layer
// ============================================================================

/** A vector record in the index */
export interface VectorRecord {
  id: MemoryId;
  vector: number[];
  metadata: Record<string, unknown>;
}

/** Vector search result */
export interface VectorSearchResult {
  id: MemoryId;
  score: number;
  metadata: Record<string, unknown>;
}

/** Vector index interface — pluggable backend */
export interface VectorIndex {
  /** Insert or update a vector */
  upsert(id: MemoryId, vector: number[], metadata?: Record<string, unknown>): Promise<void>;
  /** Remove a vector */
  delete(id: MemoryId): Promise<void>;
  /** Search for similar vectors */
  search(query: number[], limit?: number, threshold?: number): Promise<VectorSearchResult[]>;
  /** Get a vector by ID */
  get(id: MemoryId): Promise<VectorRecord | null>;
  /** Count total vectors */
  count(): Promise<number>;
}

/** Embedding provider interface */
export interface EmbeddingProvider {
  /** Generate embedding for a single text */
  embed(text: string): Promise<number[]>;
  /** Generate embeddings for multiple texts (batch) */
  embedBatch(texts: string[]): Promise<number[][]>;
  /** Dimension of the embedding vectors */
  dimension: number;
}

// ============================================================================
// Consolidation
// ============================================================================

/** Consolidation action types */
export type ConsolidationAction =
  | { type: 'reinforce'; id: MemoryId; reason: string }
  | { type: 'decay'; id: MemoryId; newImportance: Importance }
  | { type: 'merge'; ids: MemoryId[]; mergedId: MemoryId }
  | { type: 'archive'; id: MemoryId; reason: string }
  | { type: 'promote'; id: MemoryId; targetType: 'semantic' | 'procedural' };

/** Consolidation report */
export interface ConsolidationReport {
  timestamp: string;
  reinforced: number;
  decayed: number;
  merged: number;
  archived: number;
  promoted: number;
  details: ConsolidationAction[];
}

/** Consolidation config */
export interface ConsolidationConfig {
  /** Run consolidation every N minutes (default: 60) */
  intervalMinutes: number;
  /** Importance threshold below which entries are decayed (default: 0.2) */
  decayThreshold: Importance;
  /** Importance decay rate per interval (default: 0.05) */
  decayRate: number;
  /** Minimum importance before archival (default: 0.05) */
  archiveThreshold: Importance;
  /** Access count threshold for reinforcement (default: 3) */
  reinforceAccessThreshold: number;
  /** Number of similar episodes before merge (default: 5) */
  mergeSimilarThreshold: number;
}

// ============================================================================
// Memory Orchestrator
// ============================================================================

/** Top-level config for the entire memory system */
export interface CodyMemoryConfig {
  /** Path to the workspace data directory */
  workspaceDataDir: string;
  /** Workspace ID */
  workspaceId: string;
  working: WorkingMemoryConfig;
  episodic: EpisodicMemoryConfig;
  semantic: SemanticMemoryConfig;
  procedural: ProceduralMemoryConfig;
  consolidation: ConsolidationConfig;
}

/** Default config factory */
export function defaultCodyMemoryConfig(
  workspaceDataDir: string,
  workspaceId: string,
): CodyMemoryConfig {
  return {
    workspaceDataDir,
    workspaceId,
    working: {
      maxTokens: 80_000,
      evictionRatio: 0.7,
    },
    episodic: {
      maxEpisodes: 10_000,
      similarityThreshold: 0.7,
      defaultSearchLimit: 10,
    },
    semantic: {
      similarityThreshold: 0.65,
      defaultSearchLimit: 10,
    },
    procedural: {
      minSuccessRate: 0.3,
      maxSkills: 500,
      minUseCountForPromotion: 3,
    },
    consolidation: {
      intervalMinutes: 60,
      decayThreshold: 0.2,
      decayRate: 0.05,
      archiveThreshold: 0.05,
      reinforceAccessThreshold: 3,
      mergeSimilarThreshold: 5,
    },
  };
}

// ============================================================================
// L5 Core Memory (Never decays, user-editable)
// ============================================================================

export interface CoreMemoryEntry {
  id: MemoryId;
  category: 'identity' | 'goal' | 'preference' | 'constraint';
  content: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// L6 Cross-Context Memory (Entity deduplication)
// ============================================================================

export interface CrossContextEntity {
  entity: string;
  domains: string[];       // e.g., ['work', 'personal', 'learning']
  mergedFrom: MemoryId[];  // source IDs that were merged
  confidence: number;
}

// ============================================================================
// Memory Context Injection — Global Workspace Theory
// ============================================================================

/** Context injection result — what gets added to the LLM context */
export interface MemoryContextInjection {
  /** Relevant episodes to include */
  relevantEpisodes: Episode[];
  /** Relevant facts/preferences */
  relevantSemantics: SemanticEntry[];
  /** Applicable skills */
  applicableSkills: ProceduralEntry[];
  /** User profile summary */
  userProfile: UserProfile | null;
  /** Core memory (identity, goals, constraints) */
  coreMemory: CoreMemoryEntry[];
  /** Knowledge graph context */
  kgContext: KnowledgeTriple[];
  /** Total tokens estimated */
  totalTokenEstimate: number;
}

// ============================================================================
// 7-Layer Memory Stats
// ============================================================================

export interface MemoryStats {
  workingMemorySize: number;
  workingMemoryTokens: number;
  episodicCount: number;
  semanticCount: number;
  proceduralCount: number;
  coreMemoryCount: number;
  triplesCount: number;
  vectorCount: number;
  /** Average memory retention across all layers */
  avgRetention: number;
}
