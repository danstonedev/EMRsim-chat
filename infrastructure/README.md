# Azure Infrastructure Files - Historical Reference

## ⚠️ Important Notice

The `infrastructure/` directory contains **Azure-specific Bicep templates** that are **NOT used for Vercel deployment**.

## What's in the Infrastructure Directory

```
infrastructure/
├── main.bicep                  # Full Azure deployment
├── main.basic.bicep           # Basic tier deployment
├── main.containerapp.bicep    # Container Apps deployment
├── main.free.bicep            # Free tier attempt
├── main.mysql.bicep           # MySQL database setup
├── main.students.bicep        # Azure for Students
└── main.students.v2.bicep     # Azure for Students v2
```

## Purpose

These files were created during exploration of Azure deployment options:
- Azure Container Apps
- Azure App Service
- Azure MySQL
- Azure Redis
- Azure Static Web Apps

## Current Status

- ❌ **Not actively used** for production
- ✅ **Kept for reference** if Azure deployment is needed in future
- ✅ **Does not interfere** with Vercel deployment

## Vercel vs Azure

| Aspect | Azure (Bicep) | Vercel |
|--------|--------------|---------|
| Deployment | Infrastructure as Code | Git push / CLI |
| Configuration | *.bicep files | vercel.json |
| Database | Azure MySQL | SQLite / External DB |
| Compute | Container Apps / App Service | Serverless Functions |
| Current Use | ❌ Not used | ✅ Active |

## Why Keep These Files?

1. **Historical Record**: Documents deployment attempts
2. **Future Option**: Can switch back to Azure if needed
3. **Learning Resource**: Shows infrastructure patterns
4. **No Harm**: Doesn't affect Vercel in any way

## If You Want to Deploy to Azure

See historical documentation:
- `AZURE_QUOTA_ISSUE.md`
- `DEPLOYMENT_OPTIONS.md`
- `QUICK_DEPLOYMENT_REFERENCE.md` (references Azure)

Then use:
```powershell
az deployment group create \
  --resource-group your-rg \
  --template-file infrastructure/main.bicep
```

## Current Production Deployment

**Platform**: Vercel  
**Configuration**: `backend/vercel.json` (backend) + Vite config (frontend)  
**No Azure resources required**

---

**Recommendation**: Keep these files but ignore them for current Vercel deployment.
