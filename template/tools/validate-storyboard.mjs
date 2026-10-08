#!/usr/bin/env node
// Validate the job's storyboard before any paid or expensive pipeline stage.
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const errors = [];
const fail = message => errors.push(message.replace(/[\r\n\u2028\u2029]/g, ' '));
const obj = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const string = value => typeof value === 'string' && value.trim().length > 0;
const number = value => typeof value === 'number' && Number.isFinite(value);
const words = value => value.trim().split(/\s+/u).filter(Boolean).length;
let sb;
try {
  sb = JSON.parse(await readFile(path.join(process.cwd(), 'storyboard.json'), 'utf8'));
} catch (e) {
  console.error(`storyboard.json: ${e.code === 'ENOENT' ? 'file not found' : `invalid JSON (${e.message})`}`);
  process.exit(1);
}
if (!obj(sb)) fail('storyboard: expected an object');
const meta = sb?.meta;
if (!obj(meta)) fail('meta: expected an object');
for (const field of ['title', 'voice', 'persona', 'audience']) {
  if (!string(meta?.[field])) fail(`meta.${field}: required non-empty string`);
}
if (!number(meta?.target_seconds) || meta.target_seconds <= 0) fail('meta.target_seconds: required positive number');
if (meta?.words_per_minute !== undefined && (!number(meta.words_per_minute) || meta.words_per_minute <= 0))
  fail('meta.words_per_minute: expected a positive number');
if (meta?.timing !== undefined) {
  if (!obj(meta.timing)) fail('meta.timing: expected an object');
  else for (const field of ['fps', 'lead_in', 'gap', 'tail']) {
    const value = meta.timing[field];
    if (value !== undefined && (!number(value) || value < 0 || (field === 'fps' && (!Number.isInteger(value) || value < 1))))
      fail(`meta.timing.${field}: expected ${field === 'fps' ? 'positive integer' : 'nonnegative number'}`);
    else if (field === 'fps' && value !== undefined && value !== 30 && process.env.DOC2VID_OFFLINE !== '1')
      fail('meta.timing.fps: must be 30 unless DOC2VID_OFFLINE=1');
  }
}
const cues = new Map();
if (!Array.isArray(sb?.music) || !sb.music.length) fail('music: expected a non-empty array of cues');
else sb.music.forEach((cue, i) => {
  const at = `music[${i}]`;
  if (!obj(cue)) { fail(`${at}: expected an object`); return; }
  if (!string(cue.id)) fail(`${at}.id: required non-empty string`);
  else if (cues.has(cue.id)) fail(`${at}.id: duplicate music cue ${cue.id}`);
  else cues.set(cue.id, cue);
  if (!string(cue.prompt)) fail(`${at}.prompt: required non-empty string`);
  if (cue.scenes !== undefined && (!Array.isArray(cue.scenes) || cue.scenes.some(id => !string(id))))
    fail(`${at}.scenes: expected an array of scene ids`);
});
if (!Array.isArray(sb?.scenes) || !sb.scenes.length) fail('scenes: expected a non-empty array');
const sceneIds = new Set(), beatIds = new Set();
let wordCount = 0, beatCount = 0;
(sb?.scenes instanceof Array ? sb.scenes : []).forEach((scene, i) => {
  const at = `scenes[${i}]`;
  if (!obj(scene)) { fail(`${at}: expected an object`); return; }
  const expected = `s${String(i + 1).padStart(2, '0')}`;
  if (scene.id !== expected) fail(`${at}.id: expected ${expected} in scene order`);
  if (sceneIds.has(scene.id)) fail(`${at}.id: duplicate scene id ${scene.id}`);
  sceneIds.add(scene.id);
  for (const field of ['title', 'mood']) if (!string(scene[field])) fail(`${at}.${field}: required non-empty string`);
  const linked = [...cues].filter(([, cue]) => cue.scenes?.includes(scene.id)).map(([id]) => id);
  if (scene.music !== undefined && !cues.has(scene.music)) fail(`${at}.music: unknown music cue ${scene.music}`);
  if (scene.music === undefined && linked.length !== 1) fail(`${at}.music: must reference exactly one existing music cue (or be listed in one cue.scenes)`);
  if (scene.music !== undefined && linked.length && (linked.length !== 1 || linked[0] !== scene.music))
    fail(`${at}.music: conflicts with music cue scenes lists`);
  if (!Array.isArray(scene.beats) || scene.beats.length < 1 || scene.beats.length > 12) {
    fail(`${at}.beats: expected 1–12 beats`); return;
  }
  scene.beats.forEach((beat, j) => {
    const where = `${at}.beats[${j}]`;
    beatCount++;
    if (!obj(beat)) { fail(`${where}: expected an object`); return; }
    if (typeof beat.id !== 'string' || !new RegExp(`^${expected}b\\d{2}[a-z]?$`).test(beat.id))
      fail(`${where}.id: expected ${expected}bNN with optional lowercase letter`);
    if (beatIds.has(beat.id)) fail(`${where}.id: duplicate beat id ${beat.id}`);
    beatIds.add(beat.id);
    if (!string(beat.narration)) fail(`${where}.narration: required non-empty text`);
    else {
      const count = words(beat.narration);
      wordCount += count;
      if (count > 60) fail(`${where}.narration: ${count} words exceeds 60`);
      if (/\p{Nd}/u.test(beat.narration)) fail(`${where}.narration: digits are not allowed; spell out numbers`);
      if (/[\p{C}\p{Zl}\p{Zp}]/u.test(beat.narration)) fail(`${where}.narration: contains non-printable characters`);
    }
    if (!Array.isArray(beat.onscreen_text) || beat.onscreen_text.length > 6 ||
        beat.onscreen_text.some(value => typeof value !== 'string' || [...value].length > 70 || /[\p{C}\p{Zl}\p{Zp}]/u.test(value)))
      fail(`${where}.onscreen_text: expected at most 6 printable strings of at most 70 characters each`);
    if (!string(beat.visual)) fail(`${where}.visual: required non-empty string`);
    if (beat.delivery !== undefined && typeof beat.delivery !== 'string') fail(`${where}.delivery: expected a string`);
    if (beat.hold_seconds !== undefined && (!number(beat.hold_seconds) || beat.hold_seconds < 0))
      fail(`${where}.hold_seconds: expected a nonnegative number`);
  });
});
if (number(meta?.target_seconds) && meta.target_seconds > 0) {
  const expected = meta.target_seconds * 163 / 60 * 0.92;
  const low = expected * 0.65, high = expected * 1.35;
  if (wordCount < low || wordCount > high)
    fail(`word budget: ${wordCount} words; expected ${expected.toFixed(0)} for ${meta.target_seconds}s at 163 wpm × 0.92; allowed ${low.toFixed(0)}–${high.toFixed(0)} (±35%)`);
}
for (const [id, cue] of cues) for (const sceneId of cue.scenes || []) {
  if (!sceneIds.has(sceneId)) fail(`music cue ${id}: unknown scene ${sceneId}`);
}
if (errors.length) {
  for (const error of errors) console.error(error);
  process.exit(1);
}
console.log(`valid: ${sb.scenes.length} scenes, ${beatCount} beats, ${wordCount} words, ${(wordCount / 163 * 60 / 0.92).toFixed(1)} estimated seconds`);
