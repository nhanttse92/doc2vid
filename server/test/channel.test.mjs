import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { runChannelAgent } from '../src/channel-runner.mjs';

const channelScript = fileURLToPath(new URL('../src/channel.mjs', import.meta.url));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Plays the part of the interactive Claude Code session: it receives channel notifications and
// answers each task by calling the channel's say and finish tools.
async function startChannel(t, answer) {
  const port = 20000 + Math.floor(Math.random() * 20000);
  const client = new Client({ name: 'fake-session', version: '1' });
  const delivered = [];
  client.fallbackNotificationHandler = async notification => {
    if (notification.method !== 'notifications/claude/channel') return;
    delivered.push(notification.params);
    void answer(client, notification.params);
  };
  const transport = new StdioClientTransport({ command: process.execPath, args: [channelScript], env: { ...process.env, ORIGIN_KEY: 'channel-key', CHANNEL_PORT: String(port) }, stderr: 'ignore' });
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
