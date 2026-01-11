/**
 * ABOUTME: Claude Code agent plugin for the claude CLI.
 * Integrates with Anthropic's Claude Code CLI for AI-assisted coding.
 * Full implementation in US-006.
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
 * Claude Code agent plugin implementation.
 * Uses the `claude` CLI to execute AI coding tasks.
 */
export class ClaudeAgentPlugin extends BaseAgentPlugin {
  readonly meta: AgentPluginMeta = {
    id: 'claude',
    name: 'Claude Code',
    description: 'Anthropic Claude Code CLI for AI-assisted coding',
    version: '1.0.0',
    author: 'Anthropic',
    defaultCommand: 'claude',
    supportsStreaming: true,
    supportsInterrupt: true,
    supportsFileContext: true,
  };

  private printMode: 'text' | 'json' | 'stream' = 'text';
  private model?: string;

  override async initialize(config: Record<string, unknown>): Promise<void> {
    await super.initialize(config);

    if (
      typeof config.printMode === 'string' &&
      ['text', 'json', 'stream'].includes(config.printMode)
    ) {
      this.printMode = config.printMode as 'text' | 'json' | 'stream';
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
        id: 'printMode',
        prompt: 'Output mode:',
        type: 'select',
        choices: [
          {
            value: 'text',
            label: 'Text',
            description: 'Plain text output (default)',
          },
          { value: 'json', label: 'JSON', description: 'Structured JSON output' },
          {
            value: 'stream',
            label: 'Stream',
            description: 'Streaming output for real-time feedback',
          },
        ],
        default: 'text',
        required: false,
        help: 'How Claude should output its responses',
      },
      {
        id: 'model',
        prompt: 'Model to use:',
        type: 'text',
        default: '',
        required: false,
        help: 'Claude model variant (leave empty for default)',
      },
    ];
  }

  protected buildArgs(
    prompt: string,
    files?: AgentFileContext[],
    _options?: AgentExecuteOptions
  ): string[] {
    const args: string[] = [];

    // Add print mode flag for non-interactive output
    args.push('--print');

    // Add output format based on printMode setting
    if (this.printMode === 'json') {
      args.push('--output-format', 'json');
    } else if (this.printMode === 'stream') {
      args.push('--output-format', 'stream-json');
    }

    // Add model if specified
    if (this.model) {
      args.push('--model', this.model);
    }

    // Add file context if provided
    if (files && files.length > 0) {
      // Claude uses file paths as context - pass them directly
      for (const file of files) {
        // The file path is included in the prompt context
        // Claude CLI can handle file references in prompts
        void file; // Placeholder for US-006 implementation
      }
    }

    // Add the prompt as the final argument
    args.push(prompt);

    return args;
  }

  override async validateSetup(
    answers: Record<string, unknown>
  ): Promise<string | null> {
    // Validate print mode
    const printMode = answers.printMode;
    if (
      printMode !== undefined &&
      !['text', 'json', 'stream'].includes(String(printMode))
    ) {
      return 'Invalid print mode. Must be one of: text, json, stream';
    }

    return null;
  }
}

/**
 * Factory function for the Claude Code agent plugin.
 */
const createClaudeAgent: AgentPluginFactory = () => new ClaudeAgentPlugin();

export default createClaudeAgent;
