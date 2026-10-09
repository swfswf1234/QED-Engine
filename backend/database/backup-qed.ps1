# Generate a rollback snapshot of the qed database via mysqldump.
# Snapshots go to the data root only: <QED_DATA_ROOT>/backups/<YYYY-MM-DD>-<TaskId>/ (ADR 0019
# 第 4 条：仓库内不设备份位；快照仅供当次 D 类数据操作的回滚窗口，验收通过即清)。
# Password is read from -Password or $env:QED_DB_PASSWORD (root .env may set it).
param(
    [string]$Host = "127.0.0.1",
    [int]$Port = 3306,
    [string]$User = "root",
    [string]$Password = "",
    [string]$Db = "qed",
    [string]$TaskId = "manual",
    [string]$DataRoot = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not $DataRoot) { $DataRoot = if ($env:QED_DATA_ROOT) { $env:QED_DATA_ROOT } else { Join-Path $Root "dataset" } }
$BackupDir = Join-Path $DataRoot ("backups\" + (Get-Date -Format "yyyy-MM-dd") + "-$TaskId")
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

if (-not $Password) { $Password = $env:QED_DB_PASSWORD }
$passwordArg = if ($Password) { "--password=$Password" } else { "--password" }

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$out = Join-Path $BackupDir "qed-$stamp.sql"

Write-Host "Backing up '$Db'@$Host`:$Port -> $out"
& mysqldump --host $Host --port $Port --user $User $passwordArg --single-transaction --routines --databases $Db | Out-File -FilePath $out -Encoding utf8

if ($LASTEXITCODE -ne 0) { throw "mysqldump failed with exit code $LASTEXITCODE" }
Write-Host "Backup complete: $out"