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
  const duration = 360;
  const buffer = createBuffer(duration);

  const chirp = renderTone({
    durationMs: 120,
    startFreq: 780,
    endFreq: 980,
    waveform: "square",
    volume: 0.58,
    curve: "easeInOut",
  });
  applyEnvelope(chirp, { attackMs: 4, decayMs: 80, sustainLevel: 0.18, releaseMs: 40 });
  applyBitCrush(chirp, 7);
  mixInto(buffer, chirp, 0);

  const shuffle = renderNoise({ durationMs: 190, color: "pink", volume: 0.3 });
  applyHighPass(shuffle, 1100);
  applyEnvelope(shuffle, { attackMs: 6, decayMs: 90, sustainLevel: 0.12, releaseMs: 80 });
  mixInto(buffer, shuffle, msToSamples(25));

  const flutter = renderTone({
    durationMs: 210,
    startFreq: 340,
    endFreq: 320,
    waveform: "triangle",
    volume: 0.32,
    curve: "linear",
    vibratoHz: 11,
    vibratoDepth: 0.3,
  });
  applyEnvelope(flutter, { attackMs: 12, decayMs: 130, sustainLevel: 0.18, releaseMs: 120 });
  mixInto(buffer, flutter, msToSamples(90));

  const sparkle = renderTone({
    durationMs: 90,
    startFreq: 1320,
    endFreq: 1000,
    waveform: "triangle",
    volume: 0.28,
    curve: "exp",
  });
  applyEnvelope(sparkle, { attackMs: 2, decayMs: 70, sustainLevel: 0, releaseMs: 24 });
  mixInto(buffer, sparkle, msToSamples(170));

  applyDelay(buffer, { delayMs: 110, gain: 0.18, repeats: 1, decay: 0.6 });

  return normalize(buffer, 0.78);
}

function createCardPlace() {
  const duration = 300;
  const buffer = createBuffer(duration);

  const pop = renderTone({
    durationMs: 170,
    startFreq: 260,
    endFreq: 210,
    waveform: "square",
    volume: 0.62,
    curve: "log",
  });
  applyEnvelope(pop, { attackMs: 0, decayMs: 120, sustainLevel: 0.12, releaseMs: 40 });
  applyBitCrush(pop, 6);
  mixInto(buffer, pop, 0);

  const slap = renderNoise({ durationMs: 120, color: "white", volume: 0.26 });
  applyHighPass(slap, 1400);
  applyEnvelope(slap, { attackMs: 0, decayMs: 70, sustainLevel: 0.1, releaseMs: 36 });
  mixInto(buffer, slap, 0);

  const chirp = renderTone({
    durationMs: 100,
    startFreq: 980,
    endFreq: 720,
    waveform: "triangle",
    volume: 0.32,
    curve: "exp",
  });
  applyEnvelope(chirp, { attackMs: 2, decayMs: 70, sustainLevel: 0, releaseMs: 24 });
  mixInto(buffer, chirp, msToSamples(60));

  const thump = renderTone({
    durationMs: 150,
    startFreq: 180,
    endFreq: 150,
    waveform: "sine",
    volume: 0.28,
    curve: "linear",
  });
  applyEnvelope(thump, { attackMs: 10, decayMs: 90, sustainLevel: 0.2, releaseMs: 70 });
  mixInto(buffer, thump, msToSamples(120));

  return normalize(buffer, 0.8);
}

function createConfirm() {
  const duration = 420;
  const buffer = createBuffer(duration);

  const root = 660;
  const steps = [0, 5, 9];
  steps.forEach((semitone, index) => {
    const freq = root * 2 ** (semitone / 12);
    const tone = renderTone({
      durationMs: 110,
      startFreq: freq,
      endFreq: freq * 1.08,
      waveform: "square",
      volume: 0.42,
      curve: "easeInOut",
    });
    applyEnvelope(tone, { attackMs: 6, decayMs: 70, sustainLevel: 0.25, releaseMs: 40 });
    applyBitCrush(tone, 7);
    mixInto(buffer, tone, msToSamples(70 * index));
  });

  const sparkle = renderTone({
    durationMs: 200,
    startFreq: 1180,
    endFreq: 1500,
    waveform: "triangle",
    volume: 0.32,
    curve: "exp",
    vibratoHz: 7,
    vibratoDepth: 0.12,
  });
  applyEnvelope(sparkle, { attackMs: 12, decayMs: 90, sustainLevel: 0.35, releaseMs: 120 });
  mixInto(buffer, sparkle, msToSamples(150));

  const noise = renderNoise({ durationMs: 240, color: "pink", volume: 0.18 });
  applyEnvelope(noise, { attackMs: 20, decayMs: 100, sustainLevel: 0.2, releaseMs: 120 });
  mixInto(buffer, noise, msToSamples(40));

  applyDelay(buffer, { delayMs: 140, gain: 0.22, repeats: 1, decay: 0.6 });

  return normalize(buffer, 0.82);
}

function createShield() {
  const duration = 620;
  const buffer = createBuffer(duration);

  const pad = renderTone({
    durationMs: duration,
    startFreq: 320,
    endFreq: 360,
    waveform: "square",
    volume: 0.28,
    curve: "easeInOut",
    vibratoHz: 5,
    vibratoDepth: 0.2,
  });
  applyEnvelope(pad, { attackMs: 22, decayMs: 200, sustainLevel: 0.35, releaseMs: 200 });
  applyBitCrush(pad, 8);
  mixInto(buffer, pad, 0);

  const hits = [0, 140, 280];
  hits.forEach((offset, index) => {
    const ping = renderTone({
      durationMs: 150,
      startFreq: 1020,
      endFreq: 1180,
      waveform: "triangle",
      volume: 0.34 - index * 0.04,
      curve: "exp",
    });
    applyEnvelope(ping, { attackMs: 4, decayMs: 90, sustainLevel: 0.25, releaseMs: 70 });
    mixInto(buffer, ping, msToSamples(offset));
  });

  const shimmer = renderNoise({ durationMs: 320, color: "white", volume: 0.18 });
  applyHighPass(shimmer, 2200);
  applyEnvelope(shimmer, { attackMs: 10, decayMs: 160, sustainLevel: 0.12, releaseMs: 100 });
  mixInto(buffer, shimmer, msToSamples(30));

  applyDelay(buffer, { delayMs: 160, gain: 0.2, repeats: 2, decay: 0.55 });

  return normalize(buffer, 0.8);
}

function createDeny() {
  const duration = 320;
  const buffer = createBuffer(duration);

  const wah = renderTone({
    durationMs: 220,
    startFreq: 520,
    endFreq: 180,
    waveform: "square",
    volume: 0.52,
    curve: "exp",
  });
  applyEnvelope(wah, { attackMs: 0, decayMs: 170, sustainLevel: 0.18, releaseMs: 60 });
  applyBitCrush(wah, 6);
  mixInto(buffer, wah, 0);

  const bump = renderTone({
    durationMs: 200,
    startFreq: 140,
    endFreq: 110,
    waveform: "sine",
    volume: 0.42,
    curve: "log",
  });
  applyEnvelope(bump, { attackMs: 10, decayMs: 150, sustainLevel: 0.22, releaseMs: 60 });
  mixInto(buffer, bump, msToSamples(40));

  const rasp = renderNoise({ durationMs: 140, color: "pink", volume: 0.26 });
  applyHighPass(rasp, 900);
  applyEnvelope(rasp, { attackMs: 0, decayMs: 90, sustainLevel: 0.08, releaseMs: 40 });
  mixInto(buffer, rasp, msToSamples(30));

  const slap = renderTone({
    durationMs: 80,
    startFreq: 980,
    endFreq: 620,
    waveform: "triangle",
    volume: 0.28,
    curve: "exp",
  });
  applyEnvelope(slap, { attackMs: 0, decayMs: 60, sustainLevel: 0, releaseMs: 20 });
  mixInto(buffer, slap, msToSamples(160));

  return normalize(buffer, 0.78);
}

function createTurnChime() {
  const duration = 540;
  const buffer = createBuffer(duration);

  const sequence = renderArpeggio({
    rootFreq: 520,
    semitoneOffsets: [0, 7, 12, 19],
    noteDurationMs: 130,
    gapMs: 20,
    waveform: "square",
    volume: 0.38,
    curve: "easeInOut",
  });
  mixInto(buffer, sequence, 0);

  const answer = renderArpeggio({
    rootFreq: 520 * 2 ** (5 / 12),
    semitoneOffsets: [-12, -7, -5, 0],
    noteDurationMs: 120,
    gapMs: 30,
    waveform: "triangle",
    volume: 0.26,
    curve: "easeInOut",
  });
  mixInto(buffer, answer, msToSamples(120));

  const shimmer = renderNoise({ durationMs: 380, color: "white", volume: 0.16 });
  applyHighPass(shimmer, 1800);
  applyEnvelope(shimmer, { attackMs: 18, decayMs: 160, sustainLevel: 0.18, releaseMs: 120 });
  mixInto(buffer, shimmer, msToSamples(40));

  applyDelay(buffer, { delayMs: 180, gain: 0.25, repeats: 1, decay: 0.55 });

  return normalize(buffer, 0.82);
}

function createWin() {
  const duration = 1000;
  const buffer = createBuffer(duration);

  const fanfare = renderArpeggio({
    rootFreq: 520,
    semitoneOffsets: [0, 7, 12, 16, 19],
    noteDurationMs: 160,
    gapMs: 30,
    waveform: "square",
    volume: 0.45,
    curve: "easeInOut",
  });
  mixInto(buffer, fanfare, 0);

  const sparkle = renderNoise({ durationMs: 620, color: "white", volume: 0.16 });
  applyHighPass(sparkle, 2100);
  applyEnvelope(sparkle, { attackMs: 24, decayMs: 200, sustainLevel: 0.22, releaseMs: 200 });
  mixInto(buffer, sparkle, msToSamples(20));

  const tail = renderTone({
    durationMs: duration,
    startFreq: 260,
    endFreq: 340,
    waveform: "triangle",
    volume: 0.24,
    curve: "easeInOut",
    vibratoHz: 4,
    vibratoDepth: 0.18,
  });
  applyEnvelope(tail, { attackMs: 50, decayMs: 220, sustainLevel: 0.38, releaseMs: 260 });
  mixInto(buffer, tail, 0);

  const twinkles = [0, 160, 320];
  twinkles.forEach((offset, index) => {
    const ping = renderTone({
      durationMs: 120,
      startFreq: 1180 + index * 80,
      endFreq: 1500 + index * 60,
      waveform: "triangle",
      volume: 0.32 - index * 0.05,
      curve: "exp",
    });
    applyEnvelope(ping, { attackMs: 6, decayMs: 80, sustainLevel: 0.25, releaseMs: 70 });
    mixInto(buffer, ping, msToSamples(offset));
  });

  applyDelay(buffer, { delayMs: 180, gain: 0.22, repeats: 2, decay: 0.55 });

  return normalize(buffer, 0.8);
}

function createLose() {
  const duration = 760;
  const buffer = createBuffer(duration);

  const slide = renderTone({
    durationMs: 420,
    startFreq: 420,
    endFreq: 180,
    waveform: "triangle",
    volume: 0.34,
    curve: "exp",
    vibratoHz: 2.5,
    vibratoDepth: 0.2,
  });
  applyEnvelope(slide, { attackMs: 30, decayMs: 200, sustainLevel: 0.3, releaseMs: 220 });
  mixInto(buffer, slide, 0);

  const sigh = renderTone({
    durationMs: duration,
    startFreq: 160,
    endFreq: 140,
    waveform: "sine",
    volume: 0.26,
    curve: "linear",
  });
  applyEnvelope(sigh, { attackMs: 60, decayMs: 220, sustainLevel: 0.28, releaseMs: 260 });
  mixInto(buffer, sigh, 0);

  const wobble = renderTone({
    durationMs: 260,
    startFreq: 280,
    endFreq: 200,
    waveform: "square",
    volume: 0.22,
    curve: "exp",
  });
  applyEnvelope(wobble, { attackMs: 10, decayMs: 160, sustainLevel: 0.18, releaseMs: 120 });
  applyBitCrush(wobble, 7);
  mixInto(buffer, wobble, msToSamples(180));

  const puff = renderNoise({ durationMs: 180, color: "pink", volume: 0.2 });
  applyHighPass(puff, 700);
  applyEnvelope(puff, { attackMs: 20, decayMs: 100, sustainLevel: 0.08, releaseMs: 80 });
  mixInto(buffer, puff, msToSamples(60));

  const sighDown = renderArpeggio({
    rootFreq: 330,
    semitoneOffsets: [0, -4, -7],
    noteDurationMs: 160,
    gapMs: 40,
    waveform: "triangle",
    volume: 0.24,
    curve: "linear",
  });
  mixInto(buffer, sighDown, msToSamples(140));

  return normalize(buffer, 0.76);
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


