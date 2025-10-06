#!/usr/bin/env node
// Test OpenAI API key directly
const API_KEY = process.env.OPENAI_API_KEY || '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';

(async () => {
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10
      })
    });
    
    console.log('Status:', r.status);
    console.log('Headers:', Object.fromEntries(r.headers.entries()));
    
    const text = await r.text();
    console.log('Body:', text);
    
    if (r.ok) {
      console.log('✅ OpenAI API key is VALID');
    } else {
      console.log('❌ OpenAI API request FAILED');
    }
  } catch (err) {
    console.log('💥 Request ERROR:', err.message);
  }
})();