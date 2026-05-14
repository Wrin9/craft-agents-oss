/**
 * ProactiveSuggestionPanel — Displays proactive suggestions from the background thinker.
 *
 * Shows pending suggestions with accept/dismiss actions.
 */

import React from 'react';

export interface ProactiveSuggestion {
  id: string;
  timestamp: string;
  type: string;
  title: string;
  description: string;
  confidence: number;
  requiresUserAction: boolean;
  suggestedAction?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'accepted' | 'dismissed' | 'auto_executed';
}

interface ProactiveSuggestionPanelProps {
  suggestions: ProactiveSuggestion[];
  onAccept?: (id: string) => void;
  onDismiss?: (id: string) => void;
}

const typeIcon: Record<string, string> = {
  task_reminder: '🔔',
  optimization: '🔧',
  follow_up: '🔄',
  preparation: '🎯',
  knowledge_update: '📚',
  skill_suggestion: '💡',
};

const priorityColor: Record<string, string> = {
  urgent: 'border-l-red-500',
  high: 'border-l-orange-500',
  medium: 'border-l-blue-500',
  low: 'border-l-gray-500',
};

const statusIcon: Record<string, string> = {
  pending: '🟡',
  accepted: '🟢',
  dismissed: '⚪',
  auto_executed: '✅',
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

export function ProactiveSuggestionPanel({ suggestions, onAccept, onDismiss }: ProactiveSuggestionPanelProps) {
  const pending = suggestions.filter(s => s.status === 'pending');
  const resolved = suggestions.filter(s => s.status !== 'pending');

  return (
    <div className="space-y-4">
      {/* Pending Suggestions */}
      {pending.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-[var(--text-secondary)] mb-2">
            💬 Active Suggestions ({pending.length})
          </h4>
          <div className="space-y-2">
            {pending.map((sug) => (
              <div
                key={sug.id}
                className={`bg-[var(--bg-secondary)] rounded-lg p-3 border border-[var(--border-default)] border-l-4 ${priorityColor[sug.priority]}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{typeIcon[sug.type] ?? '💬'}</span>
                      <span className="text-sm font-medium">{sug.title}</span>
                      <span className="text-xs text-[var(--text-tertiary)]">
                        {formatRelativeTime(sug.timestamp)}
                      </span>
                    </div>
                    {sug.description && (
                      <div className="text-xs text-[var(--text-secondary)] mt-1 ml-6">
                        {sug.description.split('\n')[0]}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1 ml-6">
                      <span className="text-xs text-[var(--text-tertiary)]">
                        Confidence: {(sug.confidence * 100).toFixed(0)}%
                      </span>
                      {sug.requiresUserAction && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">
                          needs action
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5 ml-2">
                    {onAccept && (
                      <button
                        onClick={() => onAccept(sug.id)}
                        className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                      >
                        Accept
                      </button>
                    )}
                    {onDismiss && (
                      <button
                        onClick={() => onDismiss(sug.id)}
                        className="text-xs px-2 py-1 rounded bg-gray-500/20 text-gray-400 hover:bg-gray-500/30 transition-colors"
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resolved Suggestions */}
      {resolved.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-[var(--text-secondary)] mb-2">
            📋 Recent ({resolved.length})
          </h4>
          <div className="space-y-1.5">
            {resolved.slice(0, 5).map((sug) => (
              <div
                key={sug.id}
                className="flex items-center gap-2 text-xs text-[var(--text-tertiary)] py-1"
              >
                <span>{statusIcon[sug.status]}</span>
                <span className="truncate flex-1">{sug.title}</span>
                <span>{formatRelativeTime(sug.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {suggestions.length === 0 && (
        <div className="text-sm text-[var(--text-tertiary)] text-center py-6">
          No suggestions yet. The proactive thinking system generates suggestions
          based on patterns it observes in your work.
        </div>
      )}
    </div>
  );
}
