/**
 * ABOUTME: Configuration loading and validation for Ralph TUI.
 * Handles merging stored config with CLI options and validating the result.
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import { readFile, access, constants } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import type {
  StoredConfig,
  RalphConfig,
  RuntimeOptions,
  ConfigValidationResult,
} from './types.js';
import { DEFAULT_CONFIG, DEFAULT_ERROR_HANDLING } from './types.js';
import type { ErrorHandlingConfig } from '../engine/types.js';
import type { AgentPluginConfig } from '../plugins/agents/types.js';
import type { TrackerPluginConfig } from '../plugins/trackers/types.js';
import { getAgentRegistry } from '../plugins/agents/registry.js';
import { getTrackerRegistry } from '../plugins/trackers/registry.js';

/**
 * Default config file path
 */
const CONFIG_PATH = join(homedir(), '.config', 'ralph-tui', 'config.yaml');

/**
 * Load stored configuration from YAML file
 */
export async function loadStoredConfig(
  configPath: string = CONFIG_PATH
): Promise<StoredConfig> {
  try {
    await access(configPath, constants.R_OK);
    const content = await readFile(configPath, 'utf-8');
    return parseYaml(content) as StoredConfig;
  } catch {
    // Return empty config if file doesn't exist
    return {};
  }
}

/**
 * Get default agent configuration based on available plugins
 */
function getDefaultAgentConfig(
  storedConfig: StoredConfig,
  options: RuntimeOptions
): AgentPluginConfig | undefined {
  const registry = getAgentRegistry();
  const plugins = registry.getRegisteredPlugins();

  // Check CLI override first
  if (options.agent) {
    const found = storedConfig.agents?.find(
      (a) => a.name === options.agent || a.plugin === options.agent
    );
    if (found) return found;

    // Create minimal config for the specified plugin
    if (registry.hasPlugin(options.agent)) {
      return {
        name: options.agent,
        plugin: options.agent,
        options: {},
      };
    }
    return undefined;
  }

  // Check stored default
  if (storedConfig.defaultAgent) {
    const found = storedConfig.agents?.find(
      (a) => a.name === storedConfig.defaultAgent
    );
    if (found) return found;
  }

  // Use first available agent from config
  if (storedConfig.agents && storedConfig.agents.length > 0) {
    const defaultAgent = storedConfig.agents.find((a) => a.default);
    return defaultAgent ?? storedConfig.agents[0];
  }

  // Fall back to first built-in plugin (claude)
  const firstPlugin = plugins.find((p) => p.id === 'claude') ?? plugins[0];
  if (firstPlugin) {
    return {
      name: firstPlugin.id,
      plugin: firstPlugin.id,
      options: {},
    };
  }

  return undefined;
}

/**
 * Get default tracker configuration based on available plugins
 */
function getDefaultTrackerConfig(
  storedConfig: StoredConfig,
  options: RuntimeOptions
): TrackerPluginConfig | undefined {
  const registry = getTrackerRegistry();
  const plugins = registry.getRegisteredPlugins();

  // Check CLI override first
  if (options.tracker) {
    const found = storedConfig.trackers?.find(
      (t) => t.name === options.tracker || t.plugin === options.tracker
    );
    if (found) return found;

    // Create minimal config for the specified plugin
    if (registry.hasPlugin(options.tracker)) {
      return {
        name: options.tracker,
        plugin: options.tracker,
        options: {},
      };
    }
    return undefined;
  }

  // Check stored default
  if (storedConfig.defaultTracker) {
    const found = storedConfig.trackers?.find(
      (t) => t.name === storedConfig.defaultTracker
    );
    if (found) return found;
  }

  // Use first available tracker from config
  if (storedConfig.trackers && storedConfig.trackers.length > 0) {
    const defaultTracker = storedConfig.trackers.find((t) => t.default);
    return defaultTracker ?? storedConfig.trackers[0];
  }

  // Fall back to first built-in plugin (beads-bv)
  const firstPlugin = plugins.find((p) => p.id === 'beads-bv') ?? plugins[0];
  if (firstPlugin) {
    return {
      name: firstPlugin.id,
      plugin: firstPlugin.id,
      options: {},
    };
  }

  return undefined;
}

/**
 * Build runtime configuration by merging stored config with CLI options
 */
export async function buildConfig(
  options: RuntimeOptions = {}
): Promise<RalphConfig | null> {
  const storedConfig = await loadStoredConfig();

  // Get agent config
  const agentConfig = getDefaultAgentConfig(storedConfig, options);
  if (!agentConfig) {
    console.error('Error: No agent configured or available');
    return null;
  }

  // Get tracker config
  const trackerConfig = getDefaultTrackerConfig(storedConfig, options);
  if (!trackerConfig) {
    console.error('Error: No tracker configured or available');
    return null;
  }

  // Apply epic/prd options to tracker
  if (options.epicId) {
    trackerConfig.options = {
      ...trackerConfig.options,
      epicId: options.epicId,
    };
  }
  if (options.prdPath) {
    trackerConfig.options = {
      ...trackerConfig.options,
      prdPath: options.prdPath,
    };
  }

  // Build error handling config, applying CLI overrides
  const errorHandling: ErrorHandlingConfig = {
    ...DEFAULT_ERROR_HANDLING,
    ...(storedConfig.errorHandling ?? {}),
    ...(options.onError ? { strategy: options.onError } : {}),
    ...(options.maxRetries !== undefined ? { maxRetries: options.maxRetries } : {}),
  };

  return {
    agent: agentConfig,
    tracker: trackerConfig,
    maxIterations:
      options.iterations ??
      storedConfig.maxIterations ??
      DEFAULT_CONFIG.maxIterations,
    iterationDelay:
      options.iterationDelay ??
      storedConfig.iterationDelay ??
      DEFAULT_CONFIG.iterationDelay,
    cwd: options.cwd ?? DEFAULT_CONFIG.cwd,
    outputDir: storedConfig.outputDir ?? DEFAULT_CONFIG.outputDir,
    epicId: options.epicId,
    prdPath: options.prdPath,
    model: options.model,
    showTui: !options.headless,
    errorHandling,
  };
}

/**
 * Validate configuration before starting
 */
export async function validateConfig(
  config: RalphConfig
): Promise<ConfigValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate agent plugin exists
  const agentRegistry = getAgentRegistry();
  if (!agentRegistry.hasPlugin(config.agent.plugin)) {
    errors.push(`Agent plugin '${config.agent.plugin}' not found`);
  }

  // Validate tracker plugin exists
  const trackerRegistry = getTrackerRegistry();
  if (!trackerRegistry.hasPlugin(config.tracker.plugin)) {
    errors.push(`Tracker plugin '${config.tracker.plugin}' not found`);
  }

  // Validate tracker-specific requirements
  if (
    config.tracker.plugin === 'beads' ||
    config.tracker.plugin === 'beads-bv'
  ) {
    if (!config.epicId) {
      warnings.push(
        'No epic ID specified for beads tracker; will use current directory'
      );
    }
  }

  if (config.tracker.plugin === 'json') {
    if (!config.prdPath) {
      errors.push('PRD path required for json tracker');
    }
  }

  // Validate iterations
  if (config.maxIterations < 0) {
    errors.push('Max iterations must be 0 or greater');
  }

  // Validate delay
  if (config.iterationDelay < 0) {
    errors.push('Iteration delay must be 0 or greater');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// Re-export types
export type { StoredConfig, RalphConfig, RuntimeOptions, ConfigValidationResult };
export { DEFAULT_CONFIG };
