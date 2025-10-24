import fs from 'node:fs';

export function safeReadJson<T = any>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch (error) {
    if (process.env.DEBUG) {
      console.warn('[sps][load] failed to parse', filePath, error);
    }
    return null;
  }
}
