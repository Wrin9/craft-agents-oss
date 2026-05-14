/**
 * EvolutionTimeline — Displays the evolution log as a vertical timeline.
 *
 * Shows:
 * - Skill creations / refinements
 * - Memory consolidations
 * - Performance changes
 * - Knowledge gap detections
 * - Self-modifications (proposed/applied/rejected)
 */

import React from 'react';

export interface EvolutionLogEntry {
  id: string;
  timestamp: string;
  type: string;
  description: string;
  before: string;
  after: string;
  reason: string;
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high';
  autoApplied: boolean;
  outcome?: 'improved' | 'no_change' | 'degraded';
}

export interface SelfModification {
  id: string;
  dimension: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high';
  confidence: number;
  reason: string;
  status: 'proposed' | 'approved' | 'applied' | 'rejected' | 'rolled_back';
  proposedAt: string;
}

interface EvolutionTimelineProps {
  entries: EvolutionLogEntry[];
  pendingModifications: SelfModification[];
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}

const typeIcon: Record<string, string> = {
  skill_creation: '🟢',
  skill_refinement: '🔵',
  knowledge_consolidation: '🟣',
  preference_learning: '🟡',
  approach_optimization: '🟠',
  context_optimization: '🔷',
  memory_management: '⚪',
};

const typeLabel: Record<string, string> = {
  skill_creation: 'Skill Created',
  skill_refinement: 'Skill Refined',
  knowledge_consolidation: 'Consolidation',
  preference_learning: 'Preference Learned',
  approach_optimization: 'Approach Optimized',
  context_optimization: 'Context Optimized',
  memory_management: 'Memory Managed',
};

function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export function EvolutionTimeline({ entries, pendingModifications, onApprove, onReject }: EvolutionTimelineProps) {
  return (
    <div className="space-y-4">
      {/* Pending Modifications */}
      {pendingModifications.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-[var(--text-secondary)] mb-2">
            ⏳ Pending Modifications ({pendingModifications.length})
          </h4>
          <div className="space-y-2">
            {pendingModifications.map((mod) => (
              <div
                key={mod.id}
                className="bg-[var(--bg-secondary)] rounded-lg p-3 border border-[var(--border-default)] border-l-4 border-l-yellow-500"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-medium">{mod.description}</div>
                    <div className="text-xs text-[var(--text-secondary)] mt-1">
                      {mod.reason} • Risk: {mod.riskLevel} • Confidence: {(mod.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {onApprove && (
                      <button
                        onClick={() => onApprove(mod.id)}
                        className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                      >
                        Approve
                      </button>
                    )}
                    {onReject && (
                      <button
                        onClick={() => onReject(mod.id)}
                        className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                      >
                        Reject
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <h4 className="text-sm font-semibold text-[var(--text-secondary)]">
        📜 Evolution Log
      </h4>
      {entries.length === 0 ? (
        <div className="text-sm text-[var(--text-tertiary)] text-center py-6">
          No evolution entries yet. The system will start recording as you interact.
        </div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-3.5 top-0 bottom-0 w-px bg-[var(--border-default)]" />

          <div className="space-y-3">
            {entries.map((entry) => (
              <div key={entry.id} className="relative pl-10">
                {/* Icon */}
                <div className="absolute left-1.5 top-1 text-sm">
                  {typeIcon[entry.type] ?? '⚪'}
                </div>

                <div className="text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {typeLabel[entry.type] ?? entry.type}
                    </span>
                    <span className="text-xs text-[var(--text-tertiary)]">
                      {formatRelativeTime(entry.timestamp)}
                    </span>
                    {entry.autoApplied && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                        auto
                      </span>
                    )}
                    {entry.outcome && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        entry.outcome === 'improved' ? 'bg-green-500/20 text-green-400' :
                        entry.outcome === 'degraded' ? 'bg-red-500/20 text-red-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {entry.outcome === 'improved' ? '↑ improved' : entry.outcome === 'degraded' ? '↓ degraded' : '→ no change'}
                      </span>
                    )}
                  </div>
                  <div className="text-[var(--text-secondary)] mt-0.5">
                    {entry.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
