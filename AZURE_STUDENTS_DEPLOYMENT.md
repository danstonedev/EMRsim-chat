# Azure for Students Deployment Guide

## Overview

Azure for Students accounts have some limitations compared to full subscriptions:
- Cannot create service principals (requires directory admin permissions)
- Limited to certain regions and services
- Some features may not be available

This guide provides an alternative deployment approach that works with these limitations.

## Deployment Strategy

Instead of using GitHub Actions with service principals, we'll use:
1. **Direct CLI deployment** for initial setup
2. **Azure Static Web Apps GitHub integration** (uses built-in authentication)
3. **Manual App Service deployment** via ZIP or local Git

## Step 1: Deploy Frontend (Static Web App)

### Create Static Web App with GitHub Integration
```powershell
# This will prompt you to authenticate with GitHub
az staticwebapp create \
  --name emrsim-chat-frontend \
  --resource-group emrsim-chat-rg \
  --source https://github.com/YOUR-USERNAME/EMRsim-chat \
  --location "East US 2" \
  --branch main \
  --app-location "/frontend" \
  --output-location "dist" \
  --login-with-github
```

**What this does:**
- Creates a Static Web App resource
- Automatically adds GitHub Actions workflow to your repo
- Uses GitHub's built-in authentication (no service principal needed)
- Deploys your frontend automatically on push

## Step 2: Deploy Backend (App Service)

### Option A: Create App Service and Deploy via ZIP

```powershell
# Create App Service Plan
az appservice plan create \
  --name emrsim-chat-plan \
  --resource-group emrsim-chat-rg \
  --location eastus \
  --sku B1 \
  --is-linux

# Create Web App
az webapp create \
  --name emrsim-chat-backend \
  --resource-group emrsim-chat-rg \
  --plan emrsim-chat-plan \
  --runtime "NODE:22-lts"

# Build and deploy
cd backend
npm install
npm run build
zip -r ../backend.zip .
cd ..

az webapp deployment source config-zip \
  --resource-group emrsim-chat-rg \
  --name emrsim-chat-backend \
  --src backend.zip
```

### Option B: Local Git Deployment

```powershell
# Enable local git
az webapp deployment source config-local-git \
  --name emrsim-chat-backend \
  --resource-group emrsim-chat-rg

# Get deployment credentials
az webapp deployment list-publishing-credentials \
  --name emrsim-chat-backend \
  --resource-group emrsim-chat-rg

# Add Azure remote and push
cd backend
git init
git add .
git commit -m "Initial backend"
git remote add azure https://emrsim-chat-backend.scm.azurewebsites.net:443/emrsim-chat-backend.git
git push azure main
```

## Step 3: Create Database

### PostgreSQL Flexible Server
```powershell
# Create PostgreSQL server
az postgres flexible-server create \
  --name emrsim-chat-db \
  --resource-group emrsim-chat-rg \
  --location eastus \
  --admin-user emrsimadmin \
  --admin-password "YourSecurePassword123!" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --storage-size 32 \
  --version 14

# Allow Azure services
az postgres flexible-server firewall-rule create \
  --resource-group emrsim-chat-rg \
  --name emrsim-chat-db \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

# Create database
az postgres flexible-server db create \
  --resource-group emrsim-chat-rg \
  --server-name emrsim-chat-db \
  --database-name emrsimchat
```

### Get Connection String
```powershell
az postgres flexible-server show-connection-string \
  --server-name emrsim-chat-db \
  --admin-user emrsimadmin \
  --admin-password "YourSecurePassword123!" \
  --database-name emrsimchat
```

## Step 4: Create Redis Cache

```powershell
az redis create \
  --name emrsim-chat-redis \
  --resource-group emrsim-chat-rg \
  --location eastus \
  --sku Basic \
  --vm-size c0
```

## Step 5: Configure App Settings

### Backend Environment Variables
```powershell
az webapp config appsettings set \
  --name emrsim-chat-backend \
  --resource-group emrsim-chat-rg \
  --settings \
    DATABASE_URL="postgres://emrsimadmin:YourSecurePassword123!@emrsim-chat-db.postgres.database.azure.com:5432/emrsimchat?sslmode=require" \
    REDIS_HOST="emrsim-chat-redis.redis.cache.windows.net" \
    REDIS_PORT="6380" \
    REDIS_PASSWORD="$(az redis list-keys --name emrsim-chat-redis --resource-group emrsim-chat-rg --query primaryKey -o tsv)" \
    NODE_ENV="production"
```

### Frontend Environment Variables (Static Web App)
```powershell
# Static Web Apps use application settings
az staticwebapp appsettings set \
  --name emrsim-chat-frontend \
  --resource-group emrsim-chat-rg \
  --setting-names \
    VITE_API_URL="https://emrsim-chat-backend.azurewebsites.net"
```

## Step 6: Run Database Migrations

```powershell
# SSH into the web app
az webapp ssh \
  --name emrsim-chat-backend \
  --resource-group emrsim-chat-rg

# Inside the SSH session
cd /home/site/wwwroot
npm run migrate
exit
```

## Step 7: Verify Deployment

### Check Backend
```powershell
# Open backend in browser
az webapp browse \
  --name emrsim-chat-backend \
  --resource-group emrsim-chat-rg

# View logs
az webapp log tail \
  --name emrsim-chat-backend \
  --resource-group emrsim-chat-rg
```

### Check Frontend
```powershell
# Get Static Web App URL
az staticwebapp show \
  --name emrsim-chat-frontend \
  --resource-group emrsim-chat-rg \
  --query "defaultHostname" -o tsv
```

## Alternative: Use Bicep with Manual Parameters

If you want to use the Bicep template but can't use GitHub Actions:

```powershell
# Deploy infrastructure
az deployment group create \
  --resource-group emrsim-chat-rg \
  --template-file infrastructure/main.bicep \
  --parameters \
    environment=production \
    administratorLogin=emrsimadmin \
    administratorLoginPassword='YourSecurePassword123!'
```

## Troubleshooting

### Service Principal Errors
- **Issue**: "Insufficient privileges to complete the operation"
- **Solution**: Use the direct deployment methods above instead of GitHub Actions with service principals

### Region Availability
- **Issue**: Service not available in selected region
- **Solution**: Try alternative regions like "East US 2", "Central US", or "West US"

### Cost Management
Monitor your Azure for Students credits:
```powershell
az consumption usage list \
  --start-date 2025-01-01 \
  --end-date 2025-12-31
```

## Next Steps

1. **Create GitHub Repository**
   - Push your code to GitHub
   - The Static Web App will automatically create a workflow

2. **Configure Custom Domain** (Optional)
   ```powershell
   az staticwebapp hostname set \
     --name emrsim-chat-frontend \
     --resource-group emrsim-chat-rg \
     --hostname yourdomain.com
   ```

3. **Set up Monitoring**
   ```powershell
   # Enable Application Insights
   az monitor app-insights component create \
     --app emrsim-chat-insights \
     --location eastus \
     --resource-group emrsim-chat-rg
   ```

## Resources

- [Azure for Students Documentation](https://docs.microsoft.com/azure/education/)
- [Static Web Apps CLI](https://azure.github.io/static-web-apps-cli/)
- [App Service Deployment](https://docs.microsoft.com/azure/app-service/deploy-zip)
