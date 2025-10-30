import fs from "node:fs";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "public", "sounds");
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

function generateSine({ frequency, durationMs, volume, fadeInMs = 15, fadeOutMs = 35 }) {
  const sampleRate = 44100;
  const totalSamples = Math.floor((durationMs / 1000) * sampleRate);
  const fadeInSamples = Math.floor((fadeInMs / 1000) * sampleRate);
  const fadeOutSamples = Math.floor((fadeOutMs / 1000) * sampleRate);
  const samples = new Int16Array(totalSamples);

  for (let i = 0; i < totalSamples; i += 1) {
    const t = i / sampleRate;
    let amplitude = Math.sin(2 * Math.PI * frequency * t);
    if (i < fadeInSamples) {
      amplitude *= i / fadeInSamples;
    }
    if (i > totalSamples - fadeOutSamples) {
      const fadeIndex = totalSamples - i;
      amplitude *= fadeIndex / fadeOutSamples;
    }
    samples[i] = Math.round(amplitude * 0.8 * 32767 * volume);
  }
  return samples;
}

function generatePercussive({ baseFrequency, durationMs, volume, hits }) {
  const sampleRate = 44100;
  const totalSamples = Math.floor((durationMs / 1000) * sampleRate);
  const samples = new Int16Array(totalSamples);

  hits.forEach(({ offsetMs, decayMs, freqMultiplier, amp }) => {
    const offsetSamples = Math.floor((offsetMs / 1000) * sampleRate);
    const decaySamples = Math.floor((decayMs / 1000) * sampleRate);
    for (let i = 0; i < decaySamples && offsetSamples + i < totalSamples; i += 1) {
      const t = i / sampleRate;
      const envelope = Math.exp(-3 * (i / decaySamples));
      const value = Math.sin(2 * Math.PI * baseFrequency * freqMultiplier * t);
      samples[offsetSamples + i] += Math.round(value * envelope * amp * volume * 32767);
    }
  });

  return samples;
}

function writeWav(filePath, samples) {
  const sampleRate = 44100;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
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
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  Buffer.from(samples.buffer).copy(buffer, 44);
  fs.writeFileSync(filePath, buffer);
}

const sounds = [
  { name: "card_draw", samples: generateSine({ frequency: 520, durationMs: 250, volume: 0.6 }) },
  {
    name: "card_place",
    samples: generatePercussive({
      baseFrequency: 320,
      durationMs: 220,
      volume: 0.7,
      hits: [
        { offsetMs: 0, decayMs: 140, freqMultiplier: 1.2, amp: 0.9 },
        { offsetMs: 30, decayMs: 120, freqMultiplier: 1.8, amp: 0.4 },
      ],
    }),
  },
  { name: "confirm", samples: generateSine({ frequency: 760, durationMs: 180, volume: 0.6 }) },
  {
    name: "shield",
    samples: generatePercussive({
      baseFrequency: 460,
      durationMs: 420,
      volume: 0.6,
      hits: [
        { offsetMs: 0, decayMs: 260, freqMultiplier: 0.5, amp: 0.7 },
        { offsetMs: 30, decayMs: 300, freqMultiplier: 1.5, amp: 0.5 },
      ],
    }),
  },
  {
    name: "deny",
    samples: generatePercussive({
      baseFrequency: 180,
      durationMs: 260,
      volume: 0.7,
      hits: [
        { offsetMs: 0, decayMs: 150, freqMultiplier: 0.6, amp: 0.8 },
        { offsetMs: 40, decayMs: 120, freqMultiplier: 1.7, amp: 0.5 },
      ],
    }),
  },
  { name: "turn_chime", samples: generateSine({ frequency: 980, durationMs: 320, volume: 0.7 }) },
  {
    name: "win",
    samples: generatePercussive({
      baseFrequency: 660,
      durationMs: 620,
      volume: 0.7,
      hits: [
        { offsetMs: 0, decayMs: 300, freqMultiplier: 1, amp: 0.8 },
        { offsetMs: 120, decayMs: 380, freqMultiplier: 1.5, amp: 0.6 },
      ],
    }),
  },
  { name: "lose", samples: generateSine({ frequency: 220, durationMs: 420, volume: 0.6 }) },
];

sounds.forEach((sound) => {
  writeWav(path.join(OUT_DIR, `${sound.name}.wav`), sound.samples);
});

console.log(`Generated ${sounds.length} sound files in ${OUT_DIR}`);

