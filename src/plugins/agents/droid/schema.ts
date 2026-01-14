/**
 * ABOUTME: Zod schema for Factory Droid agent configuration options.
 * Validates optional model and reasoning effort settings.
 */

import { z } from 'zod';

export const DroidReasoningEffortSchema = z.enum(['low', 'medium', 'high']);

export const DroidAgentConfigSchema = z
  .object({
    model: z.string().optional(),
    reasoningEffort: DroidReasoningEffortSchema.optional(),
    skipPermissions: z.boolean().optional().default(false),
  })
  .passthrough();

export type DroidReasoningEffort = z.infer<typeof DroidReasoningEffortSchema>;
export type DroidAgentConfig = z.infer<typeof DroidAgentConfigSchema>;
