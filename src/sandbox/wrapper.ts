/**
 * ABOUTME: Wraps commands in bwrap for sandbox isolation.
 * Builds bubblewrap arguments based on config and agent requirements.
 */

import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import type { SandboxConfig } from './types.js';
import type { AgentSandboxRequirements } from '../plugins/agents/types.js';

export interface WrappedCommand {
  command: string;
  args: string[];
}

export interface SandboxWrapOptions {
  cwd?: string;
}

const SYSTEM_DIRS = ['/usr', '/bin', '/lib', '/lib64', '/sbin', '/etc'];

export class SandboxWrapper {
  private readonly config: SandboxConfig;
  private readonly requirements: AgentSandboxRequirements;

  constructor(config: SandboxConfig, requirements: AgentSandboxRequirements) {
    this.config = config;
    this.requirements = requirements;
  }

  wrapCommand(
    command: string,
    args: string[],
    options: SandboxWrapOptions = {}
  ): WrappedCommand {
    if (this.config.enabled === false || this.config.mode === 'off') {
      return { command, args };
    }

    if (this.config.mode && this.config.mode !== 'auto' && this.config.mode !== 'bwrap') {
      return { command, args };
    }

    return this.wrapWithBwrap(command, args, options);
  }

  wrapWithBwrap(
    command: string,
    args: string[],
    options: SandboxWrapOptions = {}
  ): WrappedCommand {
    const cwd = options.cwd ?? process.cwd();
    const workDir = resolve(cwd);
    const bwrapArgs: string[] = ['--die-with-parent', '--dev', '/dev', '--proc', '/proc'];

    if (this.config.network === false) {
      bwrapArgs.push('--unshare-net');
    }

    for (const dir of SYSTEM_DIRS) {
      if (existsSync(dir)) {
        bwrapArgs.push('--ro-bind', dir, dir);
      }
    }

    const readWritePaths = new Set<string>([
      workDir,
      ...this.normalizePaths(this.config.allowPaths ?? [], workDir),
    ]);
    const readOnlyPaths = new Set<string>([
      ...this.normalizePaths(this.config.readOnlyPaths ?? [], workDir),
      ...this.normalizePaths(this.getRequirementPaths(), workDir),
    ]);

    for (const path of readWritePaths) {
      readOnlyPaths.delete(path);
    }

    for (const path of readWritePaths) {
      bwrapArgs.push('--bind', path, path);
    }

    for (const path of readOnlyPaths) {
      bwrapArgs.push('--ro-bind', path, path);
    }

    bwrapArgs.push('--chdir', workDir, '--', command, ...args);

    return { command: 'bwrap', args: bwrapArgs };
  }

  private getRequirementPaths(): string[] {
    return [
      ...this.requirements.authPaths,
      ...this.requirements.binaryPaths,
      ...this.requirements.runtimePaths,
    ];
  }

  private normalizePaths(paths: string[], cwd: string): string[] {
    const resolved = paths
      .filter((path) => path.trim().length > 0)
      .map((path) => (isAbsolute(path) ? path : resolve(cwd, path)));
    return Array.from(new Set(resolved));
  }
}
