# Installs the lyt commands (lyt, yt3, yt4) onto your PATH and makes sure
# yt-dlp and ffmpeg are actually installed — winget first, then lyt's own
# managed download (checksum-verified, per-user, no admin rights needed).
#
# Safe to re-run: every step is skipped when it is already done.
#
# Run from anywhere:
#   powershell -ExecutionPolicy Bypass -File .\install\install.ps1

#Requires -Version 5
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

function Refresh-SessionPath {
    # Pick up PATH changes made by winget/installers without a new terminal.
    $machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $user = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machine;$user"
}

Write-Host "Installing lyt commands (lyt, yt3, yt4)..." -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js 20+ is required. Install it with: winget install OpenJS.NodeJS"
}

Push-Location $root
try {
    npm install -g .
    if ($LASTEXITCODE -ne 0) {
        Write-Error "npm install -g . failed (exit code $LASTEXITCODE)."
    }
} finally {
    Pop-Location
}

# ---------------------------------------------------------------------------
# yt-dlp / ffmpeg: install for real instead of just warning.
# ---------------------------------------------------------------------------

$tools = @(
    @{ Name = "yt-dlp"; WingetId = "yt-dlp.yt-dlp" },
    @{ Name = "ffmpeg"; WingetId = "Gyan.FFmpeg" }
)

$haveWinget = [bool](Get-Command winget -ErrorAction SilentlyContinue)
$needManaged = $false

foreach ($tool in $tools) {
    if (Get-Command $tool.Name -ErrorAction SilentlyContinue) {
        Write-Host "$($tool.Name) is already installed." -ForegroundColor Green
        continue
    }

    if ($haveWinget) {
        Write-Host "Installing $($tool.Name) with winget..." -ForegroundColor Cyan
        try {
            winget install --id $tool.WingetId -e --accept-source-agreements --accept-package-agreements
        } catch {
            Write-Warning "winget install of $($tool.Name) failed: $_"
        }
        Refresh-SessionPath
        if (Get-Command $tool.Name -ErrorAction SilentlyContinue) {
            continue
        }
    }

    $needManaged = $true
}

if ($needManaged) {
    # Fall back to lyt's managed download: official binaries fetched into
    # %LOCALAPPDATA%\lyt\bin (yt-dlp is checksum-verified). No admin needed.
    Write-Host "Falling back to lyt's managed download (per-user, no admin)..." -ForegroundColor Cyan
    node "$root\bin\lyt.js" doctor --fix

    $managedBin = Join-Path $env:LOCALAPPDATA "lyt\bin"
    if (Test-Path $managedBin) {
        # Put the managed dir on the *user* PATH so the tools work everywhere.
        $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
        if (($userPath -split ";") -notcontains $managedBin) {
            [Environment]::SetEnvironmentVariable("Path", "$userPath;$managedBin", "User")
            Write-Host "Added $managedBin to your user PATH." -ForegroundColor Green
        }
        Refresh-SessionPath
    }
}

# ---------------------------------------------------------------------------
# Verification
# ---------------------------------------------------------------------------

Write-Host ""
Write-Host "Verifying installed versions:" -ForegroundColor Cyan
Write-Host "  node    $(node --version)"

foreach ($tool in $tools) {
    $resolved = Get-Command $tool.Name -ErrorAction SilentlyContinue
    $exe = if ($resolved) { $tool.Name } else {
        $candidate = Join-Path $env:LOCALAPPDATA "lyt\bin\$($tool.Name).exe"
        if (Test-Path $candidate) { $candidate } else { $null }
    }

    if ($exe) {
        $version = (& $exe --version 2>$null | Select-Object -First 1)
        if ($tool.Name -eq "ffmpeg") { $version = ($version -replace "^ffmpeg version\s+", "") -split " " | Select-Object -First 1 }
        Write-Host "  $($tool.Name.PadRight(7)) $version"
    } else {
        Write-Warning "$($tool.Name) is still missing. Run: node `"$root\bin\lyt.js`" doctor --fix"
    }
}

Write-Host ""
Write-Host "Done. Try:" -ForegroundColor Green
Write-Host '  yt3 "https://www.youtube.com/watch?v=VIDEO_ID"   # audio'
Write-Host '  yt4 "https://www.youtube.com/watch?v=VIDEO_ID"   # video'
Write-Host '  yt3 --paste                                       # download from clipboard'
Write-Host ""
Write-Host "Optional: add right-click menu entries with:" -ForegroundColor Green
Write-Host "  powershell -ExecutionPolicy Bypass -File .\install\windows-context-menu.ps1"
