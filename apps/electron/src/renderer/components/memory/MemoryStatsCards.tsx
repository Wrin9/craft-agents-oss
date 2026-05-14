/**
 * MemoryStatsCards — Displays memory statistics in a grid of cards.
 *
 * Shows:
 * - Episodes (experiences)
 * - Facts (knowledge entries)
 * - Skills (procedures)
 * - Evolution Score (0-100)
 */

import React from 'react';

export interface MemoryStats {
  episodicCount: number;
  semanticCount: number;
  proceduralCount: number;
  workingMemorySize: number;
  workingMemoryTokens: number;
  vectorCount: number;
}

export interface EvolutionStats {
  performanceTrend: 'improving' | 'stable' | 'declining';
  currentScore: number;
  totalEvolutions: number;
  activeStrategies: number;
  totalStrategies: number;
  bestStrategy: string | null;
  pendingModifications: number;
}

interface MemoryStatsCardsProps {
  stats: MemoryStats | null;
  evolution: EvolutionStats | null;
}

const trendIcon: Record<string, string> = {
  improving: '📈',
  stable: '➡️',
  declining: '📉',
};

const trendColor: Record<string, string> = {
  improving: 'text-green-500',
  stable: 'text-gray-400',
  declining: 'text-red-500',
};

export function MemoryStatsCards({ stats, evolution }: MemoryStatsCardsProps) {
  const cards = [
    {
      label: 'Episodes',
      icon: '📝',
      value: stats?.episodicCount ?? 0,
      subtitle: 'Experiences recorded',
      color: 'text-blue-400',
    },
    {
      label: 'Facts',
      icon: '💡',
      value: stats?.semanticCount ?? 0,
      subtitle: 'Knowledge entries',
      color: 'text-yellow-400',
    },
    {
      label: 'Skills',
      icon: '⚡',
      value: stats?.proceduralCount ?? 0,
      subtitle: 'Learned procedures',
      color: 'text-purple-400',
    },
    {
      label: 'Score',
      icon: '🧬',
      value: evolution?.currentScore ?? 0,
      subtitle: evolution ? `${trendIcon[evolution.performanceTrend]} ${evolution.performanceTrend}` : 'Not enough data',
      color: evolution?.performanceTrend === 'improving' ? 'text-green-400' : evolution?.performanceTrend === 'declining' ? 'text-red-400' : 'text-gray-400',
      maxValue: 100,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-[var(--bg-secondary)] rounded-lg p-4 border border-[var(--border-default)]"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{card.icon}</span>
            <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
              {card.label}
            </span>
          </div>
          <div className={`text-2xl font-bold ${card.color}`}>
            {card.maxValue ? `${card.value}/${card.maxValue}` : card.value}
          </div>
          <div className={`text-xs mt-1 ${trendColor[evolution?.performanceTrend ?? 'stable']}`}>
            {card.subtitle}
          </div>
        </div>
      ))}
    </div>
  );
}
