/**
 * ABOUTME: Builds Factory Droid CLI arguments for task execution.
 * Ensures non-interactive flags and working directory are applied.
 */

import { DROID_NON_INTERACTIVE_FLAGS } from './config.js';

export interface DroidCommandArgs {
  prompt: string;
  cwd: string;
  model?: string;
  reasoningEffort?: string;
  skipPermissions?: boolean;
}

export function buildDroidCommandArgs({
  prompt,
  cwd,
  model,
  reasoningEffort,
  skipPermissions,
}: DroidCommandArgs): string[] {
  const args: string[] = [...DROID_NON_INTERACTIVE_FLAGS];

  if (model) {
    args.push('--model', model);
  }

  if (reasoningEffort) {
    args.push('--reasoning-effort', reasoningEffort);
  }

  if (skipPermissions) {
    args.push('--skip-permissions-unsafe');
  }

  args.push(prompt, '--cwd', cwd);
  return args;
}
