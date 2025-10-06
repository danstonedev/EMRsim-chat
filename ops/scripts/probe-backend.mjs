#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backend');

const child = spawn('node', ['--env-file=.env', './src/index.js'], {
  cwd: backendDir,
  stdio: ['ignore', 'pipe', 'pipe']
});

child.stdout.setEncoding('utf8');
child.stderr.setEncoding('utf8');
child.stdout.on('data', data => process.stdout.write('[backend] ' + data));
child.stderr.on('data', data => process.stderr.write('[backend-err] ' + data));

async function waitForReady() {
  for await (const chunk of child.stdout) {
    if (chunk.includes('listening')) {
      return;
    }
  }
}

async function main() {
  try {
    await waitForReady();
    const personasRes = await fetch('http://127.0.0.1:3001/api/personas');
    const personas = await personasRes.json();
    const persona = personas[0];
    console.log('[probe] using persona', persona);
    const sessionRes = await fetch('http://127.0.0.1:3001/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona_id: persona.id, mode: 'text' })
    });
    const { session_id } = await sessionRes.json();
    console.log('[probe] session', session_id);

    const messageRes = await fetch(`http://127.0.0.1:3001/api/sessions/${session_id}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Hello, how are you feeling today?' })
    });

    console.log('[probe] status', messageRes.status, 'headers', Object.fromEntries(messageRes.headers.entries()));

    if (messageRes.body) {
      const reader = messageRes.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          console.log('[probe] chunk', chunk);
        }
      }
    }
  } catch (err) {
    console.error('[probe] error', err);
  } finally {
    child.kill();
  }
}

main();
