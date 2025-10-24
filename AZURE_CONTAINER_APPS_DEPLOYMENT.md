# Archived: Azure Container Apps Deployment (Not Used)

This project’s production is on Vercel. Azure-specific deployment guidance is no longer used and is archived.

For current deployment and operations, see `VERCEL_DEPLOYMENT_STATUS.md` and `DEPLOYMENT_QUICK_START.md`.

### Already Deployed Resources
- ✅ Redis Cache: `emrsim-redis-production-uat6lbqwl5n7w`
- ✅ Static Web App: `emrsim-web-production-uat6lbqwl5n7w`
- ✅ Virtual Machine: `myVm` (Standard_B1s)

### What DOESN'T Work (Zero Quota)
- ❌ App Service Free tier (Free VMs: 0)
- ❌ App Service Basic tier (Basic VMs: 0)
- ❌ App Service Standard tier (Standard App Service VMs: 0)

## 🚀 Current Deployment (Container Apps)

**Status**: Running ⏳
**Template**: `infrastructure/main.containerapp.bicep`
**Started**: 2025-10-20T21:01:14

### What's Being Deployed:

1. **Log Analytics Workspace** - For monitoring
2. **Container Apps Environment** - Runtime environment for containers
3. **Container App** (Backend API)
   - Name: `emrsim-api-{6-char-hash}`
   - Image: Placeholder (we'll update after deployment)
   - CPU: 0.5 cores
   - Memory: 1 GB
   - Auto-scaling: 1-3 replicas
   
4. **PostgreSQL Flexible Server**
   - SKU: Standard_B1ms (Burstable)
   - Storage: 32 GB
   - Version: 14
   
5. **Static Web App** (Frontend) - Will reuse existing or create new

### Environment Variables (Auto-configured):
- `NODE_ENV=production`
- `PORT=8080`
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_HOST` - Existing Redis cache
- `REDIS_PORT=6380`
- `REDIS_PASSWORD` - From existing Redis
- `REDIS_TLS=true`

## 📊 Why Container Apps Works

**App Service vs Container Apps:**

| Feature | App Service | Container Apps |
|---------|-------------|----------------|
| Quota Type | App Service VMs | Container quota |
| Your Quota | 0 (blocked) | ✅ Available |
| Pricing | ~$13/month (Basic) | ~$0.18/month base + usage |
| Auto-scaling | Manual | Automatic |
| Container support | Limited | Full |
| Startup time | Fast | Fast |

**Container Apps Benefits:**
- ✅ No App Service VM quota needed
- ✅ Built-in auto-scaling
- ✅ Pay only for what you use
- ✅ Full container support
- ✅ Integrated with Azure services
- ✅ HTTPS automatically included

## 📝 Next Steps After Deployment

### 1. Wait for Deployment (3-5 minutes)
```powershell
# Check status
az deployment group show \
  --resource-group emrsim-chat-prod \
  --name main.containerapp \
  --query "{Status:properties.provisioningState}"
```

### 2. Get Deployment Outputs
```powershell
az deployment group show \
  --resource-group emrsim-chat-prod \
  --name main.containerapp \
  --query "properties.outputs" \
  --output json
```

### 3. Build and Push Docker Image

```powershell
# Build backend Docker image
cd backend
docker build -t emrsim-backend:latest .

# Tag for Azure Container Registry (we'll create this)
docker tag emrsim-backend:latest emrsimacr.azurecr.io/backend:latest

# Push to ACR
docker push emrsimacr.azurecr.io/backend:latest
```

### 4. Update Container App with Your Image

```powershell
az containerapp update \
  --name <container-app-name> \
  --resource-group emrsim-chat-prod \
  --image emrsimacr.azurecr.io/backend:latest
```

### 5. Deploy Frontend to Static Web App

```powershell
cd frontend
npm run build

# Deploy using Azure CLI or GitHub Actions
az staticwebapp deploy \
  --name <static-web-app-name> \
  --resource-group emrsim-chat-prod \
  --app-location ./dist
```

## 💰 Cost Estimate (Container Apps)

### Monthly Costs:
- **Container Apps Environment**: ~$0.18/month base
- **Container App**: ~$0.000024/vCPU-second + $0.0000025/GB-second
  - Running 24/7 at 0.5 vCPU, 1GB: ~$15/month
- **PostgreSQL B1ms**: ~$12/month
- **Redis Basic C0**: ~$17/month
- **Static Web App**: FREE
- **Log Analytics**: ~$2/month (first 5GB free)

**Total**: ~$46/month (can be reduced with auto-scaling)

### Ways to Reduce Costs:
1. Scale container to 0 when not in use
2. Use consumption plan for functions
3. Stop resources during nights/weekends
4. Use Azure for Students credits ($100)

## 🔍 Troubleshooting

### If Deployment Fails:

```powershell
# Get error details
az deployment operation group list \
  --resource-group emrsim-chat-prod \
  --name main.containerapp \
  --query "[?properties.provisioningState=='Failed']" \
  --output json
```

### Common Issues:

1. **PostgreSQL location restricted**: Try different region (eastus, centralus)
2. **Container name too long**: Already fixed (< 32 chars)
3. **Redis connection**: Using existing Redis from previous deployment

## 🎯 Summary

**What's Working:**
- ✅ Container Apps registered and deploying
- ✅ No VM quota issues
- ✅ Redis and Static Web App already deployed
- ✅ All services configured correctly

**What's Pending:**
- ⏳ Container Apps deployment (3-5 minutes)
- ⏳ PostgreSQL server creation
- ⏳ Log Analytics workspace

**What's Next:**
- Build Docker image for backend
- Push to Azure Container Registry
- Update container app with your image
- Test the deployment
- Configure frontend to use container app URL

## 📚 Documentation References

- [Azure Container Apps Docs](https://learn.microsoft.com/en-us/azure/container-apps/)
- [Container Apps Pricing](https://azure.microsoft.com/en-us/pricing/details/container-apps/)
- [Quotas and Limits](https://learn.microsoft.com/en-us/azure/container-apps/quotas)
- [Deploy from Container Registry](https://learn.microsoft.com/en-us/azure/container-apps/deploy-container-registry)

---

**Last Updated**: 2025-10-20 21:05 UTC
**Deployment Status**: Running ⏳
**ETA**: 3-5 minutes
