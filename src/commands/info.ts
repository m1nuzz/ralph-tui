/**
 * ABOUTME: System info command for ralph-tui.
 * Outputs diagnostic information useful for bug reports.
 * Collects version info, config paths, and environment details.
 */

import { platform, release, arch } from 'node:os';
import { join } from 'node:path';
import { access, constants, readFile } from 'node:fs/promises';

import { loadStoredConfigWithSource, CONFIG_PATHS } from '../config/index.js';
import { getAgentRegistry } from '../plugins/agents/registry.js';
import { registerBuiltinAgents } from '../plugins/agents/builtin/index.js';
import { registerBuiltinTrackers } from '../plugins/trackers/builtin/index.js';
import { getUserConfigDir } from '../templates/engine.js';

// Package version - imported at runtime
let packageVersion = 'unknown';
try {
  // Try to read from package.json in various locations
  const possiblePaths = [
    join(__dirname, '../../package.json'),
    join(__dirname, '../package.json'),
    join(process.cwd(), 'package.json'),
  ];
  for (const p of possiblePaths) {
    try {
      const pkg = await readFile(p, 'utf-8');
      const parsed = JSON.parse(pkg);
      if (parsed.name === 'ralph-tui') {
        packageVersion = parsed.version;
        break;
      }
    } catch {
      // Try next path
    }
  }
} catch {
  // Version remains unknown
}

/**
 * System info result
 */
export interface SystemInfo {
  /** ralph-tui version */
  version: string;

  /** Runtime info */
  runtime: {
    /** Bun or Node version */
    version: string;
    /** Runtime name */
    name: 'bun' | 'node';
  };

  /** Operating system info */
  os: {
    platform: string;
    release: string;
    arch: string;
  };

  /** Configuration info */
  config: {
    /** Global config path */
    globalPath: string;
    /** Global config exists */
    globalExists: boolean;
    /** Project config path (if found) */
    projectPath: string | null;
    /** Project config exists */
    projectExists: boolean;
  };

  /** Templates info */
  templates: {
    /** Global templates directory */
    globalDir: string;
    /** Templates found */
    installed: string[];
  };

  /** Agent info */
  agent: {
    /** Configured agent name */
    name: string;
    /** Agent detected/available */
    available: boolean;
    /** Agent version (if available) */
    version?: string;
    /** Detection error (if any) */
    error?: string;
  };

  /** Tracker info */
  tracker: {
    /** Configured tracker name */
    name: string;
  };
}

/**
 * Collect system information for bug reports
 */
export async function collectSystemInfo(cwd: string = process.cwd()): Promise<SystemInfo> {
  // Load config with source info
  const { config, source } = await loadStoredConfigWithSource(cwd);

  // Check global config exists
  let globalExists = false;
  try {
    await access(CONFIG_PATHS.global, constants.R_OK);
    globalExists = true;
  } catch {
    // Doesn't exist
  }

  // Check templates directory
  const templatesDir = join(getUserConfigDir(), 'templates');
  const installedTemplates: string[] = [];
  try {
    const { readdir } = await import('node:fs/promises');
    const files = await readdir(templatesDir);
    installedTemplates.push(...files.filter((f) => f.endsWith('.hbs')));
  } catch {
    // Directory doesn't exist or can't read
  }

  // Get agent info
  registerBuiltinAgents();
  const agentRegistry = getAgentRegistry();
  const agentName = config.agent ?? 'claude';
  let agentAvailable = false;
  let agentVersion: string | undefined;
  let agentError: string | undefined;

  try {
    if (agentRegistry.hasPlugin(agentName)) {
      const agent = await agentRegistry.getInstance({
        name: agentName,
        plugin: agentName,
        options: config.agentOptions ?? {},
      });
      const detection = await agent.detect();
      agentAvailable = detection.available;
      agentVersion = detection.version;
      agentError = detection.error;
    } else {
      agentError = `Unknown agent plugin: ${agentName}`;
    }
  } catch (error) {
    agentError = error instanceof Error ? error.message : String(error);
  }

  // Get tracker info
  registerBuiltinTrackers();
  const trackerName = config.tracker ?? 'beads';

  // Determine runtime
  const isBun = typeof Bun !== 'undefined';
  const runtimeVersion = isBun ? Bun.version : process.version;

  return {
    version: packageVersion,
    runtime: {
      name: isBun ? 'bun' : 'node',
      version: runtimeVersion,
    },
    os: {
      platform: platform(),
      release: release(),
      arch: arch(),
    },
    config: {
      globalPath: CONFIG_PATHS.global,
      globalExists,
      projectPath: source.projectPath,
      projectExists: source.projectLoaded,
    },
    templates: {
      globalDir: templatesDir,
      installed: installedTemplates,
    },
    agent: {
      name: agentName,
      available: agentAvailable,
      version: agentVersion,
      error: agentError,
    },
    tracker: {
      name: trackerName,
    },
  };
}

/**
 * Format system info for display
 */
export function formatSystemInfo(info: SystemInfo): string {
  const lines: string[] = [];

  lines.push('ralph-tui System Information');
  lines.push('============================');
  lines.push('');

  // Version info
  lines.push(`ralph-tui version: ${info.version}`);
  lines.push(`Runtime: ${info.runtime.name} ${info.runtime.version}`);
  lines.push(`OS: ${info.os.platform} ${info.os.release} (${info.os.arch})`);
  lines.push('');

  // Config info
  lines.push('Configuration:');
  lines.push(`  Global config: ${info.config.globalPath}`);
  lines.push(`    Exists: ${info.config.globalExists ? 'yes' : 'no'}`);
  if (info.config.projectPath) {
    lines.push(`  Project config: ${info.config.projectPath}`);
    lines.push(`    Exists: ${info.config.projectExists ? 'yes' : 'no'}`);
  } else {
    lines.push('  Project config: (none found)');
  }
  lines.push('');

  // Templates info
  lines.push('Templates:');
  lines.push(`  Directory: ${info.templates.globalDir}`);
  if (info.templates.installed.length > 0) {
    lines.push(`  Installed: ${info.templates.installed.join(', ')}`);
  } else {
    lines.push('  Installed: (none)');
  }
  lines.push('');

  // Agent info
  lines.push('Agent:');
  lines.push(`  Configured: ${info.agent.name}`);
  lines.push(`  Available: ${info.agent.available ? 'yes' : 'no'}`);
  if (info.agent.version) {
    lines.push(`  Version: ${info.agent.version}`);
  }
  if (info.agent.error) {
    lines.push(`  Error: ${info.agent.error}`);
  }
  lines.push('');

  // Tracker info
  lines.push('Tracker:');
  lines.push(`  Configured: ${info.tracker.name}`);

  return lines.join('\n');
}

/**
 * Format system info as copyable bug report snippet
 */
export function formatForBugReport(info: SystemInfo): string {
  const lines: string[] = [];

  lines.push('```');
  lines.push(`ralph-tui: ${info.version}`);
  lines.push(`runtime: ${info.runtime.name} ${info.runtime.version}`);
  lines.push(`os: ${info.os.platform} ${info.os.release} (${info.os.arch})`);
  lines.push(`agent: ${info.agent.name}${info.agent.version ? ` v${info.agent.version}` : ''}${info.agent.available ? '' : ' (unavailable)'}`);
  lines.push(`tracker: ${info.tracker.name}`);
  lines.push(`global-config: ${info.config.globalExists ? 'yes' : 'no'}`);
  lines.push(`project-config: ${info.config.projectExists ? 'yes' : 'no'}`);
  lines.push(`templates: ${info.templates.installed.length > 0 ? info.templates.installed.join(', ') : 'none'}`);
  lines.push('```');

  return lines.join('\n');
}

// ANSI colors
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';

/**
 * Parse --cwd argument from args array.
 * Handles both '--cwd path' and '--cwd=path' forms.
 * Uses indexOf to avoid truncating paths containing '=' characters.
 */
export function parseCwdArg(args: string[]): string {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Handle --cwd=path form (use indexOf to preserve '=' in path)
    if (arg.startsWith('--cwd=')) {
      return arg.substring('--cwd='.length);
    }

    // Handle --cwd path form
    if (arg === '--cwd' && i + 1 < args.length) {
      return args[i + 1];
    }
  }

  return process.cwd();
}

/**
 * Execute the info command
 */
export async function executeInfoCommand(args: string[]): Promise<void> {
  const jsonOutput = args.includes('--json');
  const copyable = args.includes('--copyable') || args.includes('-c');
  const cwd = parseCwdArg(args);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
${BOLD}ralph-tui info${RESET} - Display system information for bug reports

${BOLD}Usage:${RESET} ralph-tui info [options]

${BOLD}Options:${RESET}
  ${DIM}--json${RESET}            Output in JSON format
  ${DIM}--copyable, -c${RESET}    Output in copyable format for bug reports
  ${DIM}--cwd <path>${RESET}      Working directory (default: current directory)
  ${DIM}-h, --help${RESET}        Show this help message

${BOLD}Description:${RESET}
  Collects and displays diagnostic information about your ralph-tui
  installation. This is useful for including in bug reports.

  Information collected:
  - ralph-tui version
  - Runtime (Bun/Node) version
  - Operating system details
  - Configuration file locations and status
  - Installed templates
  - Agent detection status
  - Tracker configuration

${BOLD}Examples:${RESET}
  ${CYAN}ralph-tui info${RESET}              # Display system info
  ${CYAN}ralph-tui info --json${RESET}       # JSON output for scripts
  ${CYAN}ralph-tui info -c${RESET}           # Copyable format for bug reports
`);
    return;
  }

  try {
    const info = await collectSystemInfo(cwd);

    if (jsonOutput) {
      console.log(JSON.stringify(info, null, 2));
    } else if (copyable) {
      console.log(formatForBugReport(info));
    } else {
      console.log();
      console.log(formatSystemInfo(info));
      console.log();
      console.log(`${DIM}Tip: Use ${CYAN}ralph-tui info -c${RESET}${DIM} for a copyable bug report format${RESET}`);
      console.log();
    }
  } catch (error) {
    console.error(`${YELLOW}Error collecting system info:${RESET}`, error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
