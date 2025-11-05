#!/usr/bin/env node
// Fetch Celtic music pages and download .mp3/.ogg files into public/sounds/bgm/
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CATEGORY_DEFAULT = 'https://kazuki-kaneko-music.com/category/celtic_music/';
const OUT_DIR = path.resolve(__dirname, '..', 'public', 'sounds', 'bgm');

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function fetchText(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} ${res.statusText} for ${url}`);
  return await res.text();
}

function extractLinks(html) {
  const linkRe = /href=["']([^"']+)["']/gi;
  const links = new Set();
  let m;
  while ((m = linkRe.exec(html)) !== null) {
    const href = m[1];
    if (href.startsWith('http') && href.includes('kazuki-kaneko-music.com')) {
      links.add(href.split('#')[0]);
    }
  }
  return Array.from(links);
}

function extractAudioUrls(html) {
  const audioRe = /https?:\/\/[^\s"']+\.(?:mp3|ogg)/gi;
  const urls = new Set();
  let m;
  while ((m = audioRe.exec(html)) !== null) {
    urls.add(m[0]);
  }
  return Array.from(urls);
}

async function downloadFile(url, outPath) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Download failed ${res.status} ${res.statusText} for ${url}`);
  const arrayBuffer = await res.arrayBuffer();
  await fs.writeFile(outPath, Buffer.from(arrayBuffer));
}

function toSafeName(u) {
  try {
    const url = new URL(u);
    const base = path.basename(url.pathname);
    return base.replace(/[^a-zA-Z0-9._-]+/g, '_');
  } catch {
    return u.replace(/[^a-zA-Z0-9._-]+/g, '_');
  }
}

async function main() {
  const input = process.argv.slice(2);
  const seeds = input.length > 0 ? input : [CATEGORY_DEFAULT];
  await ensureDir(OUT_DIR);

  const visited = new Set();
  const audioSet = new Set();

  for (const seed of seeds) {
    try {
      const html = await fetchText(seed);
      extractAudioUrls(html).forEach((u) => audioSet.add(u));
      const links = extractLinks(html);
      for (const link of links) {
        if (visited.has(link)) continue;
        visited.add(link);
        try {
          const h = await fetchText(link);
          extractAudioUrls(h).forEach((u) => audioSet.add(u));
        } catch (e) {
          console.warn(`[bgm] skip link due to error: ${link}`, e?.message ?? e);
        }
      }
    } catch (e) {
      console.warn(`[bgm] seed fetch failed: ${seed}`, e?.message ?? e);
    }
  }

  const audioUrls = Array.from(audioSet);
  if (audioUrls.length === 0) {
    console.log('[bgm] No audio URLs discovered. You may need to pass individual post URLs.');
    process.exit(0);
  }

  console.log(`[bgm] Discovered ${audioUrls.length} audio files. Downloading to ${OUT_DIR}`);
  const saved = [];
  for (const url of audioUrls) {
    const name = toSafeName(url);
    const outPath = path.join(OUT_DIR, name);
    try {
      await downloadFile(url, outPath);
      saved.push(`/sounds/bgm/${name}`);
      console.log(`[bgm] saved ${name}`);
    } catch (e) {
      console.warn(`[bgm] failed ${url}`, e?.message ?? e);
    }
  }

  // Write manifest for convenience
  const manifestPath = path.resolve(__dirname, '..', 'lib', 'assets', 'bgm-manifest.json');
  try {
    await fs.mkdir(path.dirname(manifestPath), { recursive: true });
    await fs.writeFile(manifestPath, JSON.stringify(saved, null, 2), 'utf8');
    console.log(`[bgm] manifest written: lib/assets/bgm-manifest.json`);
  } catch (e) {
    console.warn('[bgm] manifest write failed', e?.message ?? e);
  }

  console.log('\n[bgm] Add these to your playlist if not importing manifest:');
  for (const s of saved) console.log(s);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


