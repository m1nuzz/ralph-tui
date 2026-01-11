/**
 * ABOUTME: OpenCode agent plugin for the opencode CLI.
 * Integrates with the OpenCode AI coding assistant.
 * Full implementation in US-007.
 */

import { BaseAgentPlugin } from '../base.js';
import type {
  AgentPluginMeta,
  AgentPluginFactory,
  AgentFileContext,
  AgentExecuteOptions,
  AgentSetupQuestion,
} from '../types.js';

/**
 * OpenCode agent plugin implementation.
 * Uses the `opencode` CLI to execute AI coding tasks.
 */
export class OpenCodeAgentPlugin extends BaseAgentPlugin {
  readonly meta: AgentPluginMeta = {
    id: 'opencode',
    name: 'OpenCode',
    description: 'OpenCode AI coding assistant CLI',
    version: '1.0.0',
    defaultCommand: 'opencode',
    supportsStreaming: true,
    supportsInterrupt: true,
    supportsFileContext: true,
  };

  private provider?: string;
  private model?: string;

  override async initialize(config: Record<string, unknown>): Promise<void> {
    await super.initialize(config);

    if (typeof config.provider === 'string') {
      this.provider = config.provider;
    }

    if (typeof config.model === 'string') {
      this.model = config.model;
    }
  }

  override getSetupQuestions(): AgentSetupQuestion[] {
    const baseQuestions = super.getSetupQuestions();
    return [
      ...baseQuestions,
      {
        id: 'provider',
        prompt: 'AI provider:',
        type: 'select',
        choices: [
          { value: 'anthropic', label: 'Anthropic', description: 'Claude models' },
          { value: 'openai', label: 'OpenAI', description: 'GPT models' },
          {
            value: 'local',
            label: 'Local',
            description: 'Local models (Ollama, etc.)',
          },
        ],
        required: false,
        help: 'Which AI provider to use (leave empty for OpenCode default)',
      },
      {
        id: 'model',
        prompt: 'Model to use:',
        type: 'text',
        default: '',
        required: false,
        help: 'Model name (leave empty for provider default)',
      },
    ];
  }

  protected buildArgs(
    prompt: string,
    files?: AgentFileContext[],
    _options?: AgentExecuteOptions
  ): string[] {
    const args: string[] = [];

    // Add provider if specified
    if (this.provider) {
      args.push('--provider', this.provider);
    }

    // Add model if specified
    if (this.model) {
      args.push('--model', this.model);
    }

    // Add file context if provided
    if (files && files.length > 0) {
      for (const file of files) {
        args.push('--file', file.path);
      }
    }

    // Run in non-interactive mode with prompt
    args.push('--non-interactive');
    args.push('--prompt', prompt);

    return args;
  }

  override async validateSetup(
    answers: Record<string, unknown>
  ): Promise<string | null> {
    // Validate provider
    const provider = answers.provider;
    if (
      provider !== undefined &&
      !['anthropic', 'openai', 'local'].includes(String(provider))
    ) {
      return 'Invalid provider. Must be one of: anthropic, openai, local';
    }

    return null;
  }
}

/**
 * Factory function for the OpenCode agent plugin.
 */
const createOpenCodeAgent: AgentPluginFactory = () => new OpenCodeAgentPlugin();

export default createOpenCodeAgent;
