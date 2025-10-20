# Quick Deployment Commands for Azure for Students

## Check Deployment Status
```powershell
# Refresh PATH first
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Check current deployment operations
az deployment group list --resource-group emrsim-chat-rg --output table

# Get detailed status
az deployment operation group list --resource-group emrsim-chat-rg --name main.students --output table
```

## After Infrastructure Deployment Completes

### 1. Get Deployment Outputs
```powershell
az deployment group show --resource-group emrsim-chat-rg --name main.students --query properties.outputs --output json
```

### 2. Build and Deploy Backend
```powershell
# Navigate to backend
cd backend

# Install dependencies
npm install

# Build the application
npm run build

# Create deployment package
Compress-Archive -Path * -DestinationPath ../backend.zip -Force

# Deploy to App Service
cd ..
az webapp deployment source config-zip --resource-group emrsim-chat-rg --name emrsim-api-production --src backend.zip
```

### 3. Run Database Migrations
```powershell
# Get the web app URL
$webAppUrl = az webapp show --resource-group emrsim-chat-rg --name emrsim-api-production --query defaultHostName -o tsv

# SSH into the app (or use Kudu console at https://emrsim-api-production.scm.azurewebsites.net)
az webapp ssh --resource-group emrsim-chat-rg --name emrsim-api-production

# Inside SSH session:
cd /home/site/wwwroot
npm run migrate
```

### 4. Deploy Frontend to Static Web App

#### Option A: Using GitHub (Recommended)
```powershell
# First, create a GitHub repository and push your code
# Then link it to the Static Web App:

az staticwebapp update --name emrsim-web-production --resource-group emrsim-chat-rg

# Get the deployment token
$deploymentToken = az staticwebapp secrets list --name emrsim-web-production --resource-group emrsim-chat-rg --query properties.apiKey -o tsv

Write-Host "Deployment Token: $deploymentToken"
Write-Host "Add this as a GitHub secret named AZURE_STATIC_WEB_APPS_API_TOKEN"
```

#### Option B: Using SWA CLI (Local Deployment)
```powershell
# Install Static Web Apps CLI globally
npm install -g @azure/static-web-apps-cli

# Build frontend
cd frontend
npm install
npm run build

# Get deployment token
$token = az staticwebapp secrets list --name emrsim-web-production --resource-group emrsim-chat-rg --query properties.apiKey -o tsv

# Deploy
swa deploy ./dist --deployment-token $token
```

### 5. Configure Frontend Environment Variables
```powershell
# Get backend URL
$backendUrl = "https://emrsim-api-production.azurewebsites.net"

# Update Static Web App configuration
az staticwebapp appsettings set --name emrsim-web-production --resource-group emrsim-chat-rg --setting-names "VITE_API_URL=$backendUrl"
```

## Verify Deployment

### Check Backend Health
```powershell
# Test backend endpoint
$backendUrl = az webapp show --resource-group emrsim-chat-rg --name emrsim-api-production --query defaultHostName -o tsv
curl "https://$backendUrl/api/health"
```

### Check Frontend
```powershell
# Get Static Web App URL
$frontendUrl = az staticwebapp show --name emrsim-web-production --resource-group emrsim-chat-rg --query defaultHostname -o tsv
Write-Host "Frontend URL: https://$frontendUrl"

# Open in browser
Start-Process "https://$frontendUrl"
```

### View Logs
```powershell
# Backend logs
az webapp log tail --resource-group emrsim-chat-rg --name emrsim-api-production

# Download logs
az webapp log download --resource-group emrsim-chat-rg --name emrsim-api-production --log-file backend-logs.zip
```

## Monitoring

### Check Resource Status
```powershell
az resource list --resource-group emrsim-chat-rg --output table
```

### Check Costs
```powershell
# View current month usage (for Azure for Students credit tracking)
az consumption usage list --start-date (Get-Date).ToString("yyyy-MM-01") --end-date (Get-Date).ToString("yyyy-MM-dd")
```

## Troubleshooting

### Backend Issues
```powershell
# Restart web app
az webapp restart --resource-group emrsim-chat-rg --name emrsim-api-production

# Check app settings
az webapp config appsettings list --resource-group emrsim-chat-rg --name emrsim-api-production --output table

# Update an app setting
az webapp config appsettings set --resource-group emrsim-chat-rg --name emrsim-api-production --settings "NODE_ENV=production"
```

### Database Connection Issues
```powershell
# Test PostgreSQL connection
$pgHost = az postgres flexible-server show --resource-group emrsim-chat-rg --name emrsim-db-production --query fullyQualifiedDomainName -o tsv
Write-Host "PostgreSQL Host: $pgHost"

# Check firewall rules
az postgres flexible-server firewall-rule list --resource-group emrsim-chat-rg --name emrsim-db-production --output table
```

### Redis Issues
```powershell
# Check Redis status
az redis show --resource-group emrsim-chat-rg --name emrsim-redis-production --output table

# Get Redis keys
az redis list-keys --resource-group emrsim-chat-rg --name emrsim-redis-production
```

## Cleanup (if needed)

### Delete Everything
```powershell
# WARNING: This deletes all resources!
az group delete --name emrsim-chat-rg --yes --no-wait
```

### Delete Specific Resources
```powershell
# Delete just the web app
az webapp delete --resource-group emrsim-chat-rg --name emrsim-api-production

# Delete just the database
az postgres flexible-server delete --resource-group emrsim-chat-rg --name emrsim-db-production --yes
```

## Quick Reference

| Resource Type | Name | Purpose |
|--------------|------|---------|
| Resource Group | emrsim-chat-rg | Container for all resources |
| App Service Plan | emrsim-plan-production | Hosting plan for backend |
| Web App | emrsim-api-production | Backend API server |
| Static Web App | emrsim-web-production | Frontend application |
| PostgreSQL Server | emrsim-db-production | Database server |
| PostgreSQL Database | emrsimdb | Application database |
| Redis Cache | emrsim-redis-production | Session/cache storage |

## Next Steps After Initial Deployment

1. ✅ Wait for infrastructure deployment to complete (~10-15 minutes)
2. ⏳ Deploy backend application code
3. ⏳ Run database migrations
4. ⏳ Deploy frontend application
5. ⏳ Test the application
6. ⏳ Set up custom domain (optional)
7. ⏳ Configure monitoring alerts
