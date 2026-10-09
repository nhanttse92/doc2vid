import { randomBytes } from 'node:crypto';

// Runs one agent task through the doc2vid channel (src/channel.mjs) instead of the Agent SDK. The
// channel feeds tasks to a single long-lived interactive Claude Code session, so there is no
// per-task session to resume: follow-up prompts land in the same conversation anyway.
export async function runChannelAgent({ role, scene, cwd, prompt, timeoutMs, signal, onEvent, config }) {
  const taskId = `t_${Date.now().toString(36)}_${randomBytes(3).toString('hex')}`;
  const controller = new AbortController();
  const onAbort = () => controller.abort(signal.reason);
  signal?.addEventListener('abort', onAbort, { once: true });
  if (signal?.aborted) onAbort();
  const timer = setTimeout(() => controller.abort(new Error('Agent timed out')), timeoutMs);
  const headers = { 'content-type': 'application/json', 'x-doc2vid-key': config.originKey };
  let said = 0;
  try {
    const response = await fetch(`${config.channelUrl}/tasks`, {
      method: 'POST', headers, signal: controller.signal,
      body: JSON.stringify({ task_id: taskId, role, scene, cwd, prompt }),
    });
    if (!response.ok) return { sessionId: 'channel', text: '', isError: true, error: `The channel refused the task (HTTP ${response.status}).` };
    const decoder = new TextDecoder();
    let buffer = '';
    for await (const chunk of response.body) {
      buffer += decoder.decode(chunk, { stream: true });
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (!line.trim()) continue;
        const event = JSON.parse(line);
        if (event.type === 'say' && role !== 'scene') {
          const msg = `${taskId}-${++said}`;
          onEvent({ type: 'say', msg, role, delta: event.text });
          onEvent({ type: '_say_end', msg });
        } else if (event.type === 'say') {
          onEvent({ type: 'activity', role, scene, text: `${scene} · ${event.text}`.replace(/\s+/g, ' ').slice(0, 120) });
        } else if (event.type === 'queued' && event.position > 1) {
          onEvent({ type: 'activity', role, ...(scene ? { scene } : {}), text: `${scene ? `${scene} · ` : ''}Waiting for the agent session (position ${event.position})` });
        } else if (event.type === 'finish') {
          if (role !== 'scene' && event.text) {
            const msg = `${taskId}-${++said}`;
            onEvent({ type: 'say', msg, role, delta: event.text });
            onEvent({ type: '_say_end', msg });
          }
          return { sessionId: 'channel', text: event.text, isError: !event.ok, error: event.ok ? '' : event.text || 'The agent could not finish the task.' };
        }
      }
    }
    return { sessionId: 'channel', text: '', isError: true, error: 'The channel closed before the task finished.' };
  } catch (error) {
    if (controller.signal.aborted) {
      // Tell the channel the result is no longer wanted, so a queued task is not started.
      await fetch(`${config.channelUrl}/tasks/${taskId}/cancel`, { method: 'POST', headers }).catch(() => {});
      return { sessionId: 'channel', text: '', isError: true, error: signal?.aborted ? 'Cancelled' : 'Agent timed out' };
    }
    return { sessionId: 'channel', text: '', isError: true, error: `The agent channel is unavailable: ${error.message}` };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
