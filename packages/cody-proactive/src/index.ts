/**
 * @cody-agent/proactive
 *
 * Proactive thinking system for Cody Agent.
 *
 * Inspired by Hermes Agent's sleep-time compute and OpenClaw's always-on pattern.
 * Runs background thinking cycles to consolidate memories, optimize skills,
 * predict user needs, and generate proactive suggestions.
 *
 * Usage:
 * ```ts
 * import { BackgroundThinker } from '@cody-agent/proactive';
 *
 * const thinker = new BackgroundThinker(memoryOrchestrator, evolveEngine);
 * thinker.start();
 * ```
 */

export { BackgroundThinker } from './background-thinker.ts';

export type {
  Thought,
  ThoughtType,
  ThoughtPriority,
  ThoughtStatus,
  ThoughtResult,
  ProactiveSuggestion,
  SuggestionType,
  ProactiveEngineConfig,
} from './types.ts';

export { defaultProactiveEngineConfig } from './types.ts';
