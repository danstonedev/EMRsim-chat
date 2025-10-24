#!/usr/bin/env node
/**
 * Voice Flow Environment Comparison Test
 * Compares voice transcription setup between local dev and production
 */

const LOCAL_URL = 'http://localhost:3002';
const PRODUCTION_URL = 'https://backend-rolvpi90w-dan-stones-projects-04854ae1.vercel.app';

async function testEnvironment(name, baseUrl) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 Testing ${name} Environment`);
  console.log(`   URL: ${baseUrl}`);
  console.log(`${'='.repeat(60)}\n`);

  const results = {
    environment: name,
    url: baseUrl,
    health: null,
    sessionCreation: null,
    voiceToken: null,
    voiceInstructions: null,
    errors: []
  };

  // Test 1: Health Check
  console.log('1️⃣  Checking backend health...');
  try {
    const response = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (response.ok) {
      const data = await response.json();
      results.health = data;
      console.log('   ✅ Backend is healthy');
      console.log(`      - Uptime: ${data.uptime_s?.toFixed(0)}s`);
      console.log(`      - Database: ${data.db || 'N/A'}`);
      console.log(`      - OpenAI: ${data.openai || 'N/A'}`);
      console.log(`      - Voice Enabled: ${data.features?.voiceEnabled || false}`);
      console.log(`      - SPS Enabled: ${data.features?.spsEnabled || false}`);

      if (!data.features?.voiceEnabled) {
        console.log('   ⚠️  WARNING: Voice is DISABLED in this environment!');
        results.errors.push('Voice feature is disabled (VOICE_ENABLED=false)');
      }
    } else {
      const text = await response.text().catch(() => 'No response body');
      console.log(`   ❌ Health check failed: ${response.status}`);
      console.log(`      Response: ${text.substring(0, 200)}`);
      results.errors.push(`Health check failed: ${response.status}`);
    }
  } catch (error) {
    console.log(`   ❌ Health check error: ${error.message}`);
    results.errors.push(`Health check error: ${error.message}`);
  }

  // Test 2: Create Session
  console.log('\n2️⃣  Creating test session...');
  let sessionId = null;
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
      results.sessionCreation = { success: true, sessionId };
      console.log(`   ✅ Session created: ${sessionId}`);
      if (data.sps_session_id) {
        console.log(`      - SPS Session: ${data.sps_session_id}`);
      }
      if (data.phase) {
        console.log(`      - Phase: ${data.phase}`);
      }
    } else {
      const text = await response.text().catch(() => 'No response body');
      console.log(`   ⚠️  Session creation failed: ${response.status}`);
      console.log(`      Response: ${text.substring(0, 200)}`);
      console.log(`      Note: Trying stateless voice token (without session)...`);
      results.sessionCreation = { success: false, status: response.status };
      // Don't add to errors - we'll try stateless approach
    }
  } catch (error) {
    console.log(`   ❌ Session creation error: ${error.message}`);
    results.sessionCreation = { success: false, error: error.message };
    results.errors.push(`Session creation error: ${error.message}`);
  }

  // Test 3: Request Voice Token (try with session if available, otherwise stateless)
  console.log('\n3️⃣  Requesting voice token...');
  try {
    const tokenBody = sessionId
      ? {
          session_id: sessionId,
          voice: 'cedar',
          input_language: 'en',
          model: 'gpt-realtime-mini-2025-10-06',
          transcription_model: 'gpt-4o-mini-transcribe'
        }
      : {
          session_id: 'test-stateless-session',
          voice: 'cedar',
          input_language: 'en',
          model: 'gpt-realtime-mini-2025-10-06',
          transcription_model: 'gpt-4o-mini-transcribe',
          persona_id: 'alloy-jordan-patel',
          scenario_id: 'lowbackpain'
        };

    const response = await fetch(`${baseUrl}/api/voice/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tokenBody)
    });

    if (response.ok) {
      const data = await response.json();
      results.voiceToken = {
        success: true,
        model: data.model,
        voice: data.tts_voice,
        hasToken: !!data.rtc_token,
        tokenLength: data.rtc_token?.length || 0
      };
      console.log('   ✅ Voice token obtained');
      console.log(`      - Model: ${data.model}`);
      console.log(`      - Voice: ${data.tts_voice}`);
      console.log(`      - Token Length: ${data.rtc_token?.length || 0} chars`);
      if (data.persona) {
        console.log(`      - Persona: ${data.persona.display_name || data.persona.id}`);
      }
      if (data.opts?.expires_at) {
        console.log(`      - Expires: ${data.opts.expires_at}`);
      }
    } else {
      const text = await response.text().catch(() => 'No response body');
      console.log(`   ❌ Voice token failed: ${response.status}`);
      console.log(`      Response: ${text.substring(0, 200)}`);
      results.voiceToken = { success: false, status: response.status, error: text };
      results.errors.push(`Voice token failed: ${response.status} - ${text.substring(0, 100)}`);
    }
  } catch (error) {
    console.log(`   ❌ Voice token error: ${error.message}`);
    results.voiceToken = { success: false, error: error.message };
    results.errors.push(`Voice token error: ${error.message}`);
  }

  // Test 4: Get Voice Instructions (only if we have a real session)
  if (sessionId) {
    console.log('\n4️⃣  Getting voice instructions...');
    try {
      const response = await fetch(`${baseUrl}/api/voice/instructions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId
        })
      });

      if (response.ok) {
        const data = await response.json();
        results.voiceInstructions = {
          success: true,
          hasInstructions: !!data.instructions,
          instructionsLength: data.instructions?.length || 0,
          phase: data.phase,
          outstandingGate: data.outstanding_gate
        };
        console.log('   ✅ Voice instructions obtained');
        console.log(`      - Instructions Length: ${data.instructions?.length || 0} chars`);
        console.log(`      - Phase: ${data.phase || 'N/A'}`);
        if (data.outstanding_gate && data.outstanding_gate.length > 0) {
          console.log(`      - Outstanding Gates: ${data.outstanding_gate.join(', ')}`);
        }
        // Show first 200 chars of instructions
        if (data.instructions) {
          const preview = data.instructions.substring(0, 150).replace(/\n/g, ' ');
          console.log(`      - Preview: ${preview}...`);
        }
      } else {
        const text = await response.text().catch(() => 'No response body');
        console.log(`   ❌ Voice instructions failed: ${response.status}`);
        console.log(`      Response: ${text.substring(0, 200)}`);
        results.voiceInstructions = { success: false, status: response.status, error: text };
        results.errors.push(`Voice instructions failed: ${response.status}`);
      }
    } catch (error) {
      console.log(`   ❌ Voice instructions error: ${error.message}`);
      results.voiceInstructions = { success: false, error: error.message };
      results.errors.push(`Voice instructions error: ${error.message}`);
    }
  } else {
    console.log('\n4️⃣  ⏭️  Skipping voice instructions (no valid session)');
  }

  return results;
}

function printComparison(localResults, prodResults) {
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 COMPARISON SUMMARY');
  console.log(`${'='.repeat(60)}\n`);

  const features = [
    { name: 'Backend Health', local: localResults.health?.ok, prod: prodResults.health?.ok },
    { name: 'Voice Enabled', local: localResults.health?.features?.voiceEnabled, prod: prodResults.health?.features?.voiceEnabled },
    { name: 'Session Creation', local: localResults.sessionCreation?.success, prod: prodResults.sessionCreation?.success },
    { name: 'Voice Token', local: localResults.voiceToken?.success, prod: prodResults.voiceToken?.success },
    { name: 'Voice Instructions', local: localResults.voiceInstructions?.success, prod: prodResults.voiceInstructions?.success }
  ];

  console.log('Feature Comparison:');
  console.log('─'.repeat(60));
  console.log('Feature'.padEnd(25) + 'Local Dev'.padEnd(15) + 'Production');
  console.log('─'.repeat(60));

  for (const feature of features) {
    const localStatus = feature.local === true ? '✅ Yes' : feature.local === false ? '❌ No' : '⚠️  N/A';
    const prodStatus = feature.prod === true ? '✅ Yes' : feature.prod === false ? '❌ No' : '⚠️  N/A';
    const match = feature.local === feature.prod ? '' : ' ⚠️  MISMATCH';
    console.log(`${feature.name.padEnd(25)}${localStatus.padEnd(15)}${prodStatus}${match}`);
  }

  console.log('\n' + '─'.repeat(60));
  console.log('Configuration Details:');
  console.log('─'.repeat(60));

  if (localResults.voiceToken?.model && prodResults.voiceToken?.model) {
    const modelMatch = localResults.voiceToken.model === prodResults.voiceToken.model;
    console.log(`Model: ${localResults.voiceToken.model} (local) vs ${prodResults.voiceToken.model} (prod) ${modelMatch ? '✅' : '⚠️  DIFFERENT'}`);
  }

  if (localResults.voiceToken?.voice && prodResults.voiceToken?.voice) {
    const voiceMatch = localResults.voiceToken.voice === prodResults.voiceToken.voice;
    console.log(`Voice: ${localResults.voiceToken.voice} (local) vs ${prodResults.voiceToken.voice} (prod) ${voiceMatch ? '✅' : '⚠️  DIFFERENT'}`);
  }

  console.log('\n' + '─'.repeat(60));
  console.log('Errors & Warnings:');
  console.log('─'.repeat(60));

  if (localResults.errors.length === 0 && prodResults.errors.length === 0) {
    console.log('✅ No errors detected in either environment!');
  } else {
    if (localResults.errors.length > 0) {
      console.log('\n🔴 Local Development Errors:');
      localResults.errors.forEach((err, i) => console.log(`   ${i + 1}. ${err}`));
    }
    if (prodResults.errors.length > 0) {
      console.log('\n🔴 Production Errors:');
      prodResults.errors.forEach((err, i) => console.log(`   ${i + 1}. ${err}`));
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('🎯 VERDICT');
  console.log('═'.repeat(60));

  const criticalIssues = [];

  if (!prodResults.health?.ok) {
    criticalIssues.push('Production backend is not healthy');
  }
  if (!prodResults.health?.features?.voiceEnabled) {
    criticalIssues.push('Voice is DISABLED in production (VOICE_ENABLED=false)');
  }
  if (localResults.health?.features?.voiceEnabled && !prodResults.health?.features?.voiceEnabled) {
    criticalIssues.push('Voice works in local but NOT in production');
  }
  if (localResults.voiceToken?.success && !prodResults.voiceToken?.success) {
    criticalIssues.push('Voice token works locally but fails in production');
  }

  if (criticalIssues.length === 0) {
    console.log('✅ Both environments are configured similarly for voice!');
    console.log('   Voice transcription flow should work the same in both.');
  } else {
    console.log('⚠️  CRITICAL DIFFERENCES DETECTED:\n');
    criticalIssues.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue}`);
    });
    console.log('\n💡 ACTION REQUIRED: Fix production environment configuration.');
  }

  console.log('\n');
}

async function main() {
  console.log('🎙️  Voice Flow Environment Comparison Test');
  console.log('   Testing voice transcription setup between environments\n');

  try {
    // Test local first
    const localResults = await testEnvironment('Local Development', LOCAL_URL);

    // Test production
    const prodResults = await testEnvironment('Production', PRODUCTION_URL);

    // Print comparison
    printComparison(localResults, prodResults);

    // Save detailed results to file
    const fullReport = {
      timestamp: new Date().toISOString(),
      local: localResults,
      production: prodResults
    };

    const fs = await import('fs');
    const path = await import('path');
    const reportPath = path.join(process.cwd(), 'scripts', 'voice-flow-test-results.json');
    fs.writeFileSync(reportPath, JSON.stringify(fullReport, null, 2));
    console.log(`📄 Detailed results saved to: ${reportPath}\n`);

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

main();
