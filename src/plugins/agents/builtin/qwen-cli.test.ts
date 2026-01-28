/**
 * ABOUTME: Tests for the Qwen CLI agent plugin.
 * Tests configuration, argument building, and JSONL parsing for Alibaba's Qwen CLI.
 */

import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import {
    QwenCliAgentPlugin,
    extractErrorMessage,
    parseQwenJsonLine,
    parseQwenOutputToEvents,
} from './qwen-cli.js';

describe('QwenCliAgentPlugin', () => {
    let plugin: QwenCliAgentPlugin;

    beforeEach(() => {
        plugin = new QwenCliAgentPlugin();
    });

    afterEach(async () => {
        await plugin.dispose();
    });

    describe('meta', () => {
        test('has correct plugin ID', () => {
            expect(plugin.meta.id).toBe('qwen-cli');
        });

        test('has correct name', () => {
            expect(plugin.meta.name).toBe('Qwen CLI');
        });

        test('has correct default command', () => {
            expect(plugin.meta.defaultCommand).toBe('qwen');
        });

        test('supports streaming', () => {
            expect(plugin.meta.supportsStreaming).toBe(true);
        });

        test('supports interrupt', () => {
            expect(plugin.meta.supportsInterrupt).toBe(true);
        });

        test('supports subagent tracing', () => {
            expect(plugin.meta.supportsSubagentTracing).toBe(true);
        });

        test('has JSONL structured output format', () => {
            expect(plugin.meta.structuredOutputFormat).toBe('jsonl');
        });

        test('has skills paths configured', () => {
            expect(plugin.meta.skillsPaths?.personal).toBe('~/.qwen/skills');
            expect(plugin.meta.skillsPaths?.repo).toBe('.qwen/skills');
        });
    });

    describe('initialize', () => {
        test('initializes with default config', async () => {
            await plugin.initialize({});
            expect(await plugin.isReady()).toBe(true);
        });

        test('accepts model configuration', async () => {
            await plugin.initialize({ model: 'coder-model' });
            expect(await plugin.isReady()).toBe(true);
        });

        test('accepts yoloMode configuration', async () => {
            await plugin.initialize({ yoloMode: false });
            expect(await plugin.isReady()).toBe(true);
        });

        test('accepts timeout configuration', async () => {
            await plugin.initialize({ timeout: 300000 });
            expect(await plugin.isReady()).toBe(true);
        });
    });

    describe('getSetupQuestions', () => {
        test('includes model question with choices', () => {
            const questions = plugin.getSetupQuestions();
            const modelQuestion = questions.find((q) => q.id === 'model');
            expect(modelQuestion).toBeDefined();
            expect(modelQuestion?.type).toBe('select');
            expect(modelQuestion?.choices?.length).toBeGreaterThan(0);
        });

        test('includes qwen model choices', () => {
            const questions = plugin.getSetupQuestions();
            const modelQuestion = questions.find((q) => q.id === 'model');
            const choices = modelQuestion?.choices ?? [];
            const values = choices.map((c) => c.value);
            expect(values).toContain('coder-model');
            expect(values).toContain('vision-model');
        });

        test('includes yoloMode question', () => {
            const questions = plugin.getSetupQuestions();
            const yoloQuestion = questions.find((q) => q.id === 'yoloMode');
            expect(yoloQuestion).toBeDefined();
            expect(yoloQuestion?.type).toBe('boolean');
            expect(yoloQuestion?.default).toBe(true);
        });

        test('includes base questions (command, timeout)', () => {
            const questions = plugin.getSetupQuestions();
            expect(questions.find((q) => q.id === 'command')).toBeDefined();
            expect(questions.find((q) => q.id === 'timeout')).toBeDefined();
        });
    });

    describe('validateSetup', () => {
        test('accepts valid qwen model', async () => {
            const result = await plugin.validateSetup({ model: 'coder-model' });
            expect(result).toBeNull();
        });

        test('accepts empty model', async () => {
            const result = await plugin.validateSetup({ model: '' });
            expect(result).toBeNull();
        });

        test('rejects invalid model format', async () => {
            const result = await plugin.validateSetup({ model: 'gpt-4o' });
            expect(result).not.toBeNull();
            expect(result).toContain('qwen-');
        });
    });

    describe('validateModel', () => {
        test('accepts valid qwen model', () => {
            expect(plugin.validateModel('coder-model')).toBeNull();
            expect(plugin.validateModel('vision-model')).toBeNull();
            expect(plugin.validateModel('qwen-plus')).toBeNull();
        });

        test('accepts empty model', () => {
            expect(plugin.validateModel('')).toBeNull();
        });

        test('rejects non-qwen model', () => {
            const result = plugin.validateModel('gpt-4o');
            expect(result).not.toBeNull();
            expect(result).toContain('qwen-');
        });
    });
});

describe('QwenCliAgentPlugin buildArgs', () => {
    let plugin: QwenCliAgentPlugin;

    // Create a test subclass to access protected method
    class TestableQwenPlugin extends QwenCliAgentPlugin {
        testBuildArgs(prompt: string): string[] {
            return (this as unknown as { buildArgs: (p: string) => string[] }).buildArgs(prompt);
        }

        testGetStdinInput(prompt: string): string | undefined {
            return (this as unknown as { getStdinInput: (p: string) => string | undefined }).getStdinInput(prompt);
        }
    }

    beforeEach(() => {
        plugin = new TestableQwenPlugin();
    });

    afterEach(async () => {
        await plugin.dispose();
    });

    test('includes --output-format stream-json', async () => {
        await plugin.initialize({});
        const args = (plugin as TestableQwenPlugin).testBuildArgs('test prompt');
        expect(args).toContain('--output-format');
        expect(args).toContain('stream-json');
    });

    test('includes --yolo by default', async () => {
        await plugin.initialize({});
        const args = (plugin as TestableQwenPlugin).testBuildArgs('test prompt');
        expect(args).toContain('--yolo');
    });

    test('omits --yolo when disabled', async () => {
        await plugin.initialize({ yoloMode: false });
        const args = (plugin as TestableQwenPlugin).testBuildArgs('test prompt');
        expect(args).not.toContain('--yolo');
    });

    test('includes model flag when specified', async () => {
        await plugin.initialize({ model: 'coder-model' });
        const args = (plugin as TestableQwenPlugin).testBuildArgs('test prompt');
        expect(args).toContain('-m');
        expect(args).toContain('coder-model');
    });

    test('omits model flag when not specified', async () => {
        await plugin.initialize({});
        const args = (plugin as TestableQwenPlugin).testBuildArgs('test prompt');
        expect(args).not.toContain('-m');
    });

    test('returns prompt via stdin', async () => {
        await plugin.initialize({});
        const stdinInput = (plugin as TestableQwenPlugin).testGetStdinInput('my test prompt');
        expect(stdinInput).toBe('my test prompt');
    });
});

describe('extractErrorMessage', () => {
    test('returns empty string for falsy input', () => {
        expect(extractErrorMessage(null)).toBe('');
        expect(extractErrorMessage(undefined)).toBe('');
        expect(extractErrorMessage('')).toBe('');
    });

    test('returns string directly', () => {
        expect(extractErrorMessage('error message')).toBe('error message');
    });

    test('extracts message property from object', () => {
        expect(extractErrorMessage({ message: 'error from message' })).toBe('error from message');
    });

    test('extracts error property from object', () => {
        expect(extractErrorMessage({ error: 'error from error' })).toBe('error from error');
    });

    test('prefers message over error property', () => {
        expect(extractErrorMessage({ message: 'from message', error: 'from error' })).toBe('from message');
    });

    test('stringifies object without message/error', () => {
        const result = extractErrorMessage({ foo: 'bar' });
        expect(result).toBe('{"foo":"bar"}');
    });

    test('converts non-object to string', () => {
        expect(extractErrorMessage(123)).toBe('123');
        expect(extractErrorMessage(true)).toBe('true');
    });
});

describe('parseQwenJsonLine', () => {
    test('returns empty array for empty input', () => {
        expect(parseQwenJsonLine('')).toEqual([]);
        expect(parseQwenJsonLine('   ')).toEqual([]);
    });

    test('returns empty array for invalid JSON', () => {
        expect(parseQwenJsonLine('not json')).toEqual([]);
        expect(parseQwenJsonLine('{ invalid')).toEqual([]);
    });

    test('parses assistant message', () => {
        const input = JSON.stringify({
            type: 'message',
            role: 'assistant',
            content: 'Hello from Qwen',
        });
        const events = parseQwenJsonLine(input);
        expect(events.length).toBe(1);
        expect(events[0]?.type).toBe('text');
        expect((events[0] as { content: string }).content).toBe('Hello from Qwen');
    });

    test('skips user messages', () => {
        const input = JSON.stringify({
            type: 'message',
            role: 'user',
            content: 'User input',
        });
        expect(parseQwenJsonLine(input)).toEqual([]);
    });

    test('parses tool_call event', () => {
        const input = JSON.stringify({
            type: 'tool_call',
            name: 'Bash',
            arguments: { command: 'ls' },
        });
        const events = parseQwenJsonLine(input);
        expect(events.length).toBe(1);
        expect(events[0]?.type).toBe('tool_use');
        expect((events[0] as { name: string }).name).toBe('Bash');
    });

    test('parses function_call event', () => {
        const input = JSON.stringify({
            type: 'function_call',
            function: { name: 'Read' },
            args: { path: '/test' },
        });
        const events = parseQwenJsonLine(input);
        expect(events.length).toBe(1);
        expect(events[0]?.type).toBe('tool_use');
        expect((events[0] as { name: string }).name).toBe('Read');
    });

    test('parses tool_result event with error', () => {
        const input = JSON.stringify({
            type: 'tool_result',
            is_error: true,
            error: 'File not found',
        });
        const events = parseQwenJsonLine(input);
        expect(events.some(e => e.type === 'error')).toBe(true);
        expect(events.some(e => e.type === 'tool_result')).toBe(true);
    });

    test('parses function_result event with error', () => {
        const input = JSON.stringify({
            type: 'function_result',
            error: { message: 'Permission denied' },
        });
        const events = parseQwenJsonLine(input);
        expect(events.length).toBe(2);
        expect(events[0]?.type).toBe('error');
        expect(events[1]?.type).toBe('tool_result');
    });

    test('parses tool_result without error', () => {
        const input = JSON.stringify({
            type: 'tool_result',
            is_error: false,
        });
        const events = parseQwenJsonLine(input);
        expect(events.length).toBe(1);
        expect(events[0]?.type).toBe('tool_result');
    });

    test('parses error event', () => {
        const input = JSON.stringify({
            type: 'error',
            error: 'API error occurred',
        });
        const events = parseQwenJsonLine(input);
        expect(events.length).toBe(1);
        expect(events[0]?.type).toBe('error');
        expect((events[0] as { message: string }).message).toBe('API error occurred');
    });

    test('parses error event with message object', () => {
        const input = JSON.stringify({
            type: 'error',
            message: 'Error from message field',
        });
        const events = parseQwenJsonLine(input);
        expect(events.length).toBe(1);
        expect(events[0]?.type).toBe('error');
        expect((events[0] as { message: string }).message).toBe('Error from message field');
    });

    test('skips init events', () => {
        const input = JSON.stringify({ type: 'init', session_id: 'abc' });
        expect(parseQwenJsonLine(input)).toEqual([]);
    });

    test('skips result/stats events', () => {
        const input = JSON.stringify({ type: 'result', stats: { tokens: 100 } });
        expect(parseQwenJsonLine(input)).toEqual([]);
    });
});

describe('parseQwenOutputToEvents', () => {
    test('parses multiple JSONL lines', () => {
        const lines = [
            JSON.stringify({ type: 'message', role: 'assistant', content: 'Line 1' }),
            JSON.stringify({ type: 'message', role: 'assistant', content: 'Line 2' }),
        ].join('\n');
        const events = parseQwenOutputToEvents(lines);
        expect(events.length).toBe(2);
        expect((events[0] as { content: string }).content).toBe('Line 1');
        expect((events[1] as { content: string }).content).toBe('Line 2');
    });

    test('handles empty lines', () => {
        const lines = '\n\n' + JSON.stringify({ type: 'message', role: 'assistant', content: 'Hello' }) + '\n\n';
        const events = parseQwenOutputToEvents(lines);
        expect(events.length).toBe(1);
    });

    test('handles mixed valid and invalid lines', () => {
        const lines = [
            'YOLO mode enabled',
            JSON.stringify({ type: 'message', role: 'assistant', content: 'Valid' }),
            'some warning',
        ].join('\n');
        const events = parseQwenOutputToEvents(lines);
        expect(events.length).toBe(1);
        expect((events[0] as { content: string }).content).toBe('Valid');
    });
});

describe('parseQwenJsonLine edge cases', () => {
    test('handles tool_call with input field', () => {
        const input = JSON.stringify({
            type: 'tool_call',
            name: 'Write',
            input: { path: '/test', content: 'data' },
        });
        const events = parseQwenJsonLine(input);
        expect(events.length).toBe(1);
        expect(events[0]?.type).toBe('tool_use');
        expect((events[0] as { input: unknown }).input).toEqual({ path: '/test', content: 'data' });
    });

    test('handles tool_call with args field', () => {
        const input = JSON.stringify({
            type: 'tool_call',
            name: 'Read',
            args: { file: '/path' },
        });
        const events = parseQwenJsonLine(input);
        expect(events.length).toBe(1);
        expect((events[0] as { input: unknown }).input).toEqual({ file: '/path' });
    });

    test('handles message without content', () => {
        const input = JSON.stringify({
            type: 'message',
            role: 'assistant',
        });
        const events = parseQwenJsonLine(input);
        expect(events).toEqual([]);
    });

    test('handles tool_result with error object', () => {
        const input = JSON.stringify({
            type: 'tool_result',
            error: { message: 'Tool failed' },
        });
        const events = parseQwenJsonLine(input);
        expect(events.length).toBe(2);
        expect(events[0]?.type).toBe('error');
        expect((events[0] as { message: string }).message).toBe('Tool failed');
    });

    test('handles error event without error or message field', () => {
        const input = JSON.stringify({
            type: 'error',
        });
        const events = parseQwenJsonLine(input);
        expect(events.length).toBe(1);
        expect((events[0] as { message: string }).message).toBe('Unknown error');
    });

    test('handles function_call with function.name', () => {
        const input = JSON.stringify({
            type: 'function_call',
            function: { name: 'Glob' },
        });
        const events = parseQwenJsonLine(input);
        expect(events.length).toBe(1);
        expect((events[0] as { name: string }).name).toBe('Glob');
    });

    test('handles tool_call without name', () => {
        const input = JSON.stringify({
            type: 'tool_call',
            arguments: { foo: 'bar' },
        });
        const events = parseQwenJsonLine(input);
        expect(events.length).toBe(1);
        expect((events[0] as { name: string }).name).toBe('unknown');
    });

    test('handles function_result with is_error true', () => {
        const input = JSON.stringify({
            type: 'function_result',
            is_error: true,
            error: 'Failed',
        });
        const events = parseQwenJsonLine(input);
        expect(events.some(e => e.type === 'error')).toBe(true);
        expect(events.some(e => e.type === 'tool_result')).toBe(true);
    });
});

describe('extractErrorMessage edge cases', () => {
    test('handles circular reference gracefully', () => {
        // Create an object that would fail JSON.stringify
        const obj: Record<string, unknown> = { foo: 'bar' };
        obj.circular = obj; // Create circular reference

        const result = extractErrorMessage(obj);
        // Should fall back to 'Unknown error' when stringify fails
        expect(result).toBe('Unknown error');
    });
});
