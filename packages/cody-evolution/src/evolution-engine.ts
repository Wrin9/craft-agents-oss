/**
 * Self-Evolution Engine — the master orchestrator for Cody Agent's self-improvement.
 *
 * Coordinates:
 * - Performance tracking across all dimensions
 * - Strategy selection and evaluation (meta-learning)
 * - Safe self-modification with rollback support
 * - Complete evolution logging for transparency
 *
 * This is the top-level system that ties together Memory, Evolve, and Proactive.
 */

import { join } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import type { CodyMemoryOrchestrator } from '@cody-agent/memory';
import type { LTKEvolveEngine } from '@cody-agent/evolve';
import type { BackgroundThinker } from '@cody-agent/proactive';
import type {
  EvolutionConfig,
  EvolutionStrategy,
  EvolutionStrategyType,
  EvolutionLogEntry,
  PerformanceSnapshot,
  PerformanceTrend,
  SelfModification,
  RiskLevel,
  ModificationDimension,
} from './types.ts';
import { defaultEvolutionConfig } from './types.ts';

/**
 * CodyEvolutionEngine
 *
 * The master self-evolution orchestrator.
 */
export class CodyEvolutionEngine {
  private readonly config: EvolutionConfig;
  private readonly memory: CodyMemoryOrchestrator;
  private readonly evolve: LTKEvolveEngine;
  private readonly thinker: BackgroundThinker;

  private strategies: Map<EvolutionStrategyType, EvolutionStrategy> = new Map();
  private modifications: Map<string, SelfModification> = new Map();
  private performanceHistory: PerformanceSnapshot[] = [];
  private evolutionLog: EvolutionLogEntry[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private logCounter = 0;

  constructor(
    memory: CodyMemoryOrchestrator,
    evolve: LTKEvolveEngine,
    thinker: BackgroundThinker,
    config?: Partial<EvolutionConfig>,
    dataDir?: string,
  ) {
    this.config = { ...defaultEvolutionConfig(), ...config };
    this.memory = memory;
    this.evolve = evolve;
    this.thinker = thinker;

    if (dataDir) {
      mkdirSync(dataDir, { recursive: true });
    }

    // Initialize default strategies
    this.initStrategies();
  }

  // ── Lifecycle ───────────────────────────────────────────────────

  /** Start the evolution engine */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(
      () => void this.runEvolutionCycle(),
      this.config.evolutionCycleIntervalMinutes * 60 * 1000,
    );
  }

  /** Stop the evolution engine */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Initialize default evolution strategies */
  private initStrategies(): void {
    const defaultStrategies: EvolutionStrategyType[] = [
      'skill_creation',
      'skill_refinement',
      'knowledge_consolidation',
      'preference_learning',
      'approach_optimization',
      'context_optimization',
      'memory_management',
    ];

    for (const type of defaultStrategies) {
      this.strategies.set(type, {
        type,
        applicationCount: 0,
        averageImprovement: 0,
        lastAppliedAt: new Date().toISOString(),
        active: true,
      });
    }
  }

  // ── Evolution Cycle ─────────────────────────────────────────────

  /** Run a complete evolution cycle */
  async runEvolutionCycle(): Promise<void> {
    // 1. Capture performance snapshot
    if (this.config.enablePerformanceTracking) {
      const snapshot = await this.capturePerformanceSnapshot();
      this.performanceHistory.push(snapshot);

      // Trim history to last 100 snapshots
      if (this.performanceHistory.length > 100) {
        this.performanceHistory = this.performanceHistory.slice(-100);
      }
    }

    // 2. Evaluate strategy effectiveness (meta-learning)
    this.evaluateStrategies();

    // 3. Generate proposed modifications
    const proposals = await this.generateModifications();

    // 4. Apply safe modifications
    for (const proposal of proposals.slice(0, this.config.maxModificationsPerCycle)) {
      await this.applyModification(proposal);
    }

    // 5. Persist evolution log
    this.persistLog();
  }

  // ── Performance Tracking ────────────────────────────────────────

  /** Capture a performance snapshot */
  private async capturePerformanceSnapshot(): Promise<PerformanceSnapshot> {
    const stats = await this.memory.getStats();
    const recentEpisodes = await this.memory.getEpisodesForReflection(20);

    const taskSuccessRate = recentEpisodes.length > 0
      ? recentEpisodes.filter(e => e.outcome === 'success').length / recentEpisodes.length
      : 0;

    const avgTaskDuration = recentEpisodes.length > 0
      ? recentEpisodes.reduce((sum, e) => sum + e.durationMs, 0) / recentEpisodes.length
      : 0;

    const userSatisfaction = recentEpisodes.length > 0
      ? recentEpisodes.filter(e => e.userFeedback === 'positive').length / recentEpisodes.length
      : 0;

    const totalSkills = stats.proceduralCount;
    const usedSkills = [...await this.memory.procedural.search('', 100)]
      .filter(s => s.metrics.useCount > 0).length;
    const skillUtilization = totalSkills > 0 ? usedSkills / totalSkills : 0;

    const memoryEfficiency = stats.episodicCount > 0
      ? Math.min(stats.semanticCount / (stats.episodicCount * 0.1), 1)
      : 0;

    const evolutionScore = Math.round(
      taskSuccessRate * 30 +
      userSatisfaction * 25 +
      skillUtilization * 20 +
      memoryEfficiency * 15 +
      (stats.proceduralCount > 0 ? 10 : 0),
    );

    return {
      timestamp: new Date().toISOString(),
      taskSuccessRate,
      avgTaskDuration,
      userSatisfaction,
      skillUtilization,
      memoryEfficiency,
      contextRelevance: 0.5, // Placeholder — would need actual metrics
      evolutionScore,
    };
  }

  /** Get performance trend */
  getPerformanceTrend(): PerformanceTrend {
    if (this.performanceHistory.length < 3) return 'stable';

    const recent = this.performanceHistory.slice(-5);
    const scores = recent.map(s => s.evolutionScore);
    const avgFirst = scores.slice(0, Math.floor(scores.length / 2)).reduce((a, b) => a + b, 0) / Math.floor(scores.length / 2);
    const avgSecond = scores.slice(Math.floor(scores.length / 2)).reduce((a, b) => a + b, 0) / (scores.length - Math.floor(scores.length / 2));

    if (avgSecond > avgFirst * 1.05) return 'improving';
    if (avgSecond < avgFirst * 0.95) return 'declining';
    return 'stable';
  }

  /** Get latest performance snapshot */
  getLatestPerformance(): PerformanceSnapshot | null {
    return this.performanceHistory.at(-1) ?? null;
  }

  /** Get performance history */
  getPerformanceHistory(): readonly PerformanceSnapshot[] {
    return this.performanceHistory;
  }

  // ── Meta-Learning ───────────────────────────────────────────────

  /** Evaluate and adjust strategy effectiveness */
  private evaluateStrategies(): void {
    for (const [type, strategy] of this.strategies) {
      // Check if recent evolution log entries show improvement
      const recentEntries = this.evolutionLog
        .filter(e => e.type === type && e.outcome)
        .slice(-10);

      if (recentEntries.length > 0) {
        const improvedCount = recentEntries.filter(e => e.outcome === 'improved').length;
        const degradedCount = recentEntries.filter(e => e.outcome === 'degraded').length;

        strategy.averageImprovement = (improvedCount - degradedCount) / recentEntries.length;

        // Deactivate consistently poor strategies
        if (strategy.averageImprovement < -0.3 && strategy.applicationCount > 5) {
          strategy.active = false;
        }
      }
    }
  }

  /** Get all strategies */
  getStrategies(): EvolutionStrategy[] {
    return [...this.strategies.values()];
  }

  /** Get the best-performing strategy */
  getBestStrategy(): EvolutionStrategy | null {
    let best: EvolutionStrategy | null = null;
    for (const strategy of this.strategies.values()) {
      if (!strategy.active) continue;
      if (!best || strategy.averageImprovement > best.averageImprovement) {
        best = strategy;
      }
    }
    return best;
  }

  // ── Self-Modification ───────────────────────────────────────────

  /** Generate proposed modifications based on current performance */
  private async generateModifications(): Promise<SelfModification[]> {
    const proposals: SelfModification[] = [];
    const performance = this.getLatestPerformance();

    if (!performance) return proposals;

    // Skill creation: if success rate is low, suggest creating new skills
    if (performance.taskSuccessRate < 0.6) {
      proposals.push(this.createModification(
        'skill_template',
        'Create new skills from successful patterns',
        'N/A',
        'Auto-analyze and extract skills from successful episodes',
        'low',
        0.7,
        `Task success rate is ${(performance.taskSuccessRate * 100).toFixed(0)}% — creating more skills may help`,
      ));
    }

    // Context optimization: if skill utilization is low
    if (performance.skillUtilization < 0.3 && performance.evolutionScore > 0) {
      proposals.push(this.createModification(
        'memory_strategy',
        'Increase context injection relevance threshold',
        '0.5',
        '0.6',
        'low',
        0.75,
        'Skill utilization is low — more selective context injection may improve relevance',
      ));
    }

    // Preference learning: always propose if we have enough data
    const stats = await this.memory.getStats();
    if (stats.episodicCount > 20) {
      proposals.push(this.createModification(
        'system_prompt',
        'Inject user profile into system prompt',
        'No profile injection',
        'Include user preferences and expertise in system prompt',
        'low',
        0.85,
        `Detected user patterns from ${stats.episodicCount} episodes`,
      ));
    }

    return proposals;
  }

  /** Create a modification proposal */
  private createModification(
    dimension: ModificationDimension,
    description: string,
    currentValue: string,
    proposedValue: string,
    riskLevel: RiskLevel,
    confidence: number,
    reason: string,
  ): SelfModification {
    return {
      id: `mod_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      dimension,
      description,
      currentValue,
      proposedValue,
      riskLevel,
      confidence,
      reason,
      status: 'proposed',
      proposedAt: new Date().toISOString(),
    };
  }

  /** Apply a modification if safe */
  private async applyModification(modification: SelfModification): Promise<void> {
    // Check if auto-application is allowed
    const canAutoApply = this.config.enableAutoModification &&
      this.isRiskAcceptable(modification.riskLevel) &&
      modification.confidence >= this.config.minConfidenceForModification;

    if (canAutoApply) {
      modification.status = 'applied';
      modification.appliedAt = new Date().toISOString();
    } else {
      modification.status = 'proposed';
    }

    this.modifications.set(modification.id, modification);

    // Log the modification
    this.logEntry({
      type: this.mapDimensionToStrategyType(modification.dimension),
      description: modification.description,
      before: modification.currentValue,
      after: modification.proposedValue,
      reason: modification.reason,
      confidence: modification.confidence,
      riskLevel: modification.riskLevel,
      autoApplied: modification.status === 'applied',
    });
  }

  /** Check if a risk level is acceptable for auto-application */
  private isRiskAcceptable(risk: RiskLevel): boolean {
    const levels: RiskLevel[] = ['low', 'medium', 'high'];
    const maxIdx = levels.indexOf(this.config.autoModificationMaxRisk);
    const riskIdx = levels.indexOf(risk);
    return riskIdx <= maxIdx;
  }

  private mapDimensionToStrategyType(dimension: ModificationDimension): EvolutionStrategyType {
    switch (dimension) {
      case 'system_prompt': return 'context_optimization';
      case 'skill_template': return 'skill_creation';
      case 'tool_preference': return 'approach_optimization';
      case 'memory_strategy': return 'memory_management';
      case 'automation_rule': return 'approach_optimization';
      case 'permission_config': return 'memory_management';
    }
  }

  // ── Evolution Log ───────────────────────────────────────────────

  /** Log an evolution entry */
  private logEntry(input: Omit<EvolutionLogEntry, 'id' | 'timestamp'>): void {
    const entry: EvolutionLogEntry = {
      id: `evo_${++this.logCounter}_${Date.now()}`,
      timestamp: new Date().toISOString(),
      ...input,
    };

    this.evolutionLog.push(entry);

    // Trim log if needed
    if (this.evolutionLog.length > this.config.maxLogEntries) {
      this.evolutionLog = this.evolutionLog.slice(-this.config.maxLogEntries);
    }
  }

  /** Persist evolution log to disk */
  private persistLog(): void {
    // In-memory only for now — can be extended to persist to file
  }

  /** Get evolution log */
  getEvolutionLog(limit = 50): readonly EvolutionLogEntry[] {
    return this.evolutionLog.slice(-limit);
  }

  /** Get pending modifications */
  getPendingModifications(): readonly SelfModification[] {
    return [...this.modifications.values()].filter(m => m.status === 'proposed');
  }

  /** Approve and apply a pending modification */
  approveModification(id: string): boolean {
    const mod = this.modifications.get(id);
    if (!mod || mod.status !== 'proposed') return false;
    mod.status = 'applied';
    mod.appliedAt = new Date().toISOString();
    return true;
  }

  /** Reject a pending modification */
  rejectModification(id: string): boolean {
    const mod = this.modifications.get(id);
    if (!mod || mod.status !== 'proposed') return false;
    mod.status = 'rejected';
    return true;
  }

  // ── Summary ─────────────────────────────────────────────────────

  /** Get a summary of the evolution system state */
  getSummary(): EvolutionSummary {
    const performance = this.getLatestPerformance();
    return {
      performanceTrend: this.getPerformanceTrend(),
      currentScore: performance?.evolutionScore ?? 0,
      totalEvolutions: this.evolutionLog.length,
      pendingModifications: this.getPendingModifications().length,
      activeStrategies: [...this.strategies.values()].filter(s => s.active).length,
      totalStrategies: this.strategies.size,
      bestStrategy: this.getBestStrategy()?.type ?? null,
    };
  }
}

export interface EvolutionSummary {
  performanceTrend: PerformanceTrend;
  currentScore: number;
  totalEvolutions: number;
  pendingModifications: number;
  activeStrategies: number;
  totalStrategies: number;
  bestStrategy: EvolutionStrategyType | null;
}
