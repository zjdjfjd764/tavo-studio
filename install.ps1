# install.ps1 - One-click installer for the "tavo-studio" DSH agent preset
#
# Usage (PowerShell):
#   China / CDN:     iwr -useb https://cdn.jsdelivr.net/gh/zjdjfjd764/tavo-studio@main/install.ps1 | iex
#   International:   iwr -useb https://raw.githubusercontent.com/zjdjfjd764/tavo-studio/main/install.ps1 | iex
# Or locally:        powershell -ExecutionPolicy Bypass -File .\install.ps1
#
# What it does:
#   1. Downloads the preset files (dual source: raw.githubusercontent.com, then
#      jsDelivr CDN fallback - raw is often blocked on mainland-China networks).
#   2. Installs them into <DSH_HOME>\.agent-presets\tavo-studio (DSH_HOME defaults
#      to %USERPROFILE%\.dsh). An existing copy is backed up first.
#   3. Asks for the workspace root where generated files will be saved, and
#      patches the @@WORKSPACE@@ placeholder in the installed files.
#
# KEEP THIS FILE PURE ASCII (English output) - it is fetched via iwr | iex and
# must parse correctly under every PowerShell codepage.
param(
    [string]$Workspace = '',
    [string]$ArkKey = '',
    [string]$VolinkImageKey = '',
    [string]$VolinkTtsKey = '',
    [switch]$Force
)
$ErrorActionPreference = 'Stop'

$Owner   = 'zjdjfjd764'
$Repo    = 'tavo-studio'
$Branch  = 'main'
$PresetId = 'tavo-studio'

# Two download bases; tried in order (raw first, jsDelivr CDN fallback).
$Bases = @(
    "https://raw.githubusercontent.com/$Owner/$Repo/$Branch",
    "https://cdn.jsdelivr.net/gh/$Owner/$Repo@$Branch"
)

function Get-File([string]$rel, [string]$out) {
    foreach ($b in $Bases) {
        try {
            Invoke-WebRequest -UseBasicParsing "$b/$rel" -OutFile $out -TimeoutSec 30
            Write-Host "  downloaded: $rel"
            return
        } catch {
            Write-Host "  source failed, trying next: $b"
        }
    }
    throw "Could not download $rel from any source."
}

# Preset payload files, relative to the repo root.
$Files = @(
    'tavo-studio/agent.cordis.yml',
    'tavo-studio/preset.yml',
    'tavo-studio/skills/tavo-roleplay-creator/SKILL.md',
    'tavo-studio/skills/tavo-roleplay-creator/docs/explicitness-guide.md',
    'tavo-studio/skills/tavo-roleplay-creator/docs/fields-macros.md',
    'tavo-studio/skills/tavo-roleplay-creator/docs/worldbook-patterns.md',
    'tavo-studio/skills/tavo-roleplay-creator/scripts/tavo_rpc.ps1',
    'tavo-studio/skills/tavo-roleplay-creator/scripts/make_args.py',
    'tavo-studio/skills/multimodal-tool/SKILL.md',
    'tavo-studio/skills/multimodal-tool/docs/multimodal_readme.md',
    'tavo-studio/skills/multimodal-tool/.env.template',
    'tavo-studio/skills/multimodal-tool/scripts/multimodal_tool.js'
)

# Locate the DSH user preset root.
$dshHome = if ($env:DSH_HOME -and $env:DSH_HOME.Trim() -ne '') { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
$destRoot = Join-Path $dshHome '.agent-presets'
$dest = Join-Path $destRoot $PresetId

Write-Host "Installing DSH agent preset '$PresetId' -> $dest"
if (Test-Path $dest) {
    if (-not $Force) {
        $ans = Read-Host "Preset already exists at $dest. Overwrite? [y/N]"
        if ($ans -notmatch '^[yY]') { Write-Host 'Aborted.'; exit 0 }
    }
    $bak = "${dest}.bak-" + (Get-Date -Format 'yyyyMMddHHmmss')
    Rename-Item $dest $bak
    Write-Host "Existing preset backed up to $bak"
}

# Ask for the workspace root (where generated character cards are saved).
if ($Workspace -eq '') {
    $def = Join-Path $env:USERPROFILE 'TavoStudio'
    $Workspace = Read-Host "Workspace root for generated files [default: $def]"
    if ($Workspace.Trim() -eq '') { $Workspace = $def }
}
$Workspace = $Workspace.TrimEnd('\')

Write-Host 'Downloading preset files...'
$tmp = Join-Path $env:TEMP ("tavo-studio-install-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
foreach ($f in $Files) {
    $out = Join-Path $tmp ($f -replace '/', '\')
    New-Item -ItemType Directory -Force -Path (Split-Path $out) | Out-Null
    Get-File $f $out
}

# Patch the workspace placeholder into the installed files.
$mmDir = Join-Path $dest 'skills\multimodal-tool'
foreach ($rel in @(
    'tavo-studio\agent.cordis.yml',
    'tavo-studio\preset.yml',
    'tavo-studio\skills\tavo-roleplay-creator\SKILL.md'
)) {
    $p = Join-Path $tmp $rel
    $c = Get-Content -LiteralPath $p -Raw -Encoding UTF8
    $c = $c.Replace('@@WORKSPACE@@', $Workspace)
    [System.IO.File]::WriteAllText($p, $c, (New-Object System.Text.UTF8Encoding($false)))
}

# Patch the bundled multimodal-tool skill directory into its docs.
foreach ($rel in @(
    'tavo-studio\skills\multimodal-tool\SKILL.md',
    'tavo-studio\skills\multimodal-tool\docs\multimodal_readme.md'
)) {
    $p = Join-Path $tmp $rel
    $c = Get-Content -LiteralPath $p -Raw -Encoding UTF8
    $c = $c.Replace('@@MM_DIR@@', $mmDir)
    [System.IO.File]::WriteAllText($p, $c, (New-Object System.Text.UTF8Encoding($false)))
}

# Move the patched payload into place.
Copy-Item -Path (Join-Path $tmp 'tavo-studio') -Destination $dest -Recurse -Force

# Create .env for the bundled multimodal-tool skill (keep an existing one).
$envPath = Join-Path $mmDir '.env'
if (Test-Path $envPath) {
    Write-Host ".env already exists - keeping it: $envPath"
} else {
    Copy-Item (Join-Path $tmp 'tavo-studio\skills\multimodal-tool\.env.template') $envPath
    if (-not $ArkKey) { $ArkKey = Read-Host 'ARK_API_KEY (Doubao/Volcengine vision; Enter to skip)' }
    if (-not $VolinkImageKey) { $VolinkImageKey = Read-Host 'VOLINK_IMAGE_API_KEY (Enter to skip)' }
    if (-not $VolinkTtsKey) { $VolinkTtsKey = Read-Host 'VOLINK_TTS_API_KEY (Enter to skip)' }
    function Set-EnvValue([string]$path, [string]$key, [string]$value) {
        $lines = Get-Content -LiteralPath $path
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match "^$key=") { $lines[$i] = "$key=$value" }
        }
        [System.IO.File]::WriteAllLines($path, $lines, (New-Object System.Text.UTF8Encoding($false)))
    }
    if ($ArkKey) { Set-EnvValue $envPath 'ARK_API_KEY' $ArkKey }
    if ($VolinkImageKey) { Set-EnvValue $envPath 'VOLINK_IMAGE_API_KEY' $VolinkImageKey }
    if ($VolinkTtsKey) { Set-EnvValue $envPath 'VOLINK_TTS_API_KEY' $VolinkTtsKey }
    Write-Host "API keys saved to $envPath (edit this file to change them later)."
}

Remove-Item $tmp -Recurse -Force

Write-Host ''
Write-Host 'DONE! Installed.' -ForegroundColor Green
Write-Host ''
Write-Host 'Notes:'
Write-Host "  1. Preset id: $PresetId  (folder: $dest)"
Write-Host "  2. Workspace for generated files: $Workspace"
Write-Host '  3. The "multimodal-tool" skill (video/image analysis) is bundled.'
Write-Host "     Its API keys live in: $envPath"
Write-Host '     Fill in ARK_API_KEY / VOLINK_IMAGE_API_KEY / VOLINK_TTS_API_KEY there.'
Write-Host '  4. You also need a running Tavo MCP server; the agent will ask for its URL/token.'
Write-Host '  5. In DSH, start a new session and pick the installed "tavo-studio" preset'
Write-Host '     (or restart DSH so the preset list refreshes).'
Write-Host ''
Write-Host ('To uninstall later: iwr -useb ' + $Bases[0] + '/restore.ps1 | iex')
