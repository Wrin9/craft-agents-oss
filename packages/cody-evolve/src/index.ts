/**
 * @cody-agent/evolve
 *
 * LTK-Evolve continuous learning engine for Cody Agent.
 *
 * Implements Experience-driven Lifelong Learning (ELL):
 *   Experience Exploration → Reflection → Skill Learning → Knowledge Internalization
 *
 * Usage:
 * ```ts
 * import { LTKEvolveEngine } from '@cody-agent/evolve';
 *
 * const engine = new LTKEvolveEngine(memoryOrchestrator);
 * engine.start();
 *
 * // After each task
 * const result = await engine.processEpisode(episode);
 * ```
 */

export { LTKEvolveEngine } from './evolve-engine.ts';

export type {
  CodyExperience,
  ExperienceType,
  ReflectionResult,
  ReflectionLevel,
  SkillAction,
  InternalizationTarget,
  EvolveEngineConfig,
} from './types.ts';

export { defaultEvolveEngineConfig } from './types.ts';
