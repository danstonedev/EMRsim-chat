# Archived: EMRsim-Chat Azure Deployment - Quick Reference (Redacted)

Note: This document contained environment-specific credentials and connection details. All sensitive values have been redacted. If you need to use Azure again, regenerate credentials and update a secure, private runbook instead of committing secrets to the repo.

## 🌐 Your Live URLs

**Backend API**: https://emrsim-api-uat6lb.thankfulrock-92b7f4ef.westus2.azurecontainerapps.io  
**Frontend**: https://jolly-sea-03c6ed81e.3.azurestaticapps.net

## 🚀 Next Steps (Priority Order)

### 1. Deploy Backend Docker Image (Required!)
```powershell
# Create Container Registry
az acr create --resource-group emrsim-chat-prod --name emrsimacr --sku Basic

# Build and push
cd backend
az acr build --registry emrsimacr --image backend:v1 .

# Get credentials
az acr credential show --name emrsimacr

# Update Container App
az containerapp update \
  --name emrsim-api-uat6lb \
  --resource-group emrsim-chat-prod \
  --image emrsimacr.azurecr.io/backend:v1 \
  --registry-server emrsimacr.azurecr.io \
  --registry-username <username> \
  --registry-password <password>
```

### 2. Run Database Migrations
```powershell
az containerapp exec \
  --name emrsim-api-uat6lb \
  --resource-group emrsim-chat-prod \
  --command "npm run migrate"
```

### 3. Update Frontend Config
```javascript
// frontend/.env.production
VITE_API_URL=https://emrsim-api-uat6lb.thankfulrock-92b7f4ef.westus2.azurecontainerapps.io
```

### 4. Deploy Frontend
```powershell
cd frontend
npm run build
# Deploy via GitHub Actions or Azure CLI
```

## 📊 Resource Names

| Resource | Name |
|----------|------|
| Container App | emrsim-api-uat6lb |
| MySQL Server | emrsim-mysql-production-uat6lbqwl5n7w |
| MySQL Database | emrsimdb |
| Redis Cache | emrsim-redis-production-uat6lbqwl5n7w |
| Static Web App | emrsim-web-production-uat6lbqwl5n7w |
| Resource Group | emrsim-chat-prod |

## 🔐 Credentials

**MySQL**:
- Username: `[REDACTED]`
- Password: `[REDACTED]`
- Host: `[REDACTED]`
- Port: `3306`

## 🛠️ Useful Commands

```powershell
# View logs
az containerapp logs show --name emrsim-api-uat6lb --resource-group emrsim-chat-prod --follow

# Restart app
az containerapp revision restart --name emrsim-api-uat6lb --resource-group emrsim-chat-prod

# List all resources
az resource list --resource-group emrsim-chat-prod --output table

# Test MySQL connection
az mysql flexible-server connect \
  --name emrsim-mysql-production-uat6lbqwl5n7w \
  --resource-group emrsim-chat-prod \
  --admin-user emrsimadmin
```

## 💰 Monthly Cost: ~$46

## ✅ What's Working
- ✅ MySQL database (20GB)
- ✅ Redis cache (250MB)
- ✅ Container Apps environment
- ✅ Static Web App (frontend)
- ✅ Log Analytics monitoring

## ⚠️ What Needs Configuration
- ⚠️ Backend Docker image (placeholder currently)
- ⚠️ Database migrations
- ⚠️ Frontend deployment with correct API URL

---

**Status**: Infrastructure deployed, needs application code deployment  
**Region**: West US 2  
**Deployment Date**: October 20, 2025
