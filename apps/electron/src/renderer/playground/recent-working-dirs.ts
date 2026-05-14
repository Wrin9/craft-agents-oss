export type RecentDirScenario = 'none' | 'few' | 'many'

const RECENT_DIR_SCENARIO_DATA: Record<RecentDirScenario, string[]> = {
  none: [],
  few: [
    '/Users/demo/projects/cody-agent',
    '/Users/demo/projects/cody-agent/apps/electron',
    '/Users/demo/projects/cody-agent/packages/shared',
  ],
  many: [
    '/Users/demo/projects/cody-agent',
    '/Users/demo/projects/cody-agent/apps/electron',
    '/Users/demo/projects/cody-agent/apps/viewer',
    '/Users/demo/projects/cody-agent/apps/cli',
    '/Users/demo/projects/cody-agent/packages/shared',
    '/Users/demo/projects/cody-agent/packages/server-core',
    '/Users/demo/projects/cody-agent/packages/pi-agent-server',
    '/Users/demo/projects/cody-agent/packages/ui',
    '/Users/demo/projects/cody-agent/scripts',
  ],
}

/** Return a copy of the fixture list for the selected scenario. */
export function getRecentDirsForScenario(scenario: RecentDirScenario): string[] {
  return [...RECENT_DIR_SCENARIO_DATA[scenario]]
}
