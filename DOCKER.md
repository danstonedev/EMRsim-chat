# Docker Deployment Guide

This project includes Docker configurations for both development and production environments.

## Prerequisites

- Docker Engine 20.10 or higher
- Docker Compose 2.0 or higher
- `.env` file in backend directory (copy from `.env.example`)

## Quick Start

### Production Deployment

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Stop and remove volumes (WARNING: deletes database)
docker-compose down -v
```

Access the application:
- Frontend: http://localhost
- Backend API: http://localhost:3002
- Health check: http://localhost:3002/health

### Development Mode

```bash
# Start development environment with hot reload
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop services
docker-compose -f docker-compose.dev.yml down
```

Access the development application:
- Frontend (Vite HMR): http://localhost:5173
- Backend API: http://localhost:3002

## Environment Variables

Required environment variables (set in backend `.env` file or docker-compose):

```bash
OPENAI_API_KEY=your_api_key_here
OPENAI_REALTIME_MODEL=gpt-realtime-2025-08-28
OPENAI_TEXT_MODEL=gpt-4o
OPENAI_TTS_VOICE=cedar
VOICE_ENABLED=true
SPS_ENABLED=true
```

See `backend/.env.example` for all available options.

## Architecture

### Production Setup

```
┌─────────────┐
│   Nginx     │  Port 80
│  (Frontend) │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Node.js   │  Port 3002
│  (Backend)  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   SQLite    │  Persistent Volume
│  (Database) │
└─────────────┘
```

### Services

- **frontend**: Nginx serving static React build
  - Multi-stage build (Node builder + Nginx runtime)
  - Gzip compression enabled
  - SPA routing configured
  - Security headers included

- **backend**: Node.js with Express API
  - Multi-stage build for smaller image
  - Non-root user for security
  - Health checks enabled
  - Persistent volume for SQLite database

## Docker Commands

### Build Images

```bash
# Build all images
docker-compose build

# Build specific service
docker-compose build backend
docker-compose build frontend

# Build without cache
docker-compose build --no-cache
```

### Managing Services

```bash
# Start services in background
docker-compose up -d

# Start specific service
docker-compose up -d backend

# Restart service
docker-compose restart backend

# Stop services
docker-compose stop

# Remove stopped containers
docker-compose down

# View service status
docker-compose ps
```

### Viewing Logs

```bash
# Follow all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend

# View last 100 lines
docker-compose logs --tail=100
```

### Executing Commands

```bash
# Run command in backend container
docker-compose exec backend npm run test

# Run command in frontend container
docker-compose exec frontend npm run build

# Open shell in container
docker-compose exec backend sh
```

### Database Management

```bash
# Backup database
docker-compose exec backend sqlite3 /app/data/prod.db .dump > backup.sql

# Restore database
cat backup.sql | docker-compose exec -T backend sqlite3 /app/data/prod.db

# View database location
docker volume inspect emrsim-chat_backend-data
```

## Production Deployment

### AWS ECS / Azure Container Instances

1. Build and push images to container registry:

```bash
# Tag images
docker tag emrsim-chat-backend:latest your-registry/emrsim-backend:latest
docker tag emrsim-chat-frontend:latest your-registry/emrsim-frontend:latest

# Push images
docker push your-registry/emrsim-backend:latest
docker push your-registry/emrsim-frontend:latest
```

2. Create task definitions using the images
3. Set environment variables in task definition
4. Deploy as ECS service or Azure Container Instance

### Kubernetes

See `ops/k8s/` directory for Kubernetes manifests (if available).

## Troubleshooting

### Container won't start

```bash
# Check logs for errors
docker-compose logs backend

# Check container status
docker-compose ps

# Verify environment variables
docker-compose exec backend env | grep OPENAI
```

### Port already in use

```bash
# Find process using port
# Windows
netstat -ano | findstr :3002
# Linux/Mac
lsof -i :3002

# Change port in docker-compose.yml
ports:
  - "3003:3002"  # Use different host port
```

### Database issues

```bash
# Reset database (WARNING: deletes data)
docker-compose down -v
docker volume rm emrsim-chat_backend-data
docker-compose up -d

# Check database file
docker-compose exec backend ls -lh /app/data/
```

### Out of disk space

```bash
# Clean up unused images/containers
docker system prune -a

# Remove unused volumes
docker volume prune
```

## Performance Optimization

### Image Size

- Backend image: ~150MB (Alpine + Node.js)
- Frontend image: ~50MB (Alpine + Nginx)

### Build Time

- Use BuildKit for faster builds:
  ```bash
  DOCKER_BUILDKIT=1 docker-compose build
  ```

### Resource Limits

Add resource constraints to docker-compose.yml:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

## Security Best Practices

- ✅ Non-root user in containers
- ✅ Health checks enabled
- ✅ Multi-stage builds (smaller attack surface)
- ✅ .dockerignore to exclude sensitive files
- ✅ Security headers in Nginx
- ✅ Environment variables for secrets (not in image)

## Monitoring

### Health Checks

Both services have health check endpoints:
- Backend: http://localhost:3002/health
- Frontend: http://localhost/health

### Logs

Logs are written to stdout/stderr and collected by Docker:

```bash
# Stream logs to file
docker-compose logs -f > logs/docker.log

# View error logs only
docker-compose logs | grep ERROR
```

## Next Steps

1. Set up container registry (Docker Hub, AWS ECR, Azure ACR)
2. Configure CI/CD pipeline to build and push images
3. Set up production environment with proper secrets management
4. Configure load balancer and SSL certificates
5. Set up monitoring and alerting (Prometheus, Grafana)
