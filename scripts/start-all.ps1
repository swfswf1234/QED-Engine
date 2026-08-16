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

# conda 环境 python（QED_env）：PATH 中的 python 可能是基础环境（无 uvicorn），
# 启动后端/前端必须用 QED_env（服务端依赖 uvicorn；serve_web.py 亦统一走该解释器）。
$Py = "python"
foreach ($cand in @(
    "$env:USERPROFILE\anaconda3\envs\QED_env\python.exe",
    "D:\software\anaconda3\envs\QED_env\python.exe",
    "C:\ProgramData\anaconda3\envs\QED_env\python.exe"
)) {
    if (Test-Path $cand) { $Py = $cand; break }
}

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
    $p = Start-Process -FilePath $Py -ArgumentList "-m", "uvicorn", "qed_engine.api.main:app", "--host", "127.0.0.1", "--port", "8900" -WorkingDirectory $Root -RedirectStandardOutput $log -RedirectStandardError "$log.err" -PassThru -WindowStyle Hidden
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
        # 21 期：http.server 无缓存头导致浏览器启发式缓存旧 app.js/style.css（改版不可见），
        # 改用 scripts/serve_web.py（响应统一 Cache-Control: no-store）。
        $p = Start-Process -FilePath $Py -ArgumentList "scripts/serve_web.py" -WorkingDirectory $Root -RedirectStandardOutput $log -RedirectStandardError "$log.err" -PassThru -WindowStyle Hidden
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