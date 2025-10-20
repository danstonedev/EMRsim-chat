# EMRsim-chat Deployment Helper
# Run this script to prepare for deployment

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host " EMRsim-chat Production Deployment Helper" -ForegroundColor Cyan  
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# Check prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Yellow

# Git
try {
    $gitVersion = git --version
    Write-Host "  [OK] Git: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] Git not found" -ForegroundColor Red
}

# Node.js
try {
    $nodeVersion = node --version
    Write-Host "  [OK] Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] Node.js not found" -ForegroundColor Red
}

# Azure CLI
try {
    az version --output none 2>$null
    Write-Host "  [OK] Azure CLI installed" -ForegroundColor Green
} catch {
    Write-Host "  [WARN] Azure CLI not found - install from: https://aka.ms/installazurecliwindows" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. COMMIT CHANGES" -ForegroundColor Yellow
Write-Host "   git add -A"
Write-Host "   git commit -m 'Prepare for production deployment'"
Write-Host ""
Write-Host "2. SETUP GITHUB" -ForegroundColor Yellow  
Write-Host "   - Review: docs\GITHUB_SETUP_GUIDE.md"
Write-Host "   - Configure branch protection"
Write-Host "   - Create staging and production environments"
Write-Host "   - Add repository secrets"
Write-Host ""
Write-Host "3. SETUP AZURE (after installing Azure CLI)" -ForegroundColor Yellow
Write-Host "   az login"
Write-Host "   az group create --name emrsim-chat-rg --location eastus"
Write-Host "   - Follow: docs\AZURE_SERVICE_SETUP.md"
Write-Host ""
Write-Host "4. DEPLOY" -ForegroundColor Yellow
Write-Host "   - Push code to GitHub"
Write-Host "   - Run CI workflow"
Write-Host "   - Run CD workflow for staging"
Write-Host "   - Test staging"
Write-Host "   - Run CD workflow for production"
Write-Host ""
Write-Host "DOCUMENTATION:" -ForegroundColor Cyan
Write-Host "  Start here: DEPLOYMENT_GUIDE.md"
Write-Host "  Detailed:   PRODUCTION_DEPLOYMENT_CHECKLIST.md"
Write-Host "  Quick:      DEPLOYMENT_QUICK_START.md"
Write-Host ""

$choice = Read-Host "Do you want to commit changes now? (y/n)"
if ($choice -eq 'y') {
    Write-Host ""
    Write-Host "Staging all changes..." -ForegroundColor Yellow
    git add -A
    Write-Host "Committing..." -ForegroundColor Yellow
    git commit -m "Prepare for production deployment - $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    Write-Host "Done!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next: Push to GitHub and follow DEPLOYMENT_GUIDE.md" -ForegroundColor Cyan
}
