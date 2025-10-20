# Production Deployment Checklist for EMRsim-chat

This is your step-by-step guide to deploying EMRsim-chat to production. Follow each section in order, checking off items as you complete them.

---

## 📋 Phase 1: GitHub Repository Setup

### 1.1 Repository Structure ✅
- [ ] Verify repository has all required directories (`.github/workflows/`, `infrastructure/`, `docs/`)
- [ ] Confirm all workflow files are in place (`ci.yml`, `cd.yml`)
- [ ] Verify infrastructure code is ready (`main.bicep`)

### 1.2 Branch Protection Rules
- [ ] Navigate to: Repository → Settings → Branches → Add rule
- [ ] Configure protection for `main` branch:
  - [ ] Branch name pattern: `main`
  - [ ] Require pull request reviews (1 approval minimum)
  - [ ] Dismiss stale reviews when new commits are pushed
  - [ ] Require status checks: `test`, `build`, `e2e`
  - [ ] Require branches to be up to date
  - [ ] Do not allow bypassing
- [ ] Configure protection for `develop` branch (slightly less restrictive)

### 1.3 GitHub Environments
- [ ] Go to: Settings → Environments → New environment
- [ ] Create `staging` environment
- [ ] Create `production` environment
- [ ] Configure `production` environment protection:
  - [ ] Add required reviewers
  - [ ] Set wait timer: 15 minutes
  - [ ] Set deployment branches: `main` only

**Reference:** See `docs/GITHUB_SETUP_GUIDE.md` for detailed instructions

---

## 🔐 Phase 2: Configure GitHub Secrets

### 2.1 Azure Service Principal Creation
- [ ] Open Azure CLI or Cloud Shell
- [ ] Run the following commands:

```bash
# Login to Azure
az login

# Set your subscription
az account set --subscription <your-subscription-id>

# Create resource group
az group create --name emrsim-chat-rg --location eastus

# Create service principal (SAVE THE JSON OUTPUT!)
az ad sp create-for-rbac --name "github-emrsim-deploy" \
                         --role contributor \
                         --scopes /subscriptions/<subscription-id>/resourceGroups/emrsim-chat-rg \
                         --sdk-auth
```

- [ ] Copy the entire JSON output from the last command

### 2.2 Repository Secrets
Navigate to: Settings → Secrets and variables → Actions → New repository secret

Add each of these secrets:

- [ ] `AZURE_CREDENTIALS` - Paste the JSON from service principal creation
- [ ] `AZURE_RESOURCE_GROUP` - `emrsim-chat-rg` (or your chosen name)
- [ ] `AZURE_SUBSCRIPTION_ID` - Your Azure subscription ID
- [ ] `PG_ADMIN_USERNAME` - PostgreSQL admin username (e.g., `emrsimadmin`)
- [ ] `PG_ADMIN_PASSWORD` - Strong password for PostgreSQL admin
- [ ] `CODECOV_TOKEN` - (Optional) Get from codecov.io after linking repository
- [ ] `SONAR_TOKEN` - (Optional) Get from sonarcloud.io after linking repository

### 2.3 Environment-Specific Secrets

#### For `staging` environment:
Go to: Settings → Environments → staging → Add secret

- [ ] `AZURE_WEBAPP_NAME` - `app-emrsim-staging`
- [ ] `REACT_APP_API_URL` - `https://app-emrsim-staging.azurewebsites.net`
- [ ] `REACT_APP_ENV` - `staging`
- [ ] `STATIC_WEB_APP_TOKEN` - (Will get this after creating Static Web App)
- [ ] `PG_HOST` - (Will get this after PostgreSQL deployment)
- [ ] `PG_PORT` - `5432`
- [ ] `PG_DATABASE` - `emrsim`
- [ ] `PG_USER` - `emrsimapp`
- [ ] `PG_PASSWORD` - Strong password for app user

#### For `production` environment:
Go to: Settings → Environments → production → Add secret

- [ ] `AZURE_WEBAPP_NAME` - `app-emrsim-prod`
- [ ] `REACT_APP_API_URL` - `https://app-emrsim-prod.azurewebsites.net`
- [ ] `REACT_APP_ENV` - `production`
- [ ] `STATIC_WEB_APP_TOKEN` - (Will get this after creating Static Web App)
- [ ] `PG_HOST` - (Will get this after PostgreSQL deployment)
- [ ] `PG_PORT` - `5432`
- [ ] `PG_DATABASE` - `emrsim`
- [ ] `PG_USER` - `emrsimapp`
- [ ] `PG_PASSWORD` - Strong password for app user (different from staging)

### 2.4 Optional Notification Secrets
- [ ] `SLACK_WEBHOOK` - (Optional) For deployment notifications

**Reference:** See `docs/GITHUB_SETUP_GUIDE.md` Section 3.2 and 3.3

---

## ☁️ Phase 3: Azure Service Setup

### 3.1 Verify Azure CLI Setup
- [ ] Verify Azure CLI is installed: `az --version`
- [ ] Login to Azure: `az login`
- [ ] Verify correct subscription is active: `az account show`

### 3.2 Resource Group Setup
- [ ] Confirm resource group exists: `az group show --name emrsim-chat-rg`
- [ ] If not, create it: `az group create --name emrsim-chat-rg --location eastus`

### 3.3 Review Infrastructure Code
- [ ] Open and review `infrastructure/main.bicep`
- [ ] Verify parameters match your requirements
- [ ] Check naming conventions align with your organization

### 3.4 Deploy Infrastructure (Staging)
Run this command to deploy the staging infrastructure:

```bash
az deployment group create \
  --resource-group emrsim-chat-rg \
  --template-file infrastructure/main.bicep \
  --parameters environment=staging \
               administratorLogin=emrsimadmin \
               administratorLoginPassword='<your-strong-password>'
```

- [ ] Run the deployment command
- [ ] Wait for deployment to complete (may take 10-15 minutes)
- [ ] Note down the output values (Web App name, PostgreSQL hostname, etc.)

### 3.5 Get Static Web App Deployment Token
```bash
az staticwebapp secrets list --name stapp-emrsim-staging \
                              --resource-group emrsim-chat-rg \
                              --query properties.apiKey -o tsv
```

- [ ] Run command and copy the token
- [ ] Add token as `STATIC_WEB_APP_TOKEN` in staging environment secrets

### 3.6 Get PostgreSQL Connection Details
```bash
# Get PostgreSQL hostname
az postgres flexible-server show --name psql-emrsim-staging \
                                 --resource-group emrsim-chat-rg \
                                 --query fullyQualifiedDomainName -o tsv
```

- [ ] Run command and copy the hostname
- [ ] Add hostname as `PG_HOST` in staging environment secrets

### 3.7 Create Application Database User
Connect to PostgreSQL and create the application user:

```bash
# Connect to PostgreSQL
az postgres flexible-server connect --name psql-emrsim-staging \
                                   --admin-user emrsimadmin \
                                   --admin-password '<admin-password>' \
                                   --database-name emrsim
```

Then run these SQL commands:
```sql
CREATE USER emrsimapp WITH PASSWORD '<app-password>';
GRANT ALL PRIVILEGES ON DATABASE emrsim TO emrsimapp;
GRANT ALL ON SCHEMA public TO emrsimapp;
```

- [ ] Create application user
- [ ] Verify connection with app credentials

**Reference:** See `docs/AZURE_SERVICE_SETUP.md` for detailed commands

---

## 🧪 Phase 4: Verify CI Pipeline

### 4.1 Run CI Workflow
- [ ] Go to: Actions tab in GitHub repository
- [ ] Select "EMRsim-chat CI" workflow
- [ ] Click "Run workflow" → select `develop` branch → Run

### 4.2 Monitor CI Execution
Watch the workflow run and verify each job completes:
- [ ] ✅ Lint job passes
- [ ] ✅ Type check passes
- [ ] ✅ Unit tests pass
- [ ] ✅ Integration tests pass
- [ ] ✅ E2E tests pass
- [ ] ✅ Build job completes
- [ ] ✅ Bundle analysis runs

### 4.3 Review Test Results
- [ ] Check code coverage report (should be uploaded to Codecov if configured)
- [ ] Review any warnings or errors in logs
- [ ] Verify all required checks are green

### 4.4 Fix Any Issues
If CI fails:
- [ ] Review error logs in GitHub Actions
- [ ] Fix issues locally
- [ ] Push fixes and re-run CI
- [ ] Repeat until all checks pass

**Status:** CI must be passing before proceeding to deployment

---

## 🚀 Phase 5: Deploy to Staging

### 5.1 Prepare for Deployment
- [ ] Ensure all CI checks are passing
- [ ] Verify all secrets are configured in staging environment
- [ ] Review deployment workflow: `.github/workflows/cd.yml`

### 5.2 Trigger Staging Deployment
- [ ] Go to: Actions tab → "EMRsim-chat CD" workflow
- [ ] Click "Run workflow"
- [ ] Select branch: `main`
- [ ] Select environment: `staging`
- [ ] Click "Run workflow"

### 5.3 Monitor Deployment
Watch the workflow execute each job:

**Job 1: Deploy Infrastructure**
- [ ] ✅ Log in to Azure
- [ ] ✅ Deploy ARM/Bicep template
- [ ] ✅ Export infrastructure outputs

**Job 2: Deploy Backend**
- [ ] ✅ Build backend application
- [ ] ✅ Deploy to Azure Web App staging slot
- [ ] ✅ Apply database migrations
- [ ] ✅ Run smoke tests on staging slot
- [ ] ✅ Swap staging and production slots (if production)

**Job 3: Deploy Frontend**
- [ ] ✅ Build frontend application with correct environment variables
- [ ] ✅ Deploy to Azure Static Web App

**Job 4: Post-Deployment**
- [ ] ✅ Run E2E tests on deployed environment
- [ ] ✅ Run performance tests
- [ ] ✅ Send deployment notification

### 5.4 Verify Staging Deployment
- [ ] Open staging URL: `https://stapp-emrsim-staging.azurestaticapps.net`
- [ ] Test user authentication flow
- [ ] Create a test simulation scenario
- [ ] Verify real-time updates work
- [ ] Check database operations
- [ ] Test file upload/download if applicable
- [ ] Verify WebSocket connections work
- [ ] Check browser console for errors
- [ ] Test on multiple browsers (Chrome, Firefox, Edge, Safari)

---

## 🔍 Phase 6: Staging Testing & Validation

### 6.1 Functional Testing
- [ ] Complete user registration flow
- [ ] Login with test account
- [ ] Create and configure simulation
- [ ] Test patient monitoring features
- [ ] Verify chat functionality
- [ ] Test scenario progression
- [ ] Verify data persistence

### 6.2 Performance Testing
Run load tests against staging:

```bash
# Navigate to project directory
cd c:\Users\danst\EMRsim-chat

# Run load tests
npm run test:load:staging
```

- [ ] Run load tests
- [ ] Verify p95 response time < 2 seconds
- [ ] Check no errors under normal load
- [ ] Review Application Insights metrics

### 6.3 Security Testing
- [ ] Verify HTTPS is enforced
- [ ] Test authentication/authorization
- [ ] Check for exposed secrets in frontend
- [ ] Verify CORS settings
- [ ] Test rate limiting (if implemented)

### 6.4 Monitoring Validation
- [ ] Open Azure Portal → Application Insights
- [ ] Verify telemetry is being collected
- [ ] Check for any errors or warnings
- [ ] Review performance metrics
- [ ] Set up alerts for critical metrics

### 6.5 Database Validation
- [ ] Connect to staging PostgreSQL
- [ ] Verify schema is correct
- [ ] Check data integrity
- [ ] Verify backups are configured
- [ ] Test restore procedure (on a copy)

**Reference:** See `TESTING_CHECKLIST.md` for detailed test cases

---

## 📊 Phase 7: Pre-Production Review

### 7.1 Stakeholder Sign-Off
- [ ] Demo staging environment to stakeholders
- [ ] Collect feedback
- [ ] Address any concerns
- [ ] Get formal approval for production deployment

### 7.2 Documentation Review
- [ ] Update README with production information
- [ ] Review and update all deployment documentation
- [ ] Ensure runbooks are up to date
- [ ] Document known issues and workarounds

### 7.3 Rollback Plan
- [ ] Document rollback procedure
- [ ] Verify deployment slots are configured for instant rollback
- [ ] Test rollback procedure in staging
- [ ] Ensure database backups are available for rollback

### 7.4 Communication Plan
- [ ] Schedule deployment maintenance window
- [ ] Prepare user notification (if applicable)
- [ ] Alert support team of deployment
- [ ] Prepare incident response plan

---

## 🏭 Phase 8: Production Infrastructure Setup

### 8.1 Deploy Production Infrastructure
Run deployment for production environment:

```bash
az deployment group create \
  --resource-group emrsim-chat-rg \
  --template-file infrastructure/main.bicep \
  --parameters environment=production \
               administratorLogin=emrsimadmin \
               administratorLoginPassword='<production-admin-password>'
```

- [ ] Run the deployment command
- [ ] Wait for deployment to complete
- [ ] Note down all output values

### 8.2 Configure Production Database
- [ ] Get PostgreSQL hostname
- [ ] Create application database user
- [ ] Configure firewall rules
- [ ] Set up automated backups
- [ ] Configure geo-redundancy (if required)

### 8.3 Get Production Static Web App Token
```bash
az staticwebapp secrets list --name stapp-emrsim-prod \
                              --resource-group emrsim-chat-rg \
                              --query properties.apiKey -o tsv
```

- [ ] Run command and copy token
- [ ] Add as `STATIC_WEB_APP_TOKEN` in production environment secrets

### 8.4 Update Production Secrets
- [ ] Update all production environment secrets with production values
- [ ] Double-check all secrets are set correctly
- [ ] Verify no staging values are used in production

### 8.5 Configure Production Monitoring
- [ ] Set up Application Insights for production
- [ ] Configure alerts for critical metrics:
  - [ ] High error rate (> 1%)
  - [ ] High response time (> 3s p95)
  - [ ] High CPU usage (> 80%)
  - [ ] High memory usage (> 85%)
  - [ ] Database connection failures
- [ ] Set up log analytics workspace
- [ ] Configure notification channels

---

## 🎯 Phase 9: Production Deployment

### 9.1 Final Pre-Deployment Checks
- [ ] All CI checks passing on `main` branch
- [ ] All production secrets configured
- [ ] Staging environment tested and approved
- [ ] Stakeholder approval received
- [ ] Support team alerted
- [ ] Rollback plan documented and tested

### 9.2 Execute Production Deployment
- [ ] Go to: Actions → "EMRsim-chat CD" workflow
- [ ] Click "Run workflow"
- [ ] Select branch: `main`
- [ ] Select environment: `production`
- [ ] Wait for approval (15 minute timer + manual approval)
- [ ] Approve deployment
- [ ] Monitor workflow execution

### 9.3 Monitor Production Deployment
Watch each deployment phase:
- [ ] Infrastructure deployment completes
- [ ] Backend deploys to staging slot
- [ ] Database migrations run successfully
- [ ] Smoke tests pass
- [ ] Slot swap executes (zero downtime)
- [ ] Frontend deploys
- [ ] Post-deployment tests pass

### 9.4 Immediate Post-Deployment Verification
**Within 5 minutes of deployment:**
- [ ] Access production URL
- [ ] Verify homepage loads
- [ ] Test user authentication
- [ ] Check one complete user flow
- [ ] Verify no errors in browser console
- [ ] Check Application Insights for errors

### 9.5 Extended Verification (First Hour)
- [ ] Monitor error rates in Application Insights
- [ ] Check response times
- [ ] Verify all integrations work
- [ ] Monitor database performance
- [ ] Check WebSocket connections
- [ ] Review logs for warnings

### 9.6 First Day Monitoring
- [ ] Check Application Insights dashboard every 2 hours
- [ ] Monitor for any user-reported issues
- [ ] Review performance metrics
- [ ] Check database backup ran successfully
- [ ] Verify monitoring alerts are working

---

## 📈 Phase 10: Post-Production Tasks

### 10.1 Documentation Updates
- [ ] Update README with production URLs
- [ ] Document any deployment issues encountered
- [ ] Update runbooks with lessons learned
- [ ] Document production access procedures

### 10.2 Team Handoff
- [ ] Train support team on production environment
- [ ] Provide access to monitoring dashboards
- [ ] Share incident response procedures
- [ ] Schedule knowledge sharing session

### 10.3 Continuous Monitoring Setup
- [ ] Set up weekly performance review
- [ ] Configure automated backup verification
- [ ] Schedule regular security scans
- [ ] Set up cost monitoring and alerts

### 10.4 Future Improvements
- [ ] Review and implement any delayed enhancements
- [ ] Plan for next feature release
- [ ] Schedule infrastructure review
- [ ] Plan capacity scaling strategy

---

## 🆘 Emergency Procedures

### Rollback to Previous Version
If critical issues occur:

```bash
# Swap production slot back to previous version
az webapp deployment slot swap \
  -n app-emrsim-prod \
  -g emrsim-chat-rg \
  --slot production \
  --target-slot staging
```

### Database Rollback
If database issues occur, see: `docs/DATABASE_RECOVERY_GUIDE.md`

### Emergency Contacts
- **DevOps Lead:** [Name and contact]
- **Database Admin:** [Name and contact]
- **Security Team:** [Name and contact]
- **Azure Support:** [Support plan details]

---

## 📞 Support Resources

- **GitHub Repository:** `https://github.com/yourusername/EMRsim-chat`
- **Azure Portal:** `https://portal.azure.com`
- **Documentation:** `docs/` directory in repository
- **Azure Service Setup:** `docs/AZURE_SERVICE_SETUP.md`
- **GitHub Setup:** `docs/GITHUB_SETUP_GUIDE.md`
- **Deployment Procedure:** `docs/DEPLOYMENT_PROCEDURE.md`
- **Database Migration:** `docs/DATABASE_MIGRATION_PLAN.md`
- **Production Readiness:** `PRODUCTION_READINESS_PLAN.md`

---

## ✅ Deployment Completion Checklist

Before considering deployment complete:

- [ ] Production application is accessible and functional
- [ ] All user flows tested and working
- [ ] No critical errors in logs
- [ ] Performance metrics within acceptable range
- [ ] Monitoring and alerts configured and working
- [ ] Team has been trained on production environment
- [ ] Documentation is updated
- [ ] Stakeholders notified of successful deployment
- [ ] Post-deployment retrospective scheduled

---

## 🎉 Congratulations!

Once all checklist items are complete, your EMRsim-chat application is successfully deployed to production!

**Remember:** Production deployment is not a one-time event. Continue monitoring, maintaining, and improving your application.

---

**Last Updated:** October 20, 2025
**Next Review:** [Schedule regular review date]
