/**
 * ABOUTME: Qwen CLI agent plugin for Alibaba's qwen command.
 * Integrates with Qwen CLI for AI-assisted coding.
 * Supports: non-interactive mode, JSONL streaming, model selection, yolo mode.
 */

import { spawn } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { BaseAgentPlugin, findCommandPath, quoteForWindowsShell } from '../base.js';
import { processAgentEvents, processAgentEventsToSegments, type AgentDisplayEvent } from '../output-formatting.js';
import type {
  AgentPluginMeta,
  AgentPluginFactory,
  AgentFileContext,
  AgentExecuteOptions,
  AgentSetupQuestion,
  AgentDetectResult,
  AgentExecutionHandle,
} from '../types.js';

/**
 * Extract a string error message from various error formats.
 */
export function extractErrorMessage(err: unknown): string {
  if (!err) return '';
  if (typeof err === 'string') return err;
  if (typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.error === 'string') return obj.error;
    try {
      return JSON.stringify(err);
    } catch {
      return 'Unknown error';
    }
  }
  return String(err);
}

/**
 * Parse a single Qwen event object into standardized display events.
 */
export function parseQwenEvent(event: any): AgentDisplayEvent[] {
  if (!event || typeof event !== 'object') return [];

  const events: AgentDisplayEvent[] = [];

  // Protocol Support: Check for various ways Qwen might send content
  const isAssistant = event.type === 'assistant' || event.type === 'message' || event.role === 'assistant';
  const isUser = event.type === 'user' || event.role === 'user';

  if (isAssistant && !isUser) {
    // Try multiple possible content fields - enhanced to handle different formats
    let content = event.content || event.text || event.delta?.content;

    // Handle the case where content is in event.message.content as an array of objects
    if (!content && event.message?.content) {
      if (Array.isArray(event.message.content)) {
        // Handle array of content objects like [{type: "text", text: "..."}]
        content = event.message.content
          .map((item: any) => item.text || item.content || item)
          .filter((text: any) => text && typeof text === 'string')
          .join(' ');
      } else {
        content = event.message.content;
      }
    }

    if (content && typeof content === 'string') {
      events.push({ type: 'text', content });
    }
  } else if (event.type === 'tool_call' || event.type === 'function_call') {
    const toolName = event.name || event.function?.name || 'unknown';
    const toolInput = event.arguments || event.args || event.input;
    events.push({ type: 'tool_use', name: toolName, input: toolInput });
  } else if (event.type === 'tool_result' || event.type === 'function_result') {
    const isError = event.is_error === true || event.error !== undefined;
    if (isError) {
      const errMsg = extractErrorMessage(event.error);
      events.push({ type: 'error', message: errMsg });
    }
    events.push({ type: 'tool_result' });
  } else if (event.type === 'error') {
    const errorMsg = extractErrorMessage(event.error) || extractErrorMessage(event.message) || 'Unknown error';
    events.push({ type: 'error', message: errorMsg });
  }

  return events;
}

/**
 * Legacy wrapper for single-line parsing (for tests).
 */
export function parseQwenJsonLine(jsonLine: string): AgentDisplayEvent[] {
  if (!jsonLine || jsonLine.trim().length === 0) return [];
  try {
    return parseQwenEvent(JSON.parse(jsonLine.trim()));
  } catch {
    return [];
  }
}

/**
 * Extract all JSON objects from a potentially messy string.
 */
export function extractJsonObjects(str: string): { objects: any[], remaining: string } {
  const objects: any[] = [];
  let current = str;

  while (true) {
    const start = current.indexOf('{');
    if (start === -1) break;

    // Simple bracket matching
    let depth = 0;
    let end = -1;
    let inString = false;
    let escaped = false;

    for (let i = start; i < current.length; i++) {
      const char = current[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === '{') depth++;
        if (char === '}') depth--;

        if (depth === 0) {
          end = i;
          break;
        }
      }
    }

    if (end !== -1) {
      const jsonStr = current.substring(start, end + 1);
      try {
        objects.push(JSON.parse(jsonStr));
        current = current.substring(end + 1);
      } catch {
        current = current.substring(start + 1);
      }
    } else {
      return { objects, remaining: current.substring(start) };
    }
  }
  return { objects, remaining: '' };
}

/**
 * Full parsing wrapper (for tests and internal use).
 */
export function parseQwenOutputToEvents(data: string): AgentDisplayEvent[] {
  const { objects } = extractJsonObjects(data);
  const allEvents: AgentDisplayEvent[] = [];
  for (const obj of objects) {
    allEvents.push(...parseQwenEvent(obj));
  }
  return allEvents;
}

/**
 * Qwen CLI agent plugin implementation.
 */
export class QwenCliAgentPlugin extends BaseAgentPlugin {
  readonly meta: AgentPluginMeta = {
    id: 'qwen-cli',
    name: 'Qwen CLI',
    description: 'Alibaba Qwen CLI for AI-assisted coding',
    version: '1.0.0',
    author: 'Alibaba Cloud',
    defaultCommand: 'qwen',
    supportsStreaming: true,
    supportsInterrupt: true,
    supportsFileContext: false,
    supportsSubagentTracing: true,
    structuredOutputFormat: 'jsonl',
    skillsPaths: {
      personal: '~/.qwen/skills',
      repo: '.qwen/skills',
    },
  };

  private model?: string;
  private yoloMode = true;
  protected override defaultTimeout = 0;

  override async initialize(config: Record<string, unknown>): Promise<void> {
    await super.initialize(config);
    if (typeof config.model === 'string' && config.model.length > 0) this.model = config.model;
    if (typeof config.yoloMode === 'boolean') this.yoloMode = config.yoloMode;
    if (typeof config.timeout === 'number' && config.timeout > 0) this.defaultTimeout = config.timeout;
  }

  override async detect(): Promise<AgentDetectResult> {
    const command = this.commandPath ?? this.meta.defaultCommand;
    let findResult = await findCommandPath(command);

    if (!findResult.found) {
      const versionResult = await this.runVersion(command);
      if (versionResult.success) {
        findResult = { found: true, path: command };
      } else {
        return { available: false, error: `Qwen CLI not found in PATH.` };
      }
    }

    const versionResult = await this.runVersion(findResult.path);
    if (!versionResult.success) {
      return { available: false, executablePath: findResult.path, error: versionResult.error };
    }

    this.commandPath = findResult.path;
    return { available: true, version: versionResult.version, executablePath: findResult.path };
  }

  private runVersion(command: string): Promise<{ success: boolean; version?: string; error?: string }> {
    return new Promise((resolve) => {
      const useShell = process.platform === 'win32';
      const proc = spawn(useShell ? quoteForWindowsShell(command) : command, ['--version'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: useShell,
      });

      let stdout = '';
      let stderr = '';
      let settled = false;

      const safeResolve = (result: { success: boolean; version?: string; error?: string }) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      };

      proc.stdout?.on('data', (d) => stdout += d.toString());
      proc.stderr?.on('data', (d) => stderr += d.toString());
      proc.on('error', (e) => safeResolve({ success: false, error: e.message }));
      proc.on('close', (code) => {
        if (code === 0) {
          const m = stdout.match(/(\d+\.\d+\.\d+)/);
          safeResolve(m ? { success: true, version: m[1] } : { success: false, error: 'Parse error' });
        } else {
          safeResolve({ success: false, error: stderr || `Code ${code}` });
        }
      });
      const timer = setTimeout(() => { proc.kill(); safeResolve({ success: false, error: 'Timeout' }); }, 5000);
    });
  }

  override getSetupQuestions(): AgentSetupQuestion[] {
    return [
      ...super.getSetupQuestions(),
      {
        id: 'model',
        prompt: 'Model to use:',
        type: 'select',
        choices: [
          { value: '', label: 'Default', description: 'Use configured default' },
          { value: 'coder-model', label: 'Qwen Coder', description: 'qwen3-coder-plus-2025-09-23' },
          { value: 'vision-model', label: 'Qwen Vision', description: 'qwen3-vl-plus-2025-09-23' },
        ],
        default: '',
        required: false,
        help: 'Qwen model to use',
      },
      {
        id: 'yoloMode',
        prompt: 'Enable YOLO mode?',
        type: 'boolean',
        default: true,
        required: false,
        help: 'Skip approval prompts',
      },
    ];
  }

  protected buildArgs(_p: string, _f?: AgentFileContext[], _o?: AgentExecuteOptions): string[] {
    const args: string[] = ['--output-format', 'stream-json'];
    if (this.model) args.push('-m', this.model);
    if (this.yoloMode) args.push('--yolo');
    return args;
  }

  protected override getStdinInput(prompt: string): string {
    return prompt;
  }

  override execute(prompt: string, files?: AgentFileContext[], options?: AgentExecuteOptions): AgentExecutionHandle {
    let internalBuffer = '';

    const processBuffer = () => {
      if (!internalBuffer) return;

      const { objects, remaining } = extractJsonObjects(internalBuffer);
      internalBuffer = remaining;

      if (objects.length > 0) {
        const allEvents: AgentDisplayEvent[] = [];
        for (const obj of objects) {
          options?.onJsonlMessage?.(obj);
          allEvents.push(...parseQwenEvent(obj));
        }

        if (allEvents.length > 0) {
          if (options?.onStdoutSegments) options.onStdoutSegments(processAgentEventsToSegments(allEvents));
          if (options?.onStdout) options.onStdout(processAgentEvents(allEvents));
        }
      }
    };

    const parsedOptions: AgentExecuteOptions = {
      ...options,
      onStdout: (options?.onStdout || options?.onStdoutSegments || options?.onJsonlMessage)
        ? (data: string) => {
          try { appendFileSync(join(tmpdir(), 'qwen-raw-v3.log'), `[STDOUT] ${data}\n`); } catch { }
          internalBuffer += data;
          processBuffer();
        }
        : undefined,
      onStderr: (data: string) => {
        try { appendFileSync(join(tmpdir(), 'qwen-raw-v3.log'), `[STDERR] ${data}\n`); } catch { }
        options?.onStderr?.(data);
      },
      onEnd: (result) => {
        processBuffer();
        options?.onEnd?.(result);
      },
    };

    return super.execute(prompt, files, parsedOptions);
  }

  override async validateSetup(answers: Record<string, unknown>): Promise<string | null> {
    const model = answers.model;
    if (model && typeof model === 'string' && !['coder-model', 'vision-model'].includes(model) && !model.startsWith('qwen-')) {
      return `Invalid model format. Model must be "coder-model", "vision-model", or start with "qwen-" prefix.`;
    }
    return null;
  }

  override validateModel(model: string): string | null {
    if (!model || ['coder-model', 'vision-model'].includes(model) || model.startsWith('qwen-')) return null;
    return `Invalid model "${model}". Model must start with "qwen-" prefix.`;
  }
}

const createQwenCliAgent: AgentPluginFactory = () => new QwenCliAgentPlugin();
export default createQwenCliAgent;
