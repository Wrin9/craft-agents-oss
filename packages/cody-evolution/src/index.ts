/**
 * @cody-agent/evolution
 *
 * Self-evolution system for Cody Agent.
 *
 * Provides meta-learning, performance tracking, safe self-modification,
 * and complete evolution logging for transparency and auditability.
 *
 * Usage:
 * ```ts
 * import { CodyEvolutionEngine } from '@cody-agent/evolution';
 *
 * const engine = new CodyEvolutionEngine(memory, evolve, thinker);
 * engine.start();
 *
 * // Get evolution summary
 * const summary = engine.getSummary();
 * ```
 */

export { CodyEvolutionEngine } from './evolution-engine.ts';
export type { EvolutionSummary } from './evolution-engine.ts';

export type {
  EvolutionStrategy,
  EvolutionStrategyType,
  EvolutionLogEntry,
  PerformanceSnapshot,
  PerformanceTrend,
  SelfModification,
  RiskLevel,
  ModificationDimension,
  EvolutionConfig,
} from './types.ts';

export { defaultEvolutionConfig } from './types.ts';
