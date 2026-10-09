import { readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const expand = value => value?.startsWith('~/') ? path.join(homedir(), value.slice(2)) : value;

export async function readDotenv(file) {
  try {
    const mode = (await stat(expand(file))).mode & 0o777;
    if (mode & 0o077) throw new Error(`${expand(file)} must be readable only by its owner (chmod 600).`);
    const result = {};
    for (const line of (await readFile(expand(file), 'utf8')).split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z_0-9]*)\s*=\s*(.*?)\s*$/);
      if (match) result[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
    return result;
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

export async function loadConfig(overrides = {}) {
  const fileEnv = await readDotenv('~/.config/doc2vid/server.env');
  const env = { ...fileEnv, ...process.env, ...overrides };
  if (!env.ORIGIN_KEY) throw new Error('ORIGIN_KEY is required (set it in ~/.config/doc2vid/server.env)');
  const number = (name, fallback) => {
    const value = Number(env[name] ?? fallback);
    if (!Number.isFinite(value) || value <= 0) throw new Error(`Invalid ${name}`);
    return value;
  };
  const concurrency = number('SCENE_CONCURRENCY', 3);
  const renderJobs = number('RENDER_JOBS', 4);
  const port = Number(env.PORT ?? 8790);
  if (!Number.isInteger(concurrency) || !Number.isInteger(renderJobs) || !Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port or worker concurrency');
  return {
    env, host: env.HOST || '127.0.0.1', port,
    home: expand(env.DOC2VID_HOME || '~/doc2vid-data'),
    template: expand(env.TEMPLATE_DIR || path.join(repoRoot, 'template')),
    originKey: env.ORIGIN_KEY, openrouterFile: expand(env.OPENROUTER_ENV_FILE || '~/.config/doc2vid/env'),
    claudePath: expand(env.CLAUDE_PATH || '~/.local/bin/claude'),
    storyboardModel: env.STORYBOARD_MODEL || 'claude-opus-5-5', sceneModel: env.SCENE_MODEL || 'claude-opus-5-5',
    sceneConcurrency: concurrency, renderJobs,
    maxUploadBytes: Math.floor(number('MAX_UPLOAD_MB', 50) * 1024 * 1024),
    agentSandbox: env.AGENT_SANDBOX === '1', fakeAgent: env.DOC2VID_FAKE_AGENT === '1',
    agentTransport: env.AGENT_TRANSPORT === 'channel' ? 'channel' : 'sdk',
    channelUrl: env.CHANNEL_URL || 'http://127.0.0.1:8792',
  };
}
