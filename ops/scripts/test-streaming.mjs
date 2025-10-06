#!/usr/bin/env node
// Test streaming OpenAI chat exactly like the backend does

const API_KEY = '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';
const MODEL = 'gpt-4o';

async function testStreamingChat() {
  console.log('Testing streaming with:', { model: MODEL, hasKey: !!API_KEY });
  
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello, who are you?' },
        ],
      }),
    });

    console.log('Response status:', r.status);
    if (!r.ok) {
      const text = await r.text();
      console.log('Error response:', text);
      return;
    }

    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let collected = '';
    let deltaCount = 0;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n\n')) >= 0) {
        const chunk = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        
        if (!chunk.startsWith('data:')) continue;
        const data = chunk.slice(5).trim();
        if (data === '[DONE]') break;
        
        try {
          const obj = JSON.parse(data);
          const delta = obj.choices?.[0]?.delta?.content || '';
          if (delta) {
            deltaCount++;
            collected += delta;
            process.stdout.write(delta);
          }
        } catch (e) {
          console.log('Parse error:', e.message, 'for:', data);
        }
      }
    }
    
    console.log(`\n\n✅ Streaming SUCCESS: ${deltaCount} deltas, ${collected.length} chars`);
    
  } catch (err) {
    console.log('❌ Streaming ERROR:', err.message);
  }
}

testStreamingChat();