# QED-Engine root services stopper.
# Stops the processes recorded in tmp/ by start-all.ps1 (8900 backend, 8903 frontend).
# QED-Tracker (8901) / Axiom-Flow (8902) are managed by the control center;
# stop them there or manually in their own repositories.
param()

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$TmpDir = Join-Path $Root "tmp"

foreach ($pair in @(@("qed-engine-backend.pid", "backend (8900)"), @("qed-engine-frontend.pid", "frontend (8903)"))) {
    $pidFile = Join-Path $TmpDir $pair[0]
    $name = $pair[1]
    if (-not (Test-Path -LiteralPath $pidFile)) {
        Write-Host "$name : not running (no pid file)"
        continue
    }
    $pidVal = Get-Content -LiteralPath $pidFile -ErrorAction SilentlyContinue
    $proc = Get-Process -Id ([int]$pidVal) -ErrorAction SilentlyContinue
    if ($proc) {
        Stop-Process -Id ([int]$pidVal) -Force
        Write-Host "$name : stopped"
    } else {
        Write-Host "$name : already stopped"
    }
    Remove-Item -LiteralPath $pidFile -Force
}

Write-Host "done. QED-Tracker/Axiom-Flow are managed by the control center (service endpoints)."