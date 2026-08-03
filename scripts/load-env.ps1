<#
.SYNOPSIS
    从根 .env 加载统一配置到当前 PowerShell 会话，并映射导出子项目变量名。

.DESCRIPTION
    用法（必须 dot-source，使变量在当前会话生效）：
        . .\scripts\load-env.ps1

    读取根 .env（KEY=VALUE 行，忽略注释与空行），导出供应商 API key 与
    QED_OCR_MODEL，并按下表映射为子项目现状变量名。映射表与
    docs/design/configuration-and-secrets.md 保持一致；子项目改造为直读
    新变量后，本脚本的映射层退役。

    映射：
        QWEN_API_KEY    -> AXIOM_API_KEY, DASHSCOPE_API_KEY
        QED_OCR_MODEL   -> AXIOM_VISION_MODEL

    幂等：重复执行只覆盖同名变量，不产生副作用。
#>

$ErrorActionPreference = "Stop"

$envFile = Join-Path $PSScriptRoot "..\.env"
if (-not (Test-Path -LiteralPath $envFile)) {
    Write-Host "未找到 $envFile，跳过加载。" -ForegroundColor Yellow
    return
}

# 解析 .env：跳过空行与 # 注释，取 KEY=VALUE
$vars = @{}
Get-Content -LiteralPath $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) { return }
    $idx = $line.IndexOf("=")
    if ($idx -le 0) { return }
    $key = $line.Substring(0, $idx).Trim()
    $value = $line.Substring($idx + 1).Trim()
    if ($key -ne "") { $vars[$key] = $value }
}

# 导出到当前会话（dot-source 时即调用方会话）
foreach ($key in $vars.Keys) {
    Set-Item -Path "Env:$key" -Value $vars[$key]
}

# 映射导出子项目现状变量名（仅当源变量非空）
$mapping = @{
    "QWEN_API_KEY"  = @("AXIOM_API_KEY", "DASHSCOPE_API_KEY")
    "QED_OCR_MODEL" = @("AXIOM_VISION_MODEL")
}
$exported = @()
foreach ($src in $mapping.Keys) {
    if ($vars.ContainsKey($src) -and $vars[$src] -ne "") {
        foreach ($dst in $mapping[$src]) {
            Set-Item -Path "Env:$dst" -Value $vars[$src]
            $exported += "$src -> $dst"
        }
    }
}

Write-Host "已从 $envFile 加载 $(($vars.Keys | Measure-Object).Count) 个变量。"
if ($exported.Count -gt 0) {
    Write-Host "映射导出：" -NoNewline
    Write-Host ($exported -join "; ")
} else {
    Write-Host "映射导出：无（源变量均为空）" -ForegroundColor Yellow
}
