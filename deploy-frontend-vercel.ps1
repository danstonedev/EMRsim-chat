# Quick Deploy Script for Frontend to Vercel (ASCII-only to avoid PowerShell parsing issues)

Write-Host "`nEMRsim-chat Frontend Deployment to Vercel`n" -ForegroundColor Cyan

# Check if vercel CLI is installed
$vercelInstalled = Get-Command vercel -ErrorAction SilentlyContinue
if (-not $vercelInstalled) {
  Write-Host "Vercel CLI not found. Installing...`n" -ForegroundColor Yellow
  npm install -g vercel
}

# Navigate to frontend directory
Set-Location -Path $PSScriptRoot\frontend

Write-Host "Creating production build configuration...`n" -ForegroundColor Green

# Resolve API base from .env.production, fallback to existing value if missing
$envProdPath = Join-Path $PSScriptRoot 'frontend/.env.production'
$apiBase = 'https://your-backend.vercel.app'
if (Test-Path $envProdPath) {
  try {
    $line = (Get-Content $envProdPath | Where-Object { $_ -match '^\s*VITE_API_BASE_URL\s*=' } | Select-Object -First 1)
    if ($line) {
      $val = $line -replace '^\s*VITE_API_BASE_URL\s*=\s*', ''
      if ($val) { $apiBase = $val.Trim() }
    }
  }
  catch {
    Write-Host "Could not read .env.production; using default API base for vercel.json" -ForegroundColor Yellow
  }
}

# Create vercel.json (always updated to ensure envs are current)
$vercelConfig = @"
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "env": {
    "VITE_API_BASE_URL": "$apiBase",
    "VITE_VOICE_ENABLED": "true",
    "VITE_SPS_ENABLED": "true",
    "VITE_BANNERS_ENABLED": "true",
    "VITE_CHAT_ANIMATIONS_ENABLED": "true",
    "VITE_ADAPTIVE_VAD": "true",
    "VITE_ADAPTIVE_VAD_BADGE": "false",
    "VITE_ADAPTIVE_VAD_DEBUG": "false",
    "VITE_VIEWER_AA": "false",
    "VITE_VIEWER_SHADOWS": "false",
    "VITE_VIEWER_PERF_MODE": "false",
    "VITE_RENDER_METRICS": "false",
    "VITE_STT_FALLBACK_MS": "800",
    "VITE_VOICE_DEBUG": "false",
    "VITE_VOICE_BARGE_IN": "false"
  }
}
"@

# Write JSON without BOM to avoid CLI parse issues
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path (Get-Location) "vercel.json"), $vercelConfig, $utf8NoBom)

Write-Host "Configuration created!`n" -ForegroundColor Green
Write-Host "Deploying to Vercel...`n" -ForegroundColor Cyan
Write-Host "   Follow the prompts to:" -ForegroundColor White
Write-Host "   1. Login to Vercel (if not logged in)" -ForegroundColor White
Write-Host "   2. Select or create a project" -ForegroundColor White
Write-Host "   3. Confirm deployment settings`n" -ForegroundColor White

# Deploy to Vercel
vercel --prod

Write-Host "`nDeployment complete!`n" -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "   1. Copy your Vercel URL from above" -ForegroundColor White
Write-Host '   2. Update backend CORS: cd ..\backend' -ForegroundColor White
Write-Host "   3. Update CORS_ORIGIN in Vercel backend environment variables to include your frontend URL`n" -ForegroundColor White
