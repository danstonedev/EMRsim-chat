/**
 * Load Testing Script for EMRsim-chat
 * 
 * This script performs load testing to verify that the application
 * can handle expected user load and scale horizontally.
 * 
 * Uses k6 (https://k6.io/) for load testing.
 */

import http from 'k6/http';
import { sleep, check } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import ws from 'k6/ws';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const websocketErrors = new Counter('websocket_errors');
const messageRate = new Rate('message_rate');
const messageLatency = new Trend('message_latency');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'https://emrsim-chat-staging.azurewebsites.net';
const WS_URL = __ENV.WS_URL || BASE_URL.replace('https://', 'wss://') + '/ws';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-token'; // Replace with actual auth token acquisition

// Test scenarios
export const options = {
  scenarios: {
    // Simulate normal usage
    normal_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },  // Ramp up to 50 users over 1 minute
        { duration: '3m', target: 50 },  // Stay at 50 users for 3 minutes
        { duration: '1m', target: 0 },   // Ramp down to 0 users over 1 minute
      ],
      gracefulRampDown: '30s',
    },
    
    // Simulate peak usage (many users connecting at once)
    peak_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 200 }, // Quickly ramp up to 200 users
        { duration: '2m', target: 200 },  // Maintain 200 users for 2 minutes
        { duration: '30s', target: 0 },   // Quickly ramp down
      ],
      gracefulRampDown: '30s',
      startTime: '6m', // Start after normal_load scenario completes
    },
    
    // Test WebSocket capabilities under sustained load
    websocket_load: {
      executor: 'constant-vus',
      vus: 50,
      duration: '3m',
      startTime: '10m', // Start after peak_load scenario completes
    },
    
    // Stress test to find breaking points
    stress_test: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '3m', target: 400 },  // Ramp up to 400 users over 3 minutes
        { duration: '2m', target: 400 },  // Stay at 400 users for 2 minutes
        { duration: '1m', target: 0 },    // Ramp down to 0 users over 1 minute
      ],
      gracefulRampDown: '30s',
      startTime: '14m', // Start after websocket_load scenario completes
    }
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests should complete in less than 2s
    http_req_failed: ['rate<0.05'],    // Less than 5% of requests should fail
    'message_rate': ['rate>0.9'],      // 90% of WebSocket messages should succeed
    'message_latency': ['p(95)<500'],  // 95% of WebSocket messages should have latency under 500ms
  },
};

// Setup function that runs before the test
export function setup() {
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: 'test@example.com',
    password: 'password123'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
  
  check(loginRes, {
    'Login successful': (r) => r.status === 200
  });
  
  return {
    token: loginRes.json('token'),
    userId: loginRes.json('userId')
  };
}

// Default function that represents a typical user
export default function(data) {
  // Common headers
  const headers = {
    'Authorization': `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  };
  
  // 1. Visit the home page
  let res = http.get(`${BASE_URL}/`, { headers });
  check(res, {
    'Homepage loaded': (r) => r.status === 200
  });
  sleep(2);
  
  // 2. Load available simulations
  res = http.get(`${BASE_URL}/api/simulations`, { headers });
  check(res, {
    'Simulations loaded': (r) => r.status === 200,
    'Has simulations': (r) => r.json('length') > 0
  });
  
  // Pick a random simulation from the response
  const simulations = res.json();
  if (simulations.length === 0) {
    console.log('No simulations available');
    return;
  }
  
  const simulation = simulations[Math.floor(Math.random() * simulations.length)];
  sleep(1);
  
  // 3. Start a simulation
  res = http.post(`${BASE_URL}/api/simulations/${simulation.id}/start`, {}, { headers });
  check(res, {
    'Simulation started': (r) => r.status === 200
  });
  sleep(1);
  
  // 4. Get patient data
  res = http.get(`${BASE_URL}/api/patients/${simulation.patientId}`, { headers });
  check(res, {
    'Patient data loaded': (r) => r.status === 200
  });
  sleep(2);
  
  // 5. Create a conversation
  const conversationId = randomString(10);
  res = http.post(`${BASE_URL}/api/conversations`, JSON.stringify({
    simulationId: simulation.id,
    patientId: simulation.patientId,
    title: 'Test Conversation'
  }), { headers });
  
  check(res, {
    'Conversation created': (r) => r.status === 201
  });
  
  // Extract conversation ID from response
  const conversation = res.json();
  sleep(1);
  
  // 6. Connect to WebSocket for real-time chat
  const wsParams = {
    headers: {
      'Authorization': `Bearer ${data.token}`
    }
  };
  
  // WebSocket connection simulation
  const wsRes = ws.connect(`${WS_URL}?userId=${data.userId}&conversationId=${conversation.id}`, wsParams, function(socket) {
    socket.on('open', () => {
      // Send a message every second for 10 seconds
      let count = 0;
      const interval = setInterval(() => {
        if (count >= 5) {
          clearInterval(interval);
          socket.close();
          return;
        }
        
        const msgId = randomString(8);
        const timestamp = new Date().getTime();
        
        socket.send(JSON.stringify({
          type: 'chat',
          msgId: msgId,
          payload: {
            text: `Test message ${count + 1}`,
            timestamp: timestamp
          }
        }));
        
        count++;
      }, 2000);
      
      // Handle incoming messages
      socket.on('message', (data) => {
        const msg = JSON.parse(data);
        messageRate.add(1);
        
        if (msg.msgId) {
          // Calculate latency for response to our message
          const now = new Date().getTime();
          const msgTimestamp = msg.timestamp;
          const latency = now - msgTimestamp;
          messageLatency.add(latency);
        }
      });
      
      // Handle errors
      socket.on('error', () => {
        websocketErrors.add(1);
      });
      
      socket.on('close', () => {
        // Connection closed
      });
    });
  });
  
  check(wsRes, {
    'WebSocket connection successful': (r) => r.status === 101
  });
  
  // 7. Send some API requests while WebSocket is active
  res = http.get(`${BASE_URL}/api/conversations/${conversation.id}/messages`, { headers });
  check(res, {
    'Messages loaded': (r) => r.status === 200
  });
  
  sleep(12); // Wait for WebSocket interaction to complete
  
  // 8. Complete the simulation
  res = http.post(`${BASE_URL}/api/simulations/${simulation.id}/complete`, JSON.stringify({
    score: Math.floor(Math.random() * 100)
  }), { headers });
  
  check(res, {
    'Simulation completed': (r) => r.status === 200
  });
  
  sleep(2);
}

// Function for WebSocket-focused scenario
export function websocketScenario(data) {
  // Connect many users to WebSocket and have them communicate
  const wsParams = {
    headers: {
      'Authorization': `Bearer ${data.token}`
    }
  };
  
  // Create a new conversation for this test
  const res = http.post(`${BASE_URL}/api/conversations`, JSON.stringify({
    simulationId: 'stress-test',
    patientId: 'stress-test-patient',
    title: 'WebSocket Stress Test'
  }), { 
    headers: {
      'Authorization': `Bearer ${data.token}`,
      'Content-Type': 'application/json',
    }
  });
  
  const conversation = res.json();
  
  // Connect to WebSocket
  ws.connect(`${WS_URL}?userId=${data.userId}&conversationId=${conversation.id}`, wsParams, function(socket) {
    socket.on('open', () => {
      // Send messages rapidly
      let count = 0;
      const interval = setInterval(() => {
        if (count >= 20) {
          clearInterval(interval);
          socket.close();
          return;
        }
        
        socket.send(JSON.stringify({
          type: 'chat',
          msgId: randomString(8),
          payload: {
            text: `Stress test message ${count}`,
            timestamp: new Date().getTime()
          }
        }));
        
        count++;
      }, 500);
      
      socket.on('message', (data) => {
        // Process incoming messages
        messageRate.add(1);
      });
      
      socket.on('error', () => {
        websocketErrors.add(1);
      });
    });
  });
  
  sleep(15);
}

// Function for the stress test scenario
export function stressTest(data) {
  // Mix of API calls and WebSocket connections to stress the system
  
  // Make multiple concurrent API calls
  const requests = [
    { url: `${BASE_URL}/api/simulations` },
    { url: `${BASE_URL}/api/patients` },
    { url: `${BASE_URL}/api/users/me` },
    { url: `${BASE_URL}/api/conversations` }
  ];
  
  const responses = http.batch(requests.map(req => ({
    ...req,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${data.token}`,
      'Content-Type': 'application/json',
    }
  })));
  
  // Check batch responses
  check(responses[0], {
    'Simulations API works under load': (r) => r.status === 200
  });
  
  // Create a new conversation and immediately start messaging
  const res = http.post(`${BASE_URL}/api/conversations`, JSON.stringify({
    simulationId: 'stress-test',
    patientId: 'stress-test-patient',
    title: 'Stress Test ' + randomString(5)
  }), { 
    headers: {
      'Authorization': `Bearer ${data.token}`,
      'Content-Type': 'application/json',
    }
  });
  
  if (res.status === 201) {
    const conversation = res.json();
    
    // Connect to WebSocket
    ws.connect(`${WS_URL}?userId=${data.userId}&conversationId=${conversation.id}`, {
      headers: {
        'Authorization': `Bearer ${data.token}`
      }
    }, function(socket) {
      socket.on('open', () => {
        // Send a burst of messages
        for (let i = 0; i < 5; i++) {
          socket.send(JSON.stringify({
            type: 'chat',
            msgId: randomString(8),
            payload: {
              text: `Burst message ${i}`,
              timestamp: new Date().getTime()
            }
          }));
          
          // Small sleep between messages
          sleep(0.2);
        }
        
        socket.close();
      });
    });
  }
  
  sleep(Math.random() * 3 + 2); // Random sleep between 2-5 seconds
}
