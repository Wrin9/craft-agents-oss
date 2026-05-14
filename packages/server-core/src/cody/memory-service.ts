/**
 * CodyMemoryService — Workspace-scoped singleton for the Cody cognitive system.
 *
 * Manages CodyAgent lifecycle per workspace:
 * - On workspace load → createCodyAgent()
 * - On workspace unload → agent.shutdown()
 * - Provides access to the agent for SessionManager and IPC handlers
 *
 * Memory data is persisted to `{workspaceRoot}/cody-memory/`.
 */

import { createCodyAgent, type CodyAgent, type CodyAgentStatus } from '@cody-agent/core';
import { join } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';

const codyLog = {
  info: (...args: unknown[]) => console.log('[cody-memory]', ...args),
  warn: (...args: unknown[]) => console.warn('[cody-memory]', ...args),
  error: (...args: unknown[]) => console.error('[cody-memory]', ...args),
};

/**
 * Manages CodyAgent instances per workspace.
 * Designed as a singleton — one instance shared across the entire server.
 */
export class CodyMemoryService {
  private readonly agents = new Map<string, CodyAgent>();
  private readonly dataDirs = new Map<string, string>();

  /** Whether the service is globally enabled (can be toggled via config) */
  private _enabled = true;

  get enabled(): boolean {
    return this._enabled;
  }

  setEnabled(value: boolean): void {
    this._enabled = value;
  }

  /**
   * Get or create a CodyAgent for a workspace.
   * Returns null if the service is disabled or initialization fails.
   */
  async getAgent(workspaceId: string, workspaceRootPath: string): Promise<CodyAgent | null> {
    if (!this._enabled) return null;

    const existing = this.agents.get(workspaceId);
    if (existing && existing.isActive) return existing;

    // Clean up stale agent if exists but inactive
    if (existing) {
      this.agents.delete(workspaceId);
    }

    try {
      const dataDir = join(workspaceRootPath, 'cody-memory');
      if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true });
      }

      this.dataDirs.set(workspaceId, dataDir);

      const agent = await createCodyAgent({
        workspaceDataDir: dataDir,
        workspaceId,
      });

      this.agents.set(workspaceId, agent);
      codyLog.info(`CodyAgent initialized for workspace ${workspaceId} (data: ${dataDir})`);
      return agent;
    } catch (error) {
      codyLog.error(`Failed to initialize CodyAgent for workspace ${workspaceId}:`, error);
      return null;
    }
  }

  /**
   * Get an already-initialized agent (no creation).
   * Returns null if not initialized.
   */
  getActiveAgent(workspaceId: string): CodyAgent | null {
    const agent = this.agents.get(workspaceId);
    return agent?.isActive ? agent : null;
  }

  /**
   * Shutdown the agent for a workspace.
   */
  async shutdownWorkspace(workspaceId: string): Promise<void> {
    const agent = this.agents.get(workspaceId);
    if (agent) {
      try {
        await agent.shutdown();
        codyLog.info(`CodyAgent shutdown for workspace ${workspaceId}`);
      } catch (error) {
        codyLog.error(`Error shutting down CodyAgent for workspace ${workspaceId}:`, error);
      }
      this.agents.delete(workspaceId);
      this.dataDirs.delete(workspaceId);
    }
  }

  /**
   * Shutdown all workspace agents.
   */
  async shutdownAll(): Promise<void> {
    const ids = [...this.agents.keys()];
    await Promise.all(ids.map(id => this.shutdownWorkspace(id)));
    codyLog.info(`All CodyAgents shutdown (${ids.length} workspaces)`);
  }

  /**
   * Get the data directory for a workspace.
   */
  getDataDir(workspaceId: string): string | null {
    return this.dataDirs.get(workspaceId) ?? null;
  }

  /**
   * Get status for a workspace's cognitive system.
   */
  async getStatus(workspaceId: string): Promise<CodyAgentStatus | null> {
    const agent = this.getActiveAgent(workspaceId);
    if (!agent) return null;
    try {
      return await agent.getStatus();
    } catch {
      return null;
    }
  }
}

/** Global singleton instance */
let _instance: CodyMemoryService | null = null;

/**
 * Get the global CodyMemoryService instance.
 * Creates it on first call.
 */
export function getCodyMemoryService(): CodyMemoryService {
  if (!_instance) {
    _instance = new CodyMemoryService();
    codyLog.info('CodyMemoryService singleton created');
  }
  return _instance;
}

/**
 * Reset the singleton (for testing).
 */
export function resetCodyMemoryService(): void {
  _instance = null;
}
