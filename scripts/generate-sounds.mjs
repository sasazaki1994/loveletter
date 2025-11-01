import fs from "node:fs";
import path from "node:path";

const SAMPLE_RATE = 44100;
const OUT_DIR = path.join(process.cwd(), "public", "sounds");

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

const rng = createRng(0xfaceb00c);

function msToSamples(ms) {
  return Math.max(1, Math.floor((ms / 1000) * SAMPLE_RATE));
}

function createBuffer(durationMs) {
  return new Float32Array(msToSamples(durationMs));
}

function mixInto(target, source, offsetSamples = 0, gain = 1) {
  if (offsetSamples >= target.length) return target;
  const length = Math.min(source.length, target.length - offsetSamples);
  for (let i = 0; i < length; i += 1) {
    target[offsetSamples + i] += source[i] * gain;
  }
  return target;
}

function normalize(buffer, targetPeak = 0.95) {
  let max = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    const value = Math.abs(buffer[i]);
    if (value > max) max = value;
  }
  if (max < 1e-6) return buffer;
  const gain = targetPeak / max;
  for (let i = 0; i < buffer.length; i += 1) {
    buffer[i] *= gain;
  }
  return buffer;
}

function floatToInt16(buffer) {
  const int16 = new Int16Array(buffer.length);
  for (let i = 0; i < buffer.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, buffer[i]));
    int16[i] = Math.round(clamped * 32767);
  }
  return int16;
}

function writeWav(filePath, floatBuffer) {
  const samples = floatToInt16(floatBuffer);
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (SAMPLE_RATE * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = samples.length * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  Buffer.from(samples.buffer).copy(buffer, 44);
  fs.writeFileSync(filePath, buffer);
}

function ease(progress, curve) {
  switch (curve) {
    case "exp":
      return progress ** 2;
    case "log":
      return Math.sqrt(progress);
    case "easeInOut":
      return progress < 0.5
        ? 2 * progress ** 2
        : 1 - ((-2 * progress + 2) ** 2) / 2;
    default:
      return progress;
  }
}

function renderTone({
  durationMs,
  startFreq,
  endFreq = startFreq,
  waveform = "sine",
  volume = 1,
  curve = "linear",
  vibratoHz = 0,
  vibratoDepth = 0,
}) {
  const samples = createBuffer(durationMs);
  const totalSamples = samples.length;
  let phase = 0;
  const vibratoIncrement = (2 * Math.PI * vibratoHz) / SAMPLE_RATE;
  let vibratoPhase = 0;

  for (let i = 0; i < totalSamples; i += 1) {
    const progress = i / totalSamples;
    const eased = ease(progress, curve);
    const baseFreq = startFreq + (endFreq - startFreq) * eased;
    vibratoPhase += vibratoIncrement;
    const vibratoSemitone = vibratoDepth * Math.sin(vibratoPhase);
    const freq = baseFreq * 2 ** (vibratoSemitone / 12);
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;

    let value;
    switch (waveform) {
      case "triangle":
        value = (2 / Math.PI) * Math.asin(Math.sin(phase));
        break;
      case "square":
        value = Math.sign(Math.sin(phase));
        break;
      case "saw":
        value = 2 * ((phase / (2 * Math.PI)) % 1) - 1;
        break;
      default:
        value = Math.sin(phase);
    }

    samples[i] = value * volume;
  }

  return samples;
}

function renderNoise({ durationMs, color = "white", volume = 1 }) {
  const samples = createBuffer(durationMs);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;

  for (let i = 0; i < samples.length; i += 1) {
    let white = rng() * 2 - 1;
    if (color === "pink") {
      b0 = 0.99765 * b0 + white * 0.0990460;
      b1 = 0.96300 * b1 + white * 0.2965164;
      b2 = 0.57000 * b2 + white * 1.0526913;
      white = b0 + b1 + b2 + white * 0.5362;
      white *= 0.11;
    }
    samples[i] = white * volume;
  }

  return samples;
}

function applyEnvelope(samples, { attackMs = 0, decayMs = 0, sustainLevel = 1, releaseMs = 0, holdMs = 0 }) {
  const total = samples.length;
  const attack = Math.min(msToSamples(attackMs), total);
  const decay = Math.min(msToSamples(decayMs), total - attack);
  const release = Math.min(msToSamples(releaseMs), total);
  const hold = Math.min(msToSamples(holdMs), Math.max(0, total - attack - decay - release));
  const sustainStart = attack + decay + hold;
  const releaseStart = Math.max(total - release, sustainStart);

  for (let i = 0; i < total; i += 1) {
    let amp;
    if (i < attack && attack > 0) {
      amp = i / attack;
    } else if (i < attack + decay && decay > 0) {
      const t = (i - attack) / decay;
      amp = 1 - (1 - sustainLevel) * t;
    } else if (i < releaseStart) {
      amp = sustainLevel;
    } else if (release > 0) {
      const t = (i - releaseStart) / release;
      amp = sustainLevel * (1 - t);
    } else {
      amp = 0;
    }
    samples[i] *= amp;
  }

  return samples;
}

function applyHighPass(samples, cutoffHz) {
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const dt = 1 / SAMPLE_RATE;
  const alpha = rc / (rc + dt);
  let prevInput = samples[0];
  let prevOutput = 0;
  samples[0] = 0;

  for (let i = 1; i < samples.length; i += 1) {
    const current = samples[i];
    const output = alpha * (prevOutput + current - prevInput);
    samples[i] = output;
    prevOutput = output;
    prevInput = current;
  }

  return samples;
}

function applyBitCrush(samples, bits = 8) {
  const levels = 2 ** bits;
  const step = 2 / levels;
  for (let i = 0; i < samples.length; i += 1) {
    const value = samples[i];
    samples[i] = Math.round(value / step) * step;
  }
  return samples;
}

function applyDelay(samples, { delayMs, gain = 0.3, repeats = 1, decay = 0.55 }) {
  const offset = msToSamples(delayMs);
  if (offset <= 0 || gain <= 0) return samples;
  for (let r = 1; r <= repeats; r += 1) {
    const attenuation = gain * decay ** (r - 1);
    const sourceLength = samples.length - offset * r;
    if (sourceLength <= 0) break;
    const copy = samples.slice(0, sourceLength);
    mixInto(samples, copy, offset * r, attenuation);
  }
  return samples;
}

function renderArpeggio({
  rootFreq,
  semitoneOffsets,
  noteDurationMs,
  gapMs = 0,
  waveform = "sine",
  volume = 1,
  curve = "linear",
}) {
  const totalDuration = semitoneOffsets.length * (noteDurationMs + gapMs) + 200;
  const buffer = createBuffer(totalDuration);
  let cursorMs = 0;

  semitoneOffsets.forEach((offset) => {
    const freq = rootFreq * 2 ** (offset / 12);
    const tone = renderTone({
      durationMs: noteDurationMs + 140,
      startFreq: freq,
      endFreq: freq * 1.05,
      waveform,
      volume,
      curve,
      vibratoHz: 5,
      vibratoDepth: 0.1,
    });
    applyEnvelope(tone, {
      attackMs: 12,
      decayMs: Math.min(120, noteDurationMs * 0.5),
      sustainLevel: 0.55,
      releaseMs: 160,
    });
    mixInto(buffer, tone, msToSamples(cursorMs));
    cursorMs += noteDurationMs + gapMs;
  });

  return normalize(buffer, 0.8);
}

function createCardDraw() {
  const duration = 240;
  const buffer = createBuffer(duration);

  // より明るく短いメインビープ（高音域強調）
  const chirp = renderTone({
    durationMs: 80,
    startFreq: 880,
    endFreq: 1200,
    waveform: "square",
    volume: 0.68,
    curve: "exp",
  });
  applyEnvelope(chirp, { attackMs: 2, decayMs: 50, sustainLevel: 0.15, releaseMs: 28 });
  applyBitCrush(chirp, 4);
  mixInto(buffer, chirp, 0);

  // 短いシャッフルノイズ
  const shuffle = renderNoise({ durationMs: 120, color: "pink", volume: 0.28 });
  applyHighPass(shuffle, 1500);
  applyEnvelope(shuffle, { attackMs: 3, decayMs: 60, sustainLevel: 0.1, releaseMs: 50 });
  applyBitCrush(shuffle, 5);
  mixInto(buffer, shuffle, msToSamples(15));

  // 高音域のスパークル（より明るく）
  const sparkle = renderTone({
    durationMs: 60,
    startFreq: 1600,
    endFreq: 2000,
    waveform: "triangle",
    volume: 0.38,
    curve: "exp",
  });
  applyEnvelope(sparkle, { attackMs: 1, decayMs: 40, sustainLevel: 0, releaseMs: 20 });
  mixInto(buffer, sparkle, msToSamples(100));

  // 短いデレイでパンチを追加
  applyDelay(buffer, { delayMs: 80, gain: 0.22, repeats: 1, decay: 0.65 });

  return normalize(buffer, 0.82);
}

function createCardPlace() {
  const duration = 220;
  const buffer = createBuffer(duration);

  // よりパンチのあるポップ（メロディ要素追加）
  const pop = renderTone({
    durationMs: 100,
    startFreq: 320,
    endFreq: 240,
    waveform: "square",
    volume: 0.72,
    curve: "log",
  });
  applyEnvelope(pop, { attackMs: 0, decayMs: 70, sustainLevel: 0.1, releaseMs: 30 });
  applyBitCrush(pop, 4);
  mixInto(buffer, pop, 0);

  // 短いメロディックチャイム（2音）
  const melody1 = renderTone({
    durationMs: 50,
    startFreq: 880,
    endFreq: 1100,
    waveform: "square",
    volume: 0.42,
    curve: "exp",
  });
  applyEnvelope(melody1, { attackMs: 1, decayMs: 35, sustainLevel: 0.15, releaseMs: 15 });
  applyBitCrush(melody1, 5);
  mixInto(buffer, melody1, msToSamples(30));

  const melody2 = renderTone({
    durationMs: 50,
    startFreq: 1320,
    endFreq: 1600,
    waveform: "square",
    volume: 0.38,
    curve: "exp",
  });
  applyEnvelope(melody2, { attackMs: 1, decayMs: 35, sustainLevel: 0.15, releaseMs: 15 });
  applyBitCrush(melody2, 5);
  mixInto(buffer, melody2, msToSamples(80));

  // 短いパンチのあるノイズ
  const slap = renderNoise({ durationMs: 80, color: "white", volume: 0.24 });
  applyHighPass(slap, 1600);
  applyEnvelope(slap, { attackMs: 0, decayMs: 50, sustainLevel: 0.08, releaseMs: 30 });
  applyBitCrush(slap, 6);
  mixInto(buffer, slap, 0);

  // 短い低音のパンチ
  const thump = renderTone({
    durationMs: 100,
    startFreq: 200,
    endFreq: 160,
    waveform: "square",
    volume: 0.32,
    curve: "linear",
  });
  applyEnvelope(thump, { attackMs: 5, decayMs: 60, sustainLevel: 0.15, releaseMs: 35 });
  applyBitCrush(thump, 5);
  mixInto(buffer, thump, msToSamples(90));

  applyDelay(buffer, { delayMs: 70, gain: 0.24, repeats: 1, decay: 0.65 });

  return normalize(buffer, 0.85);
}

function createConfirm() {
  const duration = 480;
  const buffer = createBuffer(duration);

  // よりファンファーレ風のメロディ（明るい3和音）
  const root = 660;
  const steps = [0, 4, 7, 12]; // メジャー3和音 + オクターブ
  steps.forEach((semitone, index) => {
    const freq = root * 2 ** (semitone / 12);
    const tone = renderTone({
      durationMs: 100,
      startFreq: freq,
      endFreq: freq * 1.12,
      waveform: "square",
      volume: 0.52,
      curve: "easeInOut",
    });
    applyEnvelope(tone, { attackMs: 4, decayMs: 60, sustainLevel: 0.3, releaseMs: 40 });
    applyBitCrush(tone, 4);
    mixInto(buffer, tone, msToSamples(60 * index));
  });

  // 高音域のスパークル（より明るく）
  const sparkle = renderTone({
    durationMs: 220,
    startFreq: 1400,
    endFreq: 1800,
    waveform: "triangle",
    volume: 0.42,
    curve: "exp",
    vibratoHz: 8,
    vibratoDepth: 0.15,
  });
  applyEnvelope(sparkle, { attackMs: 8, decayMs: 100, sustainLevel: 0.4, releaseMs: 120 });
  applyBitCrush(sparkle, 5);
  mixInto(buffer, sparkle, msToSamples(180));

  // 短いノイズバースト
  const noise = renderNoise({ durationMs: 180, color: "pink", volume: 0.16 });
  applyHighPass(noise, 2000);
  applyEnvelope(noise, { attackMs: 10, decayMs: 80, sustainLevel: 0.15, releaseMs: 90 });
  applyBitCrush(noise, 6);
  mixInto(buffer, noise, msToSamples(50));

  // より強いデレイで空間感を追加
  applyDelay(buffer, { delayMs: 150, gain: 0.32, repeats: 2, decay: 0.58 });

  return normalize(buffer, 0.85);
}

function createShield() {
  const duration = 680;
  const buffer = createBuffer(duration);

  // より長めのチャイムベース（リバーブ強化）
  const pad = renderTone({
    durationMs: duration,
    startFreq: 360,
    endFreq: 400,
    waveform: "square",
    volume: 0.32,
    curve: "easeInOut",
    vibratoHz: 4.5,
    vibratoDepth: 0.22,
  });
  applyEnvelope(pad, { attackMs: 25, decayMs: 220, sustainLevel: 0.4, releaseMs: 220 });
  applyBitCrush(pad, 5);
  mixInto(buffer, pad, 0);

  // より明るいチャイムヒット（メロディ要素）
  const hits = [0, 160, 320];
  hits.forEach((offset, index) => {
    const freq = 1100 + index * 120;
    const ping = renderTone({
      durationMs: 160,
      startFreq: freq,
      endFreq: freq * 1.15,
      waveform: "triangle",
      volume: 0.42 - index * 0.05,
      curve: "exp",
    });
    applyEnvelope(ping, { attackMs: 3, decayMs: 100, sustainLevel: 0.3, releaseMs: 80 });
    applyBitCrush(ping, 5);
    mixInto(buffer, ping, msToSamples(offset));
  });

  // より明るいシマー（高音域強調）
  const shimmer = renderNoise({ durationMs: 380, color: "white", volume: 0.20 });
  applyHighPass(shimmer, 2500);
  applyEnvelope(shimmer, { attackMs: 12, decayMs: 180, sustainLevel: 0.18, releaseMs: 120 });
  applyBitCrush(shimmer, 6);
  mixInto(buffer, shimmer, msToSamples(40));

  // より強いリバーブ効果
  applyDelay(buffer, { delayMs: 180, gain: 0.28, repeats: 3, decay: 0.52 });

  return normalize(buffer, 0.82);
}

function createDeny() {
  const duration = 280;
  const buffer = createBuffer(duration);

  // より低く強い音（bitcrush強化で8bit風）
  const wah = renderTone({
    durationMs: 180,
    startFreq: 480,
    endFreq: 160,
    waveform: "square",
    volume: 0.62,
    curve: "exp",
  });
  applyEnvelope(wah, { attackMs: 0, decayMs: 140, sustainLevel: 0.2, releaseMs: 50 });
  applyBitCrush(wah, 3);
  mixInto(buffer, wah, 0);

  // より強い低音バンプ
  const bump = renderTone({
    durationMs: 160,
    startFreq: 160,
    endFreq: 120,
    waveform: "square",
    volume: 0.52,
    curve: "log",
  });
  applyEnvelope(bump, { attackMs: 8, decayMs: 120, sustainLevel: 0.25, releaseMs: 50 });
  applyBitCrush(bump, 4);
  mixInto(buffer, bump, msToSamples(30));

  // より強いノイズラスプ
  const rasp = renderNoise({ durationMs: 120, color: "pink", volume: 0.32 });
  applyHighPass(rasp, 800);
  applyEnvelope(rasp, { attackMs: 0, decayMs: 70, sustainLevel: 0.1, releaseMs: 35 });
  applyBitCrush(rasp, 5);
  mixInto(buffer, rasp, msToSamples(20));

  // 短い下降音
  const slap = renderTone({
    durationMs: 60,
    startFreq: 900,
    endFreq: 500,
    waveform: "square",
    volume: 0.35,
    curve: "exp",
  });
  applyEnvelope(slap, { attackMs: 0, decayMs: 45, sustainLevel: 0, releaseMs: 15 });
  applyBitCrush(slap, 4);
  mixInto(buffer, slap, msToSamples(140));

  // 短いデレイでエコー効果
  applyDelay(buffer, { delayMs: 100, gain: 0.26, repeats: 1, decay: 0.6 });

  return normalize(buffer, 0.80);
}

function createTurnChime() {
  const duration = 600;
  const buffer = createBuffer(duration);

  // よりメロディアスなチャイム（明るいアルペジオ、高音域強調）
  const sequence = renderArpeggio({
    rootFreq: 600,
    semitoneOffsets: [0, 4, 7, 12, 16],
    noteDurationMs: 110,
    gapMs: 15,
    waveform: "square",
    volume: 0.48,
    curve: "easeInOut",
  });
  mixInto(buffer, sequence, 0);

  // より明るい対位旋律
  const answer = renderArpeggio({
    rootFreq: 600 * 2 ** (7 / 12),
    semitoneOffsets: [-5, 0, 4, 7, 12],
    noteDurationMs: 100,
    gapMs: 20,
    waveform: "triangle",
    volume: 0.32,
    curve: "easeInOut",
  });
  mixInto(buffer, answer, msToSamples(100));

  // より明るいシマー（高音域強調）
  const shimmer = renderNoise({ durationMs: 420, color: "white", volume: 0.20 });
  applyHighPass(shimmer, 2200);
  applyEnvelope(shimmer, { attackMs: 15, decayMs: 180, sustainLevel: 0.22, releaseMs: 140 });
  applyBitCrush(shimmer, 6);
  mixInto(buffer, shimmer, msToSamples(50));

  // より強いデレイで空間感を追加
  applyDelay(buffer, { delayMs: 200, gain: 0.32, repeats: 2, decay: 0.58 });

  return normalize(buffer, 0.85);
}

function createWin() {
  const duration = 1200;
  const buffer = createBuffer(duration);

  // より華やかなファンファーレ（複数メロディ層）
  const fanfare1 = renderArpeggio({
    rootFreq: 600,
    semitoneOffsets: [0, 4, 7, 12, 16, 19],
    noteDurationMs: 140,
    gapMs: 25,
    waveform: "square",
    volume: 0.52,
    curve: "easeInOut",
  });
  mixInto(buffer, fanfare1, 0);

  // 2つ目のファンファーレ層（ハーモニー）
  const fanfare2 = renderArpeggio({
    rootFreq: 600 * 2 ** (7 / 12),
    semitoneOffsets: [-5, 0, 4, 9, 12, 16],
    noteDurationMs: 140,
    gapMs: 25,
    waveform: "square",
    volume: 0.38,
    curve: "easeInOut",
  });
  mixInto(buffer, fanfare2, msToSamples(50));

  // より明るいスパークル（高音域強調）
  const sparkle = renderNoise({ durationMs: 720, color: "white", volume: 0.20 });
  applyHighPass(sparkle, 2400);
  applyEnvelope(sparkle, { attackMs: 20, decayMs: 240, sustainLevel: 0.28, releaseMs: 240 });
  applyBitCrush(sparkle, 6);
  mixInto(buffer, sparkle, msToSamples(30));

  // より長いテール（ベースライン）
  const tail = renderTone({
    durationMs: duration,
    startFreq: 300,
    endFreq: 380,
    waveform: "triangle",
    volume: 0.28,
    curve: "easeInOut",
    vibratoHz: 3.5,
    vibratoDepth: 0.20,
  });
  applyEnvelope(tail, { attackMs: 60, decayMs: 260, sustainLevel: 0.42, releaseMs: 300 });
  applyBitCrush(tail, 5);
  mixInto(buffer, tail, 0);

  // より明るいツインクル（複数層）
  const twinkles = [0, 180, 360, 540];
  twinkles.forEach((offset, index) => {
    const ping = renderTone({
      durationMs: 140,
      startFreq: 1400 + index * 100,
      endFreq: 1800 + index * 80,
      waveform: "triangle",
      volume: 0.38 - index * 0.04,
      curve: "exp",
    });
    applyEnvelope(ping, { attackMs: 5, decayMs: 90, sustainLevel: 0.3, releaseMs: 80 });
    applyBitCrush(ping, 5);
    mixInto(buffer, ping, msToSamples(offset));
  });

  // より強いデレイ/リバーブで華やかさを追加
  applyDelay(buffer, { delayMs: 200, gain: 0.32, repeats: 3, decay: 0.55 });

  return normalize(buffer, 0.85);
}

function createLose() {
  const duration = 680;
  const buffer = createBuffer(duration);

  // より劇的な下降音（bitcrush強化）
  const slide = renderTone({
    durationMs: 380,
    startFreq: 400,
    endFreq: 150,
    waveform: "square",
    volume: 0.42,
    curve: "exp",
    vibratoHz: 2.5,
    vibratoDepth: 0.22,
  });
  applyEnvelope(slide, { attackMs: 25, decayMs: 180, sustainLevel: 0.32, releaseMs: 200 });
  applyBitCrush(slide, 3);
  mixInto(buffer, slide, 0);

  // より低く長いため息
  const sigh = renderTone({
    durationMs: duration,
    startFreq: 180,
    endFreq: 140,
    waveform: "square",
    volume: 0.32,
    curve: "linear",
  });
  applyEnvelope(sigh, { attackMs: 50, decayMs: 200, sustainLevel: 0.3, releaseMs: 240 });
  applyBitCrush(sigh, 4);
  mixInto(buffer, sigh, 0);

  // より強いウォブル（bitcrush強化）
  const wobble = renderTone({
    durationMs: 240,
    startFreq: 300,
    endFreq: 200,
    waveform: "square",
    volume: 0.28,
    curve: "exp",
  });
  applyEnvelope(wobble, { attackMs: 8, decayMs: 140, sustainLevel: 0.2, releaseMs: 110 });
  applyBitCrush(wobble, 3);
  mixInto(buffer, wobble, msToSamples(160));

  // より低いノイズ
  const puff = renderNoise({ durationMs: 160, color: "pink", volume: 0.24 });
  applyHighPass(puff, 600);
  applyEnvelope(puff, { attackMs: 15, decayMs: 90, sustainLevel: 0.1, releaseMs: 70 });
  applyBitCrush(puff, 5);
  mixInto(buffer, puff, msToSamples(50));

  // より劇的な下降アルペジオ
  const sighDown = renderArpeggio({
    rootFreq: 380,
    semitoneOffsets: [0, -3, -7, -12],
    noteDurationMs: 140,
    gapMs: 35,
    waveform: "square",
    volume: 0.28,
    curve: "linear",
  });
  applyBitCrush(sighDown, 4);
  mixInto(buffer, sighDown, msToSamples(120));

  // 短いデレイでエコー効果
  applyDelay(buffer, { delayMs: 150, gain: 0.24, repeats: 1, decay: 0.62 });

  return normalize(buffer, 0.78);
}

const sounds = [
  { name: "card_draw", samples: createCardDraw() },
  { name: "card_place", samples: createCardPlace() },
  { name: "confirm", samples: createConfirm() },
  { name: "shield", samples: createShield() },
  { name: "deny", samples: createDeny() },
  { name: "turn_chime", samples: createTurnChime() },
  { name: "win", samples: createWin() },
  { name: "lose", samples: createLose() },
];

sounds.forEach((sound) => {
  writeWav(path.join(OUT_DIR, `${sound.name}.wav`), sound.samples);
});

console.log(`Generated ${sounds.length} sound files in ${OUT_DIR}`);


