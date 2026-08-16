# restore.ps1 - Remove the "tavo-studio" DSH agent preset installed by install.ps1
#
# Usage (PowerShell):
#   China / CDN:   iwr -useb https://cdn.jsdelivr.net/gh/zjdjfjd764/tavo-studio@main/restore.ps1 | iex
#   International: iwr -useb https://raw.githubusercontent.com/zjdjfjd764/tavo-studio/main/restore.ps1 | iex
#
# KEEP THIS FILE PURE ASCII (English output).
param([switch]$Force)
$ErrorActionPreference = 'Stop'

$dshHome = if ($env:DSH_HOME -and $env:DSH_HOME.Trim() -ne '') { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
$dest = Join-Path (Join-Path $dshHome '.agent-presets') 'tavo-studio'

if (-not (Test-Path $dest)) {
    Write-Host 'The tavo-studio preset is not installed. Nothing to do.'
    exit 0
}
if (-not $Force) {
    $ans = Read-Host "Remove $dest ? [y/N]"
    if ($ans -notmatch '^[yY]') { Write-Host 'Aborted.'; exit 0 }
}
Remove-Item $dest -Recurse -Force
Write-Host 'DONE! tavo-studio preset removed. Restart DSH or refresh the agent preset picker.' -ForegroundColor Green
