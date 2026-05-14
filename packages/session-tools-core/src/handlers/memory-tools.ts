/**
 * Memory Tool Handlers for Cody Agent
 *
 * 5 session-scoped tools that give the LLM access to the cognitive memory system:
 * - memory_recall: Search relevant memories for context
 * - memory_store: Store facts, preferences, or knowledge
 * - memory_search: Deep search across all memory layers
 * - memory_status: Get memory stats, evolution summary, suggestions
 * - memory_action: Accept/dismiss suggestions, approve/reject modifications
 */

import type { SessionToolContext } from '../context.ts';
import type { ToolResult } from '../types.ts';
import { errorResponse } from '../response.ts';

/**
 * Get the CodyAgent instance from the context.
 * Returns a helpful error if memory is not available.
 */
function getCody(ctx: SessionToolContext) {
  if (!ctx.codyMemory) {
    return { ok: false as const, error: 'Memory system is not available in this session. Cody Agent memory requires the @cody-agent/core package to be initialized.' };
  }
  return { ok: true as const, cody: ctx.codyMemory };
}

// ============================================================
// memory_recall
// ============================================================

export async function handleMemoryRecall(ctx: SessionToolContext, args: {
  query: string;
  limit?: number;
}): Promise<ToolResult> {
  const result = getCody(ctx);
  if (!result.ok) return errorResponse(result.error);
  const cody = result.cody;

  try {
    const context = await cody.getMemoryContext(args.query);

    if (!context || context.trim().length === 0) {
      return {
        content: [{
          type: 'text',
          text: 'No relevant memories found for this query.',
        }],
      };
    }

    return {
      content: [{
        type: 'text',
        text: context,
      }],
    };
  } catch (err) {
    return errorResponse(`memory_recall failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ============================================================
// memory_store
// ============================================================

export async function handleMemoryStore(ctx: SessionToolContext, args: {
  type: 'fact' | 'preference' | 'knowledge';
  subject: string;
  content: string;
  confidence?: number;
  tags?: string[];
}): Promise<ToolResult> {
  const result = getCody(ctx);
  if (!result.ok) return errorResponse(result.error);
  const cody = result.cody;

  try {
    switch (args.type) {
      case 'fact':
        await cody.storeKnowledge(args.subject, args.content, args.confidence);
        break;
      case 'preference':
        await cody.setUserPreference(args.subject, args.content);
        break;
      case 'knowledge':
        await cody.storeKnowledge(args.subject, args.content, args.confidence);
        break;
      default:
        return errorResponse(`Unknown memory type: ${args.type}`);
    }

    return {
      content: [{
        type: 'text',
        text: `✅ Stored ${args.type}: "${args.subject}" — ${args.content.slice(0, 100)}${args.content.length > 100 ? '...' : ''}`,
      }],
    };
  } catch (err) {
    return errorResponse(`memory_store failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ============================================================
// memory_search
// ============================================================

export async function handleMemorySearch(ctx: SessionToolContext, args: {
  query: string;
  layers?: Array<'episodic' | 'semantic' | 'procedural'>;
  limit?: number;
}): Promise<ToolResult> {
  const result = getCody(ctx);
  if (!result.ok) return errorResponse(result.error);
  const cody = result.cody;

  try {
    const limit = args.limit ?? 5;
    const sections: string[] = [];

    // Search episodic memory
    if (!args.layers || args.layers.includes('episodic')) {
      const episodes = await cody.memory.getEpisodesForReflection(limit);
      if (episodes.length > 0) {
        sections.push('## Episodic Memory (Recent Experiences)');
        for (const ep of episodes) {
          sections.push(`- **${ep.task}** (${ep.outcome}): ${ep.approach.slice(0, 100)}`);
        }
      }
    }

    // Search semantic memory
    if (!args.layers || args.layers.includes('semantic')) {
      const facts = await cody.memory.semantic.search(args.query, limit);
      if (facts.length > 0) {
        sections.push('## Semantic Memory (Knowledge & Facts)');
        for (const fact of facts) {
          sections.push(`- **${fact.subject}** (confidence: ${(fact.confidence * 100).toFixed(0)}%): ${fact.content.slice(0, 150)}`);
        }
      }
    }

    // Search procedural memory (skills)
    if (!args.layers || args.layers.includes('procedural')) {
      const skills = await cody.memory.procedural.search(args.query, limit);
      if (skills.length > 0) {
        sections.push('## Procedural Memory (Learned Skills)');
        for (const skill of skills) {
          sections.push(`- **${skill.name}** (success: ${(skill.metrics.successRate * 100).toFixed(0)}%, used ${skill.metrics.useCount}x)`);
        }
      }
    }

    if (sections.length === 0) {
      return {
        content: [{
          type: 'text',
          text: 'No results found across searched memory layers.',
        }],
      };
    }

    return {
      content: [{
        type: 'text',
        text: sections.join('\n\n'),
      }],
    };
  } catch (err) {
    return errorResponse(`memory_search failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ============================================================
// memory_status
// ============================================================

export async function handleMemoryStatus(ctx: SessionToolContext, args: {
  includeEvolution?: boolean;
  includeSuggestions?: boolean;
  includePerformance?: boolean;
}): Promise<ToolResult> {
  const result = getCody(ctx);
  if (!result.ok) return errorResponse(result.error);
  const cody = result.cody;

  try {
    const sections: string[] = [];

    // Memory stats
    const stats = await cody.getMemoryStats();
    sections.push('## Memory Statistics');
    sections.push(`- **Episodes** (experiences): ${stats.episodicCount}`);
    sections.push(`- **Facts** (knowledge): ${stats.semanticCount}`);
    sections.push(`- **Skills** (procedures): ${stats.proceduralCount}`);
    sections.push(`- **Working memory**: ${stats.workingMemorySize} items (${stats.workingMemoryTokens} tokens)`);
    sections.push(`- **Vector index**: ${stats.vectorCount} entries`);

    // Evolution summary
    if (args.includeEvolution !== false) {
      const evo = cody.getEvolutionSummary();
      sections.push('');
      sections.push('## Evolution');
      sections.push(`- **Performance trend**: ${evo.performanceTrend}`);
      sections.push(`- **Current score**: ${evo.currentScore}/100`);
      sections.push(`- **Total evolutions**: ${evo.totalEvolutions}`);
      sections.push(`- **Active strategies**: ${evo.activeStrategies}/${evo.totalStrategies}`);
      sections.push(`- **Best strategy**: ${evo.bestStrategy ?? 'none yet'}`);
      sections.push(`- **Pending modifications**: ${evo.pendingModifications}`);
    }

    // Proactive suggestions
    if (args.includeSuggestions !== false) {
      const suggestions = cody.getProactiveSuggestions();
      if (suggestions.length > 0) {
        sections.push('');
        sections.push('## Proactive Suggestions');
        for (const sug of suggestions) {
          const status = sug.status === 'pending' ? '🟡' : sug.status === 'accepted' ? '🟢' : '⚪';
          sections.push(`- ${status} **${sug.title}** (${sug.type}, confidence: ${(sug.confidence * 100).toFixed(0)}%)`);
          if (sug.description) {
            sections.push(`  > ${sug.description.split('\n')[0]}`);
          }
        }
      }
    }

    // Performance snapshot
    if (args.includePerformance !== false) {
      const perf = cody.getPerformance();
      if (perf) {
        sections.push('');
        sections.push('## Performance Snapshot');
        sections.push(`- **Task success rate**: ${(perf.taskSuccessRate * 100).toFixed(0)}%`);
        sections.push(`- **User satisfaction**: ${(perf.userSatisfaction * 100).toFixed(0)}%`);
        sections.push(`- **Skill utilization**: ${(perf.skillUtilization * 100).toFixed(0)}%`);
        sections.push(`- **Evolution score**: ${perf.evolutionScore}/100`);
      }
    }

    return {
      content: [{
        type: 'text',
        text: sections.join('\n'),
      }],
    };
  } catch (err) {
    return errorResponse(`memory_status failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ============================================================
// memory_action
// ============================================================

export async function handleMemoryAction(ctx: SessionToolContext, args: {
  action: 'accept_suggestion' | 'dismiss_suggestion' | 'approve_modification' | 'reject_modification' | 'trigger_consolidation' | 'trigger_reflection';
  id?: string;
}): Promise<ToolResult> {
  const result = getCody(ctx);
  if (!result.ok) return errorResponse(result.error);
  const cody = result.cody;

  try {
    switch (args.action) {
      case 'accept_suggestion': {
        if (!args.id) return errorResponse('id is required for accept_suggestion');
        const ok = cody.acceptSuggestion(args.id);
        return {
          content: [{
            type: 'text',
            text: ok ? `✅ Suggestion ${args.id} accepted` : `❌ Suggestion ${args.id} not found or already processed`,
          }],
        };
      }

      case 'dismiss_suggestion': {
        if (!args.id) return errorResponse('id is required for dismiss_suggestion');
        const ok = cody.dismissSuggestion(args.id);
        return {
          content: [{
            type: 'text',
            text: ok ? `✅ Suggestion ${args.id} dismissed` : `❌ Suggestion ${args.id} not found`,
          }],
        };
      }

      case 'approve_modification': {
        if (!args.id) return errorResponse('id is required for approve_modification');
        const ok = cody.approveModification(args.id);
        return {
          content: [{
            type: 'text',
            text: ok ? `✅ Modification ${args.id} approved and applied` : `❌ Modification ${args.id} not found or not pending`,
          }],
        };
      }

      case 'reject_modification': {
        if (!args.id) return errorResponse('id is required for reject_modification');
        const ok = cody.rejectModification(args.id);
        return {
          content: [{
            type: 'text',
            text: ok ? `✅ Modification ${args.id} rejected` : `❌ Modification ${args.id} not found or not pending`,
          }],
        };
      }

      case 'trigger_consolidation': {
        const report = await cody.memory.runConsolidation();
        return {
          content: [{
            type: 'text',
            text: `✅ Consolidation complete: ${report.reinforced} reinforced, ${report.decayed} decayed, ${report.merged} merged, ${report.promoted} promoted to skills`,
          }],
        };
      }

      case 'trigger_reflection': {
        const recentEpisodes = await cody.memory.getEpisodesForReflection(10);
        if (recentEpisodes.length === 0) {
          return {
            content: [{ type: 'text', text: 'No recent episodes to reflect on.' }],
          };
        }
        const reflectResult = await cody.evolve.reflect('immediate', recentEpisodes);
        return {
          content: [{
            type: 'text',
            text: `✅ Reflection complete. Score: ${reflectResult.performanceScore}/100\n${reflectResult.insights.join('\n')}`,
          }],
        };
      }

      default:
        return errorResponse(`Unknown action: ${args.action}`);
    }
  } catch (err) {
    return errorResponse(`memory_action failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
