import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

export async function runCommand({ cmd, args = [], cwd, env = process.env, signal, timeoutMs = 1_200_000, onLine = () => {} }) {
  if (signal?.aborted) throw signal.reason || new Error('Cancelled');
  const child = spawn(cmd, args, { cwd, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const tail = [];
  const append = line => {
    tail.push(line);
    if (tail.length > 20) tail.shift();
    onLine(line);
  };
  for (const stream of [child.stdout, child.stderr]) createInterface({ input: stream }).on('line', append);
  let timedOut = false;
  let closed = false;
  let forceTimer;
  const kill = () => {
    if (closed) return;
    try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); }
    forceTimer ||= setTimeout(() => {
      if (!closed) { try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); } }
    }, 5_000);
    forceTimer.unref();
  };
  const timer = setTimeout(() => { timedOut = true; kill(); }, timeoutMs);
  signal?.addEventListener('abort', kill, { once: true });
  try {
    const result = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code, sig) => { closed = true; resolve({ code, sig }); });
    });
    if (signal?.aborted) throw signal.reason || new Error('Cancelled');
    if (timedOut || result.code !== 0) throw new Error(`${cmd} ${args.join(' ')} ${timedOut ? 'timed out' : `exited ${result.code ?? result.sig}`}\n${tail.join('\n')}`);
    return { lines: tail };
  } finally {
    clearTimeout(timer);
    clearTimeout(forceTimer);
    signal?.removeEventListener('abort', kill);
  }
}
