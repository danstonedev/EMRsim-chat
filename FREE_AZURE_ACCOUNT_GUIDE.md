# Deploying EMRsim-Chat with Free Azure Account

## Why Free Azure Instead of Azure for Students?

Your Azure for Students account has zero VM quota, which blocks App Service deployment. The **free Azure account** is actually better for web app deployment:

| Feature | Azure for Students | Free Azure Account |
|---------|-------------------|-------------------|
| VM Quota | ❌ 0 (blocked) | ✅ Included |
| Credit | $100/year | $200 for 30 days |
| Free Services Duration | Limited | 12 months |
| App Service | ❌ Blocked | ✅ 10 free web apps |
| PostgreSQL | Must pay | ✅ 750 hours/month free |
| Redis | Must pay | ✅ 250 MB free |
| Credit Card Required | No | Yes (verification only) |
| Auto-charge After Credit | No | Only with explicit upgrade |

## Step 1: Create Free Azure Account

### Option A: New Microsoft Account
1. Go to https://azure.microsoft.com/free/
2. Click "Start free"
3. Use a **different email** than your student account
4. Provide credit card (for verification - won't be charged)
5. Complete verification

### Option B: Add Free Account to Existing Microsoft Account
1. Sign out of Azure portal
2. Go to https://azure.microsoft.com/free/
3. Sign in with your **personal Microsoft account** (not @ndus.edu)
4. Add free subscription to existing account

## Step 2: Sign In with New Account

```powershell
# Sign out of current account
az logout

# Sign in with new free account
az login

# Verify you're using the free subscription
az account show --query "{Name:name, SubscriptionId:id, State:state}" --output table
```

## Step 3: Deploy EMRsim-Chat

Now you can use our existing Bicep templates that were blocked before:

```powershell
# Refresh PATH
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Create resource group
az group create --name emrsim-chat-free --location westus2

# Deploy infrastructure (this will work now!)
az deployment group create \
  --resource-group emrsim-chat-free \
  --template-file infrastructure/main.free.bicep \
  --parameters administratorLogin=emrsimadmin \
               administratorLoginPassword='EMRsim2025!Secure#Pass'
```

## Step 4: Build and Deploy Application

### Deploy Backend
```powershell
cd backend

# Install dependencies
npm install

# Build
npm run build

# Create deployment package
Compress-Archive -Path * -DestinationPath ../backend.zip -Force

# Deploy to App Service
cd ..
$webAppName = az deployment group show --resource-group emrsim-chat-free --name main.free --query properties.outputs.webAppName.value -o tsv

az webapp deployment source config-zip \
  --resource-group emrsim-chat-free \
  --name $webAppName \
  --src backend.zip
```

### Deploy Frontend
```powershell
cd frontend

# Install and build
npm install
npm run build

# Get Static Web App deployment token
$token = az staticwebapp secrets list \
  --name (az deployment group show --resource-group emrsim-chat-free --name main.free --query properties.outputs.staticWebAppName.value -o tsv) \
  --resource-group emrsim-chat-free \
  --query properties.apiKey -o tsv

# Install SWA CLI
npm install -g @azure/static-web-apps-cli

# Deploy
swa deploy ./dist --deployment-token $token
```

## What's Included in Free Tier?

### Free for 12 Months:
- **App Service**: F1 tier - 1 GB storage, 60 minutes/day compute
- **PostgreSQL**: B1ms - 32 GB storage, 750 hours/month
- **Redis**: C0 - 250 MB, basic tier
- **Static Web Apps**: Free tier forever
- **Bandwidth**: 5 GB outbound/month
- **Storage**: 5 GB LRS
- **Application Insights**: First 5 GB/month

### After 12 Months:
- Static Web Apps remain free
- Others switch to pay-as-you-go (but very cheap for small apps)
- You control when to upgrade from free

## Cost Management

### Stay Within Free Limits:
```powershell
# Set up cost alerts
az consumption budget create \
  --budget-name "Monthly-Free-Tier-Alert" \
  --amount 0 \
  --time-grain Monthly \
  --start-date (Get-Date -Format "yyyy-MM-01") \
  --end-date ((Get-Date).AddYears(1) | Get-Date -Format "yyyy-MM-dd")
```

### Monitor Usage:
```powershell
# Check current costs
az consumption usage list \
  --start-date (Get-Date).AddDays(-30).ToString("yyyy-MM-dd") \
  --end-date (Get-Date).ToString("yyyy-MM-dd") \
  --output table

# Check remaining credit
az account show --query "name" -o tsv
```

## Advantages of Free Account

1. **No Quota Issues** - Full VM quota included
2. **Better Documentation** - More community support for free tier
3. **Easier Upgrades** - Can upgrade specific services as needed
4. **$200 Initial Credit** - Try premium features
5. **12 Months Free** - Plenty of time for your project
6. **No Auto-Charge** - Must explicitly upgrade to paid

## Comparison: What You Get

| Component | Azure Students (Blocked) | Free Account |
|-----------|-------------------------|--------------|
| Backend API | ❌ Can't deploy | ✅ F1 tier included |
| Frontend | ❌ Quota issues | ✅ Free tier forever |
| PostgreSQL | ❌ $12/month | ✅ 750 hours free |
| Redis | ❌ $16/month | ✅ 250 MB free |
| **Monthly Cost** | **Can't deploy** | **$0 for 12 months** |

## Quick Start Commands

```powershell
# 1. Logout and login with free account
az logout
az login

# 2. Create resources
az group create --name emrsim-chat-free --location westus2

# 3. Deploy infrastructure
az deployment group create \
  --resource-group emrsim-chat-free \
  --template-file infrastructure/main.free.bicep \
  --parameters administratorLogin=emrsimadmin administratorLoginPassword='EMRsim2025!Secure#Pass'

# 4. Wait 10-15 minutes for deployment
# 5. Deploy your application code (see Step 4 above)
```

## Important Notes

### Credit Card Requirement
- ✅ Required for verification only
- ✅ Won't be charged during free period
- ✅ Won't auto-charge after - requires explicit upgrade
- ✅ Can remove card after verification

### Managing Both Accounts
```powershell
# Switch between subscriptions
az account list --output table
az account set --subscription "YOUR-FREE-SUBSCRIPTION-NAME"
```

## Next Steps

**Ready to proceed?**

1. **Create free account**: Visit https://azure.microsoft.com/free/
2. **Come back here** and run the deployment commands
3. **Your app will be running** in 30-40 minutes

This is honestly the easiest path - the free account has everything you need and none of the quota restrictions!

Would you like me to help you proceed once you've created the free account?
