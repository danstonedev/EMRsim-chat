# Production Startup Script
# Sets NODE_ENV and starts both frontend and backend in production mode

# Check if builds exist
Write-Host "Checking production builds..." -ForegroundColor Cyan

$frontendBuildExists = Test-Path "frontend/dist"
$backendBuildExists = Test-Path "backend/dist"

if (-not $frontendBuildExists -or -not $backendBuildExists) {
    Write-Host ""
    Write-Host "Production builds not found. Building now..." -ForegroundColor Yellow
    Write-Host ""
    
    if (-not $backendBuildExists) {
        Write-Host "Building backend..." -ForegroundColor Cyan
        cd backend
        npm run build
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Backend build failed!" -ForegroundColor Red
            exit 1
        }
        cd ..
    }
    
    if (-not $frontendBuildExists) {
        Write-Host "Building frontend..." -ForegroundColor Cyan
        cd frontend
        npm run build
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Frontend build failed!" -ForegroundColor Red
            exit 1
        }
        cd ..
    }
}

Write-Host ""
Write-Host "✓ Production builds ready" -ForegroundColor Green
Write-Host ""

# Check environment files
Write-Host "Checking environment configuration..." -ForegroundColor Cyan

if (-not (Test-Path "backend/.env")) {
    Write-Host "ERROR: backend/.env not found!" -ForegroundColor Red
    Write-Host "Run: npm run setup-env" -ForegroundColor Yellow
    exit 1
}

# Check for API key
$envContent = Get-Content "backend/.env" -Raw
if ($envContent -match "OPENAI_API_KEY=replace_me" -or $envContent -notmatch "OPENAI_API_KEY=sk-") {
    Write-Host "WARNING: OPENAI_API_KEY not configured in backend/.env" -ForegroundColor Yellow
    Write-Host "Please update backend/.env with your OpenAI API key" -ForegroundColor Yellow
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        exit 1
    }
}

Write-Host "✓ Environment configuration OK" -ForegroundColor Green
Write-Host ""

# Set production environment
$env:NODE_ENV = "production"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting EMRsim in PRODUCTION mode" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend will start on port 3002" -ForegroundColor White
Write-Host "Frontend preview will start on port 4173" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop both servers" -ForegroundColor Yellow
Write-Host ""

# Start backend in background
Write-Host "Starting backend server..." -ForegroundColor Cyan
$backendJob = Start-Job -ScriptBlock {
    $env:NODE_ENV = "production"
    cd $using:PWD\backend
    npm start
}

# Wait a bit for backend to start
Start-Sleep -Seconds 2

# Start frontend preview
Write-Host "Starting frontend preview server..." -ForegroundColor Cyan
cd frontend

try {
    # This will run in foreground - Ctrl+C will stop it
    npm run preview
}
finally {
    # Cleanup: Stop the backend job when frontend stops
    Write-Host ""
    Write-Host "Stopping servers..." -ForegroundColor Yellow
    Stop-Job $backendJob
    Remove-Job $backendJob
    Write-Host "Servers stopped" -ForegroundColor Green
}
