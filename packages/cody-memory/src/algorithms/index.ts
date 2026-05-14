/**
 * FSRS — Free Spaced Repetition Scheduler Algorithm Suite
 *
 * Implements neuroscience-inspired memory scheduling algorithms:
 * 1. FSRS (Ye, Su & Cao, KDD 2022) — optimal review timing, ~30% better than SM-2
 * 2. Ebbinghaus Forgetting Curve — R = e^(-t/S) with emotional modulation
 * 3. Hebbian Learning — co-activation strengthens connections
 * 4. Homeostatic Normalization — prevents runaway weight growth
 * 5. Emotional Memory Modulation — emotional memories decay 3x slower
 *
 * All algorithms are pure functions with zero external dependencies.
 */

// ============================================================================
// FSRS — Free Spaced Repetition Scheduler
// ============================================================================

export interface FSRSCard {
  /** Stability in days (how long until R drops to 90%) */
  stability: number;
  /** Difficulty 1.0–10.0 */
  difficulty: number;
  /** Last review date */
  lastReview: Date;
  /** Number of successful reviews */
  successfulReviews: number;
  /** Total reviews */
  totalReviews: number;
}

export interface FSRSResult {
  /** New stability in days */
  stability: number;
  /** New difficulty */
  difficulty: number;
  /** Current retrievability (0–1) */
  retrievability: number;
  /** Next review date */
  nextReview: Date;
  /** Recommended interval in days */
  intervalDays: number;
}

/** FSRS parameters (tuned defaults from Ye et al. 2022) */
const FSRS_DEFAULTS = {
  w: [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61],
  requestRetention: 0.9,    // Target 90% retention
  maximumInterval: 365,     // Max 1 year
  decayClassMultiplier: {
    permanent: Infinity,
    slow: 3.0,
    normal: 1.0,
    fast: 0.5,
  },
};

/**
 * Calculate current retrievability using Ebbinghaus forgetting curve.
 * R = e^(-t / S)
 * where t = elapsed days, S = stability
 */
export function calculateRetrievability(
  stability: number,
  lastReview: Date,
  now: Date = new Date(),
): number {
  if (stability <= 0) return 0;
  const elapsedMs = now.getTime() - lastReview.getTime();
  const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
  return Math.exp(-elapsedDays / stability);
}

/**
 * FSRS: Calculate new stability after a successful recall.
 * newStability = stability × (1 + w[7] × success_factor)
 */
export function fsrsOnSuccess(
  card: FSRSCard,
  decayClass: 'permanent' | 'slow' | 'normal' | 'fast' = 'normal',
): FSRSResult {
  const w = FSRS_DEFAULTS.w;
  const currentRetrievability = calculateRetrievability(card.stability, card.lastReview);

  // Hard-coded FSRS formula (simplified for production use)
  const successFactor = 1 + w[7] * (card.difficulty < 5 ? 1.3 : 1.0) * (1 + card.successfulReviews * 0.05);
  let newStability = card.stability * successFactor;

  // Apply decay class multiplier
  const classMultiplier = FSRS_DEFAULTS.decayClassMultiplier[decayClass];
  if (classMultiplier !== Infinity) {
    newStability = Math.min(newStability * classMultiplier, FSRS_DEFAULTS.maximumInterval);
  } else {
    newStability = FSRS_DEFAULTS.maximumInterval;
  }

  // Difficulty decreases slightly on success
  const newDifficulty = Math.max(1.0, card.difficulty - 0.3);

  // Calculate interval for target retention
  const intervalDays = Math.max(1, Math.round(
    newStability * Math.log(FSRS_DEFAULTS.requestRetention) / Math.log(0.9),
  ));

  const nextReview = new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000);

  return {
    stability: newStability,
    difficulty: newDifficulty,
    retrievability: currentRetrievability,
    nextReview,
    intervalDays,
  };
}

/**
 * FSRS: Calculate new stability after a failed recall (forgetting).
 * Stability is reduced; difficulty increases.
 */
export function fsrsOnFailure(card: FSRSCard): FSRSResult {
  const w = FSRS_DEFAULTS.w;

  // On failure, stability drops significantly
  const newStability = Math.max(0.5, card.stability * 0.3);
  const newDifficulty = Math.min(10.0, card.difficulty + 0.5);
  const intervalDays = Math.max(1, Math.round(newStability));

  const nextReview = new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000);
  const retrievability = calculateRetrievability(card.stability, card.lastReview);

  return {
    stability: newStability,
    difficulty: newDifficulty,
    retrievability,
    nextReview,
    intervalDays,
  };
}

// ============================================================================
// Ebbinghaus Forgetting Curve with Emotional Modulation
// ============================================================================

export interface DecayResult {
  /** Current retention rate 0–1 */
  retention: number;
  /** Whether this memory should be archived/forgotten */
  shouldForget: boolean;
  /** Effective stability (days), after emotional modulation */
  effectiveStability: number;
}

/**
 * Calculate Ebbinghaus decay with emotional modulation.
 *
 * R = e^(-t / S_eff)
 * S_eff = S × emotionMultiplier × accessMultiplier
 *
 * emotionMultiplier: memories with high emotional weight decay up to 3x slower
 * accessMultiplier: frequently accessed memories are more stable
 */
export function calculateDecay(params: {
  stability: number;
  lastAccessed: Date;
  emotionWeight: number;    // 0–1
  accessCount: number;
  decayClass?: 'permanent' | 'slow' | 'normal' | 'fast';
  forgetThreshold?: number; // Below this retention, memory should be forgotten
  now?: Date;
}): DecayResult {
  const {
    stability,
    lastAccessed,
    emotionWeight,
    accessCount,
    decayClass = 'normal',
    forgetThreshold = 0.05,
    now = new Date(),
  } = params;

  // Base decay class multiplier
  const classMultipliers = { permanent: 100, slow: 3.0, normal: 1.0, fast: 0.5 };
  const classMult = classMultipliers[decayClass];

  // Emotional modulation: decayMultiplier = 1.0 + emotion × 2.0 (range 1.0–3.0)
  // Emotional memories decay slower (Cahill & McGaugh, 1998)
  const emotionMult = 1.0 + emotionWeight * 2.0;

  // Access frequency modulation
  const accessMult = 1.0 + Math.log1p(accessCount) * 0.3;

  const effectiveStability = stability * classMult * emotionMult * accessMult;

  // Ebbinghaus: R = e^(-t / S_eff)
  const elapsedDays = (now.getTime() - lastAccessed.getTime()) / (1000 * 60 * 60 * 24);
  const retention = Math.exp(-elapsedDays / effectiveStability);

  return {
    retention,
    shouldForget: retention < forgetThreshold,
    effectiveStability,
  };
}

// ============================================================================
// Hebbian Learning — Knowledge Graph Edge Dynamics
// ============================================================================

/**
 * Hebbian learning: co-activated facts strengthen their connection.
 * w_new = w_old + LR × (1 - w_old / W_max)
 *
 * Asymptotic growth prevents unlimited weight increase.
 * (Hebb, 1949)
 */
export function hebbianStrengthen(
  currentWeight: number,
  learningRate = 0.1,
  maxWeight = 10.0,
): number {
  return currentWeight + learningRate * (1 - currentWeight / maxWeight);
}

/**
 * Hebbian decay: unused edges weaken over time.
 * w_new = w_old × (1 - decay_rate)
 *
 * Edges below threshold are pruned (synaptic downscaling).
 */
export function hebbianDecay(
  currentWeight: number,
  decayRate = 0.02,
  pruneThreshold = 0.2,
): { weight: number; shouldPrune: boolean } {
  const newWeight = currentWeight * (1 - decayRate);
  return {
    weight: newWeight,
    shouldPrune: newWeight < pruneThreshold,
  };
}

/**
 * Homeostatic normalization: prevents runaway weight growth.
 * Scales all weights proportionally to target sum.
 * (Turrigiano & Nelson, 2004)
 */
export function homeostaticNormalize(
  weights: number[],
  targetSum: number,
): number[] {
  const currentSum = weights.reduce((a, b) => a + b, 0);
  if (currentSum === 0) return weights;
  const scale = targetSum / currentSum;
  return weights.map(w => w * scale);
}

// ============================================================================
// Sleep Consolidation — Hippocampal Replay Simulation
// ============================================================================

export interface ReplayCandidate {
  id: string;
  accessCount: number;
  emotionWeight: number;
  lastAccessed: Date;
  stability: number;
}

export interface ReplayResult {
  /** IDs selected for replay */
  selectedIds: string[];
  /** New stability values: id → new stability */
  newStabilities: Map<string, number>;
  /** IDs whose connections should be pruned */
  prunedIds: string[];
}

/**
 * Select memories for hippocampal replay during sleep consolidation.
 * Priority = normalizedAccessCount × 0.3 + emotionWeight × 0.3 + recency × 0.2 + instability × 0.2
 * (Stickgold & Walker, 2013)
 */
export function selectForReplay(
  candidates: ReplayCandidate[],
  maxPerCycle = 20,
): ReplayCandidate[] {
  if (candidates.length === 0) return [];

  // Normalize access counts
  const maxAccess = Math.max(...candidates.map(c => c.accessCount), 1);

  const scored = candidates.map(c => {
    const accessNorm = c.accessCount / maxAccess;
    const recency = Math.exp(-((Date.now() - c.lastAccessed.getTime()) / (1000 * 60 * 60 * 24)) * 0.1);
    const instability = 1 / (1 + c.stability); // Lower stability = higher instability

    const priority =
      accessNorm * 0.3 +
      c.emotionWeight * 0.3 +
      recency * 0.2 +
      instability * 0.2;

    return { candidate: c, priority };
  });

  scored.sort((a, b) => b.priority - a.priority);
  return scored.slice(0, maxPerCycle).map(s => s.candidate);
}

/**
 * Simulate hippocampal replay: boost stability of selected memories.
 * newStability = stability × replayMultiplier (default 1.5 = 50% boost)
 * Emotional memories get additional 20% boost.
 * (Stickgold & Walker, 2013)
 */
export function simulateReplay(
  selected: ReplayCandidate[],
  replayMultiplier = 1.5,
  maxStability = 365,
): Map<string, number> {
  const results = new Map<string, number>();

  for (const item of selected) {
    let newStab = item.stability * replayMultiplier;

    // Emotional bonus: additional 20% for emotionally significant memories
    if (item.emotionWeight > 0.5) {
      newStab *= 1.2;
    }

    // Cap at maximum stability
    newStab = Math.min(newStab, maxStability);

    results.set(item.id, newStab);
  }

  return results;
}

/**
 * Synaptic downscaling: identify weak connections for pruning.
 * Hebbian weight < 0.2 → prune.
 * (Tononi & Cirrelli, 2006)
 */
export function pruneWeakConnections(
  edges: Array<{ id: string; hebbianWeight: number }>,
  pruneThreshold = 0.2,
): string[] {
  return edges
    .filter(e => e.hebbianWeight < pruneThreshold)
    .map(e => e.id);
}

// ============================================================================
// Emotional Weight Calculation
// ============================================================================

/**
 * Calculate initial emotional weight for a memory.
 *
 * Based on:
 * - Task outcome (failures are more valuable to remember)
 * - User feedback
 * - Self-assessment
 * - Task complexity
 */
export function calculateEmotionalWeight(params: {
  outcome?: 'success' | 'partial' | 'failure';
  userFeedback?: 'positive' | 'negative' | 'neutral';
  selfAssessment?: number;  // 1-10
  complexity?: number;      // trajectory steps
}): number {
  let weight = 0.3; // Base weight

  // Outcome modulation
  if (params.outcome === 'failure') weight += 0.3;  // Failures matter!
  if (params.outcome === 'success') weight += 0.15;
  if (params.outcome === 'partial') weight += 0.1;

  // User feedback modulation (amygdala-like)
  if (params.userFeedback === 'positive') weight += 0.2;
  if (params.userFeedback === 'negative') weight += 0.25; // Negative feedback is important!

  // Self-assessment
  if (params.selfAssessment !== undefined) {
    // Low self-assessment = valuable lesson
    weight += (1 - params.selfAssessment / 10) * 0.15;
  }

  // Complexity bonus
  if (params.complexity !== undefined) {
    weight += Math.min(params.complexity * 0.01, 0.1);
  }

  return Math.min(weight, 1.0);
}

// ============================================================================
// Multi-Signal Fusion — Reciprocal Rank Fusion (RRF)
// ============================================================================

export interface RankedItem {
  id: string;
  /** Original score from this signal */
  score: number;
}

/**
 * Reciprocal Rank Fusion (RRF): merge multiple ranked lists into one.
 *
 * RRF_score(d) = Σ (1 / (k + rank_i(d)))
 * where k = 60 (standard constant)
 *
 * This is the fusion method used in Mem0 (2025) and RMM (Google, ACL 2025).
 */
export function reciprocalRankFusion(
  signalResults: RankedItem[][],
  weights: number[] = [],
  k = 60,
): Array<{ id: string; fusedScore: number }> {
  const weightsNorm = weights.length === signalResults.length
    ? weights
    : signalResults.map(() => 1 / signalResults.length);

  const scores = new Map<string, number>();

  for (let sigIdx = 0; sigIdx < signalResults.length; sigIdx++) {
    const items = signalResults[sigIdx];
    const weight = weightsNorm[sigIdx];

    for (let rank = 0; rank < items.length; rank++) {
      const item = items[rank];
      const rrfScore = weight / (k + rank + 1); // rank is 0-indexed, so +1
      scores.set(item.id, (scores.get(item.id) ?? 0) + rrfScore);
    }
  }

  const results = [...scores.entries()]
    .map(([id, fusedScore]) => ({ id, fusedScore }))
    .sort((a, b) => b.fusedScore - a.fusedScore);

  return results;
}

// ============================================================================
// Working Memory — Miller's 7±2 Capacity
// ============================================================================

/**
 * Apply Miller's Law: limit working memory to 7±2 items.
 * Items compete for slots based on salience scores (Global Workspace Theory).
 * (Miller, 1956; Baars, 1988)
 */
export function selectWorkingMemoryItems<T>(
  items: Array<{ item: T; salience: number }>,
  maxItems = 7,
  minItems = 5,
): T[] {
  // Sort by salience (highest first)
  const sorted = [...items].sort((a, b) => b.salience - a.salience);
  // Take top N items (between min and max)
  const count = Math.min(maxItems, Math.max(minItems, sorted.length));
  return sorted.slice(0, count).map(s => s.item);
}
