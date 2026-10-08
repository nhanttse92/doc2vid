import { createHash, randomBytes } from 'node:crypto';
import { cp, mkdir, readFile, readdir, realpath, rename, rm, stat, symlink, writeFile, appendFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { runCommand } from './commands.mjs';
import { runAgent, fakeAgent } from './agent.mjs';
import { readDotenv } from './config.mjs';

const stages = ['extract', 'storyboard', 'narrate', 'timing', 'scenes', 'music', 'assemble', 'revise'];
const allowedExt = new Set(['.pdf', '.doc', '.docx', '.rtf', '.odt', '.txt', '.md']);
const outputPaths = { 'video.mp4': 'out/video.mp4', 'video.srt': 'out/video.srt', 'storyboard.json': 'storyboard.json' };
const iso = () => new Date().toISOString();
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const safeName = name => path.basename(String(name).replace(/[\r\n\x00-\x1f\x7f]/g, '_')).slice(0, 255) || 'document';
const throwIfAborted = signal => { if (signal?.aborted) throw signal.reason || new Error('Cancelled'); };

export function validateUpload(name, data) {
  const ext = path.extname(name).toLowerCase();
  if (!allowedExt.has(ext)) throw Object.assign(new Error('Use a PDF, Word, RTF, ODT, TXT or MD file.'), { code: 'bad_file' });
  const magic = ext === '.pdf' ? data.subarray(0, 4).toString() === '%PDF'
    : ['.docx', '.odt'].includes(ext) ? data.subarray(0, 2).toString() === 'PK'
    : ext === '.doc' ? data.subarray(0, 4).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0]))
    : ext === '.rtf' ? data.subarray(0, 5).toString() === '{\\rtf' : true;
  if (!magic) throw Object.assign(new Error('The file content does not match its extension.'), { code: 'bad_file' });
  return ext;
}

function summary(job) {
  return {
    id: job.id, title: job.title, status: job.status, stage: job.stage,
    minutes: job.minutes, created: job.created, updated: job.updated,
    queuePosition: job.queuePosition ?? null, inputName: job.input.name,
    hasVideo: job.hasVideo || false, durationSeconds: job.durationSeconds ?? null,
  };
}

async function fileInfo(job, name) {
  const relative = name === 'original' ? `source/original${job.input.ext}` : outputPaths[name];
  if (!relative) return null;
  try {
    const file = path.join(job.dir, relative);
    const resolved = await realpath(file);
    if (!resolved.startsWith(`${await realpath(job.dir)}${path.sep}`)) return null;
    const info = await stat(resolved);
    return info.isFile() ? { name, size: info.size, path: resolved } : null;
  }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

export class JobService {
  constructor(config, { commandRunner = runCommand, agentRunner } = {}) {
    this.config = config;
    this.commandRunner = commandRunner;
    this.agentRunner = agentRunner || (config.fakeAgent ? fakeAgent : runAgent);
    this.jobs = new Map();
    this.waiting = [];
    this.running = null;
    this.controller = null;
    this.pumping = false;
    this.pumpDone = Promise.resolve();
    this.positionChain = Promise.resolve();
    this.closed = false;
    this.listeners = new Map();
    this.openrouterKey = null;
    this.lastLogByStage = new Map();
  }

  async init() {
    await mkdir(path.join(this.config.home, 'jobs'), { recursive: true });
    this.openrouterKey = (await readDotenv(this.config.openrouterFile)).OPENROUTER_API_KEY;
    for (const entry of await readdir(path.join(this.config.home, 'jobs'), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const id = entry.name;
      const dir = path.join(this.config.home, 'jobs', id);
      try {
        const job = JSON.parse(await readFile(path.join(dir, 'job.json'), 'utf8'));
        if (job.id !== id) continue;
        const logFile = path.join(dir, 'events.ndjson');
        const log = await readFile(logFile, 'utf8').catch(error => error.code === 'ENOENT' ? '' : Promise.reject(error));
        const valid = [];
        for (const line of log.split('\n')) {
          if (!line) continue;
          try { valid.push(JSON.parse(line)); } catch { break; }
        }
        if (valid.length !== log.split('\n').filter(Boolean).length) await writeFile(logFile, valid.map(event => JSON.stringify(event)).join('\n') + (valid.length ? '\n' : ''));
        job.lastSeq = valid.at(-1)?.seq || 0;
        job.dir = dir;
        job.writeChain = Promise.resolve();
        job.eventChain = Promise.resolve();
        this.jobs.set(id, job);
        if (['queued', 'running'].includes(job.status)) { job.status = 'queued'; this.waiting.push(id); }
      } catch (error) {
        if (error.code !== 'ENOENT') throw new Error(`Cannot load job ${id}: ${error.message}`);
      }
    }
    this.waiting.sort((a, b) => this.jobs.get(a).created.localeCompare(this.jobs.get(b).created) || (this.jobs.get(a).createdOrder || 0) - (this.jobs.get(b).createdOrder || 0));
    await this.positions();
    this.kick();
  }

  dir(job) { return job.dir; }
  async persist(job) {
    job.updated = iso();
    const { dir, writeChain, eventChain, ...disk } = job;
    const json = JSON.stringify(disk, null, 2);
    job.writeChain = job.writeChain.then(async () => {
      const temp = path.join(dir, `job.json.${randomBytes(6).toString('hex')}.tmp`);
      await writeFile(temp, json);
      await rename(temp, path.join(dir, 'job.json'));
    });
    return job.writeChain;
  }

  emit(job, event) {
    const safe = { ...event };
    for (const key of ['text', 'delta', 'message', 'detail', 'file']) if (typeof safe[key] === 'string') safe[key] = this.redact(safe[key]);
    const item = { seq: ++job.lastSeq, ts: iso(), ...safe };
    job.eventChain = job.eventChain.then(async () => {
      await appendFile(path.join(job.dir, 'events.ndjson'), `${JSON.stringify(item)}\n`);
      for (const listener of this.listeners.get(job.id) || []) listener(item);
    });
    return job.eventChain;
  }

  positions() {
    this.positionChain = this.positionChain.then(() => this.updatePositions());
    return this.positionChain;
  }

  async updatePositions() {
    for (let i = 0; i < this.waiting.length; i++) {
      const job = this.jobs.get(this.waiting[i]);
      if (!job || job.status !== 'queued') continue;
      if (job.queuePosition !== i + 1) {
        job.queuePosition = i + 1;
        await this.persist(job);
        if (job.status === 'queued' && this.waiting[i] === job.id) await this.emit(job, { type: 'status', status: 'queued', queuePosition: i + 1 });
      }
    }
  }

  kick() {
    if (this.pumping || this.closed) return;
    this.pumping = true;
    this.pumpDone = new Promise(resolve => queueMicrotask(resolve)).then(() => this.pump()).catch(error => { this.pumping = false; process.stderr.write(`Job queue error: ${this.redact(error.message)}\n`); });
  }

  async pump() {
    while (!this.closed && this.waiting.length) {
      const id = this.waiting.shift();
      const job = this.jobs.get(id);
      if (!job || job.status !== 'queued') continue;
      this.running = id;
      this.controller = new AbortController();
      job.status = 'running'; job.queuePosition = null;
      await this.persist(job);
      await this.emit(job, { type: 'status', status: 'running', queuePosition: null });
      await this.positions();
      try {
        await this.execute(job, this.controller.signal);
        throwIfAborted(this.controller.signal);
        if (job.status !== 'running') {
          await this.persist(job);
          await this.emit(job, { type: 'status', status: job.status, queuePosition: null });
          continue;
        }
        job.status = 'done'; job.stage = null; job.hasVideo = Boolean(await fileInfo(job, 'video.mp4'));
        await this.persist(job);
        await this.emit(job, { type: 'status', status: 'done', queuePosition: null });
        if (job.hasVideo) await this.emit(job, { type: 'done', durationSeconds: job.durationSeconds ?? null });
      } catch (error) {
        job.status = this.closed ? 'queued' : this.controller.signal.aborted || job.status === 'cancelled' ? 'cancelled' : 'failed';
        if (this.closed) {
          await this.persist(job);
          continue;
        }
        if (job.status === 'failed') {
          await this.emit(job, { type: 'error', stage: job.stage, message: this.redact(error.message) });
        }
        await this.persist(job);
        await this.emit(job, { type: 'status', status: job.status, queuePosition: null });
      } finally {
        for (const key of this.lastLogByStage.keys()) if (key.startsWith(`${id}:`)) this.lastLogByStage.delete(key);
        this.running = null; this.controller = null;
      }
    }
    this.pumping = false;
  }

  redact(value) {
    let text = String(value || 'Unknown failure');
    for (const secret of [this.config.originKey, this.openrouterKey, this.config.env.ANTHROPIC_API_KEY].filter(Boolean)) text = text.replaceAll(secret, '[redacted]');
    return text;
  }

  async create({ fileName, data, prompt = '', minutes = 5, title }) {
    const name = safeName(fileName);
    const ext = validateUpload(name, data);
    if (data.length > this.config.maxUploadBytes) throw Object.assign(new Error('File exceeds the upload limit.'), { code: 'too_large' });
    if (![2, 5, 10, 20].includes(Number(minutes)) || !/^\d+$/.test(String(minutes))) throw Object.assign(new Error('Minutes must be 2, 5, 10 or 20.'), { code: 'bad_minutes' });
    if (typeof prompt !== 'string' || prompt.length > 4000 || typeof title !== 'undefined' && (typeof title !== 'string' || title.length > 120)) throw Object.assign(new Error('Prompt or title is too long.'), { code: 'bad_request' });
    let id, dir;
    do {
      id = `j_${new Date().toISOString().slice(0, 10).replaceAll('-', '')}_${BigInt(`0x${randomBytes(5).toString('hex')}`).toString(36).slice(0, 6).padStart(6, '0')}`;
      dir = path.join(this.config.home, 'jobs', id);
    } while (this.jobs.has(id));
    await mkdir(dir, { recursive: true });
    try {
      await cp(this.config.template, dir, { recursive: true, filter: source => source === this.config.template || !['node_modules', 'build', 'out', 'tests'].includes(path.basename(source)) });
      await symlink(path.join(this.config.template, 'node_modules'), path.join(dir, 'node_modules'), 'dir');
      await mkdir(path.join(dir, 'source'), { recursive: true });
      await writeFile(path.join(dir, `source/original${ext}`), data);
      const job = { id, title: title || name.slice(0, -ext.length), prompt, minutes: Number(minutes), created: iso(), createdOrder: Date.now() * 1000 + this.jobs.size % 1000, updated: iso(), input: { name, ext }, status: 'queued', stage: 'extract', queuePosition: null, hasVideo: false, durationSeconds: null, lastSeq: 0, stages: stages.map(name => ({ name, state: 'pending', started: null, finished: null })), scenes: [], runKind: 'initial', dir, writeChain: Promise.resolve(), eventChain: Promise.resolve() };
      await this.emit(job, { type: 'user', text: prompt, file: name });
      await this.persist(job);
      this.jobs.set(id, job);
      this.waiting.push(id);
      await this.positions();
      this.kick();
      return summary(job);
    } catch (error) {
      this.jobs.delete(id);
      this.waiting = this.waiting.filter(waitingId => waitingId !== id);
      await rm(dir, { recursive: true, force: true });
      throw error;
    }
  }

  list() { return [...this.jobs.values()].sort((a, b) => b.created.localeCompare(a.created) || (b.createdOrder || 0) - (a.createdOrder || 0)).slice(0, 50).map(summary); }
  get(id) { return this.jobs.get(id); }
  async detail(job) {
    const files = [];
    for (const name of ['video.mp4', 'video.srt', 'storyboard.json', 'original']) {
      const info = await fileInfo(job, name);
      if (info) files.push({ name, size: info.size });
    }
    if (files.some(f => f.name === 'video.srt')) files.push({ name: 'video.vtt', size: (await this.vtt(job)).length });
    return { ...summary(job), prompt: job.prompt, stages: job.stages, scenes: job.scenes, files, lastSeq: job.lastSeq };
  }

  async vtt(job) {
    const source = await fileInfo(job, 'video.srt');
    if (!source) throw Object.assign(new Error('SRT file not found'), { code: 'ENOENT' });
    const srt = await readFile(source.path, 'utf8');
    return Buffer.from(`WEBVTT\n\n${srt.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')}`);
  }
  async output(job, name) {
    if (name === 'video.vtt') {
      try { const data = await this.vtt(job); return { name, size: data.length, data }; }
      catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    }
    return fileInfo(job, name);
  }

  async cancel(job) {
    if (job.status === 'queued') {
      this.waiting = this.waiting.filter(id => id !== job.id);
      job.status = 'cancelled'; job.queuePosition = null;
      await this.persist(job);
      await this.emit(job, { type: 'status', status: 'cancelled', queuePosition: null });
      await this.positions();
    } else if (job.status === 'running' && this.running === job.id) {
      job.status = 'cancelled';
      this.controller.abort(new Error('Cancelled'));
      await this.persist(job);
    }
  }

  async message(job, text) {
    if (['queued', 'running'].includes(job.status)) return false;
    job.previousStatus = job.status;
    job.status = 'queued'; job.runKind = 'revision'; job.stage = 'revise'; job.revisionMessage = text;
    const item = job.stages.find(s => s.name === 'revise');
    item.state = 'pending'; item.started = null; item.finished = null;
    await this.emit(job, { type: 'user', text });
    await this.persist(job);
    this.waiting.push(job.id);
    await this.positions();
    this.kick();
    return true;
  }

  async stage(job, name, fn, signal) {
    throwIfAborted(signal);
    job.stage = name;
    const item = job.stages.find(s => s.name === name);
    item.state = 'running'; item.started = iso(); item.finished = null;
    await this.persist(job);
    await this.emit(job, { type: 'stage', stage: name, state: 'start' });
    try {
      const result = await fn();
      throwIfAborted(signal);
      item.state = 'done'; item.finished = iso();
      await this.persist(job);
      await this.emit(job, { type: 'stage', stage: name, state: 'done' });
      return result;
    } catch (error) {
      if (!signal.aborted) {
        item.state = 'failed'; item.finished = iso();
        await this.persist(job);
        await this.emit(job, { type: 'stage', stage: name, state: 'failed', detail: this.redact(error.message) });
      }
      throw error;
    }
  }

  async cmd(job, stage, cmd, args, signal, { openrouter = false, jobs } = {}) {
    throwIfAborted(signal);
    const env = { ...this.config.env };
    delete env.ORIGIN_KEY;
    delete env.OPENROUTER_API_KEY;
    delete env.OPENROUTER_ENV_FILE;
    if (openrouter && !this.openrouterKey && env.DOC2VID_OFFLINE !== '1') throw new Error(`OPENROUTER_API_KEY is missing from ${this.config.openrouterFile}`);
    if (openrouter && this.openrouterKey) env.OPENROUTER_API_KEY = this.openrouterKey;
    if (jobs) env.JOBS = String(jobs);
    const logKey = `${job.id}:${stage}`;
    const onLine = line => {
      const now = Date.now();
      if (now - (this.lastLogByStage.get(logKey) || 0) >= 500) {
        this.lastLogByStage.set(logKey, now);
        void this.emit(job, { type: 'log', stage, text: this.redact(line) }).catch(() => {});
      }
    };
    try {
      const result = await this.commandRunner({ cmd, args, cwd: job.dir, env, signal, timeoutMs: 1_200_000, onLine });
      throwIfAborted(signal);
      return result;
    } catch (error) {
      throw new Error(this.redact(error.message));
    }
  }

  async prompt(job, file, vars) {
    let content;
    try { content = await readFile(path.join(job.dir, 'prompts', file), 'utf8'); }
    catch (error) { if (error.code === 'ENOENT') throw new Error(`Missing prompt file: prompts/${file}`); throw error; }
    return content.replace(/\{\{([a-z_]+)\}\}/g, (match, key) => key in vars ? String(vars[key]) : match);
  }

  async agent(job, role, prompt, signal, { scene, resume } = {}) {
    throwIfAborted(signal);
    const secrets = [this.config.originKey, this.openrouterKey, this.config.env.ANTHROPIC_API_KEY].filter(Boolean);
    const hold = Math.max(0, ...secrets.map(secret => secret.length - 1));
    const pendingSay = new Map();
    const flushSay = msg => {
      const delta = pendingSay.get(msg);
      pendingSay.delete(msg);
      if (delta) void this.emit(job, { type: 'say', msg, role, delta }).catch(() => {});
    };
    const onEvent = event => {
      if (event.type === '_say_end') return flushSay(event.msg);
      if (event.type === 'say' && hold) {
        const buffered = this.redact((pendingSay.get(event.msg) || '') + event.delta);
        const split = Math.max(0, buffered.length - hold);
        if (split) void this.emit(job, { ...event, delta: buffered.slice(0, split) }).catch(() => {});
        pendingSay.set(event.msg, buffered.slice(split));
        return;
      }
      void this.emit(job, event).catch(() => {});
    };
    let result;
    try {
      result = await this.agentRunner({ role, scene, cwd: job.dir, prompt, model: role === 'scene' ? this.config.sceneModel : this.config.storyboardModel, resume, timeoutMs: role === 'scene' ? 2_400_000 : 1_800_000, signal, config: this.config, onEvent });
    } finally {
      for (const msg of pendingSay.keys()) flushSay(msg);
    }
    throwIfAborted(signal);
    if (result.cost != null || result.usage) {
      job.agentUsage ||= [];
      job.agentUsage.push({ role, scene, cost: result.cost, usage: result.usage });
      await this.persist(job);
    }
    return result;
  }

  async extract(job, signal) {
    const input = path.join(job.dir, `source/original${job.input.ext}`);
    const text = path.join(job.dir, 'source/text.txt');
    const ext = job.input.ext;
    if (ext === '.pdf') {
      const pages = path.join(job.dir, 'source/pages');
      await rm(pages, { recursive: true, force: true });
      await mkdir(pages, { recursive: true });
      const pdfText = await this.binary('pdftotext');
      const pdfPpm = await this.binary('pdftoppm');
      await this.cmd(job, 'extract', pdfText, ['-layout', '-f', '1', '-l', '60', input, text], signal);
      await this.cmd(job, 'extract', pdfPpm, ['-f', '1', '-l', '60', '-r', '80', '-png', input, path.join(pages, 'page')], signal);
      const found = (await readdir(pages)).filter(name => name.endsWith('.png')).sort();
      for (let i = 0; i < found.length; i++) await rename(path.join(pages, found[i]), path.join(pages, `page-${String(i + 1).padStart(3, '0')}.png`));
      job.hasPages = found.length > 0;
    } else if (['.txt', '.md'].includes(ext)) {
      await copyFile(input, text);
    } else {
      await this.cmd(job, 'extract', 'textutil', ['-convert', 'txt', '-output', text, input], signal);
    }
    const content = await readFile(text, 'utf8').catch(error => error.code === 'ENOENT' ? '' : Promise.reject(error));
    if (!content.trim() && !job.hasPages) throw new Error('No text or page images could be extracted from this document.');
    await this.persist(job);
  }

  async binary(name) {
    const search = [...(process.env.PATH || '').split(path.delimiter), '/opt/homebrew/bin'];
    for (const dir of search) {
      try { await stat(path.join(dir, name)); return path.join(dir, name); } catch { /* Keep searching. */ }
    }
    throw new Error(`${name} is required; install poppler with brew install poppler.`);
  }

  async validateStoryboard(job, signal, role = 'storyboard', sessionId) {
    for (let attempt = 0; attempt <= 2; attempt++) {
      try {
        await this.cmd(job, role, 'node', ['tools/validate-storyboard.mjs'], signal);
        return sessionId;
      } catch (error) {
        if (attempt === 2) throw error;
        const prompt = await this.prompt(job, 'repair-storyboard.md', { errors: error.message });
        const repair = await this.agent(job, role, prompt, signal, { resume: sessionId });
        sessionId = repair.sessionId || sessionId;
        if (repair.isError) throw new Error(repair.error || 'Storyboard repair agent failed');
      }
    }
  }

  async storyboard(job, signal) {
    const seconds = job.minutes * 60;
    const prompt = await this.prompt(job, 'storyboard.md', {
      title: job.title, minutes: job.minutes, target_seconds: seconds,
      word_budget: Math.round(seconds * 163 / 60 * 0.92),
      scene_count: Math.max(2, Math.min(10, Math.round(job.minutes / 2.2))),
      user_prompt: `${job.prompt}${job.recoveryMessage ? `\n${job.recoveryMessage}` : ''}`,
      has_pages: job.hasPages ? 'yes' : 'no', input_name: job.input.name,
    });
    const result = await this.agent(job, 'storyboard', prompt, signal);
    job.directorSession = result.sessionId;
    await this.persist(job);
    if (result.isError) throw new Error(result.error || 'Storyboard agent failed');
    job.directorSession = await this.validateStoryboard(job, signal, 'storyboard', job.directorSession);
    await this.loadScenes(job);
  }

  async loadScenes(job) {
    const storyboard = JSON.parse(await readFile(path.join(job.dir, 'storyboard.json'), 'utf8'));
    if (!Array.isArray(storyboard.scenes)) throw new Error('storyboard.json has no scenes.');
    const previous = new Map(job.scenes.map(s => [s.id, s]));
    job.scenes = storyboard.scenes.map(scene => {
      if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(scene.id)) throw new Error(`Invalid scene id: ${scene.id}`);
      return { id: scene.id, title: scene.title || scene.id, state: previous.get(scene.id)?.state || 'pending' };
    });
    await this.persist(job);
    return storyboard;
  }

  async snapshot(job) {
    const files = new Map();
    for (const relative of ['storyboard.json']) {
      try { files.set(relative, hash(await readFile(path.join(job.dir, relative)))); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    try {
      for (const name of await readdir(path.join(job.dir, 'web/scenes'))) {
        if (name.endsWith('.js')) files.set(`web/scenes/${name}`, hash(await readFile(path.join(job.dir, 'web/scenes', name))));
      }
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    return files;
  }

  async revise(job, signal) {
    const before = await this.snapshot(job);
    const prompt = await this.prompt(job, 'revise.md', { user_message: job.revisionMessage });
    const result = await this.agent(job, 'revise', prompt, signal, { resume: job.directorSession });
    job.directorSession = result.sessionId || job.directorSession;
    await this.persist(job);
    if (result.isError) throw new Error(result.error || 'Revision agent failed');
    const after = await this.snapshot(job);
    if ([...new Set([...before.keys(), ...after.keys()])].every(key => before.get(key) === after.get(key))) return false;
    job.changedScenes = [];
    job.directorSession = await this.validateStoryboard(job, signal, 'revise', job.directorSession);
    const board = await this.loadScenes(job);
    const validated = await this.snapshot(job);
    let old;
    try { old = JSON.parse(job.beforeRevisionStoryboard || '{}'); } catch { old = {}; }
    delete job.beforeRevisionStoryboard;
    job.changedScenes = board.scenes.filter(scene => {
      const oldScene = old.scenes?.find(s => s.id === scene.id);
      return JSON.stringify(oldScene?.beats) !== JSON.stringify(scene.beats) || before.get(`web/scenes/${scene.id}.js`) !== validated.get(`web/scenes/${scene.id}.js`);
    }).map(scene => scene.id);
    await this.persist(job);
    return true;
  }

  async scenesMusic(job, signal, { revision = false } = {}) {
    throwIfAborted(signal);
    const phaseController = new AbortController();
    const onAbort = () => phaseController.abort(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
    const phaseSignal = phaseController.signal;
    job.stage = 'scenes';
    const sceneStage = job.stages.find(s => s.name === 'scenes');
    const musicStage = job.stages.find(s => s.name === 'music');
    sceneStage.state = 'running'; sceneStage.started = iso(); sceneStage.finished = null;
    musicStage.state = 'running'; musicStage.started = iso(); musicStage.finished = null;
    try {
      await this.persist(job);
      await this.emit(job, { type: 'stage', stage: 'scenes', state: 'start' });
      await this.emit(job, { type: 'stage', stage: 'music', state: 'start' });
    } catch (error) {
      signal.removeEventListener('abort', onAbort);
      throw error;
    }
    const music = (async () => {
      try {
        await this.cmd(job, 'music', 'python3', ['music.py'], phaseSignal, { openrouter: true });
        musicStage.state = 'done';
        await this.emit(job, { type: 'stage', stage: 'music', state: 'done' });
      } catch (error) {
        if (!phaseSignal.aborted) {
          musicStage.state = 'failed';
          await this.emit(job, { type: 'error', stage: 'music', message: this.redact(error.message) });
          await this.emit(job, { type: 'stage', stage: 'music', state: 'failed', detail: this.redact(error.message) });
        } else {
          musicStage.state = 'skipped';
          if (!signal.aborted) await this.emit(job, { type: 'stage', stage: 'music', state: 'skipped', detail: 'Scenes failed' });
        }
      } finally { musicStage.finished = iso(); await this.persist(job); }
    })();
    try {
      const board = await this.loadScenes(job);
      const timing = JSON.parse(await readFile(path.join(job.dir, 'build/timing.json'), 'utf8'));
      let next = 0, done = 0;
      const renderGate = new Semaphore(this.config.renderJobs);
      const worker = async () => {
        while (next < board.scenes.length && !phaseSignal.aborted) {
          const scene = board.scenes[next++];
          try { await this.scene(job, scene, timing, phaseSignal, renderGate, revision); }
          catch (error) { phaseController.abort(error); throw error; }
          done++;
          await this.emit(job, { type: 'progress', stage: 'scenes', done, total: board.scenes.length });
        }
      };
      const results = await Promise.allSettled(Array.from({ length: Math.min(this.config.sceneConcurrency, board.scenes.length) }, worker));
      const failure = results.find(result => result.status === 'rejected');
      if (failure) throw failure.reason;
      throwIfAborted(signal);
      sceneStage.state = 'done'; sceneStage.finished = iso();
      await this.persist(job);
      await this.emit(job, { type: 'stage', stage: 'scenes', state: 'done' });
    } catch (error) {
      sceneStage.state = 'failed'; sceneStage.finished = iso();
      await this.persist(job);
      if (!signal.aborted) await this.emit(job, { type: 'stage', stage: 'scenes', state: 'failed', detail: this.redact(error.message) });
      throw error;
    } finally {
      signal.removeEventListener('abort', onAbort);
      await music;
    }
  }

  async scene(job, scene, timing, signal, renderGate, revision) {
    const state = job.scenes.find(s => s.id === scene.id);
    const timed = timing.scenes?.find(s => s.id === scene.id);
    const vars = { scene_id: scene.id, scene_title: scene.title || scene.id, beat_ids: scene.beats?.map(b => b.id).join(',') || '', scene_seconds: timed?.duration ?? '' };
    let sessionId, lastError;
    const changed = !revision || job.changedScenes?.includes(scene.id);
    if (changed) {
      for (let attempt = 0; attempt <= 2; attempt++) {
        throwIfAborted(signal);
        state.state = 'writing'; await this.persist(job);
        const prompt = attempt === 0 ? await this.prompt(job, 'scene.md', vars) : await this.prompt(job, 'repair-scene.md', { scene_id: scene.id, error: lastError });
        const result = await this.agent(job, 'scene', prompt, signal, { scene: scene.id, resume: sessionId });
        sessionId = result.sessionId || sessionId;
        try {
          if (result.isError) throw new Error(result.error || 'Scene agent failed');
          state.state = 'rendering'; await this.persist(job);
          await this.cmd(job, 'scenes', 'node', ['nancheck.mjs', scene.id], signal);
          await renderGate.use(() => this.cmd(job, 'scenes', 'node', ['render.mjs', scene.id], signal, { jobs: 1 }));
          state.state = 'done'; await this.persist(job);
          return;
        } catch (error) {
          lastError = error.message.split('\n').slice(-40).join('\n');
          if (attempt < 2) await this.emit(job, { type: 'error', stage: 'scenes', message: `${scene.id}: ${this.redact(lastError)}` });
        }
      }
    } else {
      try {
        state.state = 'rendering'; await this.persist(job);
        await renderGate.use(() => this.cmd(job, 'scenes', 'node', ['render.mjs', scene.id], signal, { jobs: 1 }));
        state.state = 'done'; await this.persist(job);
        return;
      } catch (error) { lastError = error.message; }
    }
    await this.emit(job, { type: 'error', stage: 'scenes', message: `${scene.id}: ${this.redact(lastError || 'Scene failed')}; using fallback` });
    state.state = 'fallback'; await this.persist(job);
    try {
      await this.cmd(job, 'scenes', 'node', ['tools/fallback-scene.mjs', scene.id], signal);
      await this.cmd(job, 'scenes', 'node', ['nancheck.mjs', scene.id], signal);
      await renderGate.use(() => this.cmd(job, 'scenes', 'node', ['render.mjs', scene.id], signal, { jobs: 1 }));
      state.state = 'done'; await this.persist(job);
    } catch (error) {
      if (!signal.aborted) { state.state = 'failed'; await this.persist(job); }
      throw error;
    }
  }

  async assemble(job, signal) {
    const timing = JSON.parse(await readFile(path.join(job.dir, 'build/timing.json'), 'utf8'));
    await this.cmd(job, 'assemble', 'python3', ['assemble.py', '--name', 'video', '--clean'], signal);
    job.durationSeconds = Number(timing.total ?? timing.durationSeconds ?? 0);
    for (const name of ['video.mp4', 'video.srt', 'storyboard.json']) {
      const info = await fileInfo(job, name);
      if (!info) throw new Error(`Assembly did not create ${name}`);
      await this.emit(job, { type: 'file', name, size: info.size, url: `files/${name}` });
    }
    await rm(path.join(job.dir, 'build/shots'), { recursive: true, force: true });
    await rm(path.join(job.dir, 'build/draft'), { recursive: true, force: true });
    await this.persist(job);
  }

  async execute(job, signal) {
    const resumeStage = job.stage;
    if (job.runKind === 'revision') {
      if (resumeStage === 'revise' && !(await fileInfo(job, 'storyboard.json'))) {
        job.recoveryMessage = job.revisionMessage;
        job.runKind = 'initial';
        await this.persist(job);
        return this.executeFrom(job, signal, 'storyboard');
      }
      if (resumeStage === 'revise') {
        job.beforeRevisionStoryboard ||= await readFile(path.join(job.dir, 'storyboard.json'), 'utf8');
        const changed = await this.stage(job, 'revise', () => this.revise(job, signal), signal);
        if (!changed) {
          job.status = job.previousStatus;
          job.stage = null;
          await this.persist(job);
          return;
        }
      }
      return this.executeFrom(job, signal, resumeStage === 'revise' ? 'narrate' : resumeStage, true);
    }
    return this.executeFrom(job, signal, resumeStage || 'extract');
  }

  async executeFrom(job, signal, from, revision = false) {
    const order = ['extract', 'storyboard', 'narrate', 'timing', 'scenes', 'assemble'];
    let start = order.indexOf(from);
    if (start < 0) start = 0;
    for (let index = start; index < order.length; index++) {
      const name = order[index];
      if (name === 'scenes') await this.scenesMusic(job, signal, { revision });
      else if (name === 'extract') await this.stage(job, name, () => this.extract(job, signal), signal);
      else if (name === 'storyboard') await this.stage(job, name, () => this.storyboard(job, signal), signal);
      else if (name === 'narrate') await this.stage(job, name, () => this.cmd(job, name, 'python3', ['narrate.py'], signal, { openrouter: true }), signal);
      else if (name === 'timing') await this.stage(job, name, () => this.cmd(job, name, 'python3', ['timing.py'], signal), signal);
      else if (name === 'assemble') await this.stage(job, name, () => this.assemble(job, signal), signal);
    }
  }

  async close() {
    this.closed = true;
    this.controller?.abort(new Error('Server stopping'));
    await this.pumpDone;
    await this.positionChain;
    for (const job of this.jobs.values()) {
      await job.writeChain;
      await job.eventChain;
    }
  }
}

class Semaphore {
  constructor(limit) { this.limit = limit; this.active = 0; this.waiters = []; }
  async use(fn) {
    if (this.active >= this.limit) await new Promise(resolve => this.waiters.push(resolve));
    this.active++;
    try { return await fn(); }
    finally { this.active--; this.waiters.shift()?.(); }
  }
}
