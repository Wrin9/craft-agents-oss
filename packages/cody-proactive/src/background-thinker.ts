/**
 * Background Thinker — the always-on thinking engine.
 *
 * Inspired by Hermes Agent's closed learning loop and Letta's sleep-time compute.
 * Runs periodically in the background to:
 * - Consolidate memories
 * - Optimize skills
 * - Detect patterns and predict needs
 * - Generate proactive suggestions
 */

import type { CodyMemoryOrchestrator } from '@cody-agent/memory';
import type { LTKEvolveEngine } from '@cody-agent/evolve';
import type {
  Thought,
  ThoughtType,
  ThoughtPriority,
  ThoughtResult,
  ProactiveSuggestion,
  ProactiveEngineConfig,
} from './types.ts';
import { defaultProactiveEngineConfig } from './types.ts';

/**
 * Background Thinker
 *
 * Maintains a priority queue of thoughts and processes them
 * in the background, generating suggestions and driving
 * autonomous improvements.
 */
export class BackgroundThinker {
  private readonly config: ProactiveEngineConfig;
  private readonly memory: CodyMemoryOrchestrator;
  private readonly evolve: LTKEvolveEngine;
  private thoughtQueue: Thought[] = [];
  private suggestions: Map<string, ProactiveSuggestion> = new Map();
  private timer: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private thoughtCounter = 0;

  constructor(
    memory: CodyMemoryOrchestrator,
    evolve: LTKEvolveEngine,
    config?: Partial<ProactiveEngineConfig>,
  ) {
    this.config = { ...defaultProactiveEngineConfig(), ...config };
    this.memory = memory;
    this.evolve = evolve;
  }

  // ── Lifecycle ───────────────────────────────────────────────────

  /** Start background thinking */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(
      () => void this.thinkCycle(),
      this.config.thinkingIntervalMinutes * 60 * 1000,
    );
  }

  /** Stop background thinking */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  // ── Thought Management ──────────────────────────────────────────

  /** Add a thought to the queue */
  enqueueThought(input: {
    type: ThoughtType;
    priority?: ThoughtPriority;
    description: string;
    context: string;
    scheduledAt?: string;
  }): Thought {
    const thought: Thought = {
      id: `thought_${++this.thoughtCounter}_${Date.now()}`,
      type: input.type,
      priority: input.priority ?? 'medium',
      description: input.description,
      context: input.context,
      createdAt: new Date().toISOString(),
      scheduledAt: input.scheduledAt,
      status: 'pending',
      retryCount: 0,
    };
    this.thoughtQueue.push(thought);
    this.sortQueue();
    return thought;
  }

  /** Sort thought queue by priority */
  private sortQueue(): void {
    const priorityOrder: Record<ThoughtPriority, number> = {
      urgent: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    this.thoughtQueue.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }

  /** Get pending thoughts */
  getPendingThoughts(): readonly Thought[] {
    return this.thoughtQueue.filter(t => t.status === 'pending');
  }

  /** Get recent suggestions */
  getSuggestions(limit = 10): ProactiveSuggestion[] {
    return [...this.suggestions.values()]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, limit);
  }

  /** Dismiss a suggestion */
  dismissSuggestion(id: string): boolean {
    const suggestion = this.suggestions.get(id);
    if (suggestion) {
      suggestion.status = 'dismissed';
      return true;
    }
    return false;
  }

  /** Accept a suggestion */
  acceptSuggestion(id: string): boolean {
    const suggestion = this.suggestions.get(id);
    if (suggestion) {
      suggestion.status = 'accepted';
      return true;
    }
    return false;
  }

  // ── Think Cycle ─────────────────────────────────────────────────

  /** Run one thinking cycle */
  private async thinkCycle(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      // 1. Generate new thoughts based on current state
      await this.generateThoughts();

      // 2. Process pending thoughts (up to max per cycle)
      await this.processThoughts(this.config.maxThoughtsPerCycle);

      // 3. Generate suggestions from results
      await this.generateSuggestions();
    } finally {
      this.isRunning = false;
    }
  }

  /** Generate thoughts based on current memory state */
  private async generateThoughts(): Promise<void> {
    const stats = await this.memory.getStats();

    // Memory consolidation thought
    if (stats.episodicCount > 100) {
      this.enqueueThought({
        type: 'memory_consolidation',
        priority: 'low',
        description: 'Consolidate episodic memories',
        context: `${stats.episodicCount} episodes stored, running consolidation`,
      });
    }

    // Skill optimization thought
    if (stats.proceduralCount > 5) {
      this.enqueueThought({
        type: 'skill_optimization',
        priority: 'low',
        description: 'Review and optimize learned skills',
        context: `${stats.proceduralCount} skills available for review`,
      });
    }

    // Self-review thought (periodic)
    this.enqueueThought({
      type: 'self_review',
      priority: 'medium',
      description: 'Review recent performance and identify improvements',
      context: `${stats.episodicCount} total experiences, ${stats.semanticCount} knowledge entries`,
    });

    // Experience reflection
    if (stats.episodicCount > 0) {
      this.enqueueThought({
        type: 'experience_reflection',
        priority: 'medium',
        description: 'Reflect on recent experiences',
        context: 'Analyze recent episodes for patterns and insights',
      });
    }

    // Pattern prediction
    this.enqueueThought({
      type: 'pattern_prediction',
      priority: 'low',
      description: 'Analyze user patterns and predict next actions',
      context: 'Build proactive readiness based on observed patterns',
    });
  }

  /** Process pending thoughts */
  private async processThoughts(maxCount: number): Promise<void> {
    const pending = this.thoughtQueue
      .filter(t => t.status === 'pending')
      .slice(0, maxCount);

    for (const thought of pending) {
      try {
        thought.status = 'running';
        thought.result = await this.executeThought(thought);
        thought.status = 'completed';
      } catch (error) {
        thought.status = 'failed';
        thought.retryCount++;
        if (thought.retryCount < 3) {
          thought.status = 'pending'; // Re-queue for retry
        }
      }
    }
  }

  /** Execute a single thought */
  private async executeThought(thought: Thought): Promise<ThoughtResult> {
    switch (thought.type) {
      case 'memory_consolidation':
        return this.executeConsolidation(thought);
      case 'skill_optimization':
        return this.executeSkillOptimization(thought);
      case 'proactive_check':
        return this.executeProactiveCheck(thought);
      case 'pattern_prediction':
        return this.executePatternPrediction(thought);
      case 'self_review':
        return this.executeSelfReview(thought);
      case 'knowledge_gap_detection':
        return this.executeKnowledgeGapDetection(thought);
      case 'experience_reflection':
        return this.executeExperienceReflection(thought);
      default:
        return { action: 'skipped', findings: [], notifyUser: false };
    }
  }

  // ── Thought Executors ───────────────────────────────────────────

  private async executeConsolidation(thought: Thought): Promise<ThoughtResult> {
    const report = await this.memory.runConsolidation();
    return {
      action: `Consolidated memories: ${report.reinforced} reinforced, ${report.decayed} decayed, ${report.merged} merged`,
      findings: [
        `Total reinforced: ${report.reinforced}`,
        `Total decayed: ${report.decayed}`,
        `Total promoted to skills: ${report.promoted}`,
      ],
      notifyUser: false,
    };
  }

  private async executeSkillOptimization(thought: Thought): Promise<ThoughtResult> {
    const topSkills = this.memory.procedural.getTopPerforming(10);
    const findings: string[] = [];

    for (const skill of topSkills) {
      if (skill.metrics.successRate < 0.5 && skill.metrics.useCount > 5) {
        findings.push(`Skill "${skill.name}" has low success rate (${(skill.metrics.successRate * 100).toFixed(0)}%) — consider refinement`);
      }
    }

    return {
      action: `Reviewed ${topSkills.length} skills`,
      findings,
      notifyUser: findings.length > 0,
      notificationMessage: findings.length > 0
        ? `${findings.length} skills need attention`
        : undefined,
    };
  }

  private async executeProactiveCheck(thought: Thought): Promise<ThoughtResult> {
    // Check for pending tasks, source changes, etc.
    const recentEpisodes = await this.memory.getEpisodesForReflection(5);
    const findings: string[] = [];

    // Check for unfinished tasks
    const partialEpisodes = recentEpisodes.filter(e => e.outcome === 'partial');
    if (partialEpisodes.length > 0) {
      findings.push(`${partialEpisodes.length} tasks were partially completed — follow up may be needed`);
    }

    return {
      action: 'Checked for pending items',
      findings,
      notifyUser: partialEpisodes.length > 0,
      notificationMessage: partialEpisodes.length > 0
        ? `You have ${partialEpisodes.length} partially completed tasks`
        : undefined,
    };
  }

  private async executePatternPrediction(thought: Thought): Promise<ThoughtResult> {
    const profile = this.memory.semantic.buildUserProfile();
    const findings: string[] = [];

    if (profile.taskPatterns.length > 0) {
      findings.push(`Detected ${profile.taskPatterns.length} recurring task patterns`);
    }

    if (profile.expertise.length > 0) {
      findings.push(`User expertise areas: ${profile.expertise.join(', ')}`);
    }

    return {
      action: 'Analyzed user patterns',
      findings,
      notifyUser: false,
      data: { userProfile: profile },
    };
  }

  private async executeSelfReview(thought: Thought): Promise<ThoughtResult> {
    const recentEpisodes = await this.memory.getEpisodesForReflection(20);
    const stats = await this.memory.getStats();
    const findings: string[] = [];

    if (recentEpisodes.length > 0) {
      const successRate = recentEpisodes.filter(e => e.outcome === 'success').length / recentEpisodes.length;
      findings.push(`Recent success rate: ${(successRate * 100).toFixed(0)}%`);

      if (successRate < 0.5) {
        findings.push('Success rate is below 50% — review approach strategies');
      }
    }

    findings.push(`Memory stats: ${stats.episodicCount} episodes, ${stats.semanticCount} facts, ${stats.proceduralCount} skills`);

    return {
      action: 'Self-review completed',
      findings,
      notifyUser: false,
    };
  }

  private async executeKnowledgeGapDetection(thought: Thought): Promise<ThoughtResult> {
    const failedEpisodes = await this.memory.getFailedEpisodes(10);
    const findings: string[] = [];

    // Detect common failure patterns
    const failureTasks = failedEpisodes.map(e => e.task);
    const uniqueFailures = [...new Set(failureTasks)];

    if (uniqueFailures.length > 0) {
      findings.push(`${uniqueFailures.length} unique failure types detected`);
      for (const task of uniqueFailures.slice(0, 3)) {
        findings.push(`Knowledge gap: "${task}"`);
      }
    }

    return {
      action: 'Knowledge gap analysis completed',
      findings,
      notifyUser: uniqueFailures.length > 3,
      notificationMessage: uniqueFailures.length > 3
        ? `Detected ${uniqueFailures.length} knowledge gaps — consider providing more context`
        : undefined,
    };
  }

  private async executeExperienceReflection(thought: Thought): Promise<ThoughtResult> {
    const recentEpisodes = await this.memory.getEpisodesForReflection(10);
    if (recentEpisodes.length === 0) {
      return { action: 'No recent episodes to reflect on', findings: [], notifyUser: false };
    }

    const result = await this.evolve.reflect('immediate', recentEpisodes);
    const findings = result.insights;

    // Apply results if beneficial
    if (result.skillActions.length > 0 || result.internalizationTargets.length > 0) {
      await this.evolve.applyReflectionResult(result);
    }

    return {
      action: `Reflected on ${recentEpisodes.length} episodes, score: ${result.performanceScore}/100`,
      findings,
      notifyUser: result.performanceScore < 40,
      notificationMessage: result.performanceScore < 40
        ? 'Performance score is low — review needed'
        : undefined,
    };
  }

  // ── Suggestion Generation ───────────────────────────────────────

  /** Generate proactive suggestions from completed thoughts */
  private async generateSuggestions(): Promise<void> {
    const completedThoughts = this.thoughtQueue.filter(
      t => t.status === 'completed' && t.result?.notifyUser,
    );

    for (const thought of completedThoughts) {
      if (!thought.result) continue;

      const suggestion: ProactiveSuggestion = {
        id: `sug_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        type: this.mapThoughtTypeToSuggestionType(thought.type),
        title: thought.description,
        description: thought.result.findings.join('\n'),
        confidence: 0.7,
        requiresUserAction: thought.result.notificationMessage !== undefined,
        suggestedAction: thought.result.notificationMessage,
        priority: thought.priority,
        status: 'pending',
      };

      this.suggestions.set(suggestion.id, suggestion);
    }

    // Clean up old completed thoughts
    this.thoughtQueue = this.thoughtQueue.filter(
      t => t.status === 'pending' || t.status === 'running',
    );
  }

  private mapThoughtTypeToSuggestionType(type: ThoughtType): ProactiveSuggestion['type'] {
    switch (type) {
      case 'proactive_check': return 'task_reminder';
      case 'skill_optimization': return 'skill_suggestion';
      case 'pattern_prediction': return 'preparation';
      case 'knowledge_gap_detection': return 'knowledge_update';
      case 'experience_reflection': return 'follow_up';
      default: return 'optimization';
    }
  }

  // ── Status ──────────────────────────────────────────────────────

  get isThinkerRunning(): boolean {
    return this.isRunning;
  }

  get thoughtQueueSize(): number {
    return this.thoughtQueue.filter(t => t.status === 'pending').length;
  }

  get suggestionCount(): number {
    return this.suggestions.size;
  }
}
