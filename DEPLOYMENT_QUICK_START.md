# Production Deployment Quick Start Guide

This is a condensed guide for experienced DevOps engineers. For detailed step-by-step instructions, see `PRODUCTION_DEPLOYMENT_CHECKLIST.md`.

## Prerequisites

- Azure subscription with Contributor access
- GitHub repository admin access
- Azure CLI installed and configured
- Node.js 16+ installed

## Quick Steps

### 1. GitHub Setup (15 minutes)

```bash
# Configure branch protection for main and develop branches
# Settings → Branches → Add rule
# - Require PR reviews (1 approval)
# - Require status checks: test, build, e2e
```

Create GitHub environments:
- `staging` (no protection)
- `production` (required reviewers + 15min wait)

### 2. Azure Service Principal (5 minutes)

```bash
az login
az account set --subscription <subscription-id>

az group create --name emrsim-chat-rg --location eastus

az ad sp create-for-rbac --name "github-emrsim-deploy" \
  --role contributor \
  --scopes /subscriptions/<subscription-id>/resourceGroups/emrsim-chat-rg \
  --sdk-auth
```

Save JSON output as GitHub secret `AZURE_CREDENTIALS`.

### 3. Configure GitHub Secrets (10 minutes)

**Repository secrets:**
- `AZURE_CREDENTIALS` - Service principal JSON
- `AZURE_RESOURCE_GROUP` - `emrsim-chat-rg`
- `AZURE_SUBSCRIPTION_ID` - Your subscription ID
- `PG_ADMIN_USERNAME` - PostgreSQL admin user
- `PG_ADMIN_PASSWORD` - Strong password
- `CODECOV_TOKEN` - (Optional)
- `SONAR_TOKEN` - (Optional)

**Environment secrets** (for both staging and production):
- `AZURE_WEBAPP_NAME` - Web app name
- `REACT_APP_API_URL` - Backend API URL
- `REACT_APP_ENV` - Environment name
- `STATIC_WEB_APP_TOKEN` - Static Web App deployment token
- `PG_HOST` - PostgreSQL hostname
- `PG_PORT` - `5432`
- `PG_DATABASE` - `emrsim`
- `PG_USER` - Application user
- `PG_PASSWORD` - Application password

### 4. Deploy Staging Infrastructure (20 minutes)

```bash
az deployment group create \
  --resource-group emrsim-chat-rg \
  --template-file infrastructure/main.bicep \
  --parameters environment=staging \
               administratorLogin=emrsimadmin \
               administratorLoginPassword='<strong-password>'
```

Get Static Web App token:
```bash
az staticwebapp secrets list \
  --name stapp-emrsim-staging \
  --resource-group emrsim-chat-rg \
  --query properties.apiKey -o tsv
```

Get PostgreSQL hostname:
```bash
az postgres flexible-server show \
  --name psql-emrsim-staging \
  --resource-group emrsim-chat-rg \
  --query fullyQualifiedDomainName -o tsv
```

Update GitHub environment secrets with these values.

### 5. Run CI Workflow (5 minutes)

```bash
# GitHub Actions → EMRsim-chat CI → Run workflow on develop branch
```

Verify all checks pass:
- ✅ Lint
- ✅ Type check
- ✅ Unit tests
- ✅ Integration tests
- ✅ E2E tests
- ✅ Build

### 6. Deploy to Staging (15 minutes)

```bash
# GitHub Actions → EMRsim-chat CD → Run workflow
# Branch: main
# Environment: staging
```

Monitor deployment phases:
1. Deploy infrastructure
2. Deploy backend → staging slot
3. Run smoke tests
4. Deploy frontend
5. Run E2E tests

### 7. Verify Staging (30 minutes)

**Functional tests:**
- [ ] Homepage loads
- [ ] User authentication works
- [ ] Create simulation scenario
- [ ] Real-time updates function
- [ ] Database operations work
- [ ] WebSocket connections stable

**Performance tests:**
```bash
npm run test:load:staging
```

Verify:
- [ ] p95 response time < 2s
- [ ] No errors under normal load
- [ ] Application Insights shows metrics

### 8. Deploy Production Infrastructure (20 minutes)

```bash
az deployment group create \
  --resource-group emrsim-chat-rg \
  --template-file infrastructure/main.bicep \
  --parameters environment=production \
               administratorLogin=emrsimadmin \
               administratorLoginPassword='<production-password>'
```

Repeat token and hostname retrieval for production, update GitHub secrets.

### 9. Deploy to Production (20 minutes)

```bash
# GitHub Actions → EMRsim-chat CD → Run workflow
# Branch: main
# Environment: production
# Wait for approval (15min + manual)
```

### 10. Post-Deployment (1 hour)

**Immediate (5 min):**
- [ ] Access production URL
- [ ] Verify homepage
- [ ] Test authentication
- [ ] Check one complete flow
- [ ] No console errors

**First hour:**
- [ ] Monitor Application Insights every 15 min
- [ ] Check error rates
- [ ] Verify response times
- [ ] Review logs

**First day:**
- [ ] Check dashboards every 2 hours
- [ ] Monitor user reports
- [ ] Verify backups ran

## Emergency Rollback

```bash
az webapp deployment slot swap \
  -n app-emrsim-prod \
  -g emrsim-chat-rg \
  --slot production \
  --target-slot staging
```

## Key Resources

- **Detailed Checklist:** `PRODUCTION_DEPLOYMENT_CHECKLIST.md`
- **GitHub Setup:** `docs/GITHUB_SETUP_GUIDE.md`
- **Azure Setup:** `docs/AZURE_SERVICE_SETUP.md`
- **Deployment Procedure:** `docs/DEPLOYMENT_PROCEDURE.md`
- **Database Recovery:** `docs/DATABASE_RECOVERY_GUIDE.md`

## Success Criteria

- [ ] All CI/CD pipelines passing
- [ ] Staging environment fully functional
- [ ] Production environment deployed
- [ ] Monitoring and alerts configured
- [ ] Team trained on production environment
- [ ] Documentation updated
- [ ] Stakeholders notified

## Timeline Summary

| Phase | Duration | Total Time |
|-------|----------|------------|
| GitHub Setup | 15 min | 15 min |
| Azure Service Principal | 5 min | 20 min |
| Configure Secrets | 10 min | 30 min |
| Deploy Staging Infra | 20 min | 50 min |
| Run CI | 5 min | 55 min |
| Deploy to Staging | 15 min | 1h 10min |
| Verify Staging | 30 min | 1h 40min |
| Deploy Prod Infra | 20 min | 2h |
| Deploy to Production | 20 min | 2h 20min |
| Post-Deployment | 1 hour | 3h 20min |

**Total estimated time:** ~3-4 hours for complete deployment

---

**Note:** This is a condensed guide. Always refer to the detailed checklist for comprehensive instructions and safety checks.
