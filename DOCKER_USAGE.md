# Archived: Docker Files (Not Used)

## ⚠️ Important Notice

Docker artifacts are not used in our production or staging deployments (Vercel). You can ignore Docker files. If needed in the future, reintroduce with current guidance.

## Docker Files in This Project

### docker-compose.yml
- **Purpose**: Run full stack locally in containers
- **Services**: Redis, Backend, Frontend
- **Use Case**: Testing production-like environment locally
- **Vercel Impact**: None

### docker-compose.dev.yml
- **Purpose**: Development environment setup
- **Use Case**: Local development with hot reload
- **Vercel Impact**: None

### backend/Dockerfile
- **Purpose**: Build backend container image
- **Use Case**: Local containerized backend
- **Vercel Impact**: None - Vercel builds from source using `vercel.json`

### frontend/Dockerfile
- **Purpose**: Build frontend container with nginx
- **Use Case**: Local containerized frontend
- **Vercel Impact**: None - Vercel uses Vite build

## Vercel Deployment

Vercel does NOT use Docker. It:
1. Pulls source code from Git
2. Runs `npm install`
3. Runs `npm run build`
4. Deploys built artifacts

## When to Use Docker

### Local Development
```powershell
# Start all services
docker-compose up

# Start in dev mode
docker-compose -f docker-compose.dev.yml up
```

### Testing Production Build Locally
```powershell
# Build and run production containers
docker-compose up --build
```

## When NOT to Use Docker

- ❌ Vercel deployment
- ❌ CI/CD pipelines
- ❌ Production environment (use Vercel)

## Configuration Conflicts?

Docker files will NOT interfere with Vercel because:
- Vercel uses `vercel.json` for configuration
- Docker uses `Dockerfile` and `docker-compose.yml`
- They operate in completely separate environments
- No shared state or configuration

## Summary

| Environment | Uses Docker | Configuration File |
|-------------|-------------|-------------------|
| Local Dev | Optional | `docker-compose.dev.yml` |
| Local Prod Test | Optional | `docker-compose.yml` |
| Vercel Production | ❌ Never | `vercel.json` |

---

**Keep Docker files**: They're useful for local development and don't affect Vercel deployment.
