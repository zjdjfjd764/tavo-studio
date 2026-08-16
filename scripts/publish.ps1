# publish.ps1 - Maintainer helper: push this repository to GitHub.
#
# Run this in a NORMAL terminal where github.com is reachable (not in the DSH
# sandbox); Git Credential Manager will ask you to sign in on first push.
#
# Prerequisite: create an EMPTY public repo named "tavo-studio" first:
#   https://github.com/new  ->  Repository name: tavo-studio
#   Visibility: Public  ->  do NOT add README/.gitignore/LICENSE (leave empty)
#
# Usage: powershell -ExecutionPolicy Bypass -File .\scripts\publish.ps1
$ErrorActionPreference = 'Stop'

$Owner  = 'zjdjfjd764'
$Repo   = 'tavo-studio'
$Branch = 'main'
$remote = "https://github.com/$Owner/$Repo.git"

if (-not (Test-Path '.git')) {
    Write-Host 'Initializing git repository...'
    git init -b $Branch
    git config user.name  $Owner
    git config user.email "$Owner@users.noreply.github.com"
}

if (git remote | Select-String -Quiet '^origin$') {
    git remote set-url origin $remote
} else {
    git remote add origin $remote
}

git add -A
$changed = git status --porcelain
if ($changed) {
    git commit -m "Publish $Repo - DSH agent preset (video link -> Tavo character card workflow)"
} else {
    Write-Host 'No changes to commit.'
}

Write-Host 'Pushing...'
git push -u origin $Branch 2>&1 | ForEach-Object { $_ }
if ($LASTEXITCODE -ne 0) {
    Write-Host 'Push rejected (the remote may have an initial commit). Merging remote history and retrying...'
    git fetch origin $Branch
    git merge "origin/$Branch" --allow-unrelated-histories -X ours -m 'Merge remote initial commit (keep local files)'
    git push -u origin $Branch
    if ($LASTEXITCODE -ne 0) { throw 'Push failed after merge. Check credentials and remote state.' }
}

Write-Host ''
Write-Host 'PUSHED OK. Now purge the jsDelivr cache:' -ForegroundColor Cyan
Write-Host "  https://purge.jsdelivr.net/gh/$Owner/$Repo@$Branch"
Write-Host 'Then verify:'
Write-Host "  powershell -ExecutionPolicy Bypass -File .\scripts\verify-release.ps1 -Owner $Owner -Repo $Repo -Branch $Branch -LocalDir ."
