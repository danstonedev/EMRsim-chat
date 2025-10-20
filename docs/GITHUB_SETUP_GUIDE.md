# GitHub Repository Setup Guide for Azure Deployment

This document provides step-by-step instructions for setting up your GitHub repository to support automated deployments to Azure.

## 1. Repository Structure Setup

Ensure your repository has the following structure for optimal CI/CD workflow:

```
EMRsim-chat/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── cd.yml
├── src/
│   ├── client/
│   └── server/
├── infrastructure/
│   ├── main.bicep
│   ├── modules/
│   └── parameters/
├── scripts/
│   ├── load-test.js
│   └── database-benchmark.js
├── docs/
│   ├── DEPLOYMENT_PROCEDURE.md
│   ├── AZURE_DEPLOYMENT_ARCHITECTURE.md
│   └── GITHUB_SETUP_GUIDE.md
└── PRODUCTION_READINESS_PLAN.md
```

## 2. Branch Protection Rules

Set up branch protection rules to maintain code quality:

1. Go to your GitHub repository → Settings → Branches → Add rule
2. Configure the following settings:
   - **Branch name pattern**: `main`
   - **Require pull request reviews before merging**: ✓
   - **Required approvals**: 1
   - **Dismiss stale pull request approvals when new commits are pushed**: ✓
   - **Require status checks to pass before merging**: ✓
     - Required status checks: `test`, `build`, `e2e`
   - **Require branches to be up to date before merging**: ✓
   - **Do not allow bypassing the above settings**: ✓

3. Create the same rule for the `develop` branch with slightly less restrictive settings

## 3. GitHub Actions Setup

### 3.1. Create GitHub Environments

1. Go to your repository → Settings → Environments → New environment
2. Create the following environments:
   - `staging`
   - `production`

3. For the `production` environment, add protection rules:
   - Required reviewers: [add team members who can approve deployments]
   - Wait timer: 15 minutes
   - Deployment branches: `main`

### 3.2. Create GitHub Secrets

Go to Settings → Secrets and variables → Actions → New repository secret

Add the following secrets:

| Secret Name | Description |
|-------------|-------------|
| `AZURE_CREDENTIALS` | JSON output from Azure service principal creation |
| `AZURE_RESOURCE_GROUP` | Resource group name for your Azure resources |
| `PG_ADMIN_USERNAME` | PostgreSQL admin username |
| `PG_ADMIN_PASSWORD` | PostgreSQL admin password |
| `PG_HOST` | PostgreSQL server hostname |
| `PG_PORT` | PostgreSQL server port |
| `PG_DATABASE` | PostgreSQL database name |
| `PG_USER` | PostgreSQL application user |
| `PG_PASSWORD` | PostgreSQL application user password |
| `STATIC_WEB_APP_TOKEN` | Deployment token for Static Web App |
| `SLACK_WEBHOOK` | Webhook URL for deployment notifications |
| `CODECOV_TOKEN` | Token for code coverage reporting |
| `SONAR_TOKEN` | Token for SonarCloud analysis |

### 3.3. Create Environment Secrets

For each environment (`staging` and `production`), add environment-specific secrets:

1. Go to Settings → Environments → [environment name] → Add secret

Add the following environment secrets to both environments:

| Secret Name | Description |
|-------------|-------------|
| `AZURE_WEBAPP_NAME` | Name of the Azure Web App |
| `REACT_APP_API_URL` | Backend API URL for the environment |
| `REACT_APP_ENV` | Environment name (`staging` or `production`) |

## 4. Create Azure Service Principal

Run the following Azure CLI commands to create a service principal for GitHub Actions:

```bash
# Login to Azure
az login

# Set subscription (if you have multiple)
az account set --subscription <subscription-id>

# Create a resource group if you don't have one
az group create --name emrsim-chat-rg --location eastus

# Create service principal with Contributor role at resource group scope
az ad sp create-for-rbac --name "github-emrsim-deploy" \
                         --role contributor \
                         --scopes /subscriptions/<subscription-id>/resourceGroups/emrsim-chat-rg \
                         --sdk-auth
```

Copy the JSON output and save it as the `AZURE_CREDENTIALS` secret in GitHub.

## 5. GitHub Actions Workflow Files

Ensure the workflow files (`.github/workflows/ci.yml` and `.github/workflows/cd.yml`) are properly set up in your repository. These files should already be created as part of the project setup.

## 6. Initial Repository Push

If this is a new repository:

```bash
# Initialize git repository if not already done
git init

# Add remote
git remote add origin https://github.com/yourusername/EMRsim-chat.git

# Add all files
git add .

# Commit
git commit -m "Initial commit with Azure deployment setup"

# Create and push develop branch
git checkout -b develop
git push -u origin develop

# Create and push main branch
git checkout -b main
git push -u origin main
```

## 7. Testing GitHub Actions Setup

1. Go to Actions tab in your GitHub repository
2. Select the CI workflow
3. Click "Run workflow" and select the `develop` branch
4. Verify that the workflow runs successfully

## 8. Setting Up GitHub Issue Templates

Create issue templates to standardize issue reporting:

1. Create `.github/ISSUE_TEMPLATE/` directory
2. Add the following templates:
   - `bug_report.md`
   - `feature_request.md`
   - `deployment_request.md`

## 9. Setting Up Pull Request Template

Create a pull request template to ensure all PRs contain necessary information:

1. Create `.github/PULL_REQUEST_TEMPLATE.md`

## 10. Next Steps

After completing the GitHub repository setup:

1. Run the CI workflow to verify tests pass
2. Set up the staging environment in Azure using the CD workflow
3. Verify staging deployment works correctly
4. Run load tests in the staging environment
5. Plan the production deployment

## Troubleshooting Common Issues

### GitHub Actions Workflow Failures

- Check the error message in the workflow run
- Verify all secrets are correctly configured
- Ensure service principal has required permissions

### Azure Deployment Failures

- Check Azure deployment logs in the GitHub Actions output
- Verify resource constraints and quotas
- Ensure ARM template or Bicep files are valid
