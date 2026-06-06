# Installs the ytgrab commands (ytgrab, yt3, yt4) onto your PATH.
#
# Run from anywhere:
#   powershell -ExecutionPolicy Bypass -File .\install\install.ps1

#Requires -Version 5
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

Write-Host "Installing ytgrab commands (ytgrab, yt3, yt4)..." -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js 20+ is required. Install it with: winget install OpenJS.NodeJS"
}

Push-Location $root
try {
    npm install -g .
} finally {
    Pop-Location
}

foreach ($tool in @("yt-dlp", "ffmpeg")) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        Write-Warning "$tool was not found on PATH. Downloads need it."
        if ($tool -eq "yt-dlp") {
            Write-Host "  Install with: winget install yt-dlp.yt-dlp" -ForegroundColor Yellow
        } else {
            Write-Host "  Install ffmpeg and make sure it is on PATH (needed for --mp3 and video muxing)." -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "Done. Open a new terminal, then try:" -ForegroundColor Green
Write-Host '  yt3 "https://www.youtube.com/watch?v=VIDEO_ID"   # audio'
Write-Host '  yt4 "https://www.youtube.com/watch?v=VIDEO_ID"   # video'
Write-Host ""
Write-Host "Optional: add right-click menu entries with:" -ForegroundColor Green
Write-Host "  powershell -ExecutionPolicy Bypass -File .\install\windows-context-menu.ps1"
