import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createServer } from '../src/server.mjs';
import { fakeAgent } from '../src/agent.mjs';
import { loadConfig } from '../src/config.mjs';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function setup(t, options = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'doc2vid-test-'));
  const template = path.join(root, 'template');
  await mkdir(path.join(template, 'prompts'), { recursive: true });
  await mkdir(path.join(template, 'node_modules'));
  for (const name of ['storyboard', 'repair-storyboard', 'scene', 'repair-scene', 'revise']) await writeFile(path.join(template, 'prompts', `${name}.md`), `${name} {{scene_id}} {{user_message}} {{errors}}`);
  const calls = [], agentCalls = [];
  let blockResolve;
  const block = new Promise(resolve => { blockResolve = resolve; });
  let failNancheck = options.failNancheck || false;
  const commandRunner = async ({ cmd, args, cwd, signal, onLine, env }) => {
    const name = path.basename(args[0] || cmd);
    calls.push({ name, args, env });
    onLine?.(`${name} progress`);
    if (options.blockAt === name) {
      await Promise.race([block, new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }))]);
    }
    if (name === 'validate-storyboard.mjs') {
      await readFile(path.join(cwd, 'storyboard.json'));
    } else if (name === 'narrate.py') {
      await mkdir(path.join(cwd, 'build'), { recursive: true });
      await writeFile(path.join(cwd, 'build/narration.json'), '{}');
    } else if (name === 'timing.py') {
      await mkdir(path.join(cwd, 'build'), { recursive: true });
      await writeFile(path.join(cwd, 'build/timing.json'), JSON.stringify({ total: 123.4, scenes: [{ id: 's01', duration: 61 }, { id: 's02', duration: 62.4 }] }));
    } else if (name === 'music.py' && options.failMusic) {
      throw new Error('music failed\nlast output line');
    } else if (name === 'nancheck.mjs' && failNancheck) {
      const scene = args[1];
      const exists = await readFile(path.join(cwd, 'web/scenes', `${scene}.js`), 'utf8').catch(() => '');
      if (!exists) throw new Error('nancheck failed\nlast output line');
    } else if (name === 'fallback-scene.mjs') {
      await mkdir(path.join(cwd, 'web/scenes'), { recursive: true });
      await writeFile(path.join(cwd, 'web/scenes', `${args[1]}.js`), 'fallback');
    } else if (name === 'render.mjs') {
      await mkdir(path.join(cwd, 'build/video'), { recursive: true });
      await writeFile(path.join(cwd, 'build/video', `${args[1]}.mp4`), 'SCENE');
    } else if (name === 'assemble.py') {
      await mkdir(path.join(cwd, 'out'), { recursive: true });
      await writeFile(path.join(cwd, 'out/video.mp4'), Buffer.from('0123456789'));
      await writeFile(path.join(cwd, 'out/video.srt'), '1\n00:00:00,000 --> 00:00:01,000\nHello\n');
    }
    return { lines: [`${name} progress`] };
  };
  const agentRunner = async args => {
    agentCalls.push({ role: args.role, scene: args.scene, resume: args.resume });
    if (args.role === 'revise' && options.answerOnly) return { sessionId: args.resume || 'revise-1', isError: false, text: 'No change.' };
    if (args.role === 'revise' && options.reviseEdit) {
      const file = path.join(args.cwd, 'storyboard.json');
      const board = JSON.parse(await readFile(file, 'utf8'));
      board.scenes[0].beats[0].narration += ' Updated.';
      await writeFile(file, JSON.stringify(board));
      return { sessionId: args.resume || 'revise-1', isError: false, text: 'Updated.' };
    }
    const result = await fakeAgent(args);
    if (args.role === 'storyboard' && options.leakSecret) {
      args.onEvent({ type: 'say', msg: 'leak', role: 'storyboard', delta: 'test-' });
      args.onEvent({ type: 'say', msg: 'leak', role: 'storyboard', delta: 'key' });
      args.onEvent({ type: '_say_end', msg: 'leak' });
    }
    return result;
  };
  const config = { env: { PATH: process.env.PATH, DOC2VID_OFFLINE: '1', ORIGIN_KEY: 'test-key', OPENROUTER_API_KEY: 'must-not-leak' }, host: '127.0.0.1', port: 0, home: path.join(root, 'data'), template, originKey: 'test-key', openrouterFile: path.join(root, 'absent'), claudePath: '/bin/false', storyboardModel: 'fake', sceneModel: 'fake', sceneConcurrency: 2, renderJobs: 1, maxUploadBytes: options.maxBytes || 1024, agentSandbox: false, fakeAgent: true };
  const app = await createServer(config, { commandRunner, agentRunner });
  await app.listen();
  const base = `http://127.0.0.1:${app.server.address().port}`;
  t.after(async () => { blockResolve(); await app.close(); await rm(root, { recursive: true, force: true }); });
  const request = async (uri, init = {}) => fetch(base + uri, { ...init, headers: { 'x-doc2vid-key': 'test-key', ...init.headers } });
  const upload = async (name = 'guide.txt', content = 'Training guide', fields = {}) => {
    const form = new FormData();
    form.set('file', new Blob([content]), name);
    for (const [key, value] of Object.entries(fields)) form.set(key, value);
    return request('/jobs', { method: 'POST', body: form });
  };
  const waitStatus = async (id, target, timeout = 4000) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const body = await (await request(`/jobs/${id}`)).json();
      if (body.job.status === target) return body.job;
      await sleep(20);
    }
    throw new Error(`Timed out waiting for ${target}`);
  };
  return { root, template, calls, agentCalls, app, config, base, request, upload, waitStatus, unblock: blockResolve };
}

async function createId(env, ...args) {
  const response = await env.upload(...args);
  const body = await response.json();
  assert.equal(response.status, 201, JSON.stringify(body));
  return body.job.id;
}

async function log(env, id) {
  const text = await readFile(path.join(env.config.home, 'jobs', id, 'events.ndjson'), 'utf8');
  return text.trim().split('\n').map(JSON.parse);
}

test('API validation and public health', async t => {
  await assert.rejects(loadConfig({ ORIGIN_KEY: '' }), /ORIGIN_KEY is required/);
  const e = await setup(t, { maxBytes: 64 });
  assert.equal((await fetch(e.base + '/health')).status, 200);
  assert.equal((await fetch(e.base + '/jobs')).status, 401);
  assert.equal((await e.request('/jobs', { headers: { 'x-doc2vid-key': 'wrong' } })).status, 401);
  assert.equal((await e.upload('bad.exe')).status, 400);
  assert.equal((await e.upload('bad.pdf', 'not PDF')).status, 400);
  assert.equal((await e.upload('guide.txt', 'x'.repeat(100))).status, 413);
  assert.equal((await e.upload('guide.txt', 'text', { minutes: '3' })).status, 400);
});

test('job lifecycle, ordered stages, events, files and ranges', async t => {
  const e = await setup(t);
  const id = await createId(e);
  const detail = await e.waitStatus(id, 'done');
  assert.deepEqual(detail.scenes.map(s => s.state), ['done', 'done']);
  assert.deepEqual(detail.files.map(f => f.name).sort(), ['original', 'storyboard.json', 'video.mp4', 'video.srt', 'video.vtt']);
  const events = await log(e, id);
  assert.deepEqual(events.map(item => item.seq), events.map((_, index) => index + 1));
  assert.ok(events.some(item => item.type === 'done'));
  const starts = events.filter(item => item.type === 'stage' && item.state === 'start').map(item => item.stage);
  assert.deepEqual(starts.slice(0, 4), ['extract', 'storyboard', 'narrate', 'timing']);
  assert.ok(starts.includes('scenes') && starts.includes('music') && starts.at(-1) === 'assemble');
  assert.equal((await e.request(`/jobs/${id}/files/video.mp4`, { headers: { range: 'bytes=2-5' } })).status, 206);
  const partial = await e.request(`/jobs/${id}/files/video.mp4`, { headers: { range: 'bytes=2-5' } });
  assert.equal(await partial.text(), '2345');
  assert.equal(partial.headers.get('content-range'), 'bytes 2-5/10');
  assert.equal((await e.request(`/jobs/${id}/files/video.mp4`, { headers: { range: 'bytes=99-' } })).status, 416);
  assert.equal((await e.request(`/jobs/${id}/files/%2e%2e%2fjob.json`)).status, 404);
  assert.equal((await e.request(`/jobs/${id}/files/secret`)).status, 404);
  assert.match(await (await e.request(`/jobs/${id}/files/video.vtt`)).text(), /^WEBVTT\n/);
  const original = await e.request(`/jobs/${id}/files/original`);
  assert.equal(original.headers.get('content-type'), 'text/plain; charset=utf-8');
  assert.match(original.headers.get('content-disposition'), /filename\*=UTF-8''guide.txt/);
  assert.ok(e.calls.some(call => call.name === 'render.mjs' && call.env.JOBS === '1'));
  assert.ok(e.calls.every(call => call.name === 'narrate.py' || call.name === 'music.py' || !call.env.OPENROUTER_API_KEY));
});

test('scene repairs and fallback, music failure remains nonfatal', async t => {
  const e = await setup(t, { failNancheck: true, failMusic: true });
  const id = await createId(e);
  await e.waitStatus(id, 'done');
  const names = e.calls.map(call => call.name);
  assert.equal(names.filter(name => name === 'fallback-scene.mjs').length, 2);
  assert.equal(e.agentCalls.filter(call => call.role === 'scene').length, 6);
  assert.ok(e.agentCalls.filter(call => call.role === 'scene' && call.resume).length >= 4);
  const events = await log(e, id);
  assert.ok(events.some(item => item.type === 'error' && item.stage === 'music'));
  assert.ok(events.some(item => item.type === 'error' && item.stage === 'scenes'));
});

test('secret redaction works across streamed assistant deltas', async t => {
  const e = await setup(t, { leakSecret: true });
  const id = await createId(e);
  await e.waitStatus(id, 'done');
  const text = await readFile(path.join(e.config.home, 'jobs', id, 'events.ndjson'), 'utf8');
  assert.ok(!text.includes('test-key'));
  const deltas = (await log(e, id)).filter(event => event.type === 'say' && event.msg === 'leak').map(event => event.delta).join('');
  assert.equal(deltas, '[redacted]');
});

test('SSE replay and live delivery', async t => {
  const e = await setup(t, { blockAt: 'narrate.py' });
  const id = await createId(e);
  await e.waitStatus(id, 'running');
  const controller = new AbortController();
  t.after(() => controller.abort());
  const response = await e.request(`/jobs/${id}/events`, { headers: { 'Last-Event-ID': '1' }, signal: controller.signal });
  const response2 = await e.request(`/jobs/${id}/events?after=1`, { signal: controller.signal });
  assert.equal(response.status, 200);
  const reader = response.body.getReader();
  const reader2 = response2.body.getReader();
  let text = '';
  while (!text.includes('"type":"stage"')) text += new TextDecoder().decode((await reader.read()).value);
  assert.ok(!text.includes('id: 1\n'));
  e.unblock();
  const end = Date.now() + 4000;
  while (!text.includes('"type":"done"') && Date.now() < end) {
    const result = await reader.read();
    if (result.done) break;
    text += new TextDecoder().decode(result.value);
  }
  assert.ok(text.includes('"type":"done"'));
  let text2 = '';
  while (!text2.includes('"type":"done"') && Date.now() < end) {
    const result = await reader2.read();
    if (result.done) break;
    text2 += new TextDecoder().decode(result.value);
  }
  assert.ok(text2.includes('"type":"done"'));
  controller.abort();
});

test('queued cancellation updates positions and never starts the cancelled job', async t => {
  const e = await setup(t, { blockAt: 'narrate.py' });
  const first = await createId(e);
  while (!(await e.request(`/jobs/${first}`).then(r => r.json())).job.stages.some(s => s.name === 'narrate' && s.state === 'running')) await sleep(10);
  const second = await createId(e);
  const third = await createId(e);
  assert.equal((await e.request(`/jobs/${second}`).then(r => r.json())).job.queuePosition, 1);
  assert.equal((await e.request(`/jobs/${third}`).then(r => r.json())).job.queuePosition, 2);
  await e.request(`/jobs/${second}/cancel`, { method: 'POST' });
  assert.equal((await e.request(`/jobs/${second}`).then(r => r.json())).job.status, 'cancelled');
  assert.equal((await e.request(`/jobs/${third}`).then(r => r.json())).job.queuePosition, 1);
  e.unblock();
  await e.waitStatus(third, 'done');
  assert.ok(!(await log(e, second)).some(item => item.status === 'running'));
});

test('cancel and restart recovery', async t => {
  const e = await setup(t, { blockAt: 'narrate.py' });
  const id = await createId(e);
  await e.waitStatus(id, 'running');
  while (!(await e.request(`/jobs/${id}`).then(r => r.json())).job.stages.some(s => s.name === 'narrate' && s.state === 'running')) await sleep(10);
  await e.request(`/jobs/${id}/cancel`, { method: 'POST' });
  await e.waitStatus(id, 'cancelled');
  const id2 = await createId(e);
  while (!(await e.request(`/jobs/${id2}`).then(r => r.json())).job.stages.some(s => s.name === 'narrate' && s.state === 'running')) await sleep(10);
  await e.app.close();
  e.unblock();
  const resumed = await createServer(e.config, { commandRunner: async args => {
    if (path.basename(args.args[0]) === 'narrate.py') {
      await mkdir(path.join(args.cwd, 'build'), { recursive: true });
      await writeFile(path.join(args.cwd, 'build/narration.json'), '{}');
      return { lines: [] };
    }
    return e.app.service.commandRunner(args);
  }, agentRunner: fakeAgent });
  await resumed.listen();
  t.after(() => resumed.close());
  const deadline = Date.now() + 4000;
  while (resumed.service.get(id2).status !== 'done' && Date.now() < deadline) await sleep(20);
  assert.equal(resumed.service.get(id2).status, 'done');
});

test('follow-up busy, answer only, and edited rerender', async t => {
  const e = await setup(t, { reviseEdit: true, blockAt: 'narrate.py' });
  const id = await createId(e);
  await e.waitStatus(id, 'running');
  assert.equal((await e.request(`/jobs/${id}/messages`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'Change it' }) })).status, 409);
  e.unblock();
  await e.waitStatus(id, 'done');
  const renders = e.calls.filter(call => call.name === 'render.mjs').length;
  assert.equal((await e.request(`/jobs/${id}/messages`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'Change it' }) })).status, 202);
  await e.waitStatus(id, 'done');
  assert.ok(e.calls.filter(call => call.name === 'render.mjs').length > renders);
});

test('answer-only follow-up does not rerun scripts', async t => {
  const e = await setup(t, { answerOnly: true });
  const id = await createId(e);
  await e.waitStatus(id, 'done');
  const count = e.calls.length;
  await e.request(`/jobs/${id}/messages`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'Question?' }) });
  const deadline = Date.now() + 4000;
  while (e.app.service.get(id).status !== 'done' && Date.now() < deadline) await sleep(20);
  assert.equal(e.app.service.get(id).status, 'done');
  assert.equal(e.calls.length, count);
  const detail = await e.app.service.detail(e.app.service.get(id));
  assert.equal(detail.stages.find(stage => stage.name === 'assemble').state, 'done');
});

test('restart repairs a partial event append and continues sequence numbers', async t => {
  const e = await setup(t, { answerOnly: true });
  const id = await createId(e);
  await e.waitStatus(id, 'done');
  const before = await log(e, id);
  await e.app.close();
  const logFile = path.join(e.config.home, 'jobs', id, 'events.ndjson');
  await writeFile(logFile, `${await readFile(logFile, 'utf8')}{"seq":`);
  const jobFile = path.join(e.config.home, 'jobs', id, 'job.json');
  const stale = JSON.parse(await readFile(jobFile, 'utf8'));
  stale.lastSeq = 1;
  await writeFile(jobFile, JSON.stringify(stale));
  const resumed = await createServer(e.config, { commandRunner: e.app.service.commandRunner, agentRunner: async args => args.role === 'revise' ? { sessionId: args.resume, isError: false, text: 'Answer only.' } : fakeAgent(args) });
  await resumed.listen();
  t.after(() => resumed.close());
  assert.equal(resumed.service.get(id).lastSeq, before.at(-1).seq);
  await resumed.service.message(resumed.service.get(id), 'Question?');
  const deadline = Date.now() + 4000;
  while (resumed.service.get(id).status !== 'done' && Date.now() < deadline) await sleep(20);
  const after = await log(e, id);
  assert.deepEqual(after.map(event => event.seq), after.map((_, index) => index + 1));
});

test('optional real-template offline integration', { skip: process.env.DOC2VID_INTEGRATION !== '1' }, async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'doc2vid-integration-'));
  const template = fileURLToPath(new URL('../../template/', import.meta.url));
  const config = {
    env: { ...process.env, DOC2VID_OFFLINE: '1', ORIGIN_KEY: 'integration-key' },
    host: '127.0.0.1', port: 0, home: path.join(root, 'data'), template,
    originKey: 'integration-key', openrouterFile: path.join(root, 'absent'),
    claudePath: '/bin/false', storyboardModel: 'fake', sceneModel: 'fake',
    sceneConcurrency: 2, renderJobs: 2, maxUploadBytes: 50 * 1024 * 1024,
    agentSandbox: false, fakeAgent: true,
  };
  const app = await createServer(config);
  await app.listen();
  t.after(async () => { await app.close(); await rm(root, { recursive: true, force: true }); });
  const form = new FormData();
  form.set('file', new Blob(['Train a worker to check every carton before packing.']), 'guide.txt');
  form.set('minutes', '2');
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const response = await fetch(`${base}/jobs`, { method: 'POST', headers: { 'x-doc2vid-key': 'integration-key' }, body: form });
  assert.equal(response.status, 201);
  const id = (await response.json()).job.id;
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline && !['done', 'failed'].includes(app.service.get(id).status)) await sleep(250);
  assert.equal(app.service.get(id).status, 'done', JSON.stringify(await app.service.detail(app.service.get(id))));
  assert.ok((await app.service.output(app.service.get(id), 'video.mp4')).size > 0);
});
