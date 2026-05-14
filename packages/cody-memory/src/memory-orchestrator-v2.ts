/**
 * Memory Orchestrator — Brain-inspired 7-layer memory coordinator.
 *
 * Coordinates Working, Episodic, Semantic, Procedural, Core, and Cross-Context
 * memory layers, providing a unified API for the rest of the system.
 *
 * Key responsibilities:
 * - Multi-signal fusion retrieval (semantic vector + BM25 + KG)
 * - Inject relevant context into LLM prompts (Global Workspace Theory)
 * - Record experiences with emotional weight
 * - Manage FSRS-based memory lifecycle
 * - Trigger sleep consolidation cycles
 *
 * Architecture: Single SQLite file with FTS5 + vec0 virtual tables.
 */

import { CodyMemoryDB, EMBEDDING_DIMENSION } from './db/index.ts';
import { LocalEmbeddingProvider } from './embedding/index.ts';
import {
  calculateDecay,
  calculateEmotionalWeight,
  calculateRetrievability,
  fsrsOnSuccess,
  fsrsOnFailure,
  hebbianStrengthen,
  hebbianDecay,
  selectForReplay,
  simulateReplay,
  pruneWeakConnections,
  reciprocalRankFusion,
  selectWorkingMemoryItems,
} from './algorithms/index.ts';
import type {
  RankedItem,
  ReplayCandidate,
} from './algorithms/index.ts';
import { WorkingMemory } from './working/index.ts';
import type {
  CodyMemoryConfig,
  MemoryContextInjection,
  Episode,
  SemanticEntry,
  ProceduralEntry,
  UserProfile,
  EpisodeOutcome,
  TrajectoryStep,
  MemoryId,
  ConsolidationReport,
  CoreMemoryEntry,
  KnowledgeTriple,
  MemoryStats,
  MemorySource,
} from './types.ts';
import type { EmbeddingProvider } from './types.ts';

/** Default config for the 7-layer architecture */
function defaultConfig(dataDir: string, workspaceId: string): CodyMemoryConfig {
  return {
    workspaceDataDir: dataDir,
    workspaceId,
    working: { maxTokens: 80_000, evictionRatio: 0.7 },
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

export class CodyMemoryOrchestrator {
  readonly config: CodyMemoryConfig;
  readonly working: WorkingMemory;

  /** Backward-compat proxy: subsystems access memory via `.procedural` and `.semantic` */
  readonly procedural: ProceduralFacade;
  readonly semantic: SemanticFacade;

  private readonly db: CodyMemoryDB;
  private readonly embeddingProvider: LocalEmbeddingProvider;
  private initialized = false;
  private consolidationTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    workspaceDataDir: string,
    workspaceId: string,
    config?: Partial<CodyMemoryConfig>,
  ) {
    this.config = defaultConfig(workspaceDataDir, workspaceId);
    if (config) {
      Object.assign(this.config.working, config.working ?? {});
      Object.assign(this.config.episodic, config.episodic ?? {});
      Object.assign(this.config.semantic, config.semantic ?? {});
      Object.assign(this.config.procedural, config.procedural ?? {});
      Object.assign(this.config.consolidation, config.consolidation ?? {});
    }

    // Initialize SQLite database (single file for all memory layers)
    const dbPath = `${workspaceDataDir}/cody-memory.db`;
    this.db = new CodyMemoryDB(dbPath);

    // Initialize local embedding provider (Transformers.js)
    this.embeddingProvider = new LocalEmbeddingProvider();

    // L0 Working Memory (in-memory ring buffer)
    this.working = new WorkingMemory(this.config.working);

    // Backward-compat facades — translate old `.procedural` / `.semantic` calls to SQLite
    this.procedural = new ProceduralFacade(this.db, this.embeddingProvider);
    this.semantic = new SemanticFacade(this.db);
  }

  // ── Lifecycle ───────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Load embedding model
    await this.embeddingProvider.initialize();

    // Start consolidation timer (sleep consolidation)
    this.startConsolidation();

    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    this.stopConsolidation();
    this.db.close();
    this.initialized = false;
  }

  get isInitialized(): boolean {
    return this.initialized;
  }

  // ── L2: Episodic Memory ─────────────────────────────────────────

  async recordEpisode(input: {
    sessionId: string;
    task: string;
    approach: string;
    outcome: EpisodeOutcome;
    trajectory?: TrajectoryStep[];
    userFeedback?: 'positive' | 'negative' | 'neutral';
    selfAssessment?: number;
    lessonsLearned?: string[];
    tags?: string[];
    durationMs?: number;
  }): Promise<Episode> {
    const id = `ep_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const emotionWeight = calculateEmotionalWeight({
      outcome: input.outcome,
      userFeedback: input.userFeedback,
      selfAssessment: input.selfAssessment,
      complexity: input.trajectory?.length,
    });

    // Generate embedding
    const embedText = `${input.task}\n${input.approach}`;
    const embedding = await this.embeddingProvider.embed(embedText);

    // FSRS: new memories start with stability=1.0, difficulty based on outcome
    const initialStability = input.outcome === 'success' ? 1.5 : 1.0;
    const initialDifficulty = input.outcome === 'failure' ? 7.0 : 5.0;
    const nextReview = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 1 day

    // Insert into SQLite
    this.db.db.prepare(`
      INSERT INTO episodes (id, workspace_id, session_id, task, approach, outcome,
        lessons, trajectory, user_feedback, self_assessment, emotion_weight,
        stability, difficulty, next_review, importance, tags, duration_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, this.config.workspaceId, input.sessionId, input.task, input.approach, input.outcome,
      JSON.stringify(input.lessonsLearned ?? []),
      JSON.stringify(input.trajectory ?? []),
      input.userFeedback ?? null, input.selfAssessment ?? null, emotionWeight,
      initialStability, initialDifficulty, nextReview,
      Math.min(emotionWeight + 0.2, 1.0), // importance
      JSON.stringify(input.tags ?? []),
      input.durationMs ?? 0, now,
    );

    // Store vector
    const row = this.db.db.prepare('SELECT rowid FROM episodes WHERE id = ?').get(id) as any;
    if (row) {
      this.db.insertVector('episode_vectors', row.rowid, embedding);
    }

    return {
      id, timestamp: now, sessionId: input.sessionId,
      workspaceId: this.config.workspaceId,
      task: input.task, approach: input.approach, outcome: input.outcome,
      trajectory: input.trajectory ?? [],
      userFeedback: input.userFeedback, selfAssessment: input.selfAssessment,
      lessonsLearned: input.lessonsLearned ?? [],
      embedding, accessCount: 0, lastAccessedAt: now,
      importance: emotionWeight + 0.2,
      tags: input.tags ?? [], durationMs: input.durationMs ?? 0,
    };
  }

  // ── L3: Semantic Memory ──────────────────────────────────────────

  async storeFact(subject: string, content: string, confidence = 0.9, source: MemorySource = 'agent'): Promise<string> {
    const id = `fact_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const embedding = await this.embeddingProvider.embed(`${subject} ${content}`);

    this.db.db.prepare(`
      INSERT INTO facts (id, workspace_id, subject, content, confidence, source, tags, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, '[]', ?, ?)
    `).run(id, this.config.workspaceId, subject, content, confidence, source, now, now);

    const row = this.db.db.prepare('SELECT rowid FROM facts WHERE id = ?').get(id) as any;
    if (row) {
      this.db.insertVector('fact_vectors', row.rowid, embedding);
    }

    return id;
  }

  async setUserPreference(key: string, value: string): Promise<void> {
    // Upsert preference
    const existing = this.db.db.prepare(
      `SELECT id FROM facts WHERE workspace_id = ? AND fact_type = 'preference' AND subject = ?`,
    ).get(this.config.workspaceId, key) as any;

    if (existing) {
      this.db.db.prepare(`UPDATE facts SET content = ?, updated_at = datetime('now') WHERE id = ?`).run(value, existing.id);
    } else {
      await this.storeFact(key, value, 1.0, 'user');
      this.db.db.prepare(`UPDATE facts SET fact_type = 'preference' WHERE subject = ? AND workspace_id = ?`).run(key, this.config.workspaceId);
    }
  }

  // ── L3: Knowledge Graph (Hebbian Dynamics) ──────────────────────

  addKnowledge(subject: string, predicate: string, object: string, confidence = 0.8): void {
    const id = `triple_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.db.db.prepare(`
      INSERT INTO triples (id, workspace_id, subject, predicate, object, confidence, hebbian_weight)
      VALUES (?, ?, ?, ?, ?, ?, 0.5)
    `).run(id, this.config.workspaceId, subject, predicate, object, confidence);
  }

  /** Strengthen a KG edge via Hebbian learning */
  strengthenTriple(tripleId: string): void {
    const row = this.db.db.prepare('SELECT hebbian_weight FROM triples WHERE id = ?').get(tripleId) as any;
    if (row) {
      const newWeight = hebbianStrengthen(row.hebbian_weight);
      this.db.db.prepare('UPDATE triples SET hebbian_weight = ? WHERE id = ?').run(newWeight, tripleId);
    }
  }

  // ── L4: Procedural Memory (Skills) ──────────────────────────────

  async storeSkill(name: string, trigger: string, procedure: string, origin: 'manual' | 'auto_generated' | 'evolved' = 'manual'): Promise<string> {
    const id = `skill_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const embedding = await this.embeddingProvider.embed(`${name} ${trigger}`);

    this.db.db.prepare(`
      INSERT INTO skills (id, workspace_id, name, trigger_patterns, procedure, origin, tags, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, '[]', ?, ?)
    `).run(id, this.config.workspaceId, name, JSON.stringify([trigger]), procedure, origin, now, now);

    const row = this.db.db.prepare('SELECT rowid FROM skills WHERE id = ?').get(id) as any;
    if (row) {
      this.db.insertVector('skill_vectors', row.rowid, embedding);
    }

    return id;
  }

  // ── L5: Core Memory (Never decays) ──────────────────────────────

  setCoreMemory(category: 'identity' | 'goal' | 'preference' | 'constraint', content: string): void {
    // Upsert by category
    const existing = this.db.db.prepare('SELECT id FROM core_memory WHERE category = ?').get(category) as any;
    if (existing) {
      this.db.db.prepare(`UPDATE core_memory SET content = ?, updated_at = datetime('now') WHERE id = ?`).run(content, existing.id);
    } else {
      const id = `core_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      this.db.db.prepare(`INSERT INTO core_memory (id, category, content) VALUES (?, ?, ?)`).run(id, category, content);
    }
  }

  getCoreMemory(): CoreMemoryEntry[] {
    return this.db.db.prepare('SELECT * FROM core_memory ORDER BY category').all() as CoreMemoryEntry[];
  }

  // ── Multi-Signal Fusion Retrieval ────────────────────────────────

  /**
   * Get context for an incoming prompt using multi-signal fusion.
   * Signal 1: Semantic vector search (weight 0.5)
   * Signal 2: BM25 full-text search (weight 0.3)
   * Signal 3: Knowledge graph traversal (weight 0.2)
   *
   * Then apply Global Workspace Theory: memories compete for limited slots (7±2).
   */
  async getContextForPrompt(userMessage: string): Promise<MemoryContextInjection> {
    const queryEmbedding = await this.embeddingProvider.embed(userMessage);

    // ── Signal 1: Semantic Vector Search ──
    const episodeVecResults = this.db.searchVectors('episode_vectors', queryEmbedding, 15);
    const factVecResults = this.db.searchVectors('fact_vectors', queryEmbedding, 15);
    const skillVecResults = this.db.searchVectors('skill_vectors', queryEmbedding, 5);

    const episodeSignal: RankedItem[] = episodeVecResults.map(r => ({
      id: String(r.rowid),
      score: 1 - r.distance, // cosine distance → similarity
    }));
    const factSignal: RankedItem[] = factVecResults.map(r => ({
      id: String(r.rowid),
      score: 1 - r.distance,
    }));
    const skillSignal: RankedItem[] = skillVecResults.map(r => ({
      id: String(r.rowid),
      score: 1 - r.distance,
    }));

    // ── Signal 2: BM25 Full-Text Search ──
    const episodeFtsResults = this.db.searchEpisodesFTS(userMessage, 15);
    const factFtsResults = this.db.searchFactsFTS(userMessage, 15);

    const episodeFtsSignal: RankedItem[] = episodeFtsResults.map(r => ({
      id: String(r.rowid),
      score: -r.rank, // BM25 rank (negative because lower is better)
    }));
    const factFtsSignal: RankedItem[] = factFtsResults.map(r => ({
      id: String(r.rowid),
      score: -r.rank,
    }));

    // ── Reciprocal Rank Fusion ──
    const fusedEpisodes = reciprocalRankFusion(
      [episodeSignal, episodeFtsSignal],
      [0.5, 0.3],
    );
    const fusedFacts = reciprocalRankFusion(
      [factSignal, factFtsSignal],
      [0.5, 0.3],
    );
    const fusedSkills = reciprocalRankFusion([skillSignal], [1.0]);

    // ── Fetch actual data ──
    const relevantEpisodes: Episode[] = this.fetchEpisodesByRowids(
      fusedEpisodes.slice(0, 10).map(f => Number(f.id)),
    );
    const relevantSemantics: SemanticEntry[] = this.fetchFactsByRowids(
      fusedFacts.slice(0, 8).map(f => Number(f.id)),
    );
    const applicableSkills: ProceduralEntry[] = this.fetchSkillsByRowids(
      fusedSkills.slice(0, 3).map(f => Number(f.id)),
    );

    // ── Signal 3: Knowledge Graph ──
    const entities = this.extractEntities(userMessage);
    const kgRows = this.db.traverseKG(this.config.workspaceId, entities, 2, 10);
    const kgContext: KnowledgeTriple[] = kgRows.map(r => ({
      subject: r.subject,
      predicate: r.predicate,
      object: r.object,
      confidence: r.confidence,
      source: 'agent' as MemorySource,
      timestamp: new Date().toISOString(),
    }));

    // ── Apply Working Memory Capacity (Miller's 7±2) ──
    const allMemoryItems = [
      ...relevantEpisodes.map(e => ({
        item: e as any,
        salience: e.importance + (e.outcome === 'failure' ? 0.3 : 0),
      })),
      ...relevantSemantics.map(f => ({
        item: f as any,
        salience: f.confidence,
      })),
    ];

    const selectedItems = selectWorkingMemoryItems(allMemoryItems, 9, 5);
    const selectedEpisodes = selectedItems.filter(i => 'task' in i) as Episode[];
    const selectedFacts = selectedItems.filter(i => 'subject' in i && !('task' in i)) as SemanticEntry[];

    // ── Build user profile ──
    const userProfile = this.buildUserProfile();

    // ── Core memory ──
    const coreMemory = this.getCoreMemory();

    // ── Token estimate ──
    const totalChars =
      selectedEpisodes.reduce((s, e) => s + e.task.length + e.approach.length, 0) +
      selectedFacts.reduce((s, f) => s + f.content.length, 0) +
      applicableSkills.reduce((s, sk) => s + sk.procedure.length, 0);
    const totalTokenEstimate = Math.ceil(totalChars / 4);

    return {
      relevantEpisodes: selectedEpisodes,
      relevantSemantics: selectedFacts,
      applicableSkills,
      userProfile,
      coreMemory,
      kgContext,
      totalTokenEstimate,
    };
  }

  /**
   * Build a memory-enriched system prompt section.
   * This gets injected into the agent's system prompt.
   */
  async buildMemoryContextBlock(userMessage: string): Promise<string> {
    const context = await this.getContextForPrompt(userMessage);
    const blocks: string[] = [];

    // Core memory (identity, goals, constraints) — always included
    if (context.coreMemory.length > 0) {
      const coreLines = context.coreMemory.map(cm =>
        `- **[${cm.category}]** ${cm.content}`,
      );
      blocks.push(`## Core Memory (Never Forgets)\n${coreLines.join('\n')}`);
    }

    // User profile context
    if (context.userProfile) {
      const p = context.userProfile;
      const profileParts: string[] = [];
      if (p.name) profileParts.push(`Name: ${p.name}`);
      if (p.language) profileParts.push(`Language: ${p.language}`);
      if (p.responseStyle) profileParts.push(`Style: ${p.responseStyle}`);
      if (p.expertise.length > 0) profileParts.push(`Expertise: ${p.expertise.join(', ')}`);

      if (profileParts.length > 0) {
        blocks.push(`## Known User Preferences\n${profileParts.join('\n')}`);
      }
    }

    // Knowledge graph context
    if (context.kgContext.length > 0) {
      const kgLines = context.kgContext.slice(0, 5).map(t =>
        `- ${t.subject} → ${t.predicate} → ${t.object} (${(t.confidence * 100).toFixed(0)}%)`,
      );
      blocks.push(`## Knowledge Graph\n${kgLines.join('\n')}`);
    }

    // Relevant past experiences
    if (context.relevantEpisodes.length > 0) {
      const episodeLines = context.relevantEpisodes.slice(0, 3).map(e =>
        `- **${e.task}** (${e.outcome}): ${e.lessonsLearned.join('; ')}`,
      );
      blocks.push(`## Relevant Past Experiences\n${episodeLines.join('\n')}`);
    }

    // Relevant knowledge
    if (context.relevantSemantics.length > 0) {
      const knowledgeLines = context.relevantSemantics.slice(0, 5).map(e =>
        `- **${e.subject}**: ${e.content}`,
      );
      blocks.push(`## Relevant Knowledge\n${knowledgeLines.join('\n')}`);
    }

    // Applicable skills
    if (context.applicableSkills.length > 0) {
      const skillLines = context.applicableSkills.map(s =>
        `- **${s.name}** (success: ${(s.metrics.successRate * 100).toFixed(0)}%, used ${s.metrics.useCount}x)`,
      );
      blocks.push(`## Applicable Skills\n${skillLines.join('\n')}`);
    }

    return blocks.length > 0
      ? `<memory_context>\n${blocks.join('\n\n')}\n</memory_context>`
      : '';
  }

  // ── Sleep Consolidation Engine ───────────────────────────────────

  private startConsolidation(): void {
    const intervalMs = (this.config.consolidation.intervalMinutes ?? 60) * 60 * 1000;
    this.consolidationTimer = setInterval(() => this.runConsolidation(), intervalMs);
  }

  private stopConsolidation(): void {
    if (this.consolidationTimer) {
      clearInterval(this.consolidationTimer);
      this.consolidationTimer = null;
    }
  }

  /**
   * Run sleep consolidation cycle:
   * 1. Select memories for replay (hippocampal replay)
   * 2. Boost stability of selected memories
   * 3. Prune weak KG connections (synaptic downscaling)
   * 4. Promote stable episodic → semantic
   * 5. Apply Ebbinghaus decay to all memories
   */
  async runConsolidation(): Promise<ConsolidationReport> {
    const report: ConsolidationReport = {
      timestamp: new Date().toISOString(),
      reinforced: 0,
      decayed: 0,
      merged: 0,
      archived: 0,
      promoted: 0,
      details: [],
    };

    try {
      // Step 1: Select episodes for replay
      const candidates = this.getReplayCandidates();
      const selected = selectForReplay(candidates);

      // Step 2: Simulate replay — boost stability
      const stabilityUpdates = simulateReplay(selected);
      for (const [id, newStab] of stabilityUpdates) {
        this.db.db.prepare('UPDATE episodes SET stability = ? WHERE id = ?').run(newStab, id);
        report.reinforced++;
      }

      // Step 3: Prune weak KG connections
      const triples = this.db.db.prepare(
        'SELECT id, hebbian_weight FROM triples WHERE workspace_id = ?',
      ).all(this.config.workspaceId) as Array<{ id: string; hebbian_weight: number }>;

      const prunedIds = pruneWeakConnections(
        triples.map(t => ({ id: t.id, hebbianWeight: t.hebbian_weight })),
      );
      for (const id of prunedIds) {
        this.db.db.prepare('DELETE FROM triples WHERE id = ?').run(id);
        report.details.push({ type: 'archive', id, reason: 'Hebbian weight below threshold' });
      }

      // Step 4: Hebbian decay on remaining KG edges
      for (const triple of triples) {
        if (prunedIds.includes(triple.id)) continue;
        const { weight, shouldPrune } = hebbianDecay(triple.hebbian_weight);
        if (shouldPrune) {
          this.db.db.prepare('DELETE FROM triples WHERE id = ?').run(triple.id);
        } else {
          this.db.db.prepare('UPDATE triples SET hebbian_weight = ? WHERE id = ?').run(weight, triple.id);
        }
      }

      // Step 5: Ebbinghaus decay — check all memories for forgetting
      const episodes = this.db.db.prepare(
        `SELECT id, stability, last_accessed, emotion_weight, access_count, decay_class
         FROM facts WHERE workspace_id = ?`,
      ).all(this.config.workspaceId) as any[];

      for (const ep of episodes) {
        const decay = calculateDecay({
          stability: ep.stability,
          lastAccessed: new Date(ep.last_accessed),
          emotionWeight: ep.emotion_weight ?? 0.3,
          accessCount: ep.access_count ?? 0,
          decayClass: ep.decay_class ?? 'normal',
        });

        if (decay.shouldForget) {
          this.db.db.prepare('DELETE FROM facts WHERE id = ?').run(ep.id);
          report.archived++;
          report.details.push({ type: 'archive', id: ep.id, reason: `Retention ${decay.retention.toFixed(3)} below threshold` });
        }
      }

      // Step 6: Promote stable episodic memories to semantic
      const promotable = this.db.db.prepare(
        `SELECT * FROM episodes WHERE workspace_id = ? AND stability > 30 AND importance > 0.6`,
      ).all(this.config.workspaceId) as any[];

      for (const ep of promotable.slice(0, 5)) { // Limit per cycle
        const content = `${ep.task}: ${ep.lessons}`;
        await this.storeFact(`experience:${ep.task}`, content, 0.7, 'evolution');
        report.promoted++;
      }

    } catch (err) {
      console.error('[CodyMemory] Consolidation error:', err);
    }

    return report;
  }

  // ── Stats ───────────────────────────────────────────────────────

  async getStats(): Promise<MemoryStats> {
    const epCount = (this.db.db.prepare('SELECT COUNT(*) as c FROM episodes WHERE workspace_id = ?').get(this.config.workspaceId) as any)?.c ?? 0;
    const factCount = (this.db.db.prepare('SELECT COUNT(*) as c FROM facts WHERE workspace_id = ?').get(this.config.workspaceId) as any)?.c ?? 0;
    const skillCount = (this.db.db.prepare('SELECT COUNT(*) as c FROM skills WHERE workspace_id = ?').get(this.config.workspaceId) as any)?.c ?? 0;
    const coreCount = (this.db.db.prepare('SELECT COUNT(*) as c FROM core_memory').get() as any)?.c ?? 0;
    const tripleCount = (this.db.db.prepare('SELECT COUNT(*) as c FROM triples WHERE workspace_id = ?').get(this.config.workspaceId) as any)?.c ?? 0;

    // Count vectors
    const epVecCount = (this.db.db.prepare('SELECT COUNT(*) as c FROM episode_vectors').get() as any)?.c ?? 0;
    const factVecCount = (this.db.db.prepare('SELECT COUNT(*) as c FROM fact_vectors').get() as any)?.c ?? 0;
    const skillVecCount = (this.db.db.prepare('SELECT COUNT(*) as c FROM skill_vectors').get() as any)?.c ?? 0;

    return {
      workingMemorySize: this.working.size,
      workingMemoryTokens: this.working.estimateTotalTokens(),
      episodicCount: epCount,
      semanticCount: factCount,
      proceduralCount: skillCount,
      coreMemoryCount: coreCount,
      triplesCount: tripleCount,
      vectorCount: epVecCount + factVecCount + skillVecCount,
      avgRetention: 0.9, // Placeholder; could compute actual average
    };
  }

  // ── Persistence (compat) ────────────────────────────────────────

  async persist(): Promise<void> {
    // SQLite is auto-persisted with WAL mode
  }

  // ── Reflection Support (backward compat) ───────────────────────

  /**
   * Get recent episodes for reflection.
   */
  async getEpisodesForReflection(limit = 20): Promise<Episode[]> {
    return this.db.db.prepare(
      `SELECT * FROM episodes WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ?`,
    ).all(this.config.workspaceId, limit).map((row: any) => this.mapRowToEpisode(row));
  }

  /**
   * Get failed episodes for analysis.
   */
  async getFailedEpisodes(limit = 10): Promise<Episode[]> {
    return this.db.db.prepare(
      `SELECT * FROM episodes WHERE workspace_id = ? AND outcome = 'failure' ORDER BY created_at DESC LIMIT ?`,
    ).all(this.config.workspaceId, limit).map((row: any) => this.mapRowToEpisode(row));
  }

  // ── Skill Management (backward compat) ───────────────────────────

  /** Get skill suggestions for a given context */
  async suggestSkills(context: string): Promise<ProceduralEntry[]> {
    const embedding = await this.embeddingProvider.embed(context);
    const vecResults = this.db.searchVectors('skill_vectors', embedding, 5);
    return this.fetchSkillsByRowids(vecResults.map(r => Number(r.rowid)));
  }

  /** Record a skill usage result */
  async recordSkillUsage(skillId: string, result: {
    success: boolean;
    durationMs: number;
    accepted?: boolean;
  }): Promise<void> {
    const row = this.db.db.prepare('SELECT * FROM skills WHERE id = ?').get(skillId) as any;
    if (!row) return;

    const newUseCount = (row.use_count ?? 0) + 1;
    const newSuccessRate = result.success
      ? ((row.success_rate ?? 0) * (newUseCount - 1) + 1) / newUseCount
      : ((row.success_rate ?? 0) * (newUseCount - 1)) / newUseCount;
    const newAvgDuration = ((row.avg_duration_ms ?? 0) * (newUseCount - 1) + result.durationMs) / newUseCount;

    this.db.db.prepare(
      `UPDATE skills SET use_count = ?, success_rate = ?, avg_duration_ms = ?, last_used = datetime('now') WHERE id = ?`,
    ).run(newUseCount, newSuccessRate, newAvgDuration, skillId);
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private getReplayCandidates(): ReplayCandidate[] {
    return (this.db.db.prepare(
      `SELECT id, access_count, emotion_weight, last_accessed, stability
       FROM episodes WHERE workspace_id = ?`,
    ).all(this.config.workspaceId) as any[]).map(row => ({
      id: row.id,
      accessCount: row.access_count ?? 0,
      emotionWeight: row.emotion_weight ?? 0.3,
      lastAccessed: new Date(row.last_accessed ?? Date.now()),
      stability: row.stability ?? 1.0,
    }));
  }

  private fetchEpisodesByRowids(rowids: number[]): Episode[] {
    if (rowids.length === 0) return [];
    const placeholders = rowids.map(() => '?').join(',');
    const rows = this.db.db.prepare(
      `SELECT * FROM episodes WHERE rowid IN (${placeholders})`,
    ).all(...rowids) as any[];

    return rows.map(row => ({
      id: row.id,
      timestamp: row.created_at,
      sessionId: row.session_id ?? '',
      workspaceId: row.workspace_id,
      task: row.task,
      approach: row.approach ?? '',
      outcome: row.outcome,
      trajectory: JSON.parse(row.trajectory ?? '[]'),
      userFeedback: row.user_feedback,
      selfAssessment: row.self_assessment,
      lessonsLearned: JSON.parse(row.lessons ?? '[]'),
      accessCount: row.access_count ?? 0,
      lastAccessedAt: row.last_accessed ?? row.created_at,
      importance: row.importance ?? 0.5,
      tags: JSON.parse(row.tags ?? '[]'),
      durationMs: row.duration_ms ?? 0,
    }));
  }

  private fetchFactsByRowids(rowids: number[]): SemanticEntry[] {
    if (rowids.length === 0) return [];
    const placeholders = rowids.map(() => '?').join(',');
    const rows = this.db.db.prepare(
      `SELECT * FROM facts WHERE rowid IN (${placeholders})`,
    ).all(...rowids) as any[];

    return rows.map(row => ({
      id: row.id,
      timestamp: row.created_at,
      type: (row.fact_type ?? 'fact') as any,
      subject: row.subject,
      content: row.content,
      confidence: row.confidence ?? 0.8,
      source: (row.source ?? 'agent') as MemorySource,
      relatedIds: JSON.parse(row.related_ids ?? '[]'),
      accessCount: row.access_count ?? 0,
      importance: row.importance ?? 0.5,
      tags: JSON.parse(row.tags ?? '[]'),
    }));
  }

  private fetchSkillsByRowids(rowids: number[]): ProceduralEntry[] {
    if (rowids.length === 0) return [];
    const placeholders = rowids.map(() => '?').join(',');
    const rows = this.db.db.prepare(
      `SELECT * FROM skills WHERE rowid IN (${placeholders})`,
    ).all(...rowids) as any[];

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      trigger: JSON.parse(row.trigger_patterns ?? '[]')[0] ?? '',
      procedure: row.procedure ?? '',
      origin: row.origin ?? 'manual',
      metrics: {
        useCount: row.use_count ?? 0,
        successRate: row.success_rate ?? 0,
        avgDurationMs: row.avg_duration_ms ?? 0,
        acceptanceRate: row.acceptance_rate ?? 0,
        refinementCount: row.refinement_count ?? 0,
      },
      version: row.version ?? 1,
      evolvedFrom: row.evolved_from,
      evolutionGeneration: row.evolution_generation ?? 0,
      tags: JSON.parse(row.tags ?? '[]'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastUsedAt: row.last_used,
    }));
  }

  private extractEntities(text: string): string[] {
    // Simple entity extraction: split on common delimiters, take nouns/capitalized words
    const words = text.split(/[\s,.;:!?\-\(\)\[\]{}'"]+/).filter(w => w.length > 2);
    // Take capitalized words and important keywords
    return [...new Set(
      words.filter(w => w[0] === w[0].toUpperCase() || w.length > 4),
    )].slice(0, 10);
  }

  private mapRowToEpisode(row: any): Episode {
    return {
      id: row.id,
      timestamp: row.created_at,
      sessionId: row.session_id ?? '',
      workspaceId: row.workspace_id,
      task: row.task,
      approach: row.approach ?? '',
      outcome: row.outcome,
      trajectory: JSON.parse(row.trajectory ?? '[]'),
      userFeedback: row.user_feedback,
      selfAssessment: row.self_assessment,
      lessonsLearned: JSON.parse(row.lessons ?? '[]'),
      accessCount: row.access_count ?? 0,
      lastAccessedAt: row.last_accessed ?? row.created_at,
      importance: row.importance ?? 0.5,
      tags: JSON.parse(row.tags ?? '[]'),
      durationMs: row.duration_ms ?? 0,
    };
  }

  private buildUserProfile(): UserProfile | null {
    const prefs = this.db.db.prepare(
      `SELECT subject, content FROM facts WHERE workspace_id = ? AND fact_type = 'preference'`,
    ).all(this.config.workspaceId) as Array<{ subject: string; content: string }>;

    if (prefs.length === 0) return null;

    const prefMap = new Map(prefs.map(p => [p.subject, p.content]));
    return {
      name: prefMap.get('name'),
      language: prefMap.get('language'),
      responseStyle: prefMap.get('responseStyle') as any,
      preferences: prefMap,
      taskPatterns: [],
      expertise: [],
      updatedAt: new Date().toISOString(),
    };
  }
}

// ============================================================================
// Backward-Compatibility Facades
// ============================================================================

/**
 * ProceduralFacade — translates old `memory.procedural.*` calls to SQLite.
 *
 * Used by: evolve-engine (create, getByName, refine),
 *          proactive (getTopPerforming), evolution (search)
 */
class ProceduralFacade {
  constructor(
    private readonly db: CodyMemoryDB,
    private readonly embeddingProvider: LocalEmbeddingProvider,
  ) {}

  async create(input: {
    name: string;
    trigger: string;
    procedure: string;
    origin?: 'manual' | 'auto_generated' | 'evolved';
    evolvedFrom?: MemoryId;
    tags?: string[];
  }): Promise<ProceduralEntry> {
    const id = `skill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const wsId = this.getWorkspaceId();

    this.db.db.prepare(
      `INSERT INTO skills (id, workspace_id, name, trigger_patterns, procedure, origin, tags, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, wsId, input.name, JSON.stringify([input.trigger]), input.procedure, input.origin ?? 'manual', JSON.stringify(input.tags ?? []), now, now);

    // Embed and insert vector
    try {
      const embedding = await this.embeddingProvider.embed(`${input.name} ${input.trigger}`);
      const row = this.db.db.prepare('SELECT rowid FROM skills WHERE id = ?').get(id) as any;
      if (row) {
        this.db.insertVector('skill_vectors', row.rowid, embedding);
      }
    } catch { /* non-critical */ }

    return this.getById(id)!;
  }

  getByName(name: string): ProceduralEntry | null {
    const row = this.db.db.prepare(
      'SELECT * FROM skills WHERE name = ? LIMIT 1',
    ).get(name) as any;
    return row ? this.rowToEntry(row) : null;
  }

  async refine(id: MemoryId, newProcedure: string, reason: string): Promise<ProceduralEntry | null> {
    const original = this.getById(id);
    if (!original) return null;

    // Create evolved version
    const evolved = await this.create({
      name: original.name,
      trigger: original.trigger,
      procedure: newProcedure,
      origin: 'evolved',
      evolvedFrom: id,
      tags: [...original.tags, `refined:${reason}`],
    });

    // Mark original as superseded
    this.db.db.prepare(
      `UPDATE skills SET tags = ? WHERE id = ?`,
    ).run(JSON.stringify([...original.tags, 'superseded']), id);

    return evolved;
  }

  getTopPerforming(limit = 10): ProceduralEntry[] {
    const rows = this.db.db.prepare(
      `SELECT * FROM skills
       WHERE use_count >= 3
       ORDER BY success_rate DESC
       LIMIT ?`,
    ).all(limit) as any[];
    return rows.map(r => this.rowToEntry(r));
  }

  async search(context: string, limit = 100): Promise<ProceduralEntry[]> {
    if (!context) {
      // Empty query → return all skills
      const rows = this.db.db.prepare(
        'SELECT * FROM skills WHERE workspace_id = ? LIMIT ?',
      ).all(this.getWorkspaceId(), limit) as any[];
      return rows.map(r => this.rowToEntry(r));
    }

    try {
      const embedding = await this.embeddingProvider.embed(context);
      const vecResults = this.db.searchVectors('skill_vectors', embedding, limit);
      if (vecResults.length === 0) return [];
      const rowids = vecResults.map(r => Number(r.rowid));
      const ph = rowids.map(() => '?').join(',');
      const rows = this.db.db.prepare(
        `SELECT * FROM skills WHERE rowid IN (${ph})`,
      ).all(...rowids) as any[];
      return rows.map(r => this.rowToEntry(r));
    } catch {
      return [];
    }
  }

  // ── Helpers ────────────────────────────────────────────────────

  private getWorkspaceId(): string {
    const row = this.db.db.prepare('SELECT DISTINCT workspace_id FROM skills LIMIT 1').get() as any;
    return row?.workspace_id ?? 'default';
  }

  private getById(id: string): ProceduralEntry | null {
    const row = this.db.db.prepare('SELECT * FROM skills WHERE id = ?').get(id) as any;
    return row ? this.rowToEntry(row) : null;
  }

  private rowToEntry(row: any): ProceduralEntry {
    return {
      id: row.id,
      name: row.name,
      trigger: JSON.parse(row.trigger_patterns ?? '[]')[0] ?? '',
      procedure: row.procedure,
      origin: row.origin ?? 'manual',
      metrics: {
        useCount: row.use_count ?? 0,
        successRate: row.success_rate ?? 0,
        avgDurationMs: row.avg_duration_ms ?? 0,
        acceptanceRate: 1,
        refinementCount: 0,
      },
      version: 1,
      evolutionGeneration: 0,
      tags: JSON.parse(row.tags ?? '[]'),
      createdAt: row.created_at,
      updatedAt: row.updated_at ?? row.created_at,
      lastUsedAt: row.last_used ?? undefined,
    };
  }
}

/**
 * SemanticFacade — translates old `memory.semantic.*` calls to SQLite.
 *
 * Used by: proactive (buildUserProfile)
 */
class SemanticFacade {
  constructor(private readonly db: CodyMemoryDB) {}

  buildUserProfile(): UserProfile {
    const prefs = this.db.db.prepare(
      `SELECT subject, content FROM facts WHERE fact_type = 'preference'`,
    ).all() as Array<{ subject: string; content: string }>;

    const habits = this.db.db.prepare(
      `SELECT content FROM facts WHERE fact_type = 'habit'`,
    ).all() as Array<{ content: string }>;

    const concepts = this.db.db.prepare(
      `SELECT DISTINCT subject FROM facts WHERE fact_type = 'fact'`,
    ).all() as Array<{ subject: string }>;

    const preferences = new Map<string, string>();
    for (const p of prefs) {
      preferences.set(p.subject, p.content);
    }

    return {
      name: preferences.get('name'),
      language: preferences.get('language'),
      responseStyle: (preferences.get('responseStyle') as UserProfile['responseStyle']) ?? undefined,
      preferences,
      taskPatterns: habits.map(h => h.content),
      expertise: concepts.map(c => c.subject),
      updatedAt: new Date().toISOString(),
    };
  }
}
