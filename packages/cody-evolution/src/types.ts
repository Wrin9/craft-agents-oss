/**
 * Cody Evolution — Type Definitions
 *
 * The self-evolution system provides:
 * 1. Experience Management   — unified lifecycle for all experience data
 * 2. Meta-Learning           — learning how to learn more effectively
 * 3. Self-Modification        — safe modification of own behavior
 * 4. Performance Tracking     — monitoring improvement over time
 * 5. Evolution Logging        — complete audit trail of all changes
 */

// ============================================================================
// Evolution Strategy
// ============================================================================

/** Types of evolution strategies */
export type EvolutionStrategyType =
  | 'skill_creation'       // Create new skills from patterns
  | 'skill_refinement'     // Improve existing skills
  | 'knowledge_consolidation' // Merge and consolidate knowledge
  | 'preference_learning'  // Learn user preferences
  | 'approach_optimization' // Find better approaches
  | 'context_optimization'  // Optimize context injection
  | 'memory_management';   // Optimize memory storage and retrieval

/** An evolution strategy with effectiveness tracking */
export interface EvolutionStrategy {
  type: EvolutionStrategyType;
  /** Number of times applied */
  applicationCount: number;
  /** Average improvement score (0-1, positive = improvement) */
  averageImprovement: number;
  /** Last time this strategy was applied */
  lastAppliedAt: string;
  /** Whether this strategy is currently active */
  active: boolean;
}

// ============================================================================
// Performance Tracking
// ============================================================================

/** A performance snapshot at a point in time */
export interface PerformanceSnapshot {
  timestamp: string;
  /** Task success rate (0-1) */
  taskSuccessRate: number;
  /** Average task duration in ms */
  avgTaskDuration: number;
  /** User satisfaction score (0-1) */
  userSatisfaction: number;
  /** Skill utilization rate */
  skillUtilization: number;
  /** Memory efficiency score (0-1) */
  memoryEfficiency: number;
  /** Context injection relevance (0-1) */
  contextRelevance: number;
  /** Overall evolution score (0-100) */
  evolutionScore: number;
}

/** Performance trend */
export type PerformanceTrend = 'improving' | 'stable' | 'declining';

// ============================================================================
// Evolution Log
// ============================================================================

/** An entry in the evolution log */
export interface EvolutionLogEntry {
  id: string;
  timestamp: string;
  /** Type of change */
  type: EvolutionStrategyType;
  /** What was changed */
  description: string;
  /** Before state (summary) */
  before: string;
  /** After state (summary) */
  after: string;
  /** Reason for the change */
  reason: string;
  /** Confidence in the change */
  confidence: number;
  /** Risk level of the change */
  riskLevel: RiskLevel;
  /** Whether the change was automatically applied */
  autoApplied: boolean;
  /** Result: improved, no_change, degraded */
  outcome?: 'improved' | 'no_change' | 'degraded';
}

export type RiskLevel = 'low' | 'medium' | 'high';

// ============================================================================
// Self-Modification
// ============================================================================

/** A proposed self-modification */
export interface SelfModification {
  id: string;
  /** What dimension is being modified */
  dimension: ModificationDimension;
  /** Description of the change */
  description: string;
  /** Current value */
  currentValue: string;
  /** Proposed new value */
  proposedValue: string;
  /** Risk level */
  riskLevel: RiskLevel;
  /** Confidence in improvement */
  confidence: number;
  /** Reason for the change */
  reason: string;
  /** Status */
  status: 'proposed' | 'approved' | 'applied' | 'rejected' | 'rolled_back';
  /** Timestamps */
  proposedAt: string;
  appliedAt?: string;
}

export type ModificationDimension =
  | 'system_prompt'      // Modify system prompt fragments
  | 'skill_template'     // Create or modify skill templates
  | 'tool_preference'    // Adjust tool selection strategy
  | 'memory_strategy'    // Adjust memory retrieval parameters
  | 'automation_rule'    // Create or modify automation rules
  | 'permission_config'; // Adjust permission rules

// ============================================================================
// Config
// ============================================================================

export interface EvolutionConfig {
  /** Enable automatic self-modification for low-risk changes */
  enableAutoModification: boolean;
  /** Maximum risk level for auto-applied changes */
  autoModificationMaxRisk: RiskLevel;
  /** Minimum confidence to apply a modification */
  minConfidenceForModification: number;
  /** How often to run evolution cycles (minutes) */
  evolutionCycleIntervalMinutes: number;
  /** Maximum modifications per cycle */
  maxModificationsPerCycle: number;
  /** Enable performance tracking */
  enablePerformanceTracking: boolean;
  /** Maximum evolution log entries to keep */
  maxLogEntries: number;
}

export function defaultEvolutionConfig(): EvolutionConfig {
  return {
    enableAutoModification: false,
    autoModificationMaxRisk: 'low',
    minConfidenceForModification: 0.8,
    evolutionCycleIntervalMinutes: 120,
    maxModificationsPerCycle: 5,
    enablePerformanceTracking: true,
    maxLogEntries: 10_000,
  };
}
