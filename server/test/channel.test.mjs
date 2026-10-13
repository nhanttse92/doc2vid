import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { runChannelAgent } from '../src/channel-runner.mjs';

const channelScript = fileURLToPath(new URL('../src/channel.mjs', import.meta.url));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Plays the part of the interactive Claude Code session: it receives channel notifications and
// answers each task by calling the channel's say and finish tools.
async function startChannel(t, answer, extraEnv = {}) {
  const port = 20000 + Math.floor(Math.random() * 20000);
  const client = new Client({ name: 'fake-session', version: '1' });
  const delivered = [];
  client.fallbackNotificationHandler = async notification => {
    if (notification.method !== 'notifications/claude/channel') return;
    delivered.push(notification.params);
    void answer(client, notification.params);
  };
  const transport = new StdioClientTransport({ command: process.execPath, args: [channelScript], env: { ...process.env, ORIGIN_KEY: 'channel-key', CHANNEL_PORT: String(port), ...extraEnv }, stderr: 'ignore' });
  await client.connect(transport);
  t.after(() => client.close());
  const url = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 50; i++) {
    if (await fetch(`${url}/health`).then(r => r.ok, () => false)) break;
    await sleep(50);
  }
  return { url, client, delivered, config: { channelUrl: url, originKey: 'channel-key' } };
}

test('channel delivers tasks one at a time and relays say and finish', async t => {
  const order = [];
  const ch = await startChannel(t, async (client, params) => {
    const taskId = params.meta.task_id;
    order.push(`start ${params.meta.role}`);
    await client.callTool({ name: 'say', arguments: { task_id: taskId, text: `working on ${params.meta.role}` } });
    await sleep(100);
    order.push(`end ${params.meta.role}`);
    await client.callTool({ name: 'finish', arguments: { task_id: taskId, ok: true, text: `${params.meta.role} done` } });
  });
  const events = [];
  const run = role => runChannelAgent({ role, scene: role === 'scene' ? 's01' : undefined, cwd: '/tmp/job', prompt: `do ${role}`, timeoutMs: 10_000, config: ch.config, onEvent: event => events.push(event) });
  const [storyboard, scene] = await Promise.all([run('storyboard'), run('scene')]);
  assert.equal(storyboard.isError, false);
  assert.equal(storyboard.text, 'storyboard done');
  assert.equal(scene.isError, false);
  // The second task starts only after the first one finishes.
  assert.deepEqual(order, ['start storyboard', 'end storyboard', 'start scene', 'end scene']);
  assert.equal(ch.delivered[0].content, 'do storyboard');
  assert.equal(ch.delivered[0].meta.cwd, '/tmp/job');
  const said = events.filter(e => e.type === 'say').map(e => e.delta);
  assert.deepEqual(said, ['working on storyboard', 'storyboard done']);
  assert.ok(events.some(e => e.type === 'activity' && e.text === 's01 · working on scene'));
});

test('channel reports a failed task and rejects a wrong key', async t => {
  const ch = await startChannel(t, async (client, params) => {
    await client.callTool({ name: 'finish', arguments: { task_id: params.meta.task_id, ok: false, text: 'nancheck failed' } });
  });
  const result = await runChannelAgent({ role: 'scene', scene: 's02', cwd: '/tmp/job', prompt: 'x', timeoutMs: 10_000, config: ch.config, onEvent: () => {} });
  assert.equal(result.isError, true);
  assert.equal(result.error, 'nancheck failed');
  const refused = await runChannelAgent({ role: 'scene', cwd: '/tmp/job', prompt: 'x', timeoutMs: 10_000, config: { ...ch.config, originKey: 'wrong' }, onEvent: () => {} });
  assert.equal(refused.isError, true);
  assert.match(refused.error, /HTTP 401/);
});

test('a cancelled queued task is never delivered', async t => {
  let release;
  const ch = await startChannel(t, async (client, params) => {
    await new Promise(resolve => { release = resolve; });
    await client.callTool({ name: 'finish', arguments: { task_id: params.meta.task_id, ok: true, text: 'done' } });
  });
  const first = runChannelAgent({ role: 'storyboard', cwd: '/tmp/job', prompt: 'first', timeoutMs: 10_000, config: ch.config, onEvent: () => {} });
  const controller = new AbortController();
  const second = runChannelAgent({ role: 'scene', scene: 's01', cwd: '/tmp/job', prompt: 'second', timeoutMs: 10_000, signal: controller.signal, config: ch.config, onEvent: () => {} });
  await sleep(200);
  controller.abort(new Error('cancel'));
  assert.equal((await second).error, 'Cancelled');
  await sleep(100);
  release();
  assert.equal((await first).isError, false);
  await sleep(200);
  assert.deepEqual(ch.delivered.map(d => d.content), ['first']);
});

test('channel unavailable is reported, not thrown', async () => {
  const result = await runChannelAgent({ role: 'storyboard', cwd: '/tmp/job', prompt: 'x', timeoutMs: 2_000, config: { channelUrl: 'http://127.0.0.1:1', originKey: 'k' }, onEvent: () => {} });
  assert.equal(result.isError, true);
  assert.match(result.error, /channel is unavailable/);
});

test('step forwards the task key and token to the job service', async t => {
  const received = [];
  const stub = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    received.push({ path: req.url, key: req.headers['x-doc2vid-key'], token: req.headers['x-doc2vid-step'], body: JSON.parse(body) });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, text: 'Narration recorded.' }));
  });
  await new Promise(resolve => stub.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => stub.close(resolve)));
  let stepResult;
  const ch = await startChannel(t, async (client, params) => {
    stepResult = await client.callTool({ name: 'step', arguments: { task_id: params.meta.task_id, name: 'narrate' } });
    await client.callTool({ name: 'finish', arguments: { task_id: params.meta.task_id, ok: true, text: 'Done.' } });
  }, { SERVICE_URL: `http://127.0.0.1:${stub.address().port}` });
  const result = await runChannelAgent({ role: 'video', cwd: '/tmp/job', prompt: 'Make a video', jobId: 'j_123', stepToken: 'private-token', timeoutMs: 10_000, config: ch.config, onEvent: () => {} });
  assert.equal(result.isError, false);
  assert.deepEqual(received, [{ path: '/jobs/j_123/steps', key: 'channel-key', token: 'private-token', body: { name: 'narrate' } }]);
  assert.equal(stepResult.isError, false);
  assert.equal(stepResult.content[0].text, 'Narration recorded.');
  assert.equal(ch.delivered[0].meta.role, 'video');
});

test('cancelling the current task notifies the session and blocks its steps', async t => {
  let deliver;
  const started = new Promise(resolve => { deliver = resolve; });
  let cancelled;
  const notice = new Promise(resolve => { cancelled = resolve; });
  const ch = await startChannel(t, async (client, params) => {
    if (params.meta.role === 'cancel') {
      const result = await client.callTool({ name: 'step', arguments: { task_id: params.meta.task_id, name: 'music' } });
      cancelled({ params, result });
      await client.callTool({ name: 'finish', arguments: { task_id: params.meta.task_id, ok: false, text: 'Stopped.' } });
    } else deliver(params);
  });
  const controller = new AbortController();
  const running = runChannelAgent({ role: 'video', cwd: '/tmp/job', prompt: 'Make a video', jobId: 'j_123', stepToken: 'private-token', timeoutMs: 10_000, signal: controller.signal, config: ch.config, onEvent: () => {} });
  await started;
  controller.abort();
  assert.equal((await running).error, 'Cancelled');
  const { params, result } = await notice;
  assert.equal(params.meta.role, 'cancel');
  assert.match(params.content, /stopped by the job service/);
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /This task was stopped by the job service/);
});

test('a quiet task stream gets keepalive lines that the runner ignores', async t => {
  const ch = await startChannel(t, async (client, params) => {
    await sleep(300);
    await client.callTool({ name: 'finish', arguments: { task_id: params.meta.task_id, ok: true, text: 'done' } });
  }, { CHANNEL_PING_MS: '50' });
  const response = await fetch(`${ch.url}/tasks`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-doc2vid-key': 'channel-key' }, body: JSON.stringify({ task_id: 'quiet-raw', role: 'video', cwd: '/tmp/job', prompt: 'wait' }) });
  const lines = (await response.text()).trim().split('\n').map(line => JSON.parse(line));
  assert.ok(lines.filter(line => line.type === 'ping').length >= 2);
  assert.equal(lines.at(-1).type, 'finish');
  const events = [];
  const result = await runChannelAgent({ role: 'video', cwd: '/tmp/job', prompt: 'wait', timeoutMs: 10_000, config: ch.config, onEvent: event => events.push(event) });
  assert.equal(result.isError, false);
  assert.deepEqual(events.filter(event => event.type === 'say').map(event => event.delta), ['done']);
  assert.ok(events.every(event => ['say', '_say_end'].includes(event.type)));
});
