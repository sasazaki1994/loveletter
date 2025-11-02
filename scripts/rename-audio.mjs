// Rename Japanese-named audio files in public/sounds to English equivalents
import fs from 'fs';
import path from 'path';

const soundsDir = path.join(process.cwd(), 'public', 'sounds');

/** @type {{ from: string; to: string }[]} */
const renames = [
  { from: '盾で防御.mp3', to: 'shield_block.mp3' },
  { from: '打撃2.mp3', to: 'hit_2.mp3' },
  { from: '剣で斬る2.mp3', to: 'sword_slash_2.mp3' },
  { from: 'ワープ.mp3', to: 'warp.mp3' },
  { from: '過去を思い出す.mp3', to: 'recall_past.mp3' },
  { from: '構えを取る.mp3', to: 'ready_stance.mp3' },
  { from: '高速移動.mp3', to: 'dash.mp3' },
  { from: 'バタンと倒れる.mp3', to: 'fall_thud.mp3' },
];

for (const { from, to } of renames) {
  const src = path.join(soundsDir, from);
  const dst = path.join(soundsDir, to);
  try {
    if (!fs.existsSync(src)) {
      console.warn(`[rename-audio] Skip: not found ${from}`);
      continue;
    }
    if (fs.existsSync(dst)) {
      console.warn(`[rename-audio] Skip: destination already exists ${to}`);
      continue;
    }
    fs.renameSync(src, dst);
    console.log(`[rename-audio] Renamed: ${from} -> ${to}`);
  } catch (err) {
    console.error(`[rename-audio] Failed: ${from} -> ${to}`, err);
    process.exitCode = 1;
  }
}


