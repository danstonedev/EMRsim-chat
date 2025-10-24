[CmdletBinding()]
param(
    # Optional override; if not provided, script will try $env:PORT, then .env PORT, else 3001
    [int]$Port
)

$ErrorActionPreference = 'Stop'
try {
    $backendRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

    # Resolve desired port: argument > backend/.env PORT > $env:PORT > default 3001
    if (-not $Port) {
        $envFile = Join-Path $backendRoot '.env'
        if (Test-Path $envFile) {
            try {
                $pairs = Get-Content $envFile -ErrorAction SilentlyContinue | ForEach-Object {
                    $l = $_.Trim()
                    if ($l -and -not $l.StartsWith('#')) {
                        $eq = $l.IndexOf('=')
                        if ($eq -gt 0) {
                            $k = $l.Substring(0, $eq).Trim()
                            $v = $l.Substring($eq + 1).Trim()
                            [pscustomobject]@{ Key = $k; Value = $v }
                        }
                    }
                }
                $portEntry = $pairs | Where-Object { $_.Key -ieq 'PORT' } | Select-Object -First 1
                if ($portEntry -and ($portEntry.Value -match '^[0-9]+$')) { 
                    $Port = [int]$portEntry.Value 
                    Write-Output "Detected PORT from .env: $Port"
                }
            }
            catch { }
        }
    }
    if (-not $Port) {
        if ($env:PORT) {
            [void][int]::TryParse($env:PORT, [ref]$Port)
        }
    }
    if (-not $Port) { $Port = 3001 }

    Write-Output "backendRoot=$backendRoot"
    Write-Output ("Resolved Port=$Port | ENV PORT=$($env:PORT)")

    # Probe multiple candidate ports to see if backend is already up
    $candidates = @()
    if ($Port) { $candidates += $Port }
    if ($env:PORT -and ($env:PORT -match '^[0-9]+$')) { $candidates += [int]$env:PORT }
    $candidates += 3001
    $candidates = $candidates | Select-Object -Unique
    Write-Output ("Candidate ports to probe: " + ($candidates -join ', '))

    foreach ($p in $candidates) {
        Write-Verbose "Probing port $p" -Verbose
        $listening = $false
        try {
            $conn = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort $p -State Listen -ErrorAction SilentlyContinue
            if ($conn) { $listening = $true }
        }
        catch {
            try {
                $tnc = Test-NetConnection -ComputerName '127.0.0.1' -Port $p -WarningAction SilentlyContinue -ErrorAction SilentlyContinue
                if ($tnc -and $tnc.TcpTestSucceeded) { $listening = $true }
            }
            catch { }
        }
        if ($listening) {
            Write-Output "Backend already listening on port $p"
            exit 0
        }
    }

    # Not listening yet: start the dev server
    Set-Location $backendRoot
    Write-Output "Starting backend dev server on port $Port..."
    npm run dev
}
catch {
    Write-Error ("ERROR in start-or-skip.ps1: " + $_.Exception.Message)
    exit 1
}
