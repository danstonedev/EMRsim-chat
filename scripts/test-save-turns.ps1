param(
    [string]$BaseUrl = 'http://localhost:3002'
)

$ErrorActionPreference = 'Stop'

Write-Host "[test] BaseUrl=$BaseUrl"

function Get-Personas {
    return Invoke-RestMethod -Uri ($BaseUrl + '/api/sessions/sps/personas') -Method Get
}

function Get-Scenarios {
    return Invoke-RestMethod -Uri ($BaseUrl + '/api/sessions/sps/scenarios') -Method Get
}

function New-Session([string]$personaId, [string]$scenarioId) {
    $body = @{ persona_id = $personaId; scenario_id = $scenarioId; mode = 'sps' } | ConvertTo-Json -Depth 5
    return Invoke-RestMethod -Method Post -Uri ($BaseUrl + '/api/sessions') -ContentType 'application/json' -Body $body
}

function Save-Turns([string]$sessionId, $turns) {
    $sid = [uri]::EscapeDataString($sessionId)
    $body = @{ turns = $turns } | ConvertTo-Json -Depth 6
    return Invoke-RestMethod -Method Post -Uri ($BaseUrl + '/api/sessions/' + $sid + '/sps/turns') -ContentType 'application/json' -Body $body
}

function Get-Turns([string]$sessionId) {
    $sid = [uri]::EscapeDataString($sessionId)
    return Invoke-RestMethod -Uri ($BaseUrl + '/api/sessions/' + $sid + '/turns') -Method Get
}

Write-Host '[test] Fetching personas...'
$per = Get-Personas
if (-not $per -or -not $per.personas -or $per.personas.Count -eq 0) { throw 'No personas returned from backend.' }
$personaId = $per.personas[0].id
Write-Host "[test] Persona selected: $personaId"

Write-Host '[test] Fetching scenarios...'
$sc = Get-Scenarios
if (-not $sc -or -not $sc.scenarios -or $sc.scenarios.Count -eq 0) { throw 'No scenarios returned from backend.' }
$match = $sc.scenarios | Where-Object { $_.persona_id -eq $personaId } | Select-Object -First 1
if ($null -ne $match) { $scenarioId = $match.scenario_id } else { $scenarioId = $sc.scenarios[0].scenario_id }
Write-Host "[test] Scenario selected: $scenarioId"

Write-Host '[test] Creating session...'
$created = New-Session -personaId $personaId -scenarioId $scenarioId
$sessionId = $created.session_id
if (-not $sessionId) { throw 'No session_id returned from POST /api/sessions' }
Write-Host "[test] Session ID: $sessionId"

Write-Host '[test] Saving sample turns...'
$now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$turns = @(
    @{ role = 'user'; text = 'Hi Jordan, I am your PT student.'; channel = 'text'; timestamp_ms = $now },
    @{ role = 'assistant'; text = 'Hello! I am Jordan. How can I help you today?'; channel = 'text'; timestamp_ms = ($now + 1000) }
)
$saveResp = Save-Turns -sessionId $sessionId -turns $turns
Write-Host ('[test] save_response=' + ($saveResp | ConvertTo-Json -Depth 6))

Write-Host '[test] Fetching turns back...'
$turnsResp = Get-Turns -sessionId $sessionId
$count = 0
if ($turnsResp -and $turnsResp.turns) { $count = ($turnsResp.turns | Measure-Object | Select-Object -ExpandProperty Count) }
Write-Host "[test] turns_count=$count"
if ($count -gt 0) {
    $first = $turnsResp.turns | Select-Object -First 1
    $last = $turnsResp.turns | Select-Object -Last 1
    Write-Host ('[test] first_turn=' + ($first | ConvertTo-Json -Depth 6))
    Write-Host ('[test] last_turn=' + ($last | ConvertTo-Json -Depth 6))
}

Write-Host '[test] Done.'
