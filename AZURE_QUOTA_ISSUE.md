# Azure for Students Deployment - Issue Summary

## Current Situation

Your Azure for Students subscription has **zero VM quota** for App Service plans, which prevents deploying the EMRsim-chat backend API using traditional Azure App Service.

### Quota Limitations Discovered:
- ❌ **Basic VMs**: 0 quota (cannot deploy B1 tier App Service)
- ❌ **Free VMs**: 0 quota (cannot deploy F1 tier App Service)
- ❌ **Region Restrictions**: Deployment restricted to specific regions by policy

### What This Means:
- Cannot deploy using App Service (requires VM quota)
- Cannot use traditional hosting methods for Node.js backend
- Need alternative deployment strategies that don't require VM quota

## Alternative Deployment Options

### Option 1: Request Quota Increase (Recommended for Production)
```powershell
# Submit a quota increase request
az support tickets create \
  --title "Request VM Quota Increase for Azure for Students" \
  --description "Need to deploy web application for academic project. Requesting Basic VM quota increase to 1." \
  --severity minimal \
  --contact-method email \
  --contact-email daniel.j.stone@ndus.edu
```

**Timeline**: Typically 1-3 business days  
**Success Rate**: High for educational purposes  
**Cost**: Still within $100/year credit limit

### Option 2: Use Azure Container Instances (ACI)
Azure Container Instances don't count against VM quota and can host Node.js apps.

**Pros:**
- ✅ No VM quota required
- ✅ Pay only when running
- ✅ Simple deployment

**Cons:**
- ❌ No built-in scaling
- ❌ More complex setup than App Service
- ❌ May exceed student credit faster

**Deployment:**
```powershell
# Build and push container
docker build -t emrsim-backend ./backend
docker tag emrsim-backend emrsimchat.azurecr.io/backend:latest
docker push emrsimchat.azurecr.io/backend:latest

# Deploy to ACI
az container create \
  --resource-group emrsim-chat-app \
  --name emrsim-api \
  --image emrsimchat.azurecr.io/backend:latest \
  --cpu 1 \
  --memory 1 \
  --ports 8080 \
  --environment-variables \
    NODE_ENV=production \
    PG_HOST=$pgHost \
    PG_DATABASE=emrsimdb \
    PG_USER=emrsimadmin \
    PG_PASSWORD='EMRsim2025!Secure#Pass'
```

### Option 3: Use Azure Functions (Serverless)
Rewrite backend as Azure Functions (consumption plan - no VM quota needed).

**Pros:**
- ✅ No VM quota required
- ✅ Scales automatically
- ✅ Pay per execution (very cheap for student projects)
- ✅ 1 million free executions/month

**Cons:**
- ❌ Requires code refactoring
- ❌ WebSocket support limited
- ❌ Different programming model

### Option 4: Static Web Apps with API Backend
Use Static Web Apps managed functions (built-in).

**Pros:**
- ✅ No VM quota required
- ✅ Fully integrated with frontend
- ✅ Free tier available
- ✅ GitHub Actions built-in

**Cons:**
- ❌ Limited to HTTP functions (no WebSockets)
- ❌ Requires API restructuring

**Deployment:**
```powershell
# Static Web Apps can include API functions
az staticwebapp create \
  --name emrsim-app \
  --resource-group emrsim-chat-app \
  --source https://github.com/YOUR-USER/EMRsim-chat \
  --branch main \
  --app-location "/frontend" \
  --api-location "/api" \
  --output-location "dist"
```

### Option 5: Use Different Azure Subscription
If you have access to a Visual Studio subscription, Microsoft Partner subscription, or can create a Pay-As-You-Go subscription.

**Pros:**
- ✅ No quota restrictions
- ✅ Full control
- ✅ Can use any services

**Cons:**
- ❌ Costs money (though can be minimal)
- ❌ Requires credit card

### Option 6: Deploy to Non-Azure Platform
Use platforms that have better free tiers for students:

**Heroku**:
- Free tier available
- Easy deployment
- PostgreSQL add-on
- Redis add-on

**Vercel**:
- Free tier available
- Supports Node.js deployments
- GitHub integration
- Easy frontend + backend deployment

**Render**:
- Free tier for web services
- PostgreSQL hosting
- Redis hosting

**Fly.io**:
- Free tier includes 3 VMs
- PostgreSQL hosting
- Redis hosting

## Recommended Path Forward

### Immediate: Option 1 + Option 6
1. **Request quota increase** (do this NOW - takes 1-3 days)
2. **Deploy to Vercel/Render/Fly.io** (works within 30 minutes) for immediate testing
3. **Migrate to Azure** once quota is approved

### Commands to Request Quota:

#### Via Azure Portal:
1. Go to https://portal.azure.com
2. Search for "Quotas"
3. Click "Request increase"
4. Select "Compute-VM (cores-vCPUs) subscription limit increase"
5. Fill in details:
   - **Deployment Model**: Resource Manager
   - **Location**: West US 2
   - **SKU family**: BS Series (Basic)
   - **New limit**: 1 vCPU
6. Submit

#### Via Support Ticket:
```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Create support ticket for quota increase
az support tickets create \
  --ticket-name "vm-quota-increase" \
  --title "Azure for Students VM Quota Increase Request" \
  --description "I am working on an academic project (EMR simulation chat application) and need to deploy a Node.js backend API. Currently have 0 quota for Basic VMs. Requesting increase to 1 vCPU for Basic BS Series in West US 2 region. Project is for educational purposes as part of coursework." \
  --problem-classification-id "/providers/Microsoft.Support/services/quota_service_guid/problemClassifications/quota_problemClassification_guid" \
  --severity minimal
```

## What We've Accomplished So Far

✅ Azure CLI configured
✅ Logged into Azure account
✅ Created resource group (emrsim-chat-app)
✅ Identified quota limitations
✅ Created multiple Bicep templates optimized for students
✅ Documentation created for alternative approaches

## Next Steps

**Choose Your Path:**

**Path A - Wait for Azure (Recommended for Learning Azure)**
1. Request quota increase NOW
2. Wait 1-3 business days
3. Deploy using our Bicep templates
4. Learn Azure-specific technologies

**Path B - Deploy Elsewhere Immediately**
1. Choose platform (Vercel recommended - easiest)
2. Deploy frontend + backend in 30 minutes
3. Get app running today
4. Migrate to Azure later if desired

**Path C - Redesign for Serverless**
1. Refactor backend to Azure Functions
2. Use Static Web Apps for frontend
3. No VM quota needed
4. More Azure-native architecture

## Cost Comparison

| Platform | Monthly Cost | Student Credit | Real Cost |
|----------|-------------|----------------|-----------|
| Azure (B1 tier) | ~$41/month | $8.33/month | $32.67 out-of-pocket |
| Azure (after quota) | ~$41/month | $8.33/month | $32.67 out-of-pocket |
| Vercel | $0 (free tier) | N/A | $0 |
| Render | $0 (free tier) | N/A | $0 |
| Fly.io | $0 (free tier) | N/A | $0 |
| Heroku | $0 (free tier being phased out) | N/A | Varies |

## Decision Time

What would you like to do?

1. **Request Azure quota increase and wait** - Best for learning Azure
2. **Deploy to Vercel/Render immediately** - Best for getting it working NOW
3. **Redesign for Azure Functions** - Best for staying in Azure with no quota issues

Let me know and I'll help you proceed with whichever option you prefer!
