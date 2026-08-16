# verify-release.ps1 - Verify a GitHub one-click release is live and byte-identical
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\verify-release.ps1 -Owner zjdjfjd764 -Repo zhm- -Branch main -LocalDir D:\path\to\project
#   # projects without a restore/uninstall script: pass a custom required-root-file list
#   powershell -ExecutionPolicy Bypass -File .\verify-release.ps1 -Owner zjdjfjd764 -Repo dsh-skills -LocalDir D:\path -RequiredRootFiles install.ps1,README.md
#
# Checks:
#   1. Repo is public and reachable (api.github.com works even where raw is blocked)
#   2. Root contents list matches expectations
#   3. jsDelivr-served install.ps1 is byte-identical to the local one
#   4. Prints the jsDelivr purge URL you must hit after every update
param(
    [Parameter(Mandatory = $true)][string]$Owner,
    [Parameter(Mandatory = $true)][string]$Repo,
    [string]$Branch = 'main',
    [Parameter(Mandatory = $true)][string]$LocalDir,
    [string[]]$RequiredRootFiles = @('install.ps1', 'README.md')
)
$ErrorActionPreference = 'Stop'
$h = @{ 'User-Agent' = 'verify-release' }
$fail = 0

function Fail([string]$m) { $script:fail++; Write-Host ("  [FAIL] " + $m) -ForegroundColor Red }
function Ok([string]$m)   { Write-Host ("  [OK]   " + $m) -ForegroundColor Green }

Write-Host "Verifying $Owner/$Repo @ $Branch"
Write-Host "1) Repository state (api.github.com)..."
try {
    $r = Invoke-RestMethod -Uri "https://api.github.com/repos/$Owner/$Repo" -Headers $h -TimeoutSec 20
    Ok ("repo exists, visibility=" + $r.visibility + ", default_branch=" + $r.default_branch)
    if ($r.visibility -ne 'public') { Fail 'repo is not public - one-click install will not work for others' }
    if ($r.default_branch -ne $Branch) { Fail ("default branch is " + $r.default_branch + " but commands use " + $Branch) }
    $c = Invoke-RestMethod -Uri "https://api.github.com/repos/$Owner/$Repo/contents/" -Headers $h -TimeoutSec 20
    $names = $c | ForEach-Object { $_.name }
    Ok ("root has: " + ($names -join ', '))
    foreach ($need in $RequiredRootFiles) {
        if ($names -notcontains $need) { Fail "missing $need in repo root" } else { Ok "$need present" }
    }
} catch { Fail ("api check failed: " + $_.Exception.Message) }

Write-Host "2) jsDelivr served install.ps1 vs local..."
$local = Join-Path $LocalDir 'install.ps1'
if (Test-Path $local) {
    $tmp = Join-Path $env:TEMP 'jsd-install.ps1'
    try {
        Invoke-WebRequest -UseBasicParsing "https://cdn.jsdelivr.net/gh/$Owner/$Repo@$Branch/install.ps1" -OutFile $tmp -TimeoutSec 30
        $h1 = (Get-FileHash $tmp).Hash
        $h2 = (Get-FileHash $local).Hash
        if ($h1 -eq $h2) { Ok "jsDelivr file is byte-identical to local ($h1)" }
        else { Fail "hash mismatch - jsDelivr serving stale/corrupt copy. Purge the cache and re-check." }
    } catch { Fail ("jsDelivr fetch failed: " + $_.Exception.Message) }
} else { Fail "local install.ps1 not found at $local" }

Write-Host "3) raw.githubusercontent.com (optional sanity)..."
try {
    $raw = Invoke-WebRequest -UseBasicParsing "https://raw.githubusercontent.com/$Owner/$Repo/$Branch/install.ps1" -TimeoutSec 15
    Ok ("raw reachable, " + $raw.Content.Length + " chars")
} catch {
    Write-Host ("  [INFO] raw not reachable from this network (" + $_.Exception.Message + ") - normal on some networks; jsDelivr is the fallback")
}

Write-Host ""
Write-Host "4) After EVERY future update, purge jsDelivr cache:"
Write-Host "   https://purge.jsdelivr.net/gh/$Owner/$Repo@$Branch" -ForegroundColor Cyan
if ($fail -gt 0) { Write-Host ("RESULT: $fail check(s) FAILED") -ForegroundColor Red; exit 1 }
else { Write-Host "RESULT: ALL CHECKS PASSED" -ForegroundColor Green; exit 0 }
