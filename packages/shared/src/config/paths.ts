/**
 * Centralized path configuration for Cody Agent.
 *
 * Supports multi-instance development via CODY_CONFIG_DIR environment variable.
 * When running from a numbered folder (e.g., cody-agent-1), the detect-instance.sh
 * script sets CODY_CONFIG_DIR to ~/.cody-agent-1, allowing multiple instances to run
 * simultaneously with separate configurations.
 *
 * Default (non-numbered folders): ~/.cody-agent/
 * Instance 1 (-1 suffix): ~/.cody-agent-1/
 * Instance 2 (-2 suffix): ~/.cody-agent-2/
 *
 * Also supports legacy CRAFT_CONFIG_DIR for backward compatibility.
 */

import { homedir } from 'os';
import { join } from 'path';

// Allow override via environment variable for multi-instance dev
// Supports both CODY_CONFIG_DIR (new) and CRAFT_CONFIG_DIR (legacy) env vars
// Falls back to default ~/.cody-agent/ for production
export const CONFIG_DIR = process.env.CODY_CONFIG_DIR || process.env.CRAFT_CONFIG_DIR || join(homedir(), '.cody-agent');
