/**
 * MemoryDashboard — Main dashboard for the Cody Agent cognitive system.
 *
 * Contains three tabs:
 * - Overview: Stats cards + performance snapshot
 * - Timeline: Evolution log + pending modifications
 * - Suggestions: Proactive suggestions with actions
 *
 * Data is fetched from the SessionManager via RPC channels.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { MemoryStatsCards, type MemoryStats, type EvolutionStats } from './MemoryStatsCards';
import { EvolutionTimeline, type EvolutionLogEntry, type SelfModification } from './EvolutionTimeline';
import { ProactiveSuggestionPanel, type ProactiveSuggestion } from './ProactiveSuggestionPanel';

// ============================================================
// RPC Communication (uses the app's existing RPC infrastructure)
// ============================================================

interface MemoryStatusResponse {
  available: boolean;
  stats?: MemoryStats;
  evolution?: EvolutionStats;
  suggestions?: ProactiveSuggestion[];
  performance?: {
    taskSuccessRate: number;
    userSatisfaction: number;
    skillUtilization: number;
    evolutionScore: number;
  };
  error?: string;
}

interface TimelineResponse {
  entries: EvolutionLogEntry[];
  pendingModifications: SelfModification[];
}

// RPC call helper — uses window.electronRPC or equivalent
// This is a placeholder that will be wired to the actual IPC transport
async function rpcCall(channel: string, ...args: unknown[]): Promise<unknown> {
  // In production, this uses the app's RPC client (e.g., window.electron.rpc)
  // For now, we provide a typed interface that the app's wiring will connect
  if (typeof window !== 'undefined' && (window as any).__rpc) {
    return (window as any).__rpc(channel, ...args);
  }
  throw new Error('RPC not available');
}

// ============================================================
// Tab Configuration
// ============================================================

type TabId = 'overview' | 'timeline' | 'suggestions';

interface TabConfig {
  id: TabId;
  label: string;
  icon: string;
}

const TABS: TabConfig[] = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'timeline', label: 'Timeline', icon: '📜' },
  { id: 'suggestions', label: 'Suggestions', icon: '💡' },
];

// ============================================================
// Dashboard Component
// ============================================================

interface MemoryDashboardProps {
  /** Session ID to fetch memory data for */
  sessionId: string;
  /** Optional RPC override for testing */
  rpcOverride?: (channel: string, ...args: unknown[]) => Promise<unknown>;
}

export function MemoryDashboard({ sessionId, rpcOverride }: MemoryDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [status, setStatus] = useState<MemoryStatusResponse | null>(null);
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const call = rpcOverride ?? rpcCall;

  // Fetch memory status
  const fetchStatus = useCallback(async () => {
    try {
      const result = await call('sessions:codyMemoryStatus', sessionId) as MemoryStatusResponse;
      setStatus(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [sessionId, call]);

  // Fetch timeline
  const fetchTimeline = useCallback(async () => {
    try {
      const result = await call('sessions:codyMemoryTimeline', sessionId, 50) as TimelineResponse;
      setTimeline(result);
    } catch (err) {
      console.error('Failed to fetch timeline:', err);
    }
  }, [sessionId, call]);

  // Initial data fetch
  useEffect(() => {
    fetchStatus();
    fetchTimeline();
  }, [fetchStatus, fetchTimeline]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Action handlers
  const handleAction = useCallback(async (action: string, id?: string) => {
    try {
      await call('sessions:codyMemoryAction', sessionId, action, id);
      // Refresh data after action
      fetchStatus();
      fetchTimeline();
    } catch (err) {
      console.error(`Memory action failed (${action}):`, err);
    }
  }, [sessionId, call, fetchStatus, fetchTimeline]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-[var(--text-secondary)]">
          Loading memory system...
        </div>
      </div>
    );
  }

  // Unavailable state
  if (status && !status.available) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="text-3xl">🧠</div>
        <div className="text-sm text-[var(--text-secondary)]">
          {status.error ? `Memory system error: ${status.error}` : 'Memory system is initializing...'}
        </div>
        <button
          onClick={fetchStatus}
          className="text-xs px-3 py-1.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab Bar */}
      <div className="flex border-b border-[var(--border-default)] px-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 ${
              activeTab === tab.id
                ? 'border-[var(--accent)] text-[var(--text-primary)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <span className="mr-1">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <MemoryStatsCards
              stats={status?.stats ?? null}
              evolution={status?.evolution ?? null}
            />

            {/* Performance Detail */}
            {status?.performance && (
              <div className="bg-[var(--bg-secondary)] rounded-lg p-4 border border-[var(--border-default)]">
                <h4 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">
                  📈 Performance Details
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-[var(--text-tertiary)]">Task Success</div>
                    <div className="font-medium">
                      {(status.performance.taskSuccessRate * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[var(--text-tertiary)]">User Satisfaction</div>
                    <div className="font-medium">
                      {(status.performance.userSatisfaction * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[var(--text-tertiary)]">Skill Utilization</div>
                    <div className="font-medium">
                      {(status.performance.skillUtilization * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[var(--text-tertiary)]">Evolution Score</div>
                    <div className="font-medium">
                      {status.performance.evolutionScore}/100
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-[var(--bg-secondary)] rounded-lg p-4 border border-[var(--border-default)]">
              <h4 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">
                ⚡ Quick Actions
              </h4>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAction('trigger_consolidation')}
                  className="text-xs px-3 py-1.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors"
                >
                  🗂️ Run Consolidation
                </button>
                <button
                  onClick={() => handleAction('trigger_reflection')}
                  className="text-xs px-3 py-1.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors"
                >
                  🤔 Trigger Reflection
                </button>
                <button
                  onClick={fetchStatus}
                  className="text-xs px-3 py-1.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors"
                >
                  🔄 Refresh
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <EvolutionTimeline
            entries={timeline?.entries ?? []}
            pendingModifications={timeline?.pendingModifications ?? []}
            onApprove={(id) => handleAction('approve_modification', id)}
            onReject={(id) => handleAction('reject_modification', id)}
          />
        )}

        {activeTab === 'suggestions' && (
          <ProactiveSuggestionPanel
            suggestions={status?.suggestions ?? []}
            onAccept={(id) => handleAction('accept_suggestion', id)}
            onDismiss={(id) => handleAction('dismiss_suggestion', id)}
          />
        )}
      </div>
    </div>
  );
}
