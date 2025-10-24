# ⚡ START HERE - Azure Deployment Quick Commands

**You just restarted PowerShell after installing Azure CLI.**

## 🎯 First - Verify Installation

```powershell
az --version
```

✅ If this works, you're ready to proceed!

## 🚀 Quick Start (5 minutes)

```powershell
# 1. Login to Azure
az login

# 2. Verify your subscription
az account show

# 3. Run the interactive helper
.\deploy-helper.ps1
```

The helper script will guide you through:
- Creating Azure resources
- Setting up GitHub
- Deploying to staging
- Deploying to production

## 📖 Full Documentation

If you prefer step-by-step instructions:

**→ Open:** `AFTER_RESTART_GUIDE.md`

This has all commands with explanations!

## 📚 Other Guides

- **DEPLOYMENT_GUIDE.md** - Navigation and overview
- **PRODUCTION_DEPLOYMENT_CHECKLIST.md** - Complete checklist
- **DEPLOYMENT_QUICK_START.md** - Fast-track guide
- **docs/GITHUB_SETUP_GUIDE.md** - GitHub configuration
- **docs/AZURE_SERVICE_SETUP.md** - Azure CLI commands

## ⚡ Fastest Path to Deployment

```powershell
# Just run these in order:
az login
.\deploy-helper.ps1
# Follow the prompts!
```

## 🎓 What Happens Next

1. **Azure Setup** - Create resource group and service principal
2. **GitHub Config** - Set up environments and secrets
3. **Deploy Staging** - First deployment to test environment
4. **Test Staging** - Verify everything works
5. **Deploy Production** - Go live!

**Total time:** 3-4 hours

---

**Quick tip:** If you see errors about Azure CLI not found, you may need to restart your computer (not just PowerShell).

**Ready?** Run: `az login`
