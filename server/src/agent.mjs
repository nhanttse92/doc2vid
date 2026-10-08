import { query } from '@anthropic-ai/claude-agent-sdk';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export async function runAgent({ role, scene, cwd, prompt, model, resume, timeoutMs, signal, onEvent, config }) {
  const abortController = new AbortController();
  const onAbort = () => abortController.abort(signal.reason);
  signal?.addEventListener('abort', onAbort, { once: true });
  if (signal?.aborted) onAbort();
  const timer = setTimeout(() => abortController.abort(new Error('Agent timed out')), timeoutMs);
  const env = { ...config.env };
  delete env.ORIGIN_KEY;
  delete env.OPENROUTER_API_KEY;
  delete env.OPENROUTER_ENV_FILE;
  delete env.DOC2VID_ORIGIN_KEY;
  const options = {
    cwd, model, resume, permissionMode: 'bypassPermissions', allowDangerouslySkipPermissions: true,
    allowedTools: ['Read', 'Write', 'Edit', 'MultiEdit', 'Glob', 'Grep', 'Bash', 'TodoWrite'],
    disallowedTools: ['WebFetch', 'WebSearch', 'Task', 'Agent'], settingSources: ['project'],
    includePartialMessages: true, pathToClaudeCodeExecutable: config.claudePath, env, abortController,
    ...(config.agentSandbox ? { sandbox: { enabled: true, failIfUnavailable: true, autoAllowBashIfSandboxed: true, allowUnsandboxedCommands: false, filesystem: { allowWrite: [cwd] }, network: { allowedDomains: [], strictAllowlist: true } } } : {}),
  };
  let sessionId = resume, text = '', isError = false, error = '', usage, cost;
  let msg = 0;
  let currentMsg;
  let toolBlocks = new Map();
  let sawResult = false;
  try {
    const stream = query({ prompt, options });
    try {
      for await (const item of stream) {
        if (signal?.aborted || abortController.signal.aborted) break;
        sessionId = item.session_id || sessionId;
        if (item.type === 'stream_event') {
          const event = item.event;
          if (event.type === 'message_start') { currentMsg = `${sessionId || 'agent'}-${++msg}`; toolBlocks = new Map(); }
          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            text += event.delta.text;
            currentMsg ||= `${sessionId || 'agent'}-${++msg}`;
            if (role !== 'scene') onEvent({ type: 'say', msg: currentMsg, role, delta: event.delta.text });
          }
          if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') toolBlocks.set(event.index, { name: event.content_block.name, input: event.content_block.input || {}, json: '' });
          if (event.type === 'content_block_delta' && event.delta?.type === 'input_json_delta' && toolBlocks.has(event.index)) toolBlocks.get(event.index).json += event.delta.partial_json;
          if (event.type === 'content_block_stop' && toolBlocks.has(event.index)) {
            const block = toolBlocks.get(event.index);
            toolBlocks.delete(event.index);
            let input = block.input;
            try { if (block.json) input = JSON.parse(block.json); } catch { /* Show the tool name if partial JSON is invalid. */ }
            const detail = block.name === 'Bash' ? `Bash: ${input.command || ''}` : `${block.name} ${input.file_path || input.path || ''}`;
            onEvent({ type: 'activity', role, ...(scene ? { scene } : {}), text: `${scene ? `${scene} · ` : ''}${detail}`.replace(/\s+/g, ' ').slice(0, 120) });
          }
          if (event.type === 'message_stop' && role !== 'scene' && currentMsg) onEvent({ type: '_say_end', msg: currentMsg });
        }
        if (item.type === 'result') {
          sawResult = true;
          isError = item.is_error || item.subtype !== 'success';
          error = item.errors?.join('\n') || (isError ? item.result || 'Claude agent failed' : '');
          text ||= item.result || '';
          usage = item.usage;
          cost = item.total_cost_usd;
        }
      }
    } finally { stream.close(); }
    if (abortController.signal.aborted) return { sessionId, text, isError: true, error: signal?.aborted ? 'Cancelled' : 'Agent timed out', usage, cost };
    if (!sawResult) return { sessionId, text, isError: true, error: 'Claude CLI exited without a result', usage, cost };
    return { sessionId, text, isError, error, usage, cost };
  } catch (caught) {
    return { sessionId, text, isError: true, error: caught.message, usage, cost };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export async function fakeAgent({ role, scene, cwd, resume, onEvent }) {
  const sessionId = resume || `fake-${role}-${scene || 'director'}`;
  if (role === 'storyboard') {
    const fixture = new URL('../test/fixtures/storyboard.json', import.meta.url);
    await writeFile(path.join(cwd, 'storyboard.json'), await readFile(fixture));
    onEvent({ type: 'say', msg: `${sessionId}-1`, role, delta: 'Planning ' });
    onEvent({ type: 'say', msg: `${sessionId}-1`, role, delta: 'complete.' });
  }
  if (role === 'revise' && process.env.DOC2VID_FAKE_REVISE_ANSWER_ONLY !== '1') {
    const file = path.join(cwd, 'storyboard.json');
    const storyboard = JSON.parse(await readFile(file, 'utf8'));
    storyboard.scenes[0].beats[0].narration += ' Revised.';
    await writeFile(file, JSON.stringify(storyboard));
  }
  if (role === 'scene') {
    await mkdir(path.join(cwd, 'web', 'scenes'), { recursive: true });
    return { sessionId, text: '', isError: true, error: `No scene generated for ${scene}` };
  }
  return { sessionId, text: '', isError: false };
}
