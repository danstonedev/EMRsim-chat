#!/usr/bin/env node

const key = process.env.OPENAI_API_KEY;
if (!key) {
  console.error('Missing OPENAI_API_KEY');
  process.exit(1);
}

const res = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: process.env.OPENAI_TEXT_MODEL || 'gpt-4o',
    stream: true,
    messages: [
      { role: 'system', content: 'You are a friendly assistant.' },
      { role: 'user', content: 'Say hi succinctly.' },
    ],
  }),
});

if (!res.ok || !res.body) {
  console.error('OpenAI request failed', res.status, await res.text());
  process.exit(1);
}

const reader = res.body.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  let idx;
  while ((idx = buffer.indexOf('\n\n')) >= 0) {
    const chunk = buffer.slice(0, idx);
    buffer = buffer.slice(idx + 2);
    if (!chunk.startsWith('data:')) continue;
    const payload = chunk.slice(5).trim();
    console.log('RAW:', payload);
  }
}
