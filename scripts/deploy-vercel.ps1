# EMRsim-chat Full Deployment to Vercel (Backend then Frontend)
# Usage (PowerShell):
#   powershell -ExecutionPolicy Bypass -File scripts/deploy-vercel.ps1

Write-Host "`nEMRsim-chat: Deploy Backend and Frontend to Vercel (prod)" -ForegroundColor Cyan

# 1) Ensure Vercel CLI
$vercelInstalled = Get-Command vercel -ErrorAction SilentlyContinue
if (-not $vercelInstalled) {
    Write-Host "Vercel CLI not found. Installing globally..." -ForegroundColor Yellow
    npm install -g vercel | Out-Null
}

# 2) Build both apps (quick sanity)
try {
    Write-Host "`nBuilding backend..." -ForegroundColor Yellow
    Push-Location backend
    npm run build | Out-Null
    Pop-Location

    Write-Host "Building frontend..." -ForegroundColor Yellow
    Push-Location frontend
    npm run build | Out-Null
    Pop-Location
}
catch {
    Write-Host "Build failed. Fix errors before deploying." -ForegroundColor Red
    exit 1
}

# 3) Deploy backend
Write-Host "`nDeploying backend to Vercel (prod)..." -ForegroundColor Cyan
Push-Location backend
$vercelOut = vercel --prod 2>&1
Pop-Location
Write-Host $vercelOut

# Try to extract backend URL
$backendUrl = ($vercelOut | Select-String -Pattern "https://[a-z0-9\-\.]+\.vercel\.app" -AllMatches | ForEach-Object { $_.Matches.Value } | Select-Object -Last 1)
if (-not $backendUrl) {
    Write-Host "Could not auto-detect backend URL from Vercel output. You'll need to paste it for the frontend." -ForegroundColor Yellow
}

# 4) Optionally set frontend Vercel env var via CLI
Write-Host "`nConfiguring frontend Vercel environment variable VITE_API_BASE_URL..." -ForegroundColor Cyan
if ($backendUrl) {
    Write-Host "Detected backend URL: $backendUrl" -ForegroundColor Green
}
$useDetected = $false
if ($backendUrl) {
    $answer = Read-Host "Use detected backend URL for VITE_API_BASE_URL? (y/n)"
    if ($answer -eq 'y') { $useDetected = $true }
}

$apiBase = $backendUrl
if (-not $useDetected) {
    $apiBase = Read-Host "Enter backend URL to use for VITE_API_BASE_URL (e.g., https://backend-xyz.vercel.app)"
}

if ($apiBase -and $apiBase.StartsWith("https://")) {
    Push-Location frontend
    try {
        Write-Host "Adding/Updating Vercel env var (production): VITE_API_BASE_URL=$apiBase" -ForegroundColor Yellow
        # This will prompt you to select project/environment if not linked
        # Use arrow keys to select "production" when asked
        $envAdd = "VITE_API_BASE_URL"
        # Vercel CLI expects interactive input; provide it when prompted
        vercel env add $envAdd production
        Write-Host "When prompted, paste: $apiBase" -ForegroundColor Cyan
    }
    catch {
        Write-Host "Failed to set env var via CLI. You can set it manually in Vercel Dashboard." -ForegroundColor Yellow
    }
    Pop-Location
}
else {
    Write-Host "Skipped setting Vercel env; invalid or empty URL provided." -ForegroundColor Yellow
}

# 5) Deploy frontend
Write-Host "`nDeploying frontend to Vercel (prod)..." -ForegroundColor Cyan
Push-Location frontend
$vercelOutFE = vercel --prod 2>&1
Pop-Location
Write-Host $vercelOutFE

Write-Host "`nDone. Verify both URLs in a browser and check Network tab for successful API calls." -ForegroundColor Green
