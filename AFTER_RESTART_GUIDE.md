# 🚀 After Restart - Quick Start Commands

Welcome back! Here's your quick reference for starting the deployment.

## ✅ First - Verify Azure CLI

```powershell
az --version
```

You should see version information. If not, Azure CLI may not be installed correctly.

## 🔐 Step 1: Login to Azure

```powershell
az login
```

This will open a browser window for authentication.

## 📊 Step 2: Check Your Subscription

```powershell
# List all subscriptions
az account list --output table

# Set the subscription you want to use
az account set --subscription "YOUR-SUBSCRIPTION-NAME-OR-ID"

# Verify the active subscription
az account show
```

## 🏗️ Step 3: Create Resource Group

```powershell
# Create resource group for the application
az group create --name emrsim-chat-rg --location eastus

# Verify it was created
az group show --name emrsim-chat-rg
```

## 🔑 Step 4: Create Service Principal for GitHub

```powershell
# Get your subscription ID
$subscriptionId = (az account show --query id -o tsv)

# Create service principal
az ad sp create-for-rbac `
  --name "github-emrsim-deploy" `
  --role contributor `
  --scopes "/subscriptions/$subscriptionId/resourceGroups/emrsim-chat-rg" `
  --sdk-auth
```

**IMPORTANT:** Copy the entire JSON output - you'll need it for GitHub secrets!

Save it temporarily to a file:

```powershell
# Save to file (delete this after adding to GitHub!)
az ad sp create-for-rbac `
  --name "github-emrsim-deploy" `
  --role contributor `
  --scopes "/subscriptions/$subscriptionId/resourceGroups/emrsim-chat-rg" `
  --sdk-auth | Out-File -FilePath azure-credentials.json
```

## 📤 Step 5: Push to GitHub

If you haven't set up your GitHub remote:

```powershell
# Create a new repository on GitHub first, then:
git remote add origin https://github.com/YOUR-USERNAME/EMRsim-chat.git
git push -u origin master
```

If you already have a remote:

```powershell
git push
```

## ⚙️ Step 6: Configure GitHub

Go to your GitHub repository and configure:

### A. Create Environments
1. Go to: Settings → Environments → New environment
2. Create `staging` environment
3. Create `production` environment (add required reviewers)

### B. Add Repository Secrets
Go to: Settings → Secrets and variables → Actions → New repository secret

Add these secrets:

| Secret Name | Value | Where to Get It |
|-------------|-------|-----------------|
| `AZURE_CREDENTIALS` | JSON from Step 4 | Output from service principal command |
| `AZURE_RESOURCE_GROUP` | `emrsim-chat-rg` | The resource group you created |
| `AZURE_SUBSCRIPTION_ID` | Your subscription ID | From `az account show` |
| `PG_ADMIN_USERNAME` | `emrsimadmin` | Choose a username |
| `PG_ADMIN_PASSWORD` | Strong password | Generate a secure password |

### C. Add Environment Secrets

For **staging** environment:
- `AZURE_WEBAPP_NAME`: `app-emrsim-staging`
- `REACT_APP_API_URL`: Will be set after deployment
- `REACT_APP_ENV`: `staging`
- `PG_HOST`: Will be set after infrastructure deployment
- `PG_PORT`: `5432`
- `PG_DATABASE`: `emrsim`
- `PG_USER`: `emrsimapp`
- `PG_PASSWORD`: Generate a secure password

For **production** environment:
- Same as staging but with `-prod` names and different passwords

## 🚀 Step 7: Deploy Infrastructure

```powershell
# Deploy staging infrastructure
az deployment group create `
  --resource-group emrsim-chat-rg `
  --template-file infrastructure/main.bicep `
  --parameters environment=staging `
               administratorLogin=emrsimadmin `
               administratorLoginPassword='YOUR-ADMIN-PASSWORD'
```

## 🎯 Step 8: Trigger CI/CD Deployment

1. Go to GitHub repository → Actions tab
2. Run "EMRsim-chat CI" workflow on `develop` branch
3. Verify all tests pass
4. Run "EMRsim-chat CD" workflow:
   - Branch: `main`
   - Environment: `staging`
5. Monitor the deployment

## 📋 Alternative: Use the Helper Script

Instead of manual commands, run:

```powershell
.\deploy-helper.ps1
```

This interactive script guides you through all steps.

## 📖 Detailed Documentation

For comprehensive instructions, see:

- **Full checklist:** `PRODUCTION_DEPLOYMENT_CHECKLIST.md`
- **Quick reference:** `DEPLOYMENT_QUICK_START.md`
- **Navigation guide:** `DEPLOYMENT_GUIDE.md`
- **GitHub setup:** `docs/GITHUB_SETUP_GUIDE.md`
- **Azure setup:** `docs/AZURE_SERVICE_SETUP.md`

## 🆘 Troubleshooting

### Azure CLI not found
```powershell
# Verify installation path
$env:PATH -split ';' | Select-String -Pattern 'azure-cli'

# If not found, add manually (adjust path if needed):
$env:PATH += ";C:\Program Files (x86)\Microsoft SDKs\Azure\CLI2\wbin"
```

### Can't login to Azure
- Make sure you have a valid Azure subscription
- Try opening browser manually if auto-open fails
- Use `az login --use-device-code` for alternative method

### Service principal creation fails
- Ensure you have permissions to create service principals
- Check if you're Owner or Contributor on the subscription
- Try: `az ad sp create-for-rbac --help` for more options

## ✅ Quick Checklist

- [ ] Azure CLI verified: `az --version`
- [ ] Logged into Azure: `az login`
- [ ] Resource group created
- [ ] Service principal created and JSON saved
- [ ] Code pushed to GitHub
- [ ] GitHub environments created (staging, production)
- [ ] GitHub secrets configured
- [ ] Infrastructure deployed
- [ ] CI workflow passed
- [ ] CD workflow running

## 🎉 You're on Your Way!

Follow these steps in order, and you'll have your application deployed to Azure!

**Current Status:** Azure CLI installed ✅
**Next:** Restart PowerShell and run through these commands

---

**Last Updated:** October 20, 2025
