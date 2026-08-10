# QED-Engine root services launcher.
# Starts: 8900 backend (uvicorn) and 8903 frontend (http.server).
# Logs -> logs/, PIDs -> tmp/.
# QED-Tracker (8901) / Axiom-Flow (8902) are hosted by the control center
# (service-control endpoints) or started manually in their own repositories.
param(
    [switch]$NoFrontend
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $Root "logs"
$TmpDir = Join-Path $Root "tmp"
New-Item -ItemType Directory -Force -Path $LogDir, $TmpDir | Out-Null

function Get-Running([string]$PidFile) {
    if (-not (Test-Path -LiteralPath $PidFile)) { return $null }
    $pidVal = Get-Content -LiteralPath $PidFile -ErrorAction SilentlyContinue
    if (-not $pidVal) { return $null }
    $proc = Get-Process -Id ([int]$pidVal) -ErrorAction SilentlyContinue
    if ($proc) { return $proc }
    Remove-Item -LiteralPath $PidFile -Force
    return $null
}

$BackendPid = Join-Path $TmpDir "qed-engine-backend.pid"
if (Get-Running $BackendPid) {
    Write-Host "backend (8900): already running"
} else {
    Write-Host "starting backend (8900) ..."
    $log = Join-Path $LogDir "qed-engine-backend.log"
    $p = Start-Process -FilePath "python" `
        -ArgumentList "-m", "uvicorn", "qed_engine.api.main:app", "--host", "127.0.0.1", "--port", "8900" `
        -WorkingDirectory $Root -RedirectStandardOutput $log -RedirectStandardError $log -PassThru -WindowStyle Hidden
    Set-Content -Path $BackendPid -Value $p.Id
    Write-Host "backend pid: $($p.Id), log: $log"
}

if (-not $NoFrontend) {
    $FrontendPid = Join-Path $TmpDir "qed-engine-frontend.pid"
    if (Get-Running $FrontendPid) {
        Write-Host "frontend (8903): already running"
    } else {
        Write-Host "starting frontend (8903) ..."
        $log = Join-Path $LogDir "qed-engine-frontend.log"
        $p = Start-Process -FilePath "python" `
            -ArgumentList "-m", "http.server", "8903", "--directory", "web" `
            -WorkingDirectory $Root -RedirectStandardOutput $log -RedirectStandardError $log -PassThru -WindowStyle Hidden
        Set-Content -Path $FrontendPid -Value $p.Id
        Write-Host "frontend pid: $($p.Id), log: $log"
    }
}

Write-Host "service probes:"
foreach ($pair in @(@("8901", "QED-Tracker"), @("8902", "Axiom-Flow"))) {
    $port = $pair[0]; $name = $pair[1]
    try {
        Invoke-WebRequest -Uri "http://127.0.0.1:$port/api/v1/health" -UseBasicParsing -TimeoutSec 2 | Out-Null
        Write-Host "  $name ($port): online"
    } catch {
        Write-Host "  $name ($port): offline (start via control center or manually)"
    }
}
Write-Host "frontend: open http://127.0.0.1:8903"