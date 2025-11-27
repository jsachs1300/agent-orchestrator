const test = require('node:test');
const assert = require('node:assert');
const { parseOrchestratorResponse } = require('../dist/core/parser');

test('parses orchestrator responses with send_message and tool_call actions', () => {
  const result = parseOrchestratorResponse(
    JSON.stringify({
      actions: [
        {
          type: 'send_message',
          target: { type: 'user', thread: 'user' },
          content: 'Hello!'
        },
        {
          type: 'tool_call',
          target: {
            type: 'tool',
            thread: 'tools',
            tool: 'fetch-data',
            call_id: '1234'
          },
          params: { prompt: 'ping' }
        }
      ],
      control: { done: true, note: 'All set' }
    })
  );

  assert.equal(result.actions.length, 2);
  const [sendMessage, toolCall] = result.actions;

  assert.deepStrictEqual(sendMessage, {
    type: 'send_message',
    target: { type: 'user', thread: 'user' },
    content: 'Hello!'
  });

  assert.deepStrictEqual(toolCall, {
    type: 'tool_call',
    target: {
      type: 'tool',
      thread: 'tools',
      tool: 'fetch-data',
      call_id: '1234'
    },
    params: { prompt: 'ping' }
  });

  assert.deepStrictEqual(result.control, { done: true, note: 'All set' });
});

test('throws a helpful error when JSON cannot be parsed', () => {
  assert.throws(
    () => parseOrchestratorResponse('not-json'),
    /Failed to parse LLM JSON/
  );
});

test('ignores malformed actions instead of crashing', () => {
  const result = parseOrchestratorResponse(
    JSON.stringify({
      actions: [
        { type: 'send_message', content: 'Missing target' },
        { type: 'tool_call', target: { type: 'tool', tool: 42 } }
      ]
    })
  );

  assert.deepStrictEqual(result.actions, []);
  assert.strictEqual(result.control, undefined);
});
