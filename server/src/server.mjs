import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { loadConfig } from './config.mjs';
import { JobService } from './service.mjs';

const json = (res, code, body) => {
  const data = Buffer.from(JSON.stringify(body));
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'content-length': data.length });
  res.end(data);
};
const failure = (res, code, message, status = 400) => json(res, status, { error: code, message });
const goodKey = (provided, expected) => {
  if (typeof provided !== 'string') return false;
  const a = Buffer.from(provided), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};
const parseSeq = value => /^\d+$/.test(String(value ?? '')) ? Number(value) : 0;
const mime = { 'video.mp4': 'video/mp4', 'video.srt': 'application/x-subrip; charset=utf-8', 'video.vtt': 'text/vtt; charset=utf-8', 'storyboard.json': 'application/json; charset=utf-8' };
const inputMime = { '.pdf': 'application/pdf', '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.rtf': 'application/rtf', '.odt': 'application/vnd.oasis.opendocument.text', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8' };
const dispositionName = name => encodeURIComponent(name).replace(/['()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);

async function readJson(req) {
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (text.length > 16_384) throw Object.assign(new Error('JSON body is too large.'), { code: 'bad_request' });
  }
  try { return JSON.parse(text); }
  catch { throw Object.assign(new Error('Expected a JSON body.'), { code: 'bad_request' }); }
}

async function formData(req, max) {
  const length = Number(req.headers['content-length']);
  if (Number.isFinite(length) && length > max + 65_536) throw Object.assign(new Error('File exceeds the upload limit.'), { code: 'too_large' });
  let size = 0;
  const body = Readable.from((async function* () {
    for await (const chunk of req) {
      size += chunk.length;
      if (size > max + 65_536) throw Object.assign(new Error('File exceeds the upload limit.'), { code: 'too_large' });
      yield chunk;
    }
  })());
  try {
    const request = new Request('http://localhost/jobs', { method: 'POST', headers: req.headers, body, duplex: 'half' });
    return await request.formData();
  } catch (error) {
    if (size > max + 65_536) throw Object.assign(new Error('File exceeds the upload limit.'), { code: 'too_large' });
    throw Object.assign(new Error('Expected a multipart upload.'), { code: 'bad_request', cause: error });
  }
}

function sendSse(res, item, state) {
  if (res.destroyed) return;
  const ok = res.write(`id: ${item.seq}\ndata: ${JSON.stringify(item)}\n\n`);
  if (!ok && !state.blockedSince) state.blockedSince = Date.now();
}

async function events(service, job, req, res, url) {
  const after = parseSeq(req.headers['last-event-id'] ?? url.searchParams.get('after'));
  res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive' });
  res.write('retry: 3000\n\n');
  let replaying = true, last = after;
  const pending = [];
  const state = { blockedSince: 0 };
  const listener = item => {
    if (replaying) pending.push(item);
    else if (item.seq > last) { sendSse(res, item, state); last = item.seq; }
  };
  let listeners = service.listeners.get(job.id);
  if (!listeners) { listeners = new Set(); service.listeners.set(job.id, listeners); }
  listeners.add(listener);
  const clean = () => {
    clearInterval(heartbeat);
    listeners.delete(listener);
    if (!listeners.size) service.listeners.delete(job.id);
  };
  const heartbeat = setInterval(() => {
    if (res.destroyed) return clean();
    if (state.blockedSince && Date.now() - state.blockedSince > 30_000) return res.destroy();
    if (!res.write(': ping\n\n') && !state.blockedSince) state.blockedSince = Date.now();
  }, 15_000);
  heartbeat.unref();
  res.on('drain', () => { state.blockedSince = 0; });
  res.on('close', clean);
  try {
    await job.eventChain;
    const { readFile } = await import('node:fs/promises');
    const log = await readFile(`${job.dir}/events.ndjson`, 'utf8').catch(error => error.code === 'ENOENT' ? '' : Promise.reject(error));
    for (const line of log.split('\n')) {
      if (!line) continue;
      const item = JSON.parse(line);
      if (item.seq > last) { sendSse(res, item, state); last = item.seq; }
    }
    replaying = false;
    for (const item of pending) if (item.seq > last) { sendSse(res, item, state); last = item.seq; }
  } catch { res.destroy(); }
}

async function serveFile(service, job, name, req, res) {
  const info = await service.output(job, name);
  if (!info) return failure(res, 'not_found', 'File not found.', 404);
  const size = info.size;
  if (size === 0 && req.headers.range) {
    res.writeHead(416, { 'content-range': 'bytes */0', 'content-length': 0, 'accept-ranges': 'bytes' });
    return res.end();
  }
  let start = 0, end = size - 1;
  if (req.headers.range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (!match || (!match[1] && !match[2])) {
      res.writeHead(416, { 'content-range': `bytes */${size}`, 'content-length': 0, 'accept-ranges': 'bytes' });
      return res.end();
    }
    if (!match[1]) {
      const suffix = Number(match[2]);
      if (!suffix) start = size;
      else start = Math.max(0, size - suffix);
    } else {
      start = Number(match[1]);
      end = match[2] ? Number(match[2]) : end;
    }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || start > end) {
      res.writeHead(416, { 'content-range': `bytes */${size}`, 'content-length': 0, 'accept-ranges': 'bytes' });
      return res.end();
    }
    end = Math.min(end, size - 1);
  }
  const headers = {
    'content-type': name === 'original' ? inputMime[job.input.ext] : mime[name],
    'content-length': Math.max(0, end - start + 1), 'accept-ranges': 'bytes',
  };
  if (req.headers.range) headers['content-range'] = `bytes ${start}-${end}/${size}`;
  if (name === 'original') headers['content-disposition'] = `attachment; filename*=UTF-8''${dispositionName(job.input.name)}`;
  res.writeHead(req.headers.range ? 206 : 200, headers);
  if (size === 0) return res.end();
  if (info.data) return res.end(info.data.subarray(start, end + 1));
  const stream = createReadStream(info.path, { start, end });
  stream.on('error', () => res.destroy());
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}

export async function createServer(config, options = {}) {
  const service = new JobService(config, options);
  await service.init();
  const server = http.createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url, 'http://localhost');
      const parts = url.pathname.split('/').filter(Boolean);
      if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { ok: true, version: '1', queue: { running: service.running, waiting: service.waiting.length } });
      if (!goodKey(req.headers['x-doc2vid-key'], config.originKey)) return failure(res, 'unauthorized', 'A valid origin key is required.', 401);
      if (req.method === 'POST' && url.pathname === '/jobs') {
        const form = await formData(req, config.maxUploadBytes);
        const file = form.get('file');
        if (!file || typeof file.arrayBuffer !== 'function' || !file.name) return failure(res, 'bad_file', 'A document file is required.');
        const data = Buffer.from(await file.arrayBuffer());
        const job = await service.create({ fileName: file.name, data, prompt: form.get('prompt') ?? '', minutes: form.get('minutes') ?? 5, title: form.get('title') ?? undefined, agent: form.get('agent') || undefined });
        return json(res, 201, { job });
      }
      if (req.method === 'GET' && url.pathname === '/jobs') return json(res, 200, { jobs: service.list() });
      if (parts[0] !== 'jobs' || parts.length < 2) return failure(res, 'not_found', 'Not found.', 404);
      const job = service.get(parts[1]);
      if (!job) return failure(res, 'not_found', 'Job not found.', 404);
      if (req.method === 'GET' && parts.length === 2) return json(res, 200, { job: await service.detail(job) });
      if (req.method === 'GET' && parts.length === 3 && parts[2] === 'events') return events(service, job, req, res, url);
      if (req.method === 'POST' && parts.length === 3 && parts[2] === 'messages') {
        if (['queued', 'running'].includes(job.status)) return failure(res, 'busy', 'The job is busy.', 409);
        const body = await readJson(req);
        if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > 4000) return failure(res, 'bad_request', 'Message text must be 1 to 4000 characters.');
        await service.message(job, body.text);
        return json(res, 202, { ok: true });
      }
      if (req.method === 'POST' && parts.length === 3 && parts[2] === 'cancel') {
        await service.cancel(job);
        return json(res, 200, { ok: true });
      }
      if (req.method === 'GET' && parts.length === 4 && parts[2] === 'files') {
        const name = decodeURIComponent(parts[3]);
        if (!['video.mp4', 'video.srt', 'video.vtt', 'storyboard.json', 'original'].includes(name)) return failure(res, 'not_found', 'File not found.', 404);
        return serveFile(service, job, name, req, res);
      }
      return failure(res, 'not_found', 'Not found.', 404);
    })().catch(error => {
      if (res.headersSent) return res.destroy();
      const status = error.code === 'too_large' ? 413 : ['bad_file', 'bad_minutes', 'bad_agent', 'bad_request'].includes(error.code) ? 400 : 500;
      failure(res, error.code || 'internal_error', status === 500 ? 'Internal server error.' : error.message, status);
      if (status === 500) process.stderr.write(`HTTP error: ${service.redact(error.message)}\n`);
    });
  });
  return {
    server, service,
    async listen() {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(config.port, config.host, () => { server.off('error', reject); resolve(); });
      });
      return server.address();
    },
    async close() {
      const stopped = new Promise(resolve => server.close(resolve));
      server.closeAllConnections();
      await service.close();
      await stopped;
    },
  };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    const config = await loadConfig();
    const app = await createServer(config);
    await app.listen();
    process.stdout.write(`doc2vid listening on ${config.host}:${app.server.address().port}\n`);
    const shutdown = () => { void app.close().then(() => process.exit(0)); };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
