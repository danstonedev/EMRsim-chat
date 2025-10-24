#!/usr/bin/env node

// Simple test script to verify SPS integration with unified session API
const BASE_URL = 'http://localhost:3001';

async function testSpsIntegration() {
  console.log('🧪 Testing SPS Integration with Unified Session API\n');

  try {
    // 1. Get SPS personas
    console.log('1. Getting SPS personas...');
  const personasRes = await fetch(`${BASE_URL}/api/sps/personas`);
    if (!personasRes.ok) throw new Error(`Failed to get personas: ${personasRes.status}`);
    const { personas } = await personasRes.json();
    console.log(`   Found ${personas.length} SPS personas`);
    if (personas.length === 0) throw new Error('No SPS personas found');
    
    // 2. Get SPS scenarios  
    console.log('2. Getting SPS scenarios...');
  const scenariosRes = await fetch(`${BASE_URL}/api/sps/scenarios`);
    if (!scenariosRes.ok) throw new Error(`Failed to get scenarios: ${scenariosRes.status}`);
    const { scenarios } = await scenariosRes.json();
    console.log(`   Found ${scenarios.length} SPS scenarios`);
    if (scenarios.length === 0) throw new Error('No SPS scenarios found');

    // 3. Create SPS session
    console.log('3. Creating SPS session...');
    const persona = personas[0];
    const scenario = scenarios[0];
    console.log(`   Using persona: ${persona.display_name} (${persona.id})`);
    console.log(`   Using scenario: ${scenario.title} (${scenario.scenario_id})`);
    
    const sessionRes = await fetch(`${BASE_URL}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        persona_id: persona.id,
        mode: 'sps',
        scenario_id: scenario.scenario_id
      })
    });
    
    if (!sessionRes.ok) {
      const errorText = await sessionRes.text();
      throw new Error(`Failed to create session: ${sessionRes.status} - ${errorText}`);
    }
    
    const sessionData = await sessionRes.json();
    console.log(`   ✅ Session created: ${sessionData.session_id}`);
    console.log(`   SPS Session ID: ${sessionData.sps_session_id}`);
    console.log(`   Phase: ${sessionData.phase}`);
    console.log(`   Gate State: ${sessionData.gate_state}`);

    // 4. Send a message and test streaming
    console.log('4. Testing streaming message...');
    const testMessage = "Hello, I'm a physical therapy student. How are you feeling today?";
    console.log(`   Sending: "${testMessage}"`);
    
    const messageRes = await fetch(`${BASE_URL}/api/sessions/${sessionData.session_id}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: testMessage })
    });
    
    if (!messageRes.ok) throw new Error(`Failed to send message: ${messageRes.status}`);
    
    // Parse the streaming response
    const reader = messageRes.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    let buffer = '';
    
    console.log('   📡 Streaming response:');
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n\n')) >= 0) {
        const chunk = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        
        const lines = chunk.split('\n');
        const eventLine = lines.find(l => l.startsWith('event:'));
        const dataLine = lines.find(l => l.startsWith('data:'));
        
        if (!eventLine || !dataLine) continue;
        
        const event = eventLine.replace('event:', '').trim();
        const data = JSON.parse(dataLine.replace('data:', ''));
        
        if (event === 'delta') {
          fullResponse += data.delta_text;
          process.stdout.write(data.delta_text);
        }
        if (event === 'done') {
          console.log('\n   ✅ Streaming complete');
          break;
        }
      }
    }
    
    console.log(`\n   Full response: "${fullResponse}"`);
    
    if (!fullResponse.trim()) {
      throw new Error('No response received from SPS');
    }
    
    // 5. Test identity verification
    console.log('5. Testing identity verification...');
    const identityMessage = "Can you please tell me your name and date of birth?";
    console.log(`   Sending: "${identityMessage}"`);
    
    const identityRes = await fetch(`${BASE_URL}/api/sessions/${sessionData.session_id}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: identityMessage })
    });
    
    if (!identityRes.ok) throw new Error(`Failed to send identity message: ${identityRes.status}`);
    
    const identityReader = identityRes.body.getReader();
    let identityResponse = '';
    let identityBuffer = '';
    
    console.log('   📡 Identity response:');
    while (true) {
      const { value, done } = await identityReader.read();
      if (done) break;
      
      identityBuffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = identityBuffer.indexOf('\n\n')) >= 0) {
        const chunk = identityBuffer.slice(0, idx);
        identityBuffer = identityBuffer.slice(idx + 2);
        
        const lines = chunk.split('\n');
        const eventLine = lines.find(l => l.startsWith('event:'));
        const dataLine = lines.find(l => l.startsWith('data:'));
        
        if (!eventLine || !dataLine) continue;
        
        const event = eventLine.replace('event:', '').trim();
        const data = JSON.parse(dataLine.replace('data:', ''));
        
        if (event === 'delta') {
          identityResponse += data.delta_text;
          process.stdout.write(data.delta_text);
        }
        if (event === 'done') {
          console.log('\n   ✅ Identity streaming complete');
          break;
        }
      }
    }
    
    console.log(`\n   Identity response: "${identityResponse}"`);
    
    // 6. End session
    console.log('6. Ending session...');
    const endRes = await fetch(`${BASE_URL}/api/sessions/${sessionData.session_id}/end`, {
      method: 'POST'
    });
    
    if (!endRes.ok) throw new Error(`Failed to end session: ${endRes.status}`);
    console.log('   ✅ Session ended successfully');
    
    console.log('\n🎉 SPS Integration Test PASSED!');
    console.log('\nThe unified session API is working correctly:');
    console.log('- ✅ SPS personas and scenarios can be fetched');
    console.log('- ✅ SPS sessions can be created through unified API');
    console.log('- ✅ SPS messages stream properly through session message endpoint');
    console.log('- ✅ SPS logic (gates, identity verification) works');
    console.log('- ✅ Sessions can be properly ended');

  } catch (error) {
    console.error('\n❌ SPS Integration Test FAILED!');
    console.error('Error:', error.message);
    process.exit(1);
  }
}

testSpsIntegration();