#!/usr/bin/env node
// Rename Celtic BGM files to a cleaner format and update playlist
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BGM_DIR = path.resolve(__dirname, '..', 'public', 'sounds', 'bgm');
const OLD_PREFIX = 'old_';

// Extract number from filename (celtic1 -> 1, celtic18 -> 18, etc.)
function extractCelticNumber(filename) {
  const match = filename.match(/celtic(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

async function main() {
  const files = await fs.readdir(BGM_DIR);
  const celticFiles = [];

  // Collect Celtic files with their numbers
  for (const file of files) {
    if (file.includes('celtic') && !file.startsWith(OLD_PREFIX)) {
      const num = extractCelticNumber(file);
      if (num !== null) {
        celticFiles.push({ old: file, num });
      }
    }
  }

  // Sort by number
  celticFiles.sort((a, b) => a.num - b.num);

  console.log(`[rename-bgm] Found ${celticFiles.length} Celtic BGM files`);

  const renamed = [];
  const oldToNew = new Map();

  // Rename files
  for (let i = 0; i < celticFiles.length; i++) {
    const { old, num } = celticFiles[i];
    const newName = `celtic_bgm_${i + 1}.mp3`;
    const oldPath = path.join(BGM_DIR, old);
    const newPath = path.join(BGM_DIR, newName);

    try {
      // Check if new name already exists (skip if it's the same file)
      try {
        const stats = await fs.stat(newPath);
        if (stats.isFile() && path.resolve(oldPath) !== path.resolve(newPath)) {
          console.warn(`[rename-bgm] Skipping ${old} - ${newName} already exists`);
          continue;
        }
      } catch {
        // File doesn't exist, proceed with rename
      }

      // Rename: move old file to backup name first, then to new name
      const backupName = `${OLD_PREFIX}${old}`;
      const backupPath = path.join(BGM_DIR, backupName);
      
      // If backup already exists, remove it
      try {
        await fs.unlink(backupPath);
      } catch {}

      // Rename old -> backup -> new
      await fs.rename(oldPath, backupPath);
      await fs.rename(backupPath, newPath);
      
      oldToNew.set(old, newName);
      renamed.push({ old, new: newName, num });
      console.log(`[rename-bgm] ${old} -> ${newName}`);
    } catch (error) {
      console.error(`[rename-bgm] Failed to rename ${old}:`, error.message);
    }
  }

  // Clean up old backup files
  const allFiles = await fs.readdir(BGM_DIR);
  for (const file of allFiles) {
    if (file.startsWith(OLD_PREFIX)) {
      try {
        await fs.unlink(path.join(BGM_DIR, file));
        console.log(`[rename-bgm] Cleaned up backup: ${file}`);
      } catch (error) {
        console.warn(`[rename-bgm] Failed to remove backup ${file}:`, error.message);
      }
    }
  }

  // Generate playlist
  const playlist = renamed.map(({ new: newName }) => `/sounds/bgm/${newName}`);

  console.log(`\n[rename-bgm] Renamed ${renamed.length} files`);
  console.log(`[rename-bgm] Playlist (${playlist.length} tracks):`);
  playlist.forEach(p => console.log(`  ${p}`));

  return playlist;
}

main().catch((error) => {
  console.error('[rename-bgm] Error:', error);
  process.exit(1);
});

