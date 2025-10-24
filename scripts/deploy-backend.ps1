# Deploy Backend to Azure Container Apps
# This script builds and deploys the EMRsim backend to Azure

$ErrorActionPreference = "Stop"

# Set PATH
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

# Configuration
$resourceGroup = "emrsim-chat-prod"
$acrName = "emrsimacr"
$containerAppName = "emrsim-api-uat6lb"
$imageName = "backend"
$imageTag = "v1"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  EMRsim Backend Deployment to Azure" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Step 1: Navigate to backend directory
Write-Host "[1/5] 📁 Navigating to backend directory..." -ForegroundColor Yellow
Set-Location "C:\Users\danst\EMRsim-chat\backend"
Write-Host "✅ In backend directory`n" -ForegroundColor Green

# Step 2: Build image in ACR
Write-Host "[2/5] 🔨 Building Docker image in Azure Container Registry..." -ForegroundColor Yellow
Write-Host "      This will take 2-4 minutes. Please wait...`n" -ForegroundColor Gray

try {
    $buildResult = az acr build `
        --registry $acrName `
        --image "${imageName}:${imageTag}" `
        --file Dockerfile `
        . 2>&1

    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Build failed!" -ForegroundColor Red
        Write-Host $buildResult
        exit 1
    }
    
    Write-Host "✅ Docker image built successfully`n" -ForegroundColor Green
}
catch {
    Write-Host "❌ Error during build: $_" -ForegroundColor Red
    exit 1
}

# Step 3: Enable admin access on ACR
Write-Host "[3/5] 🔐 Enabling admin access on Container Registry..." -ForegroundColor Yellow
az acr update --name $acrName --admin-enabled true | Out-Null
Write-Host "✅ Admin access enabled`n" -ForegroundColor Green

# Step 4: Get ACR credentials
Write-Host "[4/5] 🔑 Getting registry credentials..." -ForegroundColor Yellow
$acrCredentials = az acr credential show --name $acrName | ConvertFrom-Json
$acrUsername = $acrCredentials.username
$acrPassword = $acrCredentials.passwords[0].value
Write-Host "✅ Credentials retrieved`n" -ForegroundColor Green

# Step 5: Update Container App with new image
Write-Host "[5/5] 🚀 Updating Container App with new image..." -ForegroundColor Yellow
Write-Host "      This will take 1-2 minutes...`n" -ForegroundColor Gray

try {
    az containerapp update `
        --name $containerAppName `
        --resource-group $resourceGroup `
        --image "${acrName}.azurecr.io/${imageName}:${imageTag}" `
        --registry-server "${acrName}.azurecr.io" `
        --registry-username $acrUsername `
        --registry-password $acrPassword | Out-Null
    
    Write-Host "✅ Container App updated successfully`n" -ForegroundColor Green
}
catch {
    Write-Host "❌ Error updating Container App: $_" -ForegroundColor Red
    exit 1
}

# Get the Container App URL
Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  🎉 DEPLOYMENT SUCCESSFUL!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green

$containerAppInfo = az containerapp show `
    --name $containerAppName `
    --resource-group $resourceGroup `
    --query "{url:properties.configuration.ingress.fqdn, status:properties.provisioningState}" `
    --output json | ConvertFrom-Json

Write-Host "Backend API URL:" -ForegroundColor Cyan
Write-Host "  https://$($containerAppInfo.url)" -ForegroundColor White
Write-Host "`nStatus: $($containerAppInfo.status)" -ForegroundColor Cyan
Write-Host "`nTest your API:" -ForegroundColor Yellow
Write-Host "  curl https://$($containerAppInfo.url)/health" -ForegroundColor Gray
Write-Host "`nView logs:" -ForegroundColor Yellow
Write-Host "  az containerapp logs show --name $containerAppName --resource-group $resourceGroup --follow" -ForegroundColor Gray
Write-Host "`n"
