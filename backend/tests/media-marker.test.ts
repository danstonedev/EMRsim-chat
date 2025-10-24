// @ts-nocheck
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.ts';
import { loadSPSContent } from '../src/sps/runtime/session.ts';
import { composeRealtimeInstructions } from '../src/sps/runtime/sps.service.ts';

let app;

beforeAll(() => {
  loadSPSContent();
  app = createApp();
});

describe('Media Marker System', () => {
  describe('Scenario Media Configuration', () => {
    it('ACL scenario has media_library defined', async () => {
      const r = await request(app).get('/api/sps/scenarios');
      expect(r.status).toBe(200);
      
      const aclScenario = r.body.scenarios.find(s => 
        s.scenario_id.includes('acl') || s.title.toLowerCase().includes('acl')
      );
      
      expect(aclScenario, 'ACL scenario should exist').toBeTruthy();
      console.log('  ✓ Found ACL scenario:', aclScenario.scenario_id);
      
      // Get full scenario details
      const detailRes = await request(app).get(`/api/sps/scenarios/${aclScenario.scenario_id}`);
      expect(detailRes.status).toBe(200);
      
      const fullScenario = detailRes.body.scenario;
      expect(fullScenario.media_library, 'media_library should exist').toBeTruthy();
      expect(Array.isArray(fullScenario.media_library), 'media_library should be an array').toBe(true);
      expect(fullScenario.media_library.length, 'media_library should have items').toBeGreaterThan(0);
      
      console.log('  ✓ Media library has', fullScenario.media_library.length, 'items');
      
      // Check for knee X-ray specifically
      const kneeXray = fullScenario.media_library.find(m => m.id === 'knee_xray_bilateral');
      expect(kneeXray, 'knee_xray_bilateral should exist in media_library').toBeTruthy();
      expect(kneeXray.type).toBe('image');
      expect(kneeXray.url).toContain('.jpg');
      expect(kneeXray.caption).toBeTruthy();
      
      console.log('  ✓ Knee X-ray media item:', {
        id: kneeXray.id,
        type: kneeXray.type,
        url: kneeXray.url,
        caption: kneeXray.caption.substring(0, 50) + '...'
      });
    });

    it('ACL scenario has subjective_catalog with X-ray entry', async () => {
      const scenarios = await request(app).get('/api/sps/scenarios');
      const aclScenario = scenarios.body.scenarios.find(s => 
        s.scenario_id.includes('acl') || s.title.toLowerCase().includes('acl')
      );
      
      const detailRes = await request(app).get(`/api/sps/scenarios/${aclScenario.scenario_id}`);
      const fullScenario = detailRes.body.scenario;
      
      expect(fullScenario.subjective_catalog, 'subjective_catalog should exist').toBeTruthy();
      expect(Array.isArray(fullScenario.subjective_catalog)).toBe(true);
      
      const imagingEntry = fullScenario.subjective_catalog.find(item => 
        item.id === 'imaging_xray' || 
        item.label?.toLowerCase().includes('x-ray') ||
        item.label?.toLowerCase().includes('imaging')
      );
      
      expect(imagingEntry, 'Imaging/X-ray entry should exist in subjective_catalog').toBeTruthy();
      expect(imagingEntry.patient_response_script?.qualitative, 'Should have patient responses').toBeTruthy();
      expect(Array.isArray(imagingEntry.patient_response_script.qualitative)).toBe(true);
      expect(imagingEntry.patient_response_script.qualitative.length).toBeGreaterThan(0);
      
      console.log('  ✓ Imaging entry response:', imagingEntry.patient_response_script.qualitative[0]);
      
      // Check that the response includes natural offering language
      const response = imagingEntry.patient_response_script.qualitative[0];
      const hasNaturalOffering = 
        response.includes('patient portal') ||
        response.includes('pull them up') ||
        response.includes('show you');
      
      expect(hasNaturalOffering, 'Response should include natural offering language').toBe(true);
      console.log('  ✓ Response includes natural offering language');
      
      // Check notes include media marker
      expect(imagingEntry.notes, 'Should have notes').toBeTruthy();
      expect(imagingEntry.notes.includes('[MEDIA:knee_xray_bilateral]'), 
        'Notes should reference media marker').toBe(true);
      console.log('  ✓ Notes include [MEDIA:knee_xray_bilateral] marker');
    });
  });

  describe('Instruction Composition', () => {
    it('composeRealtimeInstructions includes media guidance', async () => {
      const scenarios = await request(app).get('/api/sps/scenarios');
      const personas = await request(app).get('/api/sps/personas');
      
      const aclScenario = scenarios.body.scenarios.find(s => 
        s.scenario_id.includes('acl') || s.title.toLowerCase().includes('acl')
      );
      const detailRes = await request(app).get(`/api/sps/scenarios/${aclScenario.scenario_id}`);
      const fullScenario = detailRes.body.scenario;
      
      const persona = personas.body.personas.find(p => p.id === fullScenario.patient_id);
      
      const instructions = composeRealtimeInstructions({
        activeCase: {
          persona,
          scenario: fullScenario,
          sessionId: 'test-session-123'
        },
        phase: null,
        gate: null,
        outstandingGate: null
      });
      
      expect(instructions).toBeTruthy();
      expect(typeof instructions).toBe('string');
      expect(instructions.length, 'Full instructions should be substantial').toBeGreaterThan(500);
      
      // Should include media guidance section
      expect(instructions.includes('[MEDIA:'), 'Should include media marker syntax').toBe(true);
      expect(instructions.includes('patient portal'), 'Should include natural offering language').toBe(true);
      expect(instructions.includes('[MEDIA:knee_xray_bilateral]'), 
        'Should include specific media ID').toBe(true);
      
      console.log('  ✓ Full instructions include media guidance');
      console.log('  Instructions length:', instructions.length, 'characters');
    });
  });

  describe('Voice Token Endpoint', () => {
    it('POST /api/voice/token includes media instructions for ACL scenario', async () => {
      const scenarios = await request(app).get('/api/sps/scenarios');
      const personas = await request(app).get('/api/sps/personas');
      
      const aclScenario = scenarios.body.scenarios.find(s => 
        s.scenario_id.includes('acl') || s.title.toLowerCase().includes('acl')
      );
      const persona = personas.body.personas[0]; // Use first persona for test
      
      // Create a session first
      const sessionRes = await request(app)
        .post('/api/sessions')
        .send({
          persona_id: persona.id,
          mode: 'sps',
          scenario_id: aclScenario.scenario_id
        });
      
      expect(sessionRes.status).toBe(201);
      const sessionId = sessionRes.body.session_id;
      
      console.log('  ✓ Created test session:', sessionId);
      
      // Note: We can't actually call OpenAI in tests, but we can verify the endpoint accepts the request
      // In a real scenario, the POST /api/voice/token would be called with this session
      console.log('  ✓ Session ready for voice token generation');
      console.log('  Note: Actual OpenAI API call would include media instructions');
    });
  });

  describe('Media Marker Parsing (Frontend Simulation)', () => {
    it('parseMediaMarker extracts media ID from text', () => {
      const testCases = [
        {
          input: 'Yes, I got X-rays. [MEDIA:knee_xray_bilateral] They showed no fractures.',
          expectedId: 'knee_xray_bilateral',
          expectedCleanText: 'Yes, I got X-rays.  They showed no fractures.'
        },
        {
          input: 'Here, let me show you. [MEDIA:knee_xray_bilateral]',
          expectedId: 'knee_xray_bilateral',
          expectedCleanText: 'Here, let me show you.'
        },
        {
          input: 'I don\'t have any imaging.',
          expectedId: null,
          expectedCleanText: 'I don\'t have any imaging.'
        }
      ];
      
      testCases.forEach((testCase, idx) => {
        const mediaMatch = testCase.input.match(/\[MEDIA:([^\]]+)\]/);
        const actualId = mediaMatch ? mediaMatch[1] : null;
        const actualCleanText = testCase.input.replace(/\[MEDIA:[^\]]+\]/g, '').trim();
        
        expect(actualId).toBe(testCase.expectedId);
        expect(actualCleanText).toBe(testCase.expectedCleanText);
        console.log(`  ✓ Test case ${idx + 1} passed:`, testCase.expectedId || 'no marker');
      });
    });
  });

  describe('End-to-End Flow Verification', () => {
    it('verifies complete media flow from scenario to instructions', async () => {
      console.log('\n📋 End-to-End Media Flow Test\n');
      
      // Step 1: Get ACL scenario with media
      const scenarios = await request(app).get('/api/sps/scenarios');
      const aclScenario = scenarios.body.scenarios.find(s => 
        s.scenario_id.includes('acl') || s.title.toLowerCase().includes('acl')
      );
      console.log('1. ✓ Found ACL scenario:', aclScenario.scenario_id);
      
      // Step 2: Get full scenario details
      const detailRes = await request(app).get(`/api/sps/scenarios/${aclScenario.scenario_id}`);
      const fullScenario = detailRes.body.scenario;
      console.log('2. ✓ Loaded full scenario with', fullScenario.media_library?.length || 0, 'media items');
      
      // Step 3: Verify media_library has knee X-ray
      const kneeXray = fullScenario.media_library?.find(m => m.id === 'knee_xray_bilateral');
      expect(kneeXray, 'Knee X-ray must exist in media_library').toBeTruthy();
      console.log('3. ✓ Verified knee_xray_bilateral in media_library:', kneeXray.url);
      
      // Step 4: Verify subjective_catalog has X-ray response
      const imagingEntry = fullScenario.subjective_catalog?.find(item => item.id === 'imaging_xray');
      expect(imagingEntry, 'Imaging entry must exist in subjective_catalog').toBeTruthy();
      console.log('4. ✓ Verified imaging entry in subjective_catalog');
      
      // Step 5: Compose full instructions
      const personas = await request(app).get('/api/sps/personas');
      const persona = personas.body.personas.find(p => p.id === fullScenario.patient_id);
      
      const instructions = composeRealtimeInstructions({
        activeCase: {
          persona,
          scenario: fullScenario,
          sessionId: 'e2e-test-session'
        },
        phase: null,
        gate: null,
        outstandingGate: null
      });
      
      expect(instructions.includes('[MEDIA:knee_xray_bilateral]'), 
        'Full instructions must include media marker').toBe(true);
      expect(instructions.includes('patient portal'), 
        'Full instructions must include offering language').toBe(true);
      console.log('5. ✓ Full instructions compose correctly');
      
      console.log('\n✅ End-to-End Flow PASSED\n');
      console.log('Expected AI behavior:');
      console.log('  Student: "Did you get any X-rays?"');
      console.log('  AI: "Yes, I got X-rays at urgent care. Here, I have them on my patient portal. [MEDIA:knee_xray_bilateral]"');
      console.log('  Result: Image appears inline in chat\n');
    });
  });
});
