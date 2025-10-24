# EMRsim-chat Deployment Procedure

This document outlines the detailed procedure for deploying EMRsim-chat to Azure using our CI/CD pipeline.

## Prerequisites

- Azure subscription with Contributor access
- GitHub repository access with admin permissions
- Azure CLI installed locally for manual operations if needed
- Terraform or Azure Bicep CLI tools for infrastructure validation

## Initial Setup (One-time Configuration)

### 1. Set up Azure Resources

#### 1.1. Create Service Principal for GitHub Actions

```bash
# Login to Azure
az login

# Create service principal for GitHub Actions
az ad sp create-for-rbac --name "github-emrsim-deploy" --role contributor \
                         --scopes /subscriptions/{subscription-id}/resourceGroups/{resource-group-name} \
                         --sdk-auth

# Copy the JSON output - this will be used as a GitHub Secret
```

#### 1.2. Set up GitHub Secrets

Add the following secrets to your GitHub repository:

- `AZURE_CREDENTIALS`: JSON output from service principal creation
- `AZURE_RESOURCE_GROUP`: Resource group name
- `PG_ADMIN_USERNAME`: PostgreSQL admin username
- `PG_ADMIN_PASSWORD`: PostgreSQL admin password
- `PG_HOST`: PostgreSQL server hostname (after initial deployment)
- `PG_PORT`: PostgreSQL port (usually 5432)
- `PG_DATABASE`: PostgreSQL database name
- `PG_USER`: PostgreSQL application user
- `PG_PASSWORD`: PostgreSQL application user password
- `STATIC_WEB_APP_TOKEN`: Deployment token for Static Web App
- `SLACK_WEBHOOK`: Webhook URL for deployment notifications

### 2. Initial Infrastructure Deployment

```bash
# Deploy the initial infrastructure using GitHub Actions
# Go to GitHub repository > Actions > Workflows > EMRsim-chat CD > Run workflow
# Select "staging" as the environment
```

## Deployment Process

### 1. Staging Deployment (Automated)

#### Triggered by:
- Push to `develop` branch
- Manual workflow dispatch

#### Process:
1. CI workflow runs tests and validates code
2. CD workflow deploys to staging environment:
   - Deploys infrastructure changes if any
   - Deploys backend to staging slot
   - Applies database migrations
   - Deploys frontend
   - Runs smoke tests
   - Sends notification upon completion

#### Verification:
1. Access the staging environment URL
2. Verify all features work as expected
3. Check Application Insights for errors
4. Run performance tests

### 2. Production Deployment

#### Triggered by:
- Push to `main` branch (after PR approval)
- Manual workflow dispatch with "production" environment selected

#### Process:
1. CI workflow runs tests and validates code
2. CD workflow deploys to production environment:
   - Deploys infrastructure changes if any
   - Deploys backend to staging slot
   - Applies database migrations
   - Deploys frontend
   - Runs smoke tests
   - Swaps staging and production slots if tests pass
   - Runs post-deployment verification
   - Sends notification upon completion

#### Verification:
1. Access the production environment URL
2. Verify critical user journeys work as expected
3. Monitor Application Insights for errors
4. Check metrics for performance issues

## Rollback Procedure

### 1. Automated Rollback (Slot Swap)

If issues are detected after swapping slots:

```bash
# Swap slots back to return to previous version
az webapp deployment slot swap -n app-emrsim-production -g $AZURE_RESOURCE_GROUP --slot staging --target-slot production
```

### 2. Database Rollback

If database migration causes issues:

```bash
# Connect to PostgreSQL
psql -h $PG_HOST -U $PG_ADMIN_USERNAME -d $PG_DATABASE

# Run down migrations to revert to previous state
# Example with Sequelize:
npx sequelize-cli db:migrate:undo --to XXXXXX-previous-stable-migration.js

# Or restore from point-in-time backup
az postgres flexible-server restore --resource-group $AZURE_RESOURCE_GROUP \
  --name $PG_SERVER_NAME \
  --source-server $PG_SERVER_NAME \
  --restore-point-in-time "2023-01-01T00:00:00Z" \
  --target-server-name $PG_SERVER_NAME-restored
```

### 3. Manual Rollback (Redeploy Previous Version)

If slot swap isn't an option:

```bash
# Find the previous successful deployment tag
git tag -l "production-*"

# Check out the last good version
git checkout production-YYYY-MM-DD-1

# Manually trigger deployment
# Go to GitHub Actions and run workflow with this version
```

## Monitoring After Deployment

### 1. Key Metrics to Watch

- Response time (p95 < 2s)
- Error rate (< 1%)
- CPU and memory usage (< 70%)
- Database connection count
- Active WebSocket connections

### 2. Alert Configuration

Alerts are configured for:
- Error rate > 5% over 5 minutes
- Response time p95 > 3s over 5 minutes
- CPU usage > 80% for 10 minutes
- Failed database connections
- Memory usage > 85%

### 3. Access Logs

```bash
# Stream logs from Azure App Service
az webapp log tail --name app-emrsim-production --resource-group $AZURE_RESOURCE_GROUP

# Download logs for offline analysis
az webapp log download --name app-emrsim-production --resource-group $AZURE_RESOURCE_GROUP
```

## Special Procedures

### 1. Database Migration

See [MIGRATION_PROCEDURE.md](./MIGRATION_PROCEDURE.md) for detailed PostgreSQL migration steps.

### 2. Scaling Up/Out

```bash
# Scale out (add more instances)
az appservice plan update --number-of-workers 4 --name plan-emrsim-production --resource-group $AZURE_RESOURCE_GROUP

# Scale up (increase VM size)
az appservice plan update --sku P3v2 --name plan-emrsim-production --resource-group $AZURE_RESOURCE_GROUP
```

### 3. SSL Certificate Renewal

SSL certificates are automatically managed by Azure Static Web Apps and App Service.

### 4. Database Backup

```bash
# Manual backup
az postgres flexible-server backup --resource-group $AZURE_RESOURCE_GROUP --name $PG_SERVER_NAME

# Check backup status
az postgres flexible-server backup list --resource-group $AZURE_RESOURCE_GROUP --name $PG_SERVER_NAME
```

## Deployment Checklist

Before each production deployment, verify:

- [ ] All tests pass in CI pipeline
- [ ] Database migrations are backward compatible
- [ ] Bundle size meets performance budget
- [ ] Staging environment verification completed
- [ ] On-call support is available during deployment window
- [ ] Rollback procedure has been reviewed
- [ ] Load testing shows system can handle expected traffic
- [ ] Security scan shows no critical vulnerabilities
