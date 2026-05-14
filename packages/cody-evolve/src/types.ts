/**
 * Cody Evolve — Type Definitions
 *
 * The LTK-Evolve continuous learning engine implements four core principles:
 * 1. Experience Exploration  — self-motivated pattern discovery
 * 2. Long-term Memory        — structured knowledge preservation
 * 3. Skill Learning           — abstracting recurring patterns into reusable skills
 * 4. Knowledge Internalization — converting explicit knowledge into intuitive capabilities
 */

import type { MemoryId, EpisodeOutcome } from '@cody-agent/memory';

// ============================================================================
// Experience
// ============================================================================

/** A codified experience extracted from an episode */
export interface CodyExperience {
  id: string;
  /** The raw episode ID this was derived from */
  sourceEpisodeId: string;
  /** When this experience was created */
  timestamp: string;
  /** Experience classification */
  type: ExperienceType;
  /** The task that was performed */
  task: string;
  /** The approach that was used */
  approach: string;
  /** Was it successful? */
  outcome: EpisodeOutcome;
  /** What was learned */
  lessonsLearned: string[];
  /** What could be improved */
  improvementSuggestions: string[];
  /** How confident we are in this experience (0-1) */
  confidence: number;
  /** Has this been internalized yet? */
  internalized: boolean;
  /** Evolution generation */
  generation: number;
  /** Tags */
  tags: string[];
}

export type ExperienceType =
  | 'success_pattern'     // A pattern that led to success
  | 'failure_analysis'    // Analysis of why something failed
  | 'optimization'        // A more efficient way to do something
  | 'preference_signal'   // User preference detected
  | 'skill_candidate'     // Potential skill detected
  | 'knowledge_gap';      // Gap in knowledge identified

// ============================================================================
// Reflection
// ============================================================================

/** Reflection level determines depth of analysis */
export type ReflectionLevel = 'immediate' | 'periodic' | 'deep';

/** Result of a reflection cycle */
export interface ReflectionResult {
  id: string;
  timestamp: string;
  level: ReflectionLevel;
  /** Episodes analyzed */
  episodeIds: string[];
  /** Experiences extracted */
  extractedExperiences: CodyExperience[];
  /** Overall performance assessment */
  performanceScore: number; // 0-100
  /** Key insights */
  insights: string[];
  /** Recommended actions */
  recommendations: string[];
  /** Skills to create or refine */
  skillActions: SkillAction[];
  /** Knowledge to internalize */
  internalizationTargets: InternalizationTarget[];
}

/** An action to take on a skill */
export interface SkillAction {
  type: 'create' | 'refine' | 'deprecate';
  /** Skill name */
  name: string;
  /** New or updated procedure */
  procedure?: string;
  /** Reason for this action */
  reason: string;
  /** Source experience IDs */
  sourceExperiences: string[];
}

/** Knowledge to be internalized into context or config */
export interface InternalizationTarget {
  type: 'core_memory' | 'user_preference' | 'system_prompt' | 'config';
  key: string;
  value: string;
  confidence: number;
}

// ============================================================================
// Evolve Engine Config
// ============================================================================

export interface EvolveEngineConfig {
  /** Run immediate reflection after every N episodes (default: 1) */
  immediateReflectionInterval: number;
  /** Run periodic reflection every N minutes (default: 60) */
  periodicReflectionIntervalMinutes: number;
  /** Run deep reflection after accumulating N experiences (default: 50) */
  deepReflectionThreshold: number;
  /** Minimum confidence to internalize knowledge (default: 0.8) */
  internalizationConfidenceThreshold: number;
  /** Minimum success rate to auto-promote a skill (default: 0.7) */
  skillPromotionSuccessRate: number;
  /** Maximum experiences to keep (default: 5000) */
  maxExperiences: number;
}

export function defaultEvolveEngineConfig(): EvolveEngineConfig {
  return {
    immediateReflectionInterval: 1,
    periodicReflectionIntervalMinutes: 60,
    deepReflectionThreshold: 50,
    internalizationConfidenceThreshold: 0.8,
    skillPromotionSuccessRate: 0.7,
    maxExperiences: 5000,
  };
}
