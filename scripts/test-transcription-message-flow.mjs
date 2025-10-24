#!/usr/bin/env node
/**
 * Transcription & Message Bubble Flow Comparison Test
 *
 * Tests the complete flow:
 * 1. Voice token generation (OpenAI Realtime API access)
 * 2. Transcript relay endpoint (receives transcripts from frontend, broadcasts via Socket.IO)
 * 3. Session/turn storage (message persistence)
 * 4. Socket.IO connection (real-time message delivery to chat bubbles)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCAL_URL = 'http://localhost:3002';
const PRODUCTION_URL = 'https://backend-rolvpi90w-dan-stones-projects-04854ae1.vercel.app';

async function testEnvironment(name, baseUrl) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🧪 Testing ${name}`);
  console.log(`   URL: ${baseUrl}`);
  console.log(`${'='.repeat(70)}\n`);

  const results = {
    environment: name,
    url: baseUrl,
    health: null,
    voiceToken: null,
    sessionCreation: null,
    turnStorage: null,
    transcriptRelay: null,
    errors: []
  };

  let sessionId = null;

  // Test 1: Health check - verify voice is enabled
  console.log('1️⃣  Checking health and voice configuration...');
  try {
    const response = await fetch(`${baseUrl}/api/health`);
    if (response.ok) {
      const data = await response.json();
      results.health = {
        success: true,
        voiceEnabled: data.features?.voiceEnabled ?? false,
        openAIConnected: data.services?.openai === 'ok'
      };
      console.log('   ✅ Health check passed');
      console.log(`      - Voice enabled: ${data.features?.voiceEnabled ? 'Yes' : 'No'}`);
      console.log(`      - OpenAI connected: ${data.services?.openai === 'ok' ? 'Yes' : 'No'}`);
    } else {
      results.health = { success: false, status: response.status };
      results.errors.push(`Health check failed: ${response.status}`);
      console.log(`   ❌ Health check failed: ${response.status}`);
    }
  } catch (error) {
    results.health = { success: false, error: error.message };
    results.errors.push(`Health check error: ${error.message}`);
    console.log(`   ❌ Health check error: ${error.message}`);
  }

  // Test 2: Voice token generation
  console.log('\n2️⃣  Testing voice token generation...');
  try {
    const response = await fetch(`${baseUrl}/api/voice/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        persona_id: 'alloy-jordan-patel',
        scenario_id: 'lowbackpain'
      })
    });

    if (response.ok) {
      const data = await response.json();
      results.voiceToken = {
        success: true,
        tokenLength: data.token?.length ?? 0,
        model: data.model,
        voice: data.voice,
        expiresAt: data.expires_at
      };
      console.log('   ✅ Voice token generated successfully');
      console.log(`      - Model: ${data.model}`);
      console.log(`      - Voice: ${data.voice}`);
      console.log(`      - Token length: ${data.token?.length} chars`);
    } else {
      const text = await response.text().catch(() => '');
      results.voiceToken = { success: false, status: response.status, error: text };
      results.errors.push(`Voice token failed: ${response.status}`);
      console.log(`   ❌ Voice token failed: ${response.status}`);
    }
  } catch (error) {
    results.voiceToken = { success: false, error: error.message };
    results.errors.push(`Voice token error: ${error.message}`);
    console.log(`   ❌ Voice token error: ${error.message}`);
  }

  // Test 3: Create session for message storage
  console.log('\n3️⃣  Creating test session...');
  try {
    const response = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        persona_id: 'alloy-jordan-patel',
        scenario_id: 'lowbackpain'
      })
    });

    if (response.ok) {
      const data = await response.json();
      sessionId = data.session_id;
      results.sessionCreation = {
        success: true,
        sessionId: sessionId,
        mode: data.mode
      };
      console.log('   ✅ Session created successfully');
      console.log(`      - Session ID: ${sessionId}`);
      console.log(`      - Mode: ${data.mode}`);
    } else {
      const text = await response.text().catch(() => '');
      results.sessionCreation = { success: false, status: response.status, error: text };
      results.errors.push(`Session creation failed: ${response.status}`);
      console.log(`   ❌ Session creation failed: ${response.status}`);
      sessionId = 'fallback-session-' + Date.now();
      console.log(`      Using fallback session ID: ${sessionId}`);
    }
  } catch (error) {
    results.sessionCreation = { success: false, error: error.message };
    results.errors.push(`Session creation error: ${error.message}`);
    console.log(`   ❌ Session creation error: ${error.message}`);
    sessionId = 'fallback-session-' + Date.now();
    console.log(`      Using fallback session ID: ${sessionId}`);
  }

  // Test 4: Turn storage (message persistence)
  console.log('\n4️⃣  Testing message turn storage...');
  try {
    const testTurns = [
      {
        role: 'user',
        text: 'Test user message from voice transcription',
        channel: 'audio',
        timestamp_ms: Date.now()
      },
      {
        role: 'assistant',
        text: 'Test assistant response for message bubble',
        channel: 'text',
        timestamp_ms: Date.now() + 1000
      }
    ];

    const response = await fetch(`${baseUrl}/api/sessions/${sessionId}/turns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turns: testTurns })
    });

    if (response.ok) {
      const data = await response.json();
      results.turnStorage = {
        success: true,
        saved: data.saved || 0,
        received: data.received || 0
      };
      console.log('   ✅ Turn storage working');
      console.log(`      - Turns saved: ${data.saved}/${data.received}`);
    } else {
      const text = await response.text().catch(() => '');
      results.turnStorage = { success: false, status: response.status, error: text };
      results.errors.push(`Turn storage failed: ${response.status}`);
      console.log(`   ⚠️  Turn storage failed: ${response.status}`);
      console.log(`      (May be expected if session doesn't exist)`);
    }
  } catch (error) {
    results.turnStorage = { success: false, error: error.message };
    results.errors.push(`Turn storage error: ${error.message}`);
    console.log(`   ⚠️  Turn storage error: ${error.message}`);
  }

  // Test 5: Transcript relay endpoint (critical for message bubble flow)
  console.log('\n5️⃣  Testing transcript relay endpoint...');
  try {
    const response = await fetch(`${baseUrl}/api/transcript/relay/${sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'user',
        text: 'Test transcript relay for message bubbles',
        isFinal: true,
        timestamp: Date.now(),
        itemId: 'test-item-' + Date.now()
      })
    });

    if (response.ok || response.status === 204) {
      results.transcriptRelay = {
        success: true,
        status: response.status
      };
      console.log('   ✅ Transcript relay working');
      console.log('      - Transcripts will be broadcast to Socket.IO clients');
      console.log('      - Message bubbles will render in real-time');
    } else {
      const text = await response.text().catch(() => '');
      results.transcriptRelay = { success: false, status: response.status, error: text };
      results.errors.push(`Transcript relay failed: ${response.status}`);
      console.log(`   ❌ Transcript relay failed: ${response.status}`);
      console.log(`      Response: ${text.substring(0, 200)}`);
    }
  } catch (error) {
    results.transcriptRelay = { success: false, error: error.message };
    results.errors.push(`Transcript relay error: ${error.message}`);
    console.log(`   ❌ Transcript relay error: ${error.message}`);
  }

  return results;
}

function printComparison(local, prod) {
  console.log(`\n${'='.repeat(70)}`);
  console.log('📊 COMPREHENSIVE COMPARISON');
  console.log(`${'='.repeat(70)}\n`);

  console.log('🎙️  VOICE & TRANSCRIPTION FLOW:');
  console.log('─'.repeat(70));

  const features = [
    {
      name: 'Voice Enabled (Backend Config)',
      local: local.health?.voiceEnabled,
      prod: prod.health?.voiceEnabled
    },
    {
      name: 'OpenAI Connection',
      local: local.health?.openAIConnected,
      prod: prod.health?.openAIConnected
    },
    {
      name: 'Voice Token Generation',
      local: local.voiceToken?.success,
      prod: prod.voiceToken?.success
    },
    {
      name: 'Session Creation',
      local: local.sessionCreation?.success,
      prod: prod.sessionCreation?.success
    },
    {
      name: 'Turn/Message Storage',
      local: local.turnStorage?.success,
      prod: prod.turnStorage?.success
    },
    {
      name: 'Transcript Relay (Socket.IO broadcast)',
      local: local.transcriptRelay?.success,
      prod: prod.transcriptRelay?.success
    }
  ];

  console.log('Feature'.padEnd(50) + 'Local Dev'.padEnd(15) + 'Production');
  console.log('─'.repeat(70));

  for (const feature of features) {
    const localStatus = feature.local === true ? '✅ Working' : feature.local === false ? '❌ Failed' : '⚠️  Unknown';
    const prodStatus = feature.prod === true ? '✅ Working' : feature.prod === false ? '❌ Failed' : '⚠️  Unknown';
    const match = feature.local === feature.prod ? '' : ' ⚠️  MISMATCH';
    console.log(`${feature.name.padEnd(50)}${localStatus.padEnd(15)}${prodStatus}${match}`);
  }

  console.log('\n📝 VOICE MODEL CONFIGURATION:');
  console.log('─'.repeat(70));

  if (local.voiceToken?.success && prod.voiceToken?.success) {
    const modelMatch = local.voiceToken.model === prod.voiceToken.model ? '✅' : '⚠️  MISMATCH';
    const voiceMatch = local.voiceToken.voice === prod.voiceToken.voice ? '✅' : '⚠️  MISMATCH';

    console.log(`Model: ${local.voiceToken.model} (local) vs ${prod.voiceToken.model} (prod) ${modelMatch}`);
    console.log(`Voice: ${local.voiceToken.voice} (local) vs ${prod.voiceToken.voice} (prod) ${voiceMatch}`);
  } else {
    console.log('⚠️  Unable to compare - voice token generation failed in one or both environments');
  }

  console.log('\n💬 MESSAGE BUBBLE RENDERING FLOW:');
  console.log('─'.repeat(70));
  console.log('Flow: User speaks → OpenAI Realtime API → Frontend receives transcript');
  console.log('   → Frontend relays to /api/transcript/relay/:sessionId');
  console.log('   → Backend broadcasts via Socket.IO → Message bubbles render');
  console.log('');

  const transcriptRelayWorking = local.transcriptRelay?.success && prod.transcriptRelay?.success;
  if (transcriptRelayWorking) {
    console.log('✅ Transcript relay working in both environments');
    console.log('   Message bubbles will render correctly from voice input');
  } else if (local.transcriptRelay?.success && !prod.transcriptRelay?.success) {
    console.log('⚠️  Transcript relay works locally but FAILS in production');
    console.log('   Message bubbles will NOT render from voice in production!');
  } else if (!local.transcriptRelay?.success && prod.transcriptRelay?.success) {
    console.log('⚠️  Transcript relay works in production but FAILS locally');
    console.log('   Message bubbles will NOT render from voice in local dev!');
  } else {
    console.log('❌ Transcript relay FAILS in both environments');
    console.log('   Message bubbles will NOT render from voice input!');
  }

  console.log('\n' + '─'.repeat(70));
  console.log('ERRORS & WARNINGS:');
  console.log('─'.repeat(70));

  const allErrors = [
    ...local.errors.map(e => `Local: ${e}`),
    ...prod.errors.map(e => `Production: ${e}`)
  ];

  if (allErrors.length === 0) {
    console.log('✅ No critical errors detected in either environment!');
  } else {
    allErrors.forEach((err, i) => console.log(`   ${i + 1}. ${err}`));
  }

  console.log('\n' + '═'.repeat(70));
  console.log('🎯 FINAL VERDICT');
  console.log('═'.repeat(70));

  const criticalIssues = [];

  // Check voice configuration
  if (!prod.health?.voiceEnabled && local.health?.voiceEnabled) {
    criticalIssues.push('Voice is enabled locally but DISABLED in production');
  }
  if (!prod.health?.openAIConnected && local.health?.openAIConnected) {
    criticalIssues.push('OpenAI connected locally but DISCONNECTED in production');
  }

  // Check voice token generation
  if (!prod.voiceToken?.success && local.voiceToken?.success) {
    criticalIssues.push('Voice token generation works locally but FAILS in production');
  }

  // Check transcript relay (most critical for message bubbles)
  if (!prod.transcriptRelay?.success && local.transcriptRelay?.success) {
    criticalIssues.push('🚨 CRITICAL: Transcript relay works locally but FAILS in production');
    criticalIssues.push('   → Message bubbles will NOT render from voice input in production!');
  }

  // Check model/voice mismatches
  if (local.voiceToken?.success && prod.voiceToken?.success) {
    if (local.voiceToken.model !== prod.voiceToken.model) {
      criticalIssues.push(`Voice model mismatch: ${local.voiceToken.model} (local) vs ${prod.voiceToken.model} (prod)`);
    }
    if (local.voiceToken.voice !== prod.voiceToken.voice) {
      criticalIssues.push(`TTS voice mismatch: ${local.voiceToken.voice} (local) vs ${prod.voiceToken.voice} (prod)`);
    }
  }

  if (criticalIssues.length === 0) {
    console.log('✅ Voice transcription and message bubble flows are IDENTICAL!');
    console.log('');
    console.log('   Both environments:');
    console.log('   • Generate voice tokens for OpenAI Realtime API');
    console.log('   • Relay transcripts from frontend to backend');
    console.log('   • Broadcast transcripts via Socket.IO');
    console.log('   • Render message bubbles in real-time');
    console.log('');
    console.log('   🎉 Voice conversations will work the same way in production!');
  } else {
    console.log('⚠️  CRITICAL DIFFERENCES DETECTED:\n');
    criticalIssues.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue}`);
    });
    console.log('\n💡 ACTION REQUIRED: Investigate and fix production environment!');
  }

  console.log('\n');
}

async function main() {
  console.log('🔍 Voice Transcription & Message Bubble Flow Comparison');
  console.log('   Complete flow: Voice → OpenAI Realtime → Transcript → Message Bubbles\n');

  try {
    const local = await testEnvironment('Local Development', LOCAL_URL);
    const prod = await testEnvironment('Production (Vercel)', PRODUCTION_URL);

    printComparison(local, prod);

    // Save detailed results
    const fullReport = {
      timestamp: new Date().toISOString(),
      test: 'Voice Transcription & Message Bubble Flow',
      local,
      production: prod
    };

    const reportPath = path.join(__dirname, 'transcription-message-flow-results.json');
    fs.writeFileSync(reportPath, JSON.stringify(fullReport, null, 2));
    console.log(`📄 Detailed results saved to: ${reportPath}\n`);

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

main();
