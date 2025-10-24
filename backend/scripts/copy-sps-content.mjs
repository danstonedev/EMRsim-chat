// Copies SPS content (JSON catalogs, personas, compiled scenarios) into dist for serverless runtimes (e.g., Vercel)
import fs from 'node:fs';
import path from 'node:path';

const SRC_DIR = path.resolve(process.cwd(), 'src', 'sps', 'content');
const DEST_DIR = path.resolve(process.cwd(), 'dist', 'sps', 'content');

function copyRecursiveSync(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      const srcPath = path.join(src, entry);
      const destPath = path.join(dest, entry);
      copyRecursiveSync(srcPath, destPath);
    }
  } else if (stat.isFile()) {
    // Only copy JSON and media; skip anything else by default
    const lower = src.toLowerCase();
    const isJson = lower.endsWith('.json');
    const isMedia = /\.(png|jpg|jpeg|gif|webp|mp3|wav|ogg|mp4)$/i.test(lower);
    if (isJson || isMedia) {
      fs.copyFileSync(src, dest);
    }
  }
}

try {
  if (!fs.existsSync(SRC_DIR)) {
    console.warn('[copy-sps-content] Source directory not found:', SRC_DIR);
    process.exit(0);
  }
  if (!fs.existsSync(DEST_DIR)) fs.mkdirSync(DEST_DIR, { recursive: true });
  copyRecursiveSync(SRC_DIR, DEST_DIR);
  console.log('[copy-sps-content] Copied SPS content to dist:', DEST_DIR);
} catch (e) {
  console.error('[copy-sps-content] Failed to copy SPS content:', e);
  process.exit(1);
}
