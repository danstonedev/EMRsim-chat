# EMRsim-chat Modernization Audit

**Date**: October 2, 2025  
**Project**: UND Simulated-Patient Chatbot  
**Version**: 0.1.0

## Executive Summary

This audit identifies modernization opportunities across the codebase to improve maintainability, developer experience, type safety, security, and deployment readiness.

**Priority Levels**:
- 🔴 **HIGH**: Significant impact on maintainability/security
- 🟡 **MEDIUM**: Moderate impact on developer experience
- 🟢 **LOW**: Nice-to-have improvements

---

## 1. Backend Architecture

### 🔴 HIGH: Mixed JavaScript/TypeScript Architecture

**Current State**:
- Backend uses both `.js` (routes, controllers, services) and `.ts` (SPS engine) files
- Creates maintenance confusion and reduces type safety benefits
- Multiple `require()` statements mixed with ESM imports in routes/sps.js

**Issues**:
```javascript
// backend/src/routes/sps.js - Lines 118-119
const fs = require('fs');
const path = require('path');
```
- Mixing CommonJS `require()` with ESM module system (package.json has `"type": "module"`)
- No type checking on JavaScript files
- Inconsistent module patterns across codebase

**Recommendation**:
1. **Migrate all `.js` files to `.ts`** (priority: routes → controllers → services)
2. Replace inline `require()` with top-level ESM imports
3. Add proper type definitions for Express handlers
4. Enable strict mode across entire backend

**Estimated Effort**: 2-3 days  
**Benefits**: 
- Full type safety across backend
- Better IDE support and autocomplete
- Catch errors at compile time
- Consistent module system

---

### 🟡 MEDIUM: Missing Express Type Definitions

**Current State**:
- Backend has `@types/node` but no `@types/express`
- Express handlers lack type safety
- Parameters, requests, and responses are untyped

**Recommendation**:
```bash
cd backend
npm install --save-dev @types/express @types/cors
```

**Benefits**: Type-safe Express middleware and route handlers

---

### 🟡 MEDIUM: Lazy-loaded File Operations

**Current State**:
```javascript
// 7 separate endpoints in sps.js all do this:
router.get('/catalogs/tests/special', (_req, res) => {
  const fs = require('fs');  // Repeated in every handler
  const path = require('path');
  const catalogPath = path.join(__dirname, '../sps/data/catalogs/...');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  // ...
});
```

**Issues**:
- Synchronous file reads in request handlers block the event loop
- Repeated require() statements (should be at module level)
- No caching—files read on every request
- Error handling is minimal

**Recommendation**:
1. Load catalog files at startup and cache in memory
2. Or use a catalog loader service with lazy initialization
3. Use async file operations if dynamic loading needed
4. Add proper error handling and validation

**Example**:
```typescript
// backend/src/services/catalogLoader.ts
import { readFile } from 'fs/promises';
import path from 'path';

class CatalogService {
  private cache = new Map<string, any>();
  
  async loadCatalog(name: string) {
    if (this.cache.has(name)) return this.cache.get(name);
    
    const data = await readFile(
      path.join(__dirname, `../sps/data/catalogs/${name}`), 
      'utf8'
    );
    const catalog = JSON.parse(data);
    this.cache.set(name, catalog);
    return catalog;
  }
}

export const catalogService = new CatalogService();
```

---

## 2. Code Quality & Tooling

### 🔴 HIGH: Missing Linting & Formatting Tools

**Current State**:
- No ESLint configuration
- No Prettier configuration
- Inconsistent code style
- Manual code review burden
- Only inline `// eslint-disable` comments exist (frontend)

**Recommendation**:
Install and configure ESLint + Prettier:

```bash
# Backend
cd backend
npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin prettier eslint-config-prettier eslint-plugin-prettier

# Frontend
cd frontend
npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-plugin-react eslint-plugin-react-hooks prettier eslint-config-prettier eslint-plugin-prettier
```

**Configuration Files Needed**:
- `.eslintrc.json` (both frontend/backend)
- `.prettierrc.json` (root or both)
- `.prettierignore`
- Add `lint` and `format` scripts to package.json

**Benefits**:
- Consistent code style
- Catch common errors
- Automated formatting on save
- Pre-commit hooks integration

---

### 🟡 MEDIUM: TypeScript Configuration Improvements

**Backend Issues**:
```jsonc
// backend/tsconfig.base.json - Missing important options
{
  "compilerOptions": {
    "forceConsistentCasingInFileNames": false, // ❌ Should be true
    // Missing: noUnusedLocals, noUnusedParameters, noFallthroughCasesInSwitch
  }
}
```

**Frontend Issues**:
```jsonc
// frontend/tsconfig.json - Already good but could add:
{
  "compilerOptions": {
    "exactOptionalPropertyTypes": true,  // Stricter optional handling
    "noUncheckedIndexedAccess": true,    // Safer array/object access
  }
}
```

**Recommendation**:
Align backend config with frontend's stricter settings.

---

### 🟢 LOW: Markdown Linting

**Current State**:
- Many documentation files have markdown linting errors (see error output)
- Missing blank lines around headings, lists, code blocks

**Recommendation**:
```bash
npm install --save-dev markdownlint-cli
```

Add `.markdownlint.json` config and fix existing issues.

---

## 3. Testing Infrastructure

### 🟡 MEDIUM: Missing Test Coverage Reporting

**Current State**:
- Tests exist (Vitest) but no coverage metrics
- Unknown which code paths are tested

**Recommendation**:
```json
// vitest.config.mjs - Add coverage
{
  "test": {
    "coverage": {
      "provider": "v8",
      "reporter": ["text", "json", "html"],
      "exclude": ["tests/**", "dist/**", "node_modules/**"]
    }
  }
}
```

Add to CI/CD pipeline to track coverage trends.

---

### 🟢 LOW: E2E Testing

**Current State**:
- Only unit/integration tests
- No end-to-end browser automation

**Recommendation**:
Consider Playwright or Cypress for E2E testing of critical user flows:
- Voice conversation initiation
- Transcript display
- Session management

---

## 4. Frontend Architecture

### 🟡 MEDIUM: Inline Styles Overuse

**Current State**:
- `CaseBuilder.tsx` has 20+ inline style violations
- Reduces reusability and makes theming harder

**Example**:
```tsx
<div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
```

**Recommendation**:
1. Extract to CSS modules or styled-components
2. Use Material-UI's `sx` prop for component-level styles
3. Create reusable layout components

---

### 🟡 MEDIUM: Type Safety Improvements

**Current State**:
- Some `any` types in ConversationController.ts (line 52, 61, etc.)
- Could be more specific

**Example**:
```typescript
// Current
const envValue = ((import.meta as any)?.env?.VITE_VOICE_DEBUG ?? '') as string

// Better
interface ImportMeta {
  env: {
    VITE_VOICE_DEBUG?: string
  }
}
```

**Recommendation**:
Create a `vite-env.d.ts` with proper environment variable types.

---

### 🟢 LOW: React Component Patterns

**Current State**:
- Mix of function components and class components
- Only `ErrorBoundary.tsx` uses class component (correct use case)
- Some places use `React.FC` (deprecated pattern)

**Recommendation**:
- Remove `React.FC` typing (it's being phased out)
- Use plain function declarations with typed props

```typescript
// Instead of:
const MyComponent: React.FC<Props> = (props) => { ... }

// Use:
function MyComponent(props: Props) { ... }
```

---

## 5. Dependency Management

### 🟡 MEDIUM: Missing Node.js Version Specification

**Current State**:
- No `engines` field in package.json files
- Team members might use incompatible Node versions

**Recommendation**:
Add to both `package.json` files:
```json
{
  "engines": {
    "node": ">=20.0.0",
    "npm": ">=9.0.0"
  }
}
```

Consider adding `.nvmrc` or `.node-version` file:
```
20.11.0
```

---

### 🟡 MEDIUM: Security Audit

**Current State**:
- No regular dependency vulnerability scanning

**Recommendation**:
```bash
# Run audit
npm audit

# Add to CI/CD
npm audit --audit-level=high
```

Add Dependabot or Renovate bot for automated dependency updates.

---

## 6. Development Experience

### 🟡 MEDIUM: Git Hooks Enhancement

**Current State**:
- `.husky/pre-commit` only validates SPS data
- No automatic linting or formatting

**Recommendation**:
Expand pre-commit to include:
```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run linting on staged files
npx lint-staged

# Run type checking
cd backend && npm run type-check
cd frontend && npm run type-check

# Existing SPS validation...
```

Add `lint-staged` config to package.json:
```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

---

### 🟢 LOW: VS Code Workspace Settings

**Current State**:
- Basic `.vscode` folder exists
- Could add recommended extensions and settings

**Recommendation**:
Create `.vscode/extensions.json`:
```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next",
    "vitest.explorer"
  ]
}
```

Create `.vscode/settings.json`:
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

---

## 7. Build & Deployment

### 🔴 HIGH: Missing Docker Configuration

**Current State**:
- No Dockerfile or docker-compose.yml
- Manual deployment process
- Inconsistent environments

**Recommendation**:
Create multi-stage Dockerfile for backend:
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build  # Add build script

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
ENV NODE_ENV=production
EXPOSE 3002
CMD ["node", "dist/index.js"]
```

Similar for frontend with nginx serving static build.

---

### 🟡 MEDIUM: Environment Variable Management

**Current State**:
- `.env.example` exists but documentation could be better
- No validation of required environment variables at startup

**Recommendation**:
Create `backend/src/env.ts`:
```typescript
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().default('3002'),
  NODE_ENV: z.enum(['development', 'production', 'test']),
  OPENAI_API_KEY: z.string().min(1),
  // ... etc
});

export const env = envSchema.parse(process.env);
```

Fail fast on startup if required variables are missing.

---

### 🟡 MEDIUM: CI/CD Pipeline

**Current State**:
- GitHub Actions only for SPS validation
- No build/test/deploy automation

**Recommendation**:
Expand `.github/workflows/`:
- `ci.yml` - Run tests on all PRs
- `build.yml` - Build frontend/backend on push
- `deploy.yml` - Deploy to staging/production

---

## 8. Monitoring & Observability

### 🟢 LOW: Structured Logging

**Current State**:
- Console.log statements throughout
- No log levels or structured format

**Recommendation**:
Add Pino or Winston for structured logging:
```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

logger.info({ sessionId }, 'Session created');
logger.error({ err, sessionId }, 'Failed to create session');
```

---

### 🟢 LOW: Performance Monitoring

**Current State**:
- Basic TTFT metric in frontend
- No backend performance tracking

**Recommendation**:
- Add response time middleware
- Track WebRTC connection times
- Monitor AI response latency

---

## 9. Security Hardening

### 🟡 MEDIUM: Security Headers

**Current State**:
- Basic CORS configuration
- No security headers (helmet)

**Recommendation**:
```bash
cd backend
npm install helmet
```

```typescript
import helmet from 'helmet';
app.use(helmet());
```

---

### 🟡 MEDIUM: Rate Limiting

**Current State**:
- No rate limiting on API endpoints
- Vulnerable to abuse

**Recommendation**:
```bash
npm install express-rate-limit
```

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

---

## 10. Documentation

### 🟡 MEDIUM: API Documentation

**Current State**:
- `ops/docs/API_CONTRACTS.md` exists
- Could be auto-generated from types

**Recommendation**:
Consider OpenAPI/Swagger for API documentation:
- Install `swagger-jsdoc` and `swagger-ui-express`
- Generate docs from JSDoc comments or Zod schemas
- Serve at `/api-docs` endpoint

---

## Implementation Priority

### Phase 1 (Week 1-2) - Foundation
1. ✅ Add ESLint + Prettier to both projects
2. ✅ Migrate backend JS files to TypeScript
3. ✅ Add `@types/express` and fix type issues
4. ✅ Add Node.js version requirements
5. ✅ Fix catalog loading (remove inline requires, add caching)

### Phase 2 (Week 3-4) - Quality
1. ✅ Add test coverage reporting
2. ✅ Fix inline styles in CaseBuilder
3. ✅ Add environment variable validation
4. ✅ Expand GitHub Actions CI/CD
5. ✅ Add security headers and rate limiting

### Phase 3 (Week 5-6) - Production Readiness
1. ✅ Create Docker configurations
2. ✅ Add structured logging
3. ✅ Set up monitoring/observability
4. ✅ API documentation generation
5. ✅ E2E testing framework

---

## Estimated Total Effort

- **Phase 1**: 40-60 hours (critical path)
- **Phase 2**: 30-40 hours (quality improvements)
- **Phase 3**: 40-50 hours (production hardening)

**Total**: ~110-150 hours (3-4 weeks with 1 developer, or 1.5-2 weeks with 2 developers)

---

## Benefits Summary

| Category | Current State | After Modernization |
|----------|---------------|---------------------|
| **Type Safety** | Partial (TS/JS mix) | Full TypeScript coverage |
| **Code Quality** | No linting | Automated linting + formatting |
| **Testing** | Unit tests only | Coverage tracking + E2E |
| **Deployment** | Manual | Docker + CI/CD |
| **Security** | Basic | Headers + rate limiting + auditing |
| **Monitoring** | Console logs | Structured logging + metrics |
| **Developer Experience** | Good | Excellent (tooling + automation) |

---

## Recommendations for Immediate Action

**This week**:
1. Install ESLint + Prettier (2 hours)
2. Add `@types/express` (30 min)
3. Add Node.js version to package.json (5 min)

**Next week**:
1. Start backend JS → TS migration (start with routes)
2. Fix catalog loading pattern
3. Add test coverage reporting

**Ongoing**:
- Keep dependencies updated
- Run security audits monthly
- Review and update this document quarterly

---

## Conclusion

The codebase is well-structured and functional, but modernization will significantly improve:
- **Maintainability**: Full TypeScript, consistent patterns
- **Security**: Headers, rate limiting, auditing
- **Developer Experience**: Linting, formatting, better tooling
- **Production Readiness**: Docker, CI/CD, monitoring

The mixed JS/TS architecture is the most urgent issue to address, as it creates confusion and reduces type safety benefits. After that, adding linting/formatting tools will provide immediate quality improvements with minimal effort.
