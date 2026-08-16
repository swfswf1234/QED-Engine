# Backup the qed database to backend/database/backups/ via mysqldump.
# Password is read from -Password or $env:QED_DB_PASSWORD (root .env may set it).
param(
    [string]$Host = "127.0.0.1",
    [int]$Port = 3306,
    [string]$User = "root",
    [string]$Password = "",
    [string]$Db = "qed"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$BackupDir = Join-Path $Root "backend\database\backups"
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

if (-not $Password) { $Password = $env:QED_DB_PASSWORD }
$passwordArg = if ($Password) { "--password=$Password" } else { "--password" }

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$out = Join-Path $BackupDir "qed-$stamp.sql"

Write-Host "Backing up '$Db'@$Host`:$Port -> $out"
& mysqldump --host $Host --port $Port --user $User $passwordArg --single-transaction --routines --databases $Db | Out-File -FilePath $out -Encoding utf8

if ($LASTEXITCODE -ne 0) { throw "mysqldump failed with exit code $LASTEXITCODE" }
Write-Host "Backup complete: $out"