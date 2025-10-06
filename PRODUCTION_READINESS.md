# Production Readiness Improvements

This document outlines recommended improvements for production deployment of the EMRsim application.

## 1. Redis Migration for Horizontal Scalability

### Current State
The backend uses an **in-memory Map** for storing RTC tokens in `backend/src/routes/voice.ts`:

```typescript
const rtcTokenStore = new Map<string, string>();
```

### Problem
- Tokens are lost on server restart
- Multiple backend instances don't share token state
- No failover capability

### Solution: Migrate to Redis

#### Step 1: Add Redis Client
Create `backend/src/services/redisClient.ts`:

```typescript
import { createClient } from 'redis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisClient = createClient({
  url: redisUrl,
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 1000),
  },
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.on('connect', () => console.log('Redis Client Connected'));

export async function connectRedis() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
}

export async function disconnectRedis() {
  if (redisClient.isOpen) {
    await redisClient.disconnect();
  }
}
```

#### Step 2: Update Voice Route
In `backend/src/routes/voice.ts`, replace:

```typescript
// OLD: In-memory store
rtcTokenStore.set(sessionId, ephemeralKey);

// NEW: Redis with 60-second TTL
await redisClient.setEx(`rtc:token:${sessionId}`, 60, ephemeralKey);
```

And for retrieval:

```typescript
// OLD
const storedToken = rtcTokenStore.get(sessionId);

// NEW
const storedToken = await redisClient.get(`rtc:token:${sessionId}`);
```

#### Step 3: Update Environment
Add to `backend/.env.example`:

```bash
# Redis connection (for production scalability)
REDIS_URL=redis://localhost:6379
```

#### Step 4: Install Dependency
```bash
npm install --save redis
npm install --save-dev @types/node
```

#### Step 5: Connect on Startup
In `backend/src/index.ts`:

```typescript
import { connectRedis, disconnectRedis } from './services/redisClient.ts';

// Before server.listen()
if (process.env.REDIS_URL) {
  await connectRedis();
}

// In graceful shutdown
process.on('SIGTERM', async () => {
  await disconnectRedis();
  server.close();
});
```

### Benefits
- ✅ Horizontal scaling with multiple backend replicas
- ✅ Tokens persist across restarts
- ✅ Automatic expiration with TTL
- ✅ Centralized session state

---

## 2. Contract Tests (API Schema Validation)

### Goal
Validate that API responses match OpenAPI/Swagger schema definitions.

### Implementation
Add `backend/tests/contract.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.ts';
import { swaggerSpec } from '../src/config/swagger.ts';

describe('Contract Tests', () => {
  let app;
  
  beforeAll(() => {
    app = createApp();
  });

  it('GET /health matches schema', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('timestamp');
    // Validate against Swagger schema
    const healthSchema = swaggerSpec.paths['/health'].get.responses['200'];
    // Add schema validator (e.g., ajv)
  });

  it('POST /sessions matches schema', async () => {
    const res = await request(app)
      .post('/sessions')
      .send({ persona_id: 'test', mode: 'sps' });
    
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('persona_id');
  });
});
```

### Tools
- **ajv**: JSON schema validator
- **openapi-validator-middleware**: Validates req/res against OpenAPI spec

---

## 3. Soak Tests (Long-Running Stability)

### Goal
Verify the application handles long-duration voice sessions without memory leaks or degradation.

### Implementation
Add `backend/tests/soak.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.ts';

describe('Soak Test - 15 Minute Voice Session', () => {
  let app;
  let sessionId;
  const testDuration = 15 * 60 * 1000; // 15 minutes
  
  beforeAll(async () => {
    app = createApp();
    
    // Create session
    const res = await request(app)
      .post('/sessions')
      .send({ persona_id: 'test_persona', mode: 'sps' });
    
    sessionId = res.body.id;
  });

  it('handles continuous transcript relay without memory leak', async () => {
    const startMemory = process.memoryUsage().heapUsed;
    const startTime = Date.now();
    let requestCount = 0;
    
    // Send transcript every 2 seconds for 15 minutes
    const interval = setInterval(async () => {
      await request(app)
        .post(`/voice/transcript/relay/${sessionId}`)
        .send({
          session_id: sessionId,
          role: 'user',
          text: `Test transcript ${requestCount}`,
          is_final: true,
          timestamp: Date.now(),
        });
      
      requestCount++;
      
      if (Date.now() - startTime >= testDuration) {
        clearInterval(interval);
      }
    }, 2000);
    
    // Wait for test duration
    await new Promise(resolve => setTimeout(resolve, testDuration));
    
    const endMemory = process.memoryUsage().heapUsed;
    const memoryGrowth = (endMemory - startMemory) / 1024 / 1024; // MB
    
    console.log(`Soak test: ${requestCount} requests, memory growth: ${memoryGrowth.toFixed(2)} MB`);
    
    // Assert memory growth is reasonable (< 100 MB for 15 min)
    expect(memoryGrowth).toBeLessThan(100);
  }, testDuration + 5000); // Add 5s buffer
});
```

### Run Soak Tests
```bash
npm run test:soak
```

Add to `package.json`:
```json
{
  "scripts": {
    "test:soak": "vitest run tests/soak.test.ts --testTimeout=1000000"
  }
}
```

---

## 4. Additional Production Recommendations

### Logging
- Replace `console.log` with structured logging (pino, winston)
- Add correlation IDs for request tracing
- Ship logs to centralized service (CloudWatch, DataDog)

### Monitoring
- Add Prometheus metrics (already scaffolded in `/metrics`)
- Set up alerts for:
  - Response time > 500ms
  - Error rate > 1%
  - Memory usage > 80%

### Database
- Migrate from SQLite to PostgreSQL for production
- Add connection pooling
- Implement database backups

### CI/CD Enhancements
- Add security scanning (npm audit, Snyk)
- Run soak tests in staging environment
- Blue-green or canary deployments

---

## Implementation Priority

| Task | Impact | Effort | Priority |
|------|--------|--------|----------|
| Redis migration | High | Medium | 1 |
| Contract tests | Medium | Low | 2 |
| Soak tests | Medium | Medium | 3 |
| Structured logging | High | Low | 4 |
| PostgreSQL migration | High | High | 5 |

---

## Getting Started

To implement Redis migration:

```bash
# 1. Install dependencies
cd backend
npm install --save redis

# 2. Add redisClient.ts (see above)

# 3. Update voice.ts to use Redis

# 4. Test locally with Redis
docker run -d -p 6379:6379 redis:alpine

# 5. Set REDIS_URL in .env
echo "REDIS_URL=redis://localhost:6379" >> .env
```
