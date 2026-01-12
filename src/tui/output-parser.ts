/**
 * ABOUTME: Parses agent output to extract readable content.
 * Handles JSONL format from Claude Code and other agents to extract
 * the meaningful result text while filtering out usage stats and metadata.
 */

/**
 * Known JSONL event types from agent output.
 * Claude Code emits events like 'result', 'assistant', 'tool_use', etc.
 */
type AgentEventType = 'result' | 'assistant' | 'tool_use' | 'tool_result' | 'error' | 'system' | string;

/**
 * Structure of a Claude Code result event.
 */
interface ClaudeCodeResultEvent {
  type: 'result';
  subtype?: string;
  result?: string;
  is_error?: boolean;
  duration_ms?: number;
  total_cost_usd?: number;
  [key: string]: unknown;
}

/**
 * Structure of an assistant event (partial message output).
 */
interface AssistantEvent {
  type: 'assistant';
  message?: {
    content?: Array<{ type: string; text?: string }> | string;
  };
  [key: string]: unknown;
}

/**
 * Generic JSONL event structure.
 */
interface AgentEvent {
  type: AgentEventType;
  [key: string]: unknown;
}

/**
 * Parse a JSONL line and extract any readable content.
 * Returns the extracted text or undefined if the line doesn't contain readable content.
 */
function parseJsonlLine(line: string): string | undefined {
  if (!line.trim()) return undefined;

  try {
    const event = JSON.parse(line) as AgentEvent;

    // Claude Code 'result' event - contains the final output
    if (event.type === 'result') {
      const resultEvent = event as ClaudeCodeResultEvent;
      if (resultEvent.result) {
        return resultEvent.result;
      }
    }

    // Assistant event with message content
    if (event.type === 'assistant') {
      const assistantEvent = event as AssistantEvent;
      const content = assistantEvent.message?.content;
      if (typeof content === 'string') {
        return content;
      }
      if (Array.isArray(content)) {
        // Extract text from content blocks
        const textParts = content
          .filter((c) => c.type === 'text' && c.text)
          .map((c) => c.text);
        if (textParts.length > 0) {
          return textParts.join('');
        }
      }
    }

    // Error event
    if (event.type === 'error' && typeof event.message === 'string') {
      return `Error: ${event.message}`;
    }

    return undefined;
  } catch {
    // Not valid JSON - might be plain text output
    return undefined;
  }
}

/**
 * Parse agent output and extract readable content.
 * Handles:
 * - JSONL output from Claude Code (extracts 'result' field)
 * - Plain text output (passed through as-is)
 * - Mixed content (extracts readable parts)
 *
 * @param rawOutput - The raw stdout from the agent
 * @returns Parsed readable content
 */
export function parseAgentOutput(rawOutput: string): string {
  if (!rawOutput || !rawOutput.trim()) {
    return '';
  }

  const lines = rawOutput.split('\n');
  const parsedParts: string[] = [];
  const plainTextLines: string[] = [];
  let hasJsonl = false;

  for (const line of lines) {
    // Try to parse as JSONL
    const parsed = parseJsonlLine(line);
    if (parsed !== undefined) {
      hasJsonl = true;
      parsedParts.push(parsed);
    } else if (line.trim() && !line.startsWith('{')) {
      // Non-JSON line that's not empty - might be plain text output
      plainTextLines.push(line);
    }
  }

  // If we found JSONL content, return the extracted parts
  if (hasJsonl && parsedParts.length > 0) {
    // Return the last result (usually the most complete output)
    // Filter to get only the meaningful results (not just partial outputs)
    const meaningfulParts = parsedParts.filter((p) => p.length > 50);
    if (meaningfulParts.length > 0) {
      return meaningfulParts[meaningfulParts.length - 1]!;
    }
    return parsedParts[parsedParts.length - 1]!;
  }

  // If we have plain text lines and no JSONL, return the plain text
  if (plainTextLines.length > 0) {
    return plainTextLines.join('\n');
  }

  // Fallback: return raw output truncated if it looks like unparseable JSON
  if (rawOutput.startsWith('{') && rawOutput.length > 500) {
    return '[Agent output could not be parsed - showing raw JSON]\n' +
           rawOutput.slice(0, 200) + '...\n[truncated]';
  }

  return rawOutput;
}

/**
 * Format output for display in the TUI.
 * Applies any final transformations for readability.
 */
export function formatOutputForDisplay(output: string, maxLines?: number): string {
  let formatted = output;

  // Limit lines if requested
  if (maxLines && maxLines > 0) {
    const lines = formatted.split('\n');
    if (lines.length > maxLines) {
      formatted = lines.slice(0, maxLines).join('\n') +
                 `\n... (${lines.length - maxLines} more lines)`;
    }
  }

  return formatted;
}
