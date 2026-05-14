/**
 * LTK-Evolve Engine — the continuous learning engine for Cody Agent.
 *
 * Implements the ELL (Experience-driven Lifelong Learning) framework:
 *   Experience Exploration → Reflection → Skill Learning → Knowledge Internalization
 *
 * The engine listens to session events, extracts experiences, reflects on them,
 * and drives the creation/refinement of skills and knowledge.
 */

import type { Episode, ProceduralEntry } from '@cody-agent/memory';
import type { CodyMemoryOrchestrator } from '@cody-agent/memory';
import type {
  EvolveEngineConfig,
  CodyExperience,
  ReflectionResult,
  ReflectionLevel,
  SkillAction,
  InternalizationTarget,
} from './types.ts';
import { defaultEvolveEngineConfig } from './types.ts';

/**
 * LTK-Evolve Engine
 */
export class LTKEvolveEngine {
  private readonly config: EvolveEngineConfig;
  private readonly memory: CodyMemoryOrchestrator;
  private experiences: Map<string, CodyExperience> = new Map();
  private episodeCounter = 0;
  private periodicTimer: ReturnType<typeof setInterval> | null = null;

  constructor(memory: CodyMemoryOrchestrator, config?: Partial<EvolveEngineConfig>) {
    this.config = { ...defaultEvolveEngineConfig(), ...config };
    this.memory = memory;
  }

  // ── Lifecycle ───────────────────────────────────────────────────

  /** Start the evolve engine */
  start(): void {
    // Set up periodic reflection
    this.periodicTimer = setInterval(
      () => void this.runPeriodicReflection(),
      this.config.periodicReflectionIntervalMinutes * 60 * 1000,
    );
  }

  /** Stop the evolve engine */
  stop(): void {
    if (this.periodicTimer) {
      clearInterval(this.periodicTimer);
      this.periodicTimer = null;
    }
  }

  // ── Experience Exploration ──────────────────────────────────────

  /**
   * Process a completed episode.
   * Called by the agent after each task execution.
   */
  async processEpisode(episode: Episode): Promise<ReflectionResult | null> {
    this.episodeCounter++;

    // Extract experience from episode
    const experience = this.extractExperience(episode);
    this.experiences.set(experience.id, experience);

    // Immediate reflection if threshold met
    if (this.episodeCounter % this.config.immediateReflectionInterval === 0) {
      return this.reflect('immediate', [episode]);
    }

    // Deep reflection if enough experiences accumulated
    if (this.experiences.size >= this.config.deepReflectionThreshold) {
      return this.runDeepReflection();
    }

    return null;
  }

  /** Extract a codified experience from a raw episode */
  private extractExperience(episode: Episode): CodyExperience {
    const id = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Classify experience type
    const type = this.classifyExperience(episode);

    // Extract lessons
    const lessonsLearned = episode.lessonsLearned.length > 0
      ? episode.lessonsLearned
      : this.inferLessons(episode);

    // Generate improvement suggestions
    const improvementSuggestions = episode.outcome !== 'success'
      ? this.generateImprovementSuggestions(episode)
      : [];

    return {
      id,
      sourceEpisodeId: episode.id,
      timestamp: new Date().toISOString(),
      type,
      task: episode.task,
      approach: episode.approach,
      outcome: episode.outcome,
      lessonsLearned,
      improvementSuggestions,
      confidence: this.calculateConfidence(episode),
      internalized: false,
      generation: 0,
      tags: episode.tags,
    };
  }

  /** Classify the type of experience */
  private classifyExperience(episode: Episode): CodyExperience['type'] {
    if (episode.outcome === 'success' && episode.selfAssessment && episode.selfAssessment >= 8) {
      return 'success_pattern';
    }
    if (episode.outcome === 'failure') {
      return 'failure_analysis';
    }
    if (episode.userFeedback === 'positive') {
      return 'preference_signal';
    }
    if (episode.trajectory.length > 5 && episode.outcome === 'success') {
      return 'skill_candidate';
    }
    if (episode.outcome === 'partial') {
      return 'optimization';
    }
    return 'knowledge_gap';
  }

  /** Infer lessons from an episode when none were explicitly provided */
  private inferLessons(episode: Episode): string[] {
    const lessons: string[] = [];

    if (episode.outcome === 'success') {
      lessons.push(`Approach "${episode.approach.slice(0, 50)}" was effective for "${episode.task}"`);
    } else if (episode.outcome === 'failure') {
      lessons.push(`Approach "${episode.approach.slice(0, 50)}" was not effective for "${episode.task}"`);
    }

    // Analyze tool usage
    const toolCalls = episode.trajectory.filter(s => s.type === 'tool_call');
    if (toolCalls.length > 0) {
      const toolNames = [...new Set(toolCalls.map(s => s.toolName).filter(Boolean))];
      lessons.push(`Tools used: ${toolNames.join(', ')}`);
    }

    return lessons;
  }

  /** Generate suggestions for improvement */
  private generateImprovementSuggestions(episode: Episode): string[] {
    const suggestions: string[] = [];

    if (episode.outcome === 'failure') {
      suggestions.push('Consider alternative approaches or tools');
      suggestions.push('Review the task requirements more carefully before starting');
    }

    if (episode.outcome === 'partial') {
      suggestions.push('Identify which steps succeeded and which need adjustment');
      suggestions.push('Consider breaking the task into smaller subtasks');
    }

    if (episode.durationMs > 60000) {
      suggestions.push('Task took longer than expected — look for efficiency improvements');
    }

    return suggestions;
  }

  /** Calculate confidence in an experience */
  private calculateConfidence(episode: Episode): number {
    let confidence = 0.5;

    if (episode.userFeedback === 'positive') confidence += 0.3;
    if (episode.userFeedback === 'negative') confidence += 0.1;
    if (episode.selfAssessment) confidence += (episode.selfAssessment / 10) * 0.2;
    if (episode.outcome === 'success') confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  // ── Reflection ──────────────────────────────────────────────────

  /** Run reflection on a set of episodes */
  async reflect(level: ReflectionLevel, episodes: Episode[]): Promise<ReflectionResult> {
    const id = `ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Extract experiences from the episodes
    const extractedExperiences = episodes.map(ep => {
      let exp = this.findExperienceByEpisode(ep.id);
      if (!exp) {
        exp = this.extractExperience(ep);
        this.experiences.set(exp.id, exp);
      }
      return exp;
    });

    // Analyze patterns
    const insights = this.analyzePatterns(extractedExperiences, level);

    // Generate skill actions
    const skillActions = this.generateSkillActions(extractedExperiences);

    // Generate internalization targets
    const internalizationTargets = this.generateInternalizationTargets(extractedExperiences);

    // Calculate performance score
    const performanceScore = this.calculatePerformanceScore(episodes);

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      insights,
      skillActions,
      performanceScore,
    );

    return {
      id,
      timestamp: new Date().toISOString(),
      level,
      episodeIds: episodes.map(e => e.id),
      extractedExperiences,
      performanceScore,
      insights,
      recommendations,
      skillActions,
      internalizationTargets,
    };
  }

  /** Run periodic reflection on recent episodes */
  private async runPeriodicReflection(): Promise<ReflectionResult | null> {
    const recentEpisodes = await this.memory.getEpisodesForReflection(20);
    if (recentEpisodes.length === 0) return null;
    return this.reflect('periodic', recentEpisodes);
  }

  /** Run deep reflection on all accumulated experiences */
  private async runDeepReflection(): Promise<ReflectionResult> {
    const recentEpisodes = await this.memory.getEpisodesForReflection(50);
    const failedEpisodes = await this.memory.getFailedEpisodes(20);
    const allEpisodes = [...recentEpisodes, ...failedEpisodes];

    const result = await this.reflect('deep', allEpisodes);

    // Apply deep reflection results
    await this.applyReflectionResult(result);

    return result;
  }

  // ── Pattern Analysis ────────────────────────────────────────────

  /** Analyze patterns across experiences */
  private analyzePatterns(experiences: CodyExperience[], level: ReflectionLevel): string[] {
    const insights: string[] = [];

    // Success patterns
    const successes = experiences.filter(e => e.outcome === 'success');
    const failures = experiences.filter(e => e.outcome === 'failure');

    if (successes.length > failures.length * 2) {
      insights.push(`High success ratio (${successes.length}/${experiences.length}) — current approach is effective`);
    }

    if (failures.length > successes.length) {
      insights.push(`Low success ratio — approach needs significant adjustment`);
    }

    // Common failure patterns
    if (level === 'deep') {
      const failureReasons = failures.flatMap(e => e.improvementSuggestions);
      const reasonCounts = new Map<string, number>();
      for (const reason of failureReasons) {
        reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
      }
      for (const [reason, count] of reasonCounts) {
        if (count >= 2) {
          insights.push(`Recurring issue: "${reason}" (seen ${count} times)`);
        }
      }
    }

    // User preference signals
    const preferences = experiences.filter(e => e.type === 'preference_signal');
    if (preferences.length > 0) {
      insights.push(`${preferences.length} preference signals detected — consider updating user profile`);
    }

    // Skill candidates
    const skillCandidates = experiences.filter(e => e.type === 'skill_candidate');
    if (skillCandidates.length >= 2) {
      insights.push(`${skillCandidates.length} skill candidates identified — ready for skill extraction`);
    }

    return insights;
  }

  /** Generate skill actions from experiences */
  private generateSkillActions(experiences: CodyExperience[]): SkillAction[] {
    const actions: SkillAction[] = [];

    // Find skill candidates with high confidence
    const candidates = experiences.filter(
      e => e.type === 'skill_candidate' && e.confidence >= this.config.skillPromotionSuccessRate,
    );

    for (const candidate of candidates) {
      actions.push({
        type: 'create',
        name: candidate.task.toLowerCase().replace(/\s+/g, '-').slice(0, 50),
        procedure: candidate.approach,
        reason: `High-confidence success pattern (confidence: ${candidate.confidence.toFixed(2)})`,
        sourceExperiences: [candidate.id],
      });
    }

    // Find experiences that suggest refining existing skills
    const optimizations = experiences.filter(e => e.type === 'optimization');
    for (const opt of optimizations) {
      actions.push({
        type: 'refine',
        name: opt.task.toLowerCase().replace(/\s+/g, '-').slice(0, 50),
        procedure: opt.approach,
        reason: `Optimization opportunity identified: ${opt.improvementSuggestions.join('; ')}`,
        sourceExperiences: [opt.id],
      });
    }

    return actions;
  }

  /** Generate knowledge internalization targets */
  private generateInternalizationTargets(experiences: CodyExperience[]): InternalizationTarget[] {
    const targets: InternalizationTarget[] = [];

    for (const exp of experiences) {
      if (exp.confidence < this.config.internalizationConfidenceThreshold) continue;

      // User preference signals → user preference storage
      if (exp.type === 'preference_signal') {
        for (const lesson of exp.lessonsLearned) {
          targets.push({
            type: 'user_preference',
            key: `preference_${Date.now()}`,
            value: lesson,
            confidence: exp.confidence,
          });
        }
      }

      // Success patterns → core memory
      if (exp.type === 'success_pattern' && exp.confidence >= 0.9) {
        targets.push({
          type: 'core_memory',
          key: exp.task,
          value: exp.approach,
          confidence: exp.confidence,
        });
      }
    }

    return targets;
  }

  /** Calculate performance score from episodes */
  private calculatePerformanceScore(episodes: Episode[]): number {
    if (episodes.length === 0) return 50;

    const successRate = episodes.filter(e => e.outcome === 'success').length / episodes.length;
    const avgSelfAssessment = episodes
      .filter(e => e.selfAssessment !== undefined)
      .reduce((sum, e) => sum + (e.selfAssessment ?? 0), 0) / episodes.length || 5;

    const feedbackScore = episodes.filter(e => e.userFeedback === 'positive').length / episodes.length;

    return Math.round(
      successRate * 50 + // 0-50 points
      (avgSelfAssessment / 10) * 30 + // 0-30 points
      feedbackScore * 20, // 0-20 points
    );
  }

  /** Generate actionable recommendations */
  private generateRecommendations(
    insights: string[],
    skillActions: SkillAction[],
    performanceScore: number,
  ): string[] {
    const recommendations: string[] = [...insights];

    if (performanceScore < 50) {
      recommendations.push('Performance is below average — consider reviewing fundamental approaches');
    }

    if (skillActions.length > 0) {
      recommendations.push(`${skillActions.length} skill actions pending — review and apply`);
    }

    return recommendations;
  }

  // ── Apply Results ───────────────────────────────────────────────

  /** Apply a reflection result to the memory system */
  async applyReflectionResult(result: ReflectionResult): Promise<void> {
    // 1. Apply skill actions
    for (const action of result.skillActions) {
      switch (action.type) {
        case 'create':
          if (action.procedure) {
            await this.memory.procedural.create({
              name: action.name,
              trigger: action.name,
              procedure: action.procedure,
              origin: 'auto_generated',
              tags: ['evolve-auto'],
            });
          }
          break;
        case 'refine': {
          const existing = this.memory.procedural.getByName(action.name);
          if (existing && action.procedure) {
            await this.memory.procedural.refine(existing.id, action.procedure, action.reason);
          }
          break;
        }
      }
    }

    // 2. Apply internalization targets
    for (const target of result.internalizationTargets) {
      switch (target.type) {
        case 'user_preference':
          await this.memory.setUserPreference(target.key, target.value);
          break;
        case 'core_memory':
          await this.memory.storeFact(target.key, target.value, target.confidence);
          break;
      }
    }

    // 3. Persist changes
    await this.memory.persist();
  }

  // ── Helpers ─────────────────────────────────────────────────────

  /** Find an experience by source episode ID */
  private findExperienceByEpisode(episodeId: string): CodyExperience | undefined {
    for (const exp of this.experiences.values()) {
      if (exp.sourceEpisodeId === episodeId) return exp;
    }
    return undefined;
  }

  /** Get all experiences */
  getExperiences(): CodyExperience[] {
    return [...this.experiences.values()];
  }

  /** Get experience count */
  get experienceCount(): number {
    return this.experiences.size;
  }
}
